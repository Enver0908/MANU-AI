import Stripe from "stripe";
import type { CommercialEntitlementStatus } from "./phase-83b-commercial-entitlement-model";
import {
  evaluateCommercialDashboardAccess,
  transitionCommercialEntitlement,
} from "./phase-83b-commercial-entitlement-model";

export const PHASE_83C_VERSION = "phase83-stripe-billing-gate-v1";

export const PHASE_83C_HANDLED_STRIPE_EVENTS = [
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

export type Phase83cHandledStripeEvent = (typeof PHASE_83C_HANDLED_STRIPE_EVENTS)[number];

export const DEFAULT_CHECKOUT_WINDOW_MINUTES = 30;

export type StripeBillingConfig = {
  enabled: boolean;
  sandboxOnly: true;
  secretKey: string | null;
  webhookSecret: string | null;
  priceId: string | null;
  appUrl: string | null;
  blockingReasons: string[];
};

export type CheckoutEligibilityInput = {
  inviteFound: boolean;
  inviteEligibilityBlockingReasons: string[];
  existingCheckoutSessionId?: string | null;
  existingCheckoutStartedAt?: string | null;
  checkoutWindowMinutes?: number;
  now?: string;
};

export type CheckoutEligibilityResult = {
  allowed: boolean;
  reuseExistingSession: boolean;
  existingCheckoutSessionId: string | null;
  blockingReasons: string[];
};

export type StripeCheckoutSessionRequest = {
  normalizedEmail: string;
  commercialInviteId: string;
  successUrl: string;
  cancelUrl: string;
};

export type StripeCheckoutSessionResult = {
  sessionId: string;
  checkoutUrl: string;
};

export type StripeBillingPortalRequest = {
  stripeCustomerId: string;
  returnUrl: string;
};

export type StripeBillingPortalResult = {
  portalUrl: string;
};

export type StripeWebhookProcessInput = {
  event: Stripe.Event;
  existingLedgerStripeEventId?: string | null;
};

export type StripeWebhookProcessResult = {
  duplicate: boolean;
  handled: boolean;
  eventType: string;
  tenantId: string | null;
  commercialInviteId: string | null;
  entitlementStatus: CommercialEntitlementStatus | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  checkoutSessionId: string | null;
  consumeInvite: boolean;
  payloadSummary: Record<string, unknown>;
  blockingReasons: string[];
};

export type StripeBillingClient = {
  createCheckoutSession: (input: StripeCheckoutSessionRequest) => Promise<StripeCheckoutSessionResult>;
  retrieveCheckoutSession: (sessionId: string) => Promise<StripeCheckoutSessionResult>;
  createBillingPortalSession: (input: StripeBillingPortalRequest) => Promise<StripeBillingPortalResult>;
  cancelSubscription: (subscriptionId: string) => Promise<{ subscriptionId: string; status: string }>;
  constructWebhookEvent: (payload: string, signature: string) => Stripe.Event;
};

export function resolveStripeBillingConfig(env: NodeJS.ProcessEnv = process.env): StripeBillingConfig {
  const blockingReasons: string[] = [];
  const enabled = env.MANU_ALLOW_STRIPE_SANDBOX === "true";
  const secretKey = env.STRIPE_SECRET_KEY?.trim() || null;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim() || null;
  const priceId = env.STRIPE_PRICE_ID?.trim() || null;
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim() || null;

  if (!enabled) {
    blockingReasons.push("stripe sandbox gate is disabled");
  }
  if (!secretKey) {
    blockingReasons.push("STRIPE_SECRET_KEY is missing");
  } else if (secretKey.startsWith("sk_live_")) {
    blockingReasons.push("live Stripe secret keys are blocked in Phase 83C");
  } else if (!secretKey.startsWith("sk_test_")) {
    blockingReasons.push("STRIPE_SECRET_KEY must be a sandbox test key");
  }
  if (!webhookSecret) {
    blockingReasons.push("STRIPE_WEBHOOK_SECRET is missing");
  }
  if (!priceId) {
    blockingReasons.push("STRIPE_PRICE_ID is missing");
  }
  if (!appUrl) {
    blockingReasons.push("NEXT_PUBLIC_APP_URL is missing");
  }

  return {
    enabled,
    sandboxOnly: true,
    secretKey,
    webhookSecret,
    priceId,
    appUrl,
    blockingReasons,
  };
}

export function isStripeBillingConfigured(config: StripeBillingConfig = resolveStripeBillingConfig()) {
  return config.blockingReasons.length === 0;
}

export function createStripeBillingClient(config: StripeBillingConfig): StripeBillingClient {
  if (!isStripeBillingConfigured(config) || !config.secretKey || !config.webhookSecret || !config.priceId) {
    throw new Error("stripe_billing_not_configured");
  }

  const stripe = new Stripe(config.secretKey, {
    apiVersion: "2025-08-27.basil",
  });

  return {
    async createCheckoutSession(input) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: input.normalizedEmail,
        line_items: [{ price: config.priceId!, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          commercial_invite_id: input.commercialInviteId,
          normalized_email: input.normalizedEmail,
        },
      });

      if (!session.url || !session.id) {
        throw new Error("stripe_checkout_session_missing_url");
      }

      return {
        sessionId: session.id,
        checkoutUrl: session.url,
      };
    },
    async retrieveCheckoutSession(sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (!session.url || !session.id) {
        throw new Error("stripe_checkout_session_missing_url");
      }
      return {
        sessionId: session.id,
        checkoutUrl: session.url,
      };
    },
    async createBillingPortalSession(input) {
      const session = await stripe.billingPortal.sessions.create({
        customer: input.stripeCustomerId,
        return_url: input.returnUrl,
      });

      if (!session.url) {
        throw new Error("stripe_billing_portal_missing_url");
      }

      return { portalUrl: session.url };
    },
    async cancelSubscription(subscriptionId) {
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      return {
        subscriptionId: subscription.id,
        status: subscription.status,
      };
    },
    constructWebhookEvent(payload, signature) {
      return stripe.webhooks.constructEvent(payload, signature, config.webhookSecret!);
    },
  };
}

export function evaluateCheckoutEligibility(input: CheckoutEligibilityInput): CheckoutEligibilityResult {
  const blockingReasons = [...input.inviteEligibilityBlockingReasons];

  if (!input.inviteFound) {
    blockingReasons.push("invite not found for email");
  }

  const uniqueReasons = [...new Set(blockingReasons)];
  if (uniqueReasons.length > 0) {
    return {
      allowed: false,
      reuseExistingSession: false,
      existingCheckoutSessionId: null,
      blockingReasons: uniqueReasons,
    };
  }

  const windowMinutes = input.checkoutWindowMinutes ?? DEFAULT_CHECKOUT_WINDOW_MINUTES;
  const nowMs = new Date(input.now ?? new Date().toISOString()).getTime();
  const startedAtMs = input.existingCheckoutStartedAt
    ? new Date(input.existingCheckoutStartedAt).getTime()
    : null;
  const reuseExistingSession = Boolean(
    input.existingCheckoutSessionId &&
      startedAtMs &&
      nowMs - startedAtMs <= windowMinutes * 60_000,
  );

  return {
    allowed: true,
    reuseExistingSession,
    existingCheckoutSessionId: input.existingCheckoutSessionId ?? null,
    blockingReasons: [],
  };
}

export function mapStripeSubscriptionStatusToEntitlement(
  status: string | null | undefined,
): CommercialEntitlementStatus | null {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return null;
  }
}

function readStripeCustomerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) {
  if (typeof value === "string") {
    return value;
  }
  return value?.id ?? null;
}

function readInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const legacy = (invoice as Stripe.Invoice & {
    subscription?: string | { id?: string } | null;
  }).subscription;
  if (typeof legacy === "string") {
    return legacy;
  }
  if (legacy && typeof legacy === "object" && legacy.id) {
    return legacy.id;
  }

  const parent = (invoice as Stripe.Invoice & {
    parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
  }).parent;
  const subscription = parent?.subscription_details?.subscription;
  if (typeof subscription === "string") {
    return subscription;
  }
  if (subscription && typeof subscription === "object" && subscription.id) {
    return subscription.id;
  }

  return null;
}

function readMetadataString(metadata: Stripe.Metadata | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function summarizeStripeObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }
  const record = value as Record<string, unknown>;
  return {
    id: typeof record.id === "string" ? record.id : null,
    status: typeof record.status === "string" ? record.status : null,
    customer:
      typeof record.customer === "string"
        ? record.customer
        : typeof record.customer === "object" && record.customer && "id" in record.customer
          ? String((record.customer as { id?: string }).id ?? "")
          : null,
    subscription:
      typeof record.subscription === "string"
        ? record.subscription
        : typeof record.subscription === "object" && record.subscription && "id" in record.subscription
          ? String((record.subscription as { id?: string }).id ?? "")
          : null,
  };
}

export function processStripeBillingWebhookEvent(
  input: StripeWebhookProcessInput,
): StripeWebhookProcessResult {
  if (input.existingLedgerStripeEventId === input.event.id) {
    return {
      duplicate: true,
      handled: false,
      eventType: input.event.type,
      tenantId: null,
      commercialInviteId: null,
      entitlementStatus: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      checkoutSessionId: null,
      consumeInvite: false,
      payloadSummary: { duplicate: true },
      blockingReasons: [],
    };
  }

  if (!PHASE_83C_HANDLED_STRIPE_EVENTS.includes(input.event.type as Phase83cHandledStripeEvent)) {
    return {
      duplicate: false,
      handled: false,
      eventType: input.event.type,
      tenantId: null,
      commercialInviteId: null,
      entitlementStatus: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      checkoutSessionId: null,
      consumeInvite: false,
      payloadSummary: { ignored: true },
      blockingReasons: ["unsupported stripe event type"],
    };
  }

  const base = {
    duplicate: false,
    handled: true,
    eventType: input.event.type,
    blockingReasons: [] as string[],
    consumeInvite: false,
  };

  if (input.event.type === "checkout.session.completed") {
    const session = input.event.data.object as Stripe.Checkout.Session;
    const commercialInviteId = readMetadataString(session.metadata, "commercial_invite_id");
    const normalizedEmail = readMetadataString(session.metadata, "normalized_email");
    const stripeCustomerId = readStripeCustomerId(session.customer);
    const stripeSubscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id ?? null;

    return {
      ...base,
      tenantId: null,
      commercialInviteId,
      entitlementStatus: "active",
      stripeCustomerId,
      stripeSubscriptionId,
      checkoutSessionId: session.id,
      consumeInvite: true,
      payloadSummary: {
        ...summarizeStripeObject(session),
        normalizedEmail,
      },
    };
  }

  if (input.event.type === "invoice.paid") {
    const invoice = input.event.data.object as Stripe.Invoice;
    const stripeCustomerId = readStripeCustomerId(invoice.customer);
    const stripeSubscriptionId = readInvoiceSubscriptionId(invoice);

    return {
      ...base,
      tenantId: null,
      commercialInviteId: null,
      entitlementStatus: "active",
      stripeCustomerId,
      stripeSubscriptionId,
      checkoutSessionId: null,
      payloadSummary: summarizeStripeObject(invoice),
    };
  }

  if (input.event.type === "invoice.payment_failed") {
    const invoice = input.event.data.object as Stripe.Invoice;
    const stripeCustomerId = readStripeCustomerId(invoice.customer);
    const stripeSubscriptionId = readInvoiceSubscriptionId(invoice);

    return {
      ...base,
      tenantId: null,
      commercialInviteId: null,
      entitlementStatus: "past_due",
      stripeCustomerId,
      stripeSubscriptionId,
      checkoutSessionId: null,
      payloadSummary: summarizeStripeObject(invoice),
    };
  }

  if (input.event.type === "customer.subscription.updated") {
    const subscription = input.event.data.object as Stripe.Subscription;
    const entitlementStatus = mapStripeSubscriptionStatusToEntitlement(subscription.status);
    const stripeCustomerId = readStripeCustomerId(subscription.customer);

    return {
      ...base,
      tenantId: null,
      commercialInviteId: null,
      entitlementStatus,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      checkoutSessionId: null,
      payloadSummary: summarizeStripeObject(subscription),
      blockingReasons: entitlementStatus ? [] : ["unsupported subscription status"],
      handled: Boolean(entitlementStatus),
    };
  }

  const subscription = input.event.data.object as Stripe.Subscription;
  const stripeCustomerId = readStripeCustomerId(subscription.customer);

  return {
    ...base,
    tenantId: null,
    commercialInviteId: null,
    entitlementStatus: "canceled",
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    checkoutSessionId: null,
    payloadSummary: summarizeStripeObject(subscription),
  };
}

export function evaluateBillingPortalAccess(input: {
  isAuthenticated: boolean;
  hasTenantMembership: boolean;
  hasDietitianProfile: boolean;
  entitlementStatus: CommercialEntitlementStatus | null;
  stripeCustomerId: string | null;
  role?: string | null;
}) {
  if (input.role != null && input.role !== "owner" && input.role !== "admin") {
    return { allowed: false, blockingReasons: ["billing_portal_role_forbidden"] };
  }

  const dashboard = evaluateCommercialDashboardAccess({
    isAuthenticated: input.isAuthenticated,
    hasTenantMembership: input.hasTenantMembership,
    hasDietitianProfile: input.hasDietitianProfile,
    entitlementStatus: input.entitlementStatus,
  });

  const blockingReasons = [...dashboard.blockingReasons];
  if (!input.stripeCustomerId) {
    blockingReasons.push("stripe customer mapping required");
  }

  return {
    allowed: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function canApplyEntitlementTransition(input: {
  currentStatus: CommercialEntitlementStatus | null;
  nextStatus: CommercialEntitlementStatus;
}) {
  if (!input.currentStatus) {
    return { allowed: true, blockingReasons: [] as string[] };
  }
  const transition = transitionCommercialEntitlement({
    fromStatus: input.currentStatus,
    toStatus: input.nextStatus,
  });
  return {
    allowed: transition.allowed || input.currentStatus === input.nextStatus,
    blockingReasons: transition.blockingReasons,
  };
}

export function summarizePhase83cStripeBillingGate(config: StripeBillingConfig = resolveStripeBillingConfig()) {
  return {
    phase83cVersion: PHASE_83C_VERSION,
    sandboxOnly: true,
    configured: isStripeBillingConfigured(config),
    handledEvents: [...PHASE_83C_HANDLED_STRIPE_EVENTS],
    checkoutWindowMinutes: DEFAULT_CHECKOUT_WINDOW_MINUTES,
    blockingReasonCount: config.blockingReasons.length,
  };
}

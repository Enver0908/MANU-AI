import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import {
  evaluateBillingPortalAccess,
  evaluateCheckoutEligibility,
  mapStripeSubscriptionStatusToEntitlement,
  processStripeBillingWebhookEvent,
  resolveStripeBillingConfig,
  summarizePhase83cStripeBillingGate,
} from "./phase-83c-stripe-billing-gate";

const NOW = "2026-07-01T12:00:00.000Z";

function buildEvent(type: string, object: Record<string, unknown>, id = "evt_test_1"): Stripe.Event {
  return {
    id,
    type,
    data: { object },
  } as Stripe.Event;
}

describe("phase 83c stripe billing gate", () => {
  it("requires sandbox gate and rejects live Stripe keys", () => {
    const blocked = resolveStripeBillingConfig({
      MANU_ALLOW_STRIPE_SANDBOX: "true",
      STRIPE_SECRET_KEY: "sk_live_blocked",
      STRIPE_WEBHOOK_SECRET: "whsec_test",
      STRIPE_PRICE_ID: "price_test",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
    } as NodeJS.ProcessEnv);

    expect(blocked.blockingReasons).toContain("live Stripe secret keys are blocked in Phase 83C");

    const configured = resolveStripeBillingConfig({
      MANU_ALLOW_STRIPE_SANDBOX: "true",
      STRIPE_SECRET_KEY: "sk_test_sandbox",
      STRIPE_WEBHOOK_SECRET: "whsec_test",
      STRIPE_PRICE_ID: "price_test",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
    } as NodeJS.ProcessEnv);

    expect(configured.blockingReasons).toEqual([]);
  });

  it("blocks checkout for unapproved invite eligibility", () => {
    const result = evaluateCheckoutEligibility({
      inviteFound: false,
      inviteEligibilityBlockingReasons: ["invite not found for email"],
      now: NOW,
    });

    expect(result.allowed).toBe(false);
    expect(result.blockingReasons).toContain("invite not found for email");
  });

  it("reuses an active checkout session inside the checkout window", () => {
    const result = evaluateCheckoutEligibility({
      inviteFound: true,
      inviteEligibilityBlockingReasons: [],
      existingCheckoutSessionId: "cs_test_123",
      existingCheckoutStartedAt: "2026-07-01T11:45:00.000Z",
      now: NOW,
    });

    expect(result.allowed).toBe(true);
    expect(result.reuseExistingSession).toBe(true);
    expect(result.existingCheckoutSessionId).toBe("cs_test_123");
  });

  it("treats duplicate webhook events as idempotent", () => {
    const event = buildEvent("checkout.session.completed", {
      id: "cs_test_123",
      customer: "cus_test_1",
      subscription: "sub_test_1",
      metadata: {
        commercial_invite_id: "invite-1",
        normalized_email: "dietitian@example.com",
      },
    });

    const processed = processStripeBillingWebhookEvent({
      event,
      existingLedgerStripeEventId: "evt_test_1",
    });

    expect(processed.duplicate).toBe(true);
    expect(processed.handled).toBe(false);
  });

  it("maps checkout.session.completed to active entitlement provisioning", () => {
    const processed = processStripeBillingWebhookEvent({
      event: buildEvent("checkout.session.completed", {
        id: "cs_test_123",
        customer: "cus_test_1",
        subscription: "sub_test_1",
        metadata: {
          commercial_invite_id: "invite-1",
          normalized_email: "dietitian@example.com",
        },
      }),
    });

    expect(processed.handled).toBe(true);
    expect(processed.entitlementStatus).toBe("active");
    expect(processed.commercialInviteId).toBe("invite-1");
    expect(processed.consumeInvite).toBe(true);
    expect(processed.stripeCustomerId).toBe("cus_test_1");
  });

  it("maps invoice.payment_failed to past_due and subscription.deleted to canceled", () => {
    const failed = processStripeBillingWebhookEvent({
      event: buildEvent("invoice.payment_failed", {
        id: "in_test_1",
        customer: "cus_test_1",
        subscription: "sub_test_1",
      }),
    });
    expect(failed.entitlementStatus).toBe("past_due");

    const deleted = processStripeBillingWebhookEvent({
      event: buildEvent("customer.subscription.deleted", {
        id: "sub_test_1",
        customer: "cus_test_1",
        status: "canceled",
      }),
    });
    expect(deleted.entitlementStatus).toBe("canceled");
  });

  it("maps subscription status values for entitlement updates", () => {
    expect(mapStripeSubscriptionStatusToEntitlement("active")).toBe("active");
    expect(mapStripeSubscriptionStatusToEntitlement("past_due")).toBe("past_due");
    expect(mapStripeSubscriptionStatusToEntitlement("canceled")).toBe("canceled");
  });

  it("requires active entitlement and stripe customer for billing portal access", () => {
    const blocked = evaluateBillingPortalAccess({
      isAuthenticated: true,
      hasTenantMembership: true,
      hasDietitianProfile: true,
      entitlementStatus: "past_due",
      stripeCustomerId: "cus_test_1",
      role: "owner",
    });
    expect(blocked.allowed).toBe(false);

    const allowed = evaluateBillingPortalAccess({
      isAuthenticated: true,
      hasTenantMembership: true,
      hasDietitianProfile: true,
      entitlementStatus: "active",
      stripeCustomerId: "cus_test_1",
      role: "owner",
    });
    expect(allowed.allowed).toBe(true);
  });

  it("blocks billing portal for non-owner/admin roles", () => {
    for (const role of ["dietitian", "assistant", "auditor"] as const) {
      const result = evaluateBillingPortalAccess({
        isAuthenticated: true,
        hasTenantMembership: true,
        hasDietitianProfile: true,
        entitlementStatus: "active",
        stripeCustomerId: "cus_test_1",
        role,
      });
      expect(result.allowed).toBe(false);
      expect(result.blockingReasons).toContain("billing_portal_role_forbidden");
    }
  });

  it("allows owner and admin roles when entitlement and stripe customer are valid", () => {
    for (const role of ["owner", "admin"] as const) {
      const result = evaluateBillingPortalAccess({
        isAuthenticated: true,
        hasTenantMembership: true,
        hasDietitianProfile: true,
        entitlementStatus: "active",
        stripeCustomerId: "cus_test_1",
        role,
      });
      expect(result.allowed).toBe(true);
    }
  });

  it("summarizes sandbox-only billing gate without secrets", () => {
    const summary = summarizePhase83cStripeBillingGate({
      enabled: true,
      sandboxOnly: true,
      secretKey: "sk_test_sandbox",
      webhookSecret: "whsec_test",
      priceId: "price_test",
      appUrl: "http://127.0.0.1:3000",
      blockingReasons: [],
    });

    expect(summary.configured).toBe(true);
    expect(summary.sandboxOnly).toBe(true);
    expect(JSON.stringify(summary)).not.toContain("sk_test_sandbox");
    expect(JSON.stringify(summary)).not.toContain("whsec_test");
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase";
import {
  type BillingCustomer,
  type BillingEventLedgerEntry,
  type CommercialBillingMethod,
  type CommercialEntitlementStatus,
  type CommercialInvite,
  type CommercialInviteStatus,
  type TenantEntitlement,
  normalizeCommercialEmail,
  transitionCommercialEntitlement,
} from "./phase-83b-commercial-entitlement-model";
import { hashCommercialInviteToken, matchesCommercialInviteToken } from "./phase-83b-commercial-entitlement-model.server";

export type CommercialInviteRow = {
  id: string;
  normalized_email: string;
  invite_token_hash: string;
  status: CommercialInviteStatus;
  tenant_seed_metadata: Record<string, unknown>;
  tenant_id: string | null;
  checkout_session_id: string | null;
  checkout_started_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TenantEntitlementRow = {
  id: string;
  tenant_id: string;
  commercial_invite_id: string | null;
  status: CommercialEntitlementStatus;
  billing_method?: CommercialBillingMethod | null;
  paid_through?: string | null;
  revision?: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  checkout_session_id: string | null;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
};

function mapInvite(row: CommercialInviteRow): CommercialInvite & {
  checkoutSessionId: string | null;
  checkoutStartedAt: string | null;
} {
  return {
    id: row.id,
    normalizedEmail: row.normalized_email,
    inviteTokenHash: row.invite_token_hash,
    status: row.status,
    tenantSeedMetadata: row.tenant_seed_metadata ?? {},
    tenantId: row.tenant_id,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    checkoutSessionId: row.checkout_session_id,
    checkoutStartedAt: row.checkout_started_at,
  };
}

function mapEntitlement(row: TenantEntitlementRow): TenantEntitlement {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    commercialInviteId: row.commercial_invite_id,
    status: row.status,
    billingMethod: row.billing_method ?? "stripe",
    paidThrough: row.paid_through ?? null,
    revision: row.revision ?? 0,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    checkoutSessionId: row.checkout_session_id,
    statusChangedAt: row.status_changed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isCommercialBillingStoreConfigured() {
  return getSupabaseAdminClient() !== null;
}

export async function loadCommercialInviteByEmail(
  admin: SupabaseClient,
  email: string,
) {
  const normalizedEmail = normalizeCommercialEmail(email);
  const { data, error } = await admin
    .from("commercial_invites")
    .select("*")
    .eq("normalized_email", normalizedEmail)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? mapInvite(data as CommercialInviteRow) : null;
}

export async function loadCommercialInviteById(admin: SupabaseClient, inviteId: string) {
  const { data, error } = await admin
    .from("commercial_invites")
    .select("*")
    .eq("id", inviteId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? mapInvite(data as CommercialInviteRow) : null;
}

export async function loadTenantEntitlementByTenantId(admin: SupabaseClient, tenantId: string) {
  const { data, error } = await admin
    .from("tenant_entitlements")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? mapEntitlement(data as TenantEntitlementRow) : null;
}

export async function loadBillingCustomerByTenantId(admin: SupabaseClient, tenantId: string) {
  const { data, error } = await admin
    .from("billing_customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return {
    id: data.id,
    tenantId: data.tenant_id,
    commercialInviteId: data.commercial_invite_id,
    normalizedEmail: data.normalized_email,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } satisfies BillingCustomer;
}

export async function loadBillingLedgerEntryByStripeEventId(
  admin: SupabaseClient,
  stripeEventId: string,
) {
  const { data, error } = await admin
    .from("billing_event_ledger")
    .select("*")
    .eq("stripe_event_id", stripeEventId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return {
    id: data.id,
    stripeEventId: data.stripe_event_id,
    eventType: data.event_type,
    tenantId: data.tenant_id,
    idempotencyKey: data.idempotency_key,
    payloadSummary: data.payload_summary ?? {},
    processedAt: data.processed_at,
    createdAt: data.created_at,
  } satisfies BillingEventLedgerEntry;
}

export async function markCommercialInviteCheckoutStarted(
  admin: SupabaseClient,
  input: {
    inviteId: string;
    checkoutSessionId: string;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const { error } = await admin
    .from("commercial_invites")
    .update({
      checkout_session_id: input.checkoutSessionId,
      checkout_started_at: now,
      updated_at: now,
    })
    .eq("id", input.inviteId);

  if (error) {
    throw error;
  }
}

export async function ensureTenantEntitlementCheckoutStarted(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    commercialInviteId: string;
    checkoutSessionId: string;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const existing = await loadTenantEntitlementByTenantId(admin, input.tenantId);

  if (!existing) {
    const { error } = await admin.from("tenant_entitlements").insert({
      tenant_id: input.tenantId,
      commercial_invite_id: input.commercialInviteId,
      status: "checkout_started",
      checkout_session_id: input.checkoutSessionId,
      status_changed_at: now,
      created_at: now,
      updated_at: now,
    });
    if (error) {
      throw error;
    }
    return;
  }

  const transition = transitionCommercialEntitlement({
    fromStatus: existing.status,
    toStatus: "checkout_started",
  });
  if (!transition.allowed && existing.status !== "checkout_started") {
    throw new Error(transition.blockingReasons[0] ?? "checkout_transition_blocked");
  }

  const { error } = await admin
    .from("tenant_entitlements")
    .update({
      commercial_invite_id: input.commercialInviteId,
      status: "checkout_started",
      checkout_session_id: input.checkoutSessionId,
      status_changed_at: now,
      updated_at: now,
    })
    .eq("tenant_id", input.tenantId);

  if (error) {
    throw error;
  }
}

export async function provisionTenantForCommercialInvite(
  admin: SupabaseClient,
  input: {
    invite: CommercialInvite & { checkoutSessionId?: string | null };
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  if (input.invite.tenantId) {
    return input.invite.tenantId;
  }

  const tenantName =
    typeof input.invite.tenantSeedMetadata.tenantName === "string" &&
    input.invite.tenantSeedMetadata.tenantName.trim()
      ? input.invite.tenantSeedMetadata.tenantName.trim()
      : `MANU Tenant ${input.invite.normalizedEmail}`;

  const tenantId = crypto.randomUUID();
  const { error: tenantError } = await admin.from("tenants").insert({
    id: tenantId,
    name: tenantName,
    created_at: now,
  });
  if (tenantError) {
    throw tenantError;
  }

  const { error: inviteError } = await admin
    .from("commercial_invites")
    .update({
      tenant_id: tenantId,
      updated_at: now,
    })
    .eq("id", input.invite.id);
  if (inviteError) {
    throw inviteError;
  }

  return tenantId;
}

export async function applyCommercialEntitlementStatus(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    commercialInviteId: string | null;
    fromStatus: CommercialEntitlementStatus | null;
    toStatus: CommercialEntitlementStatus;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    checkoutSessionId?: string | null;
    billingMethod?: CommercialBillingMethod;
    paidThrough?: string | null;
    expectedRevision?: number | null;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const existing = await loadTenantEntitlementByTenantId(admin, input.tenantId);
  const currentStatus = existing?.status ?? input.fromStatus ?? "invited";

  if (existing) {
    if (
      input.expectedRevision !== undefined &&
      input.expectedRevision !== null &&
      existing.revision !== input.expectedRevision
    ) {
      throw new Error("entitlement_revision_conflict");
    }

    const transition = transitionCommercialEntitlement({
      fromStatus: currentStatus,
      toStatus: input.toStatus,
    });
    const manualActivationAllowed =
      input.billingMethod === "manual_transfer" &&
      input.toStatus === "active" &&
      (currentStatus === "invited" || currentStatus === "checkout_started");
    if (!transition.allowed && currentStatus !== input.toStatus && !manualActivationAllowed) {
      throw new Error(transition.blockingReasons[0] ?? "entitlement_transition_blocked");
    }

    const { error } = await admin
      .from("tenant_entitlements")
      .update({
        commercial_invite_id: input.commercialInviteId ?? existing.commercialInviteId,
        status: input.toStatus,
        stripe_customer_id: input.stripeCustomerId ?? existing.stripeCustomerId,
        stripe_subscription_id: input.stripeSubscriptionId ?? existing.stripeSubscriptionId,
        checkout_session_id: input.checkoutSessionId ?? existing.checkoutSessionId,
        billing_method: input.billingMethod ?? existing.billingMethod,
        paid_through:
          input.paidThrough !== undefined ? input.paidThrough : existing.paidThrough,
        revision: existing.revision + 1,
        status_changed_at: now,
        updated_at: now,
      })
      .eq("tenant_id", input.tenantId);

    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await admin.from("tenant_entitlements").insert({
    tenant_id: input.tenantId,
    commercial_invite_id: input.commercialInviteId,
    status: input.toStatus,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    checkout_session_id: input.checkoutSessionId ?? null,
    billing_method: input.billingMethod ?? "stripe",
    paid_through: input.paidThrough ?? null,
    revision: 0,
    status_changed_at: now,
    created_at: now,
    updated_at: now,
  });

  if (error) {
    throw error;
  }
}

export async function upsertBillingCustomer(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    commercialInviteId: string | null;
    normalizedEmail: string;
    stripeCustomerId: string;
    stripeSubscriptionId?: string | null;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const { error } = await admin.from("billing_customers").upsert(
    {
      tenant_id: input.tenantId,
      commercial_invite_id: input.commercialInviteId,
      normalized_email: input.normalizedEmail,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      updated_at: now,
    },
    { onConflict: "tenant_id" },
  );

  if (error) {
    throw error;
  }
}

export async function insertBillingEventLedgerEntry(
  admin: SupabaseClient,
  input: {
    stripeEventId: string;
    eventType: string;
    tenantId: string | null;
    idempotencyKey: string;
    payloadSummary: Record<string, unknown>;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const { error } = await admin.from("billing_event_ledger").insert({
    stripe_event_id: input.stripeEventId,
    event_type: input.eventType,
    tenant_id: input.tenantId,
    idempotency_key: input.idempotencyKey,
    payload_summary: input.payloadSummary,
    processed_at: now,
    created_at: now,
  });

  if (error) {
    throw error;
  }
}

export async function markCommercialInviteConsumed(admin: SupabaseClient, inviteId: string, now?: string) {
  const timestamp = now ?? new Date().toISOString();
  const { error } = await admin
    .from("commercial_invites")
    .update({
      status: "consumed",
      updated_at: timestamp,
    })
    .eq("id", inviteId);

  if (error) {
    throw error;
  }
}

export function evaluateCommercialInviteEligibility(input: {
  invite: (CommercialInvite & { checkoutSessionId?: string | null }) | null;
  email: string;
  inviteToken: string;
  now?: string;
  pepper?: string;
}) {
  const normalizedEmail = normalizeCommercialEmail(input.email);
  const blockingReasons: string[] = [];

  if (!input.invite) {
    blockingReasons.push("invite not found for email");
    return { allowed: false, normalizedEmail, blockingReasons };
  }

  if (input.invite.normalizedEmail !== normalizedEmail) {
    blockingReasons.push("email does not match invite");
  }

  const tokenMatch = matchesCommercialInviteToken({
    invite: input.invite,
    inviteToken: input.inviteToken,
    pepper: input.pepper,
    now: input.now,
  });
  blockingReasons.push(...tokenMatch.blockingReasons);

  return {
    allowed: blockingReasons.length === 0,
    normalizedEmail,
    blockingReasons,
  };
}

export function buildCommercialInviteTokenHashForStorage(token: string, pepper?: string) {
  return hashCommercialInviteToken(token, pepper);
}

export async function loadBillingCustomerByStripeCustomerId(
  admin: SupabaseClient,
  stripeCustomerId: string,
) {
  const { data, error } = await admin
    .from("billing_customers")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return {
    id: data.id,
    tenantId: data.tenant_id,
    commercialInviteId: data.commercial_invite_id,
    normalizedEmail: data.normalized_email,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } satisfies BillingCustomer;
}

export async function applyStripeWebhookProcessResult(
  admin: SupabaseClient,
  input: {
    result: import("./phase-83c-stripe-billing-gate").StripeWebhookProcessResult;
    stripeEventId: string;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const { result } = input;

  if (result.duplicate) {
    return { applied: false, duplicate: true, tenantId: null as string | null };
  }

  if (!result.handled || !result.entitlementStatus) {
    await insertBillingEventLedgerEntry(admin, {
      stripeEventId: input.stripeEventId,
      eventType: result.eventType,
      tenantId: null,
      idempotencyKey: input.stripeEventId,
      payloadSummary: result.payloadSummary,
      now,
    });
    return { applied: false, duplicate: false, tenantId: null as string | null };
  }

  let tenantId = result.tenantId;
  let commercialInviteId = result.commercialInviteId;
  let normalizedEmail: string | null = null;

  if (commercialInviteId) {
    const invite = await loadCommercialInviteById(admin, commercialInviteId);
    if (!invite) {
      throw new Error("commercial_invite_not_found");
    }
    normalizedEmail = invite.normalizedEmail;
    tenantId = invite.tenantId ?? (await provisionTenantForCommercialInvite(admin, { invite, now }));
  }

  if (!tenantId && result.stripeCustomerId) {
    const billingCustomer = await loadBillingCustomerByStripeCustomerId(admin, result.stripeCustomerId);
    tenantId = billingCustomer?.tenantId ?? null;
    commercialInviteId = commercialInviteId ?? billingCustomer?.commercialInviteId ?? null;
    normalizedEmail = normalizedEmail ?? billingCustomer?.normalizedEmail ?? null;
  }

  if (!tenantId) {
    throw new Error("tenant_resolution_failed");
  }

  const existingEntitlement = await loadTenantEntitlementByTenantId(admin, tenantId);
  await applyCommercialEntitlementStatus(admin, {
    tenantId,
    commercialInviteId,
    fromStatus: existingEntitlement?.status ?? null,
    toStatus: result.entitlementStatus,
    stripeCustomerId: result.stripeCustomerId,
    stripeSubscriptionId: result.stripeSubscriptionId,
    checkoutSessionId: result.checkoutSessionId,
    now,
  });

  if (result.stripeCustomerId && normalizedEmail) {
    await upsertBillingCustomer(admin, {
      tenantId,
      commercialInviteId,
      normalizedEmail,
      stripeCustomerId: result.stripeCustomerId,
      stripeSubscriptionId: result.stripeSubscriptionId,
      now,
    });
  }

  if (result.consumeInvite && commercialInviteId) {
    await markCommercialInviteConsumed(admin, commercialInviteId, now);
  }

  await insertBillingEventLedgerEntry(admin, {
    stripeEventId: input.stripeEventId,
    eventType: result.eventType,
    tenantId,
    idempotencyKey: input.stripeEventId,
    payloadSummary: result.payloadSummary,
    now,
  });

  return { applied: true, duplicate: false, tenantId };
}

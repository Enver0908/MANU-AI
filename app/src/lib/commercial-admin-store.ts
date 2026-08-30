import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyCommercialEntitlementStatus,
  loadCommercialInviteById,
  loadTenantEntitlementByTenantId,
  type CommercialInviteRow,
} from "./commercial-billing-store";
import { getSupabaseAdminClient } from "./supabase";
import type {
  CommercialAdminAuditEventType,
  CommercialAdminInviteListItem,
  CommercialAdminLedgerListItem,
  CommercialAdminManualEntitlementAction,
  CommercialAdminSubscriptionSummary,
} from "./phase-83f-commercial-admin";
import {
  buildCommercialAdminInviteRecord,
  deriveCommercialAdminEntitlementRevokePlan,
  deriveCommercialAdminInviteRevokePlan,
  sanitizeBillingLedgerEntryForAdmin,
  sanitizeCommercialInviteForAdmin,
  validateCommercialAdminInviteCreate,
  validateCommercialAdminManualEntitlementRequest,
} from "./phase-83f-commercial-admin";
import { deriveStripeSubscriptionCancelPlan } from "./phase-84g-subscription-operations";

export type CommercialAdminAuditRow = {
  id: string;
  event_type: CommercialAdminAuditEventType;
  actor_summary: string;
  target_invite_id: string | null;
  target_tenant_id: string | null;
  payload_summary: Record<string, unknown>;
  created_at: string;
};

export type ManualEntitlementOperationRow = {
  id: string;
  request_id: string;
  request_hash: string;
  action: CommercialAdminManualEntitlementAction;
  commercial_invite_id: string;
  tenant_id: string;
  payment_reference: string;
  paid_through: string;
  resulting_entitlement_status: string;
  resulting_revision: number;
  actor_summary: string;
  created_at: string;
};

function mapInviteRow(row: CommercialInviteRow & { tenants?: { name: string } | null }) {
  return sanitizeCommercialInviteForAdmin({
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
    tenantName: row.tenants?.name ?? null,
  });
}

export function isCommercialAdminStoreConfigured() {
  return getSupabaseAdminClient() !== null;
}

export async function insertCommercialAdminAuditEvent(
  admin: SupabaseClient,
  input: {
    eventType: CommercialAdminAuditEventType;
    targetInviteId?: string | null;
    targetTenantId?: string | null;
    payloadSummary?: Record<string, unknown>;
    actorSummary?: string;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const { error } = await admin.from("commercial_admin_audit_events").insert({
    event_type: input.eventType,
    actor_summary: input.actorSummary ?? "commercial_admin",
    target_invite_id: input.targetInviteId ?? null,
    target_tenant_id: input.targetTenantId ?? null,
    payload_summary: input.payloadSummary ?? {},
    created_at: now,
  });

  if (error) {
    throw error;
  }
}

export async function loadManualEntitlementOperationByRequestId(
  admin: SupabaseClient,
  requestId: string,
) {
  const { data, error } = await admin
    .from("manual_entitlement_operations")
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? (data as ManualEntitlementOperationRow) : null;
}

export async function digestManualEntitlementRequest(input: {
  action: CommercialAdminManualEntitlementAction;
  inviteId: string;
  paymentReference: string;
  paidThrough: string;
  requestId: string;
  expectedRevision: number | null;
}) {
  const payload = JSON.stringify({
    action: input.action,
    inviteId: input.inviteId,
    paymentReference: input.paymentReference,
    paidThrough: input.paidThrough,
    requestId: input.requestId,
    expectedRevision: input.expectedRevision,
  });
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createCommercialAdminInvite(
  admin: SupabaseClient,
  input: {
    email: string;
    inviteToken?: string;
    tenantName?: string;
    expiresAt?: string | null;
    actorSummary?: string;
    now?: string;
  },
) {
  const validation = validateCommercialAdminInviteCreate(input);
  if (!validation.valid) {
    throw new Error(validation.blockingReasons[0] ?? "invalid_invite_create_input");
  }

  const now = input.now ?? new Date().toISOString();
  const inviteId = crypto.randomUUID();
  const invite = buildCommercialAdminInviteRecord({
    id: inviteId,
    email: validation.normalizedEmail,
    inviteToken: validation.inviteToken,
    tenantSeedMetadata: validation.tenantSeedMetadata,
    expiresAt: input.expiresAt ?? null,
    now,
  });

  const { error } = await admin.from("commercial_invites").insert({
    id: invite.id,
    normalized_email: invite.normalizedEmail,
    invite_token_hash: invite.inviteTokenHash,
    status: invite.status,
    tenant_seed_metadata: invite.tenantSeedMetadata,
    tenant_id: invite.tenantId,
    revoked_at: invite.revokedAt,
    expires_at: invite.expiresAt,
    created_at: invite.createdAt,
    updated_at: invite.updatedAt,
  });

  if (error) {
    throw error;
  }

  await insertCommercialAdminAuditEvent(admin, {
    eventType: "invite_created",
    targetInviteId: invite.id,
    actorSummary: input.actorSummary,
    payloadSummary: {
      normalizedEmail: invite.normalizedEmail,
      expiresAt: invite.expiresAt,
      tenantSeedMetadata: invite.tenantSeedMetadata,
    },
    now,
  });

  return {
    invite: sanitizeCommercialInviteForAdmin(invite),
    inviteToken: validation.inviteToken,
  };
}

export async function revokeCommercialAdminInvite(
  admin: SupabaseClient,
  input: {
    inviteId: string;
    actorSummary?: string;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const invite = await loadCommercialInviteById(admin, input.inviteId);
  if (!invite) {
    throw new Error("invite_not_found");
  }

  const entitlement = invite.tenantId
    ? await loadTenantEntitlementByTenantId(admin, invite.tenantId)
    : null;

  const plan = deriveCommercialAdminInviteRevokePlan({
    inviteStatus: invite.status,
    entitlementStatus: entitlement?.status ?? null,
  });

  if (!plan.canRevokeInvite) {
    throw new Error(plan.blockingReasons[0] ?? "invite_revoke_blocked");
  }
  if (plan.blockingReasons.length > 0) {
    throw new Error(plan.blockingReasons[0] ?? "invite_revoke_blocked");
  }

  const { error: inviteError } = await admin
    .from("commercial_invites")
    .update({
      status: "revoked",
      revoked_at: now,
      updated_at: now,
    })
    .eq("id", invite.id);

  if (inviteError) {
    throw inviteError;
  }

  if (plan.shouldRevokeEntitlement && invite.tenantId && plan.entitlementTargetStatus) {
    await applyCommercialEntitlementStatus(admin, {
      tenantId: invite.tenantId,
      commercialInviteId: invite.id,
      fromStatus: entitlement?.status ?? null,
      toStatus: plan.entitlementTargetStatus,
      now,
    });
  }

  await insertCommercialAdminAuditEvent(admin, {
    eventType: "invite_revoked",
    targetInviteId: invite.id,
    targetTenantId: invite.tenantId,
    actorSummary: input.actorSummary,
    payloadSummary: {
      previousInviteStatus: invite.status,
      entitlementRevoked: plan.shouldRevokeEntitlement,
    },
    now,
  });

  return {
    inviteId: invite.id,
    tenantId: invite.tenantId,
    entitlementRevoked: plan.shouldRevokeEntitlement,
  };
}

export async function revokeCommercialAdminEntitlement(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    actorSummary?: string;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const entitlement = await loadTenantEntitlementByTenantId(admin, input.tenantId);
  const plan = deriveCommercialAdminEntitlementRevokePlan({
    entitlementStatus: entitlement?.status ?? null,
  });

  if (!plan.allowed) {
    throw new Error(plan.blockingReasons[0] ?? "entitlement_revoke_blocked");
  }

  await applyCommercialEntitlementStatus(admin, {
    tenantId: input.tenantId,
    commercialInviteId: entitlement?.commercialInviteId ?? null,
    fromStatus: entitlement?.status ?? null,
    toStatus: "revoked",
    now,
  });

  await insertCommercialAdminAuditEvent(admin, {
    eventType: "entitlement_revoked",
    targetTenantId: input.tenantId,
    targetInviteId: entitlement?.commercialInviteId ?? null,
    actorSummary: input.actorSummary,
    payloadSummary: {
      previousEntitlementStatus: entitlement?.status ?? null,
    },
    now,
  });

  return {
    tenantId: input.tenantId,
    previousStatus: entitlement?.status ?? null,
  };
}

export async function applyCommercialAdminManualEntitlement(
  admin: SupabaseClient,
  input: {
    action: CommercialAdminManualEntitlementAction;
    inviteId: string;
    paymentReference: string;
    paidThrough: string;
    requestId: string;
    expectedRevision?: number | null;
    actorSummary?: string;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const validation = validateCommercialAdminManualEntitlementRequest(input, { now });
  if (
    !validation.valid ||
    !validation.action ||
    !validation.inviteId ||
    !validation.paymentReference ||
    !validation.paidThrough ||
    !validation.requestId
  ) {
    throw new Error(validation.blockingReasons[0] ?? "manual_entitlement_validation_failed");
  }

  const requestHash = await digestManualEntitlementRequest({
    action: validation.action,
    inviteId: validation.inviteId,
    paymentReference: validation.paymentReference,
    paidThrough: validation.paidThrough,
    requestId: validation.requestId,
    expectedRevision: validation.expectedRevision,
  });
  const { data, error } = await admin.rpc("apply_manual_entitlement_operation", {
    p_action: validation.action,
    p_invite_id: validation.inviteId,
    p_payment_reference: validation.paymentReference,
    p_paid_through: validation.paidThrough,
    p_request_id: validation.requestId,
    p_request_hash: requestHash,
    p_expected_revision: validation.expectedRevision,
    p_actor_summary: input.actorSummary ?? "commercial_admin",
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = (data ?? {}) as Record<string, unknown>;
  return {
    applied: result.applied === true,
    idempotent: result.idempotent === true,
    tenantId: String(result.tenantId ?? ""),
    inviteId: String(result.inviteId ?? validation.inviteId),
    entitlementStatus: String(result.entitlementStatus ?? "active"),
    paidThrough: String(result.paidThrough ?? validation.paidThrough),
    revision: Number(result.revision ?? 0),
  };
}

export async function cancelCommercialAdminStripeSubscription(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    actorSummary?: string;
    cancelSubscription: (subscriptionId: string) => Promise<{ subscriptionId: string; status: string }>;
    now?: string;
  },
) {
  const entitlement = await loadTenantEntitlementByTenantId(admin, input.tenantId);
  const plan = deriveStripeSubscriptionCancelPlan({
    entitlementStatus: entitlement?.status ?? null,
    stripeSubscriptionId: entitlement?.stripeSubscriptionId ?? null,
    stripeSandboxConfigured: true,
  });

  if (!plan.allowed) {
    throw new Error(plan.blockingReasons[0] ?? "stripe_subscription_cancel_blocked");
  }

  const canceled = await input.cancelSubscription(entitlement!.stripeSubscriptionId!);
  const now = input.now ?? new Date().toISOString();

  await insertCommercialAdminAuditEvent(admin, {
    eventType: "stripe_subscription_canceled",
    targetTenantId: input.tenantId,
    targetInviteId: entitlement?.commercialInviteId ?? null,
    actorSummary: input.actorSummary,
    payloadSummary: {
      stripeSubscriptionId: canceled.subscriptionId,
      stripeStatus: canceled.status,
      previousEntitlementStatus: entitlement?.status ?? null,
    },
    now,
  });

  return {
    tenantId: input.tenantId,
    stripeSubscriptionId: canceled.subscriptionId,
    stripeStatus: canceled.status,
  };
}

export async function recordCommercialAdminLeadStatusUpdate(
  admin: SupabaseClient,
  input: {
    leadId: string;
    previousStatus: string;
    nextStatus: string;
    normalizedEmail: string;
    actorSummary?: string;
    now?: string;
  },
) {
  await insertCommercialAdminAuditEvent(admin, {
    eventType: "lead_status_updated",
    actorSummary: input.actorSummary,
    payloadSummary: {
      leadId: input.leadId,
      normalizedEmail: input.normalizedEmail,
      previousStatus: input.previousStatus,
      nextStatus: input.nextStatus,
    },
    now: input.now,
  });
}

export async function recordCommercialAdminOperationBlocked(
  admin: SupabaseClient,
  input: {
    operation: string;
    blockingReasons: string[];
    targetTenantId?: string | null;
    targetInviteId?: string | null;
    actorSummary?: string;
    now?: string;
  },
) {
  await insertCommercialAdminAuditEvent(admin, {
    eventType: "admin_operation_blocked",
    targetTenantId: input.targetTenantId ?? null,
    targetInviteId: input.targetInviteId ?? null,
    actorSummary: input.actorSummary,
    payloadSummary: {
      operation: input.operation,
      blockingReasons: input.blockingReasons,
    },
    now: input.now,
  });
}

export async function listCommercialAdminInvites(
  admin: SupabaseClient,
  input?: { limit?: number },
) {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const { data, error } = await admin
    .from("commercial_invites")
    .select("*, tenants(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    mapInviteRow(row as CommercialInviteRow & { tenants?: { name: string } | null }),
  ) satisfies CommercialAdminInviteListItem[];
}

export async function listCommercialAdminBillingLedger(
  admin: SupabaseClient,
  input?: { limit?: number; tenantId?: string | null },
) {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  let query = admin
    .from("billing_event_ledger")
    .select("*")
    .order("processed_at", { ascending: false })
    .limit(limit);

  if (input?.tenantId) {
    query = query.eq("tenant_id", input.tenantId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    sanitizeBillingLedgerEntryForAdmin({
      id: row.id,
      stripeEventId: row.stripe_event_id,
      eventType: row.event_type,
      tenantId: row.tenant_id,
      idempotencyKey: row.idempotency_key,
      payloadSummary: row.payload_summary ?? {},
      processedAt: row.processed_at,
      createdAt: row.created_at,
    }),
  ) satisfies CommercialAdminLedgerListItem[];
}

export async function listCommercialAdminSubscriptionSummaries(admin: SupabaseClient) {
  const { data: entitlements, error: entitlementError } = await admin
    .from("tenant_entitlements")
    .select(
      "tenant_id, status, commercial_invite_id, billing_method, paid_through, revision, stripe_customer_id, stripe_subscription_id, status_changed_at",
    )
    .order("updated_at", { ascending: false });

  if (entitlementError) {
    throw entitlementError;
  }

  const rows = entitlements ?? [];
  if (rows.length === 0) {
    return [] satisfies CommercialAdminSubscriptionSummary[];
  }

  const tenantIds = rows.map((row) => row.tenant_id);
  const inviteIds = rows
    .map((row) => row.commercial_invite_id)
    .filter((value): value is string => Boolean(value));

  const [{ data: billingCustomers, error: billingError }, { data: invites, error: inviteError }] =
    await Promise.all([
      admin.from("billing_customers").select("tenant_id, normalized_email").in("tenant_id", tenantIds),
      inviteIds.length > 0
        ? admin
            .from("commercial_invites")
            .select("id, normalized_email, status")
            .in("id", inviteIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (billingError) {
    throw billingError;
  }
  if (inviteError) {
    throw inviteError;
  }

  const billingByTenant = new Map(
    (billingCustomers ?? []).map((row) => [row.tenant_id as string, row.normalized_email as string]),
  );
  const inviteById = new Map(
    (invites ?? []).map((row) => [
      row.id as string,
      {
        normalizedEmail: row.normalized_email as string,
        status: row.status as CommercialAdminSubscriptionSummary["inviteStatus"],
      },
    ]),
  );

  return rows.map((row) => {
    const invite = row.commercial_invite_id
      ? inviteById.get(row.commercial_invite_id)
      : undefined;

    return {
      tenantId: row.tenant_id,
      normalizedEmail: billingByTenant.get(row.tenant_id) ?? invite?.normalizedEmail ?? null,
      inviteId: row.commercial_invite_id,
      inviteStatus: invite?.status ?? null,
      entitlementStatus: row.status,
      billingMethod: row.billing_method ?? "stripe",
      paidThrough: row.paid_through ?? null,
      revision: row.revision ?? 0,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      statusChangedAt: row.status_changed_at,
    } satisfies CommercialAdminSubscriptionSummary;
  });
}

export async function recordCommercialAdminLedgerInspection(
  admin: SupabaseClient,
  input?: {
    tenantId?: string | null;
    resultCount?: number;
    actorSummary?: string;
    now?: string;
  },
) {
  await insertCommercialAdminAuditEvent(admin, {
    eventType: "ledger_inspected",
    targetTenantId: input?.tenantId ?? null,
    actorSummary: input?.actorSummary,
    payloadSummary: {
      resultCount: input?.resultCount ?? 0,
      tenantFilter: input?.tenantId ?? null,
    },
    now: input?.now,
  });
}

export type CommercialAdminAuditListItem = {
  id: string;
  eventType: string;
  actorSummary: string;
  targetInviteId: string | null;
  targetTenantId: string | null;
  payloadSummary: Record<string, unknown>;
  createdAt: string;
};

export type CommercialOnboardingAuditListItem = {
  id: string;
  eventType: string;
  normalizedEmail: string;
  checkoutSessionId: string | null;
  tenantId: string | null;
  payloadSummary: Record<string, unknown>;
  createdAt: string;
};

export async function listCommercialAdminAuditEvents(
  admin: SupabaseClient,
  input?: { limit?: number },
) {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const { data, error } = await admin
    .from("commercial_admin_audit_events")
    .select("id, event_type, actor_summary, target_invite_id, target_tenant_id, payload_summary, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row) =>
      ({
        id: row.id,
        eventType: row.event_type,
        actorSummary: row.actor_summary,
        targetInviteId: row.target_invite_id,
        targetTenantId: row.target_tenant_id,
        payloadSummary: row.payload_summary ?? {},
        createdAt: row.created_at,
      }) satisfies CommercialAdminAuditListItem,
  );
}

export async function listCommercialOnboardingAuditEvents(
  admin: SupabaseClient,
  input?: { limit?: number },
) {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const { data, error } = await admin
    .from("commercial_onboarding_events")
    .select("id, event_type, normalized_email, checkout_session_id, tenant_id, payload_summary, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row) =>
      ({
        id: row.id,
        eventType: row.event_type,
        normalizedEmail: row.normalized_email,
        checkoutSessionId: row.checkout_session_id,
        tenantId: row.tenant_id,
        payloadSummary: row.payload_summary ?? {},
        createdAt: row.created_at,
      }) satisfies CommercialOnboardingAuditListItem,
  );
}

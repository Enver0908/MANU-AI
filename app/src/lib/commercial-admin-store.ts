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
  CommercialAdminCustomerListItem,
  CommercialAdminInviteListItem,
  CommercialAdminLedgerListItem,
  CommercialAdminManualEntitlementAction,
  CommercialAdminSubscriptionSummary,
} from "./phase-83f-commercial-admin";
import {
  buildCommercialAdminInviteRecord,
  deriveCommercialAdminEntitlementRevokePlan,
  deriveCommercialAdminInviteRevokePlan,
  projectCommercialAdminCustomer,
  sanitizeBillingLedgerEntryForAdmin,
  sanitizeCommercialInviteForAdmin,
  validateCommercialAdminInviteCreate,
  validateCommercialAdminInviteCustomerCommand,
  validateCommercialAdminManualEntitlementRequest,
} from "./phase-83f-commercial-admin";
import { deriveStripeSubscriptionCancelPlan } from "./phase-84g-subscription-operations";
import { buildAuthCallbackUrlWithNext } from "./phase-84d-customer-auth";
import { buildAdminCustomerSetupPath } from "./phase-84f-admin-console";
import { buildAccountRecoveryCallbackUrl } from "./phase-85-stage-4d-account-security";
import { normalizeCommercialEmail } from "./phase-83b-commercial-entitlement-model";

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

export type CommercialAdminSetupEmailAdapter = {
  sendSetupEmail: (input: { email: string; inviteId: string; redirectTo: string }) => Promise<void>;
  lookupAuthUserIdByEmail?: (email: string) => Promise<string | null>;
  sendPasswordRecoveryEmail?: (input: { email: string; redirectTo: string }) => Promise<void>;
};

export const COMMERCIAL_ADMIN_AUTH_USER_PAGE_SIZE = 200;
export const COMMERCIAL_ADMIN_AUTH_USER_MAX_PAGES = 50;

export async function lookupCommercialAdminAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string,
) {
  const normalized = normalizeCommercialEmail(email);
  for (let page = 1; page <= COMMERCIAL_ADMIN_AUTH_USER_MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: COMMERCIAL_ADMIN_AUTH_USER_PAGE_SIZE,
    });
    if (error) {
      throw error;
    }
    const users = data.users ?? [];
    const match = users.find((entry) => normalizeCommercialEmail(entry.email ?? "") === normalized);
    if (match) {
      return match.id;
    }
    if (users.length < COMMERCIAL_ADMIN_AUTH_USER_PAGE_SIZE) {
      return null;
    }
  }
  return null;
}

export function createDefaultCommercialAdminSetupEmailAdapter(
  admin: SupabaseClient,
): CommercialAdminSetupEmailAdapter {
  return {
    async sendSetupEmail(input) {
      const { error } = await admin.auth.admin.inviteUserByEmail(input.email, {
        redirectTo: input.redirectTo,
        data: { commercial_invite_id: input.inviteId },
      });
      if (!error) {
        return;
      }
      const message = error.message ?? "setup_email_failed";
      if (!/already|registered|exists/i.test(message)) {
        throw new Error(message);
      }
      const { error: otpError } = await admin.auth.signInWithOtp({
        email: input.email,
        options: {
          emailRedirectTo: input.redirectTo,
          shouldCreateUser: false,
        },
      });
      if (otpError) {
        throw new Error(otpError.message || "setup_email_failed");
      }
    },
    async lookupAuthUserIdByEmail(email) {
      return lookupCommercialAdminAuthUserIdByEmail(admin, email);
    },
    async sendPasswordRecoveryEmail(input) {
      const { error } = await admin.auth.resetPasswordForEmail(input.email, {
        redirectTo: input.redirectTo,
      });
      if (error) {
        throw new Error(error.message || "password_recovery_failed");
      }
    },
  };
}

async function lookupCommercialAdminCustomerMatch(admin: SupabaseClient, email: string) {
  const normalizedEmail = normalizeCommercialEmail(email);
  const [{ data: invites, error: inviteError }, { data: billingCustomers, error: billingError }] =
    await Promise.all([
      admin
        .from("commercial_invites")
        .select("id, status, tenant_id, tenant_seed_metadata, created_at, updated_at, tenants(name)")
        .eq("normalized_email", normalizedEmail)
        .order("created_at", { ascending: false }),
      admin.from("billing_customers").select("tenant_id, normalized_email").eq("normalized_email", normalizedEmail),
    ]);

  if (inviteError) {
    throw inviteError;
  }
  if (billingError) {
    throw billingError;
  }

  const inviteRows = invites ?? [];
  const tenantIds = [
    ...new Set(
      [
        ...inviteRows.map((row) => row.tenant_id as string | null),
        ...(billingCustomers ?? []).map((row) => row.tenant_id as string | null),
      ].filter((value): value is string => Boolean(value)),
    ),
  ];

  const entitlements =
    tenantIds.length > 0
      ? await admin
          .from("tenant_entitlements")
          .select("tenant_id, status, billing_method, paid_through, revision, commercial_invite_id")
          .in("tenant_id", tenantIds)
          .order("updated_at", { ascending: false })
      : { data: [], error: null };

  if (entitlements.error) {
    throw entitlements.error;
  }

  const memberships =
    tenantIds.length > 0
      ? await admin
          .from("tenant_memberships")
          .select("tenant_id, role")
          .in("tenant_id", tenantIds)
          .eq("role", "owner")
      : { data: [], error: null };

  if (memberships.error) {
    throw memberships.error;
  }

  const latestInviteRow = inviteRows.find((row) => row.status !== "revoked") ?? inviteRows[0] ?? null;
  const latestEntitlement = (entitlements.data ?? [])[0] ?? null;
  const openInvite = inviteRows.find((row) => row.status === "active") ?? null;

  return {
    normalizedEmail,
    tenantIds,
    openInvite: openInvite
      ? {
          id: openInvite.id as string,
          status: openInvite.status as "active" | "revoked" | "consumed",
          tenantId: (openInvite.tenant_id as string | null) ?? null,
        }
      : latestInviteRow && latestInviteRow.status !== "revoked"
        ? {
            id: latestInviteRow.id as string,
            status: latestInviteRow.status as "active" | "revoked" | "consumed",
            tenantId: (latestInviteRow.tenant_id as string | null) ?? null,
          }
        : null,
    latestInvite: latestInviteRow
      ? {
          id: latestInviteRow.id as string,
          status: latestInviteRow.status as "active" | "revoked" | "consumed",
          tenantId: (latestInviteRow.tenant_id as string | null) ?? null,
          tenantName:
            (latestInviteRow.tenants as { name?: string } | null)?.name ??
            ((latestInviteRow.tenant_seed_metadata as Record<string, unknown> | null)?.tenantName as
              | string
              | undefined) ??
            null,
          createdAt: latestInviteRow.created_at as string,
          updatedAt: latestInviteRow.updated_at as string,
          paidThrough:
            ((latestInviteRow.tenant_seed_metadata as Record<string, unknown> | null)?.paidThrough as
              | string
              | undefined) ?? null,
        }
      : null,
    latestEntitlement: latestEntitlement
      ? {
          tenantId: latestEntitlement.tenant_id as string,
          status: latestEntitlement.status,
          billingMethod: latestEntitlement.billing_method,
          paidThrough: latestEntitlement.paid_through ?? null,
          revision: latestEntitlement.revision ?? 0,
          inviteId: latestEntitlement.commercial_invite_id ?? null,
        }
      : null,
    hasOwnerMembership: (memberships.data ?? []).length > 0,
  };
}

type CommercialAdminCustomerProjectionRow = {
  normalizedEmail?: string;
  tenantIds?: string[] | null;
  latestInvite?: {
    id?: string;
    status?: string;
    tenantId?: string | null;
    tenantName?: string | null;
    tenantSeedMetadata?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  latestEntitlement?: {
    tenantId?: string;
    status?: string;
    billingMethod?: string;
    paidThrough?: string | null;
    revision?: number;
    inviteId?: string | null;
  } | null;
  hasOwnerMembership?: boolean;
};

export async function listCommercialAdminCustomers(
  admin: SupabaseClient,
  input?: { email?: string | null; limit?: number; now?: string },
) {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const emailFilter = input?.email?.trim() ? normalizeCommercialEmail(input.email) : "";
  const { data, error } = await admin.rpc("commercial_admin_list_customers_v1", {
    p_email_filter: emailFilter || null,
    p_limit: limit,
  });
  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? (data as CommercialAdminCustomerProjectionRow[]) : [];
  return rows.map((row) =>
    projectCommercialAdminCustomer({
      normalizedEmail: String(row.normalizedEmail ?? ""),
      tenantIds: (row.tenantIds ?? []).filter((value): value is string => Boolean(value)),
      latestInvite: row.latestInvite?.id
        ? {
            id: String(row.latestInvite.id),
            status: (row.latestInvite.status ?? "active") as NonNullable<
              CommercialAdminCustomerListItem["inviteStatus"]
            >,
            tenantId: row.latestInvite.tenantId ?? null,
            tenantName: row.latestInvite.tenantName ?? null,
            createdAt: String(row.latestInvite.createdAt ?? ""),
            updatedAt: String(row.latestInvite.updatedAt ?? ""),
          }
        : null,
      latestEntitlement: row.latestEntitlement?.tenantId
        ? {
            tenantId: String(row.latestEntitlement.tenantId),
            status: row.latestEntitlement.status as NonNullable<
              CommercialAdminCustomerListItem["entitlementStatus"]
            >,
            billingMethod: row.latestEntitlement.billingMethod as NonNullable<
              CommercialAdminCustomerListItem["billingMethod"]
            >,
            paidThrough: row.latestEntitlement.paidThrough ?? null,
            revision: row.latestEntitlement.revision ?? 0,
            inviteId: row.latestEntitlement.inviteId ?? null,
          }
        : null,
      hasOwnerMembership: row.hasOwnerMembership === true,
      now: input?.now,
    }),
  );
}

export async function inviteCommercialAdminCustomer(
  admin: SupabaseClient,
  input: {
    email: string;
    tenantName?: string | null;
    paidThrough?: string | null;
    expiresAt?: string | null;
    actorSummary?: string;
    now?: string;
    setupEmail?: CommercialAdminSetupEmailAdapter;
  },
) {
  const validation = validateCommercialAdminInviteCustomerCommand(input, { now: input.now });
  if (!validation.valid || !validation.paidThrough) {
    throw new Error(validation.blockingReasons[0] ?? "invalid_invite_customer_command");
  }

  const setupEmail = input.setupEmail ?? createDefaultCommercialAdminSetupEmailAdapter(admin);
  const authUserId = setupEmail.lookupAuthUserIdByEmail
    ? await setupEmail.lookupAuthUserIdByEmail(validation.normalizedEmail)
    : await lookupCommercialAdminAuthUserIdByEmail(admin, validation.normalizedEmail);

  const { data, error } = await admin.rpc("commercial_admin_invite_customer_v1", {
    p_normalized_email: validation.normalizedEmail,
    p_tenant_name: validation.tenantName ?? null,
    p_paid_through: validation.paidThrough,
    p_expires_at: validation.expiresAt ?? null,
    p_actor_summary: input.actorSummary ?? "commercial_admin",
    p_auth_user_id: authUserId,
  });
  if (error) {
    const message = error.message ?? "invite_customer_failed";
    if (message.includes("ambiguous_tenant_match")) {
      throw new Error("ambiguous_tenant_match");
    }
    throw new Error(message);
  }

  const result = (data ?? {}) as {
    status?: string;
    created?: boolean;
    resent?: boolean;
    inviteId?: string | null;
    email?: string;
    paidThrough?: string;
    blockingReason?: string | null;
  };

  if (result.status === "blocked" || !result.inviteId) {
    throw new Error(result.blockingReason ?? "duplicate_customer_match");
  }

  const inviteId = result.inviteId;
  const created = result.created === true;
  const redirectTo = buildAuthCallbackUrlWithNext(buildAdminCustomerSetupPath(inviteId));

  try {
    await setupEmail.sendSetupEmail({
      email: validation.normalizedEmail,
      inviteId,
      redirectTo,
    });
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : "setup_email_failed";
    throw new Error(message === "setup_email_failed" ? message : "setup_email_failed");
  }

  return {
    created,
    resent: !created,
    inviteId,
    email: validation.normalizedEmail,
    paidThrough: validation.paidThrough,
  };
}

export async function requestCommercialAdminPasswordRecovery(
  admin: SupabaseClient,
  input: {
    email: string;
    actorSummary?: string;
    now?: string;
    setupEmail?: CommercialAdminSetupEmailAdapter;
  },
) {
  const normalizedEmail = normalizeCommercialEmail(input.email);
  const emailValidation = validateCommercialAdminInviteCreate({ email: normalizedEmail });
  if (!emailValidation.valid) {
    throw new Error(emailValidation.blockingReasons[0] ?? "email_invalid");
  }

  const match = await lookupCommercialAdminCustomerMatch(admin, normalizedEmail);
  if (match.tenantIds.length > 1) {
    throw new Error("ambiguous_tenant_match");
  }

  const setupEmail = input.setupEmail ?? createDefaultCommercialAdminSetupEmailAdapter(admin);
  if (!setupEmail.sendPasswordRecoveryEmail) {
    throw new Error("password_recovery_unavailable");
  }

  await setupEmail.sendPasswordRecoveryEmail({
    email: normalizedEmail,
    redirectTo: buildAccountRecoveryCallbackUrl(),
  });

  await insertCommercialAdminAuditEvent(admin, {
    eventType: "password_recovery_requested",
    actorSummary: input.actorSummary,
    targetInviteId: match.latestInvite?.id ?? null,
    targetTenantId: match.latestEntitlement?.tenantId ?? match.tenantIds[0] ?? null,
    payloadSummary: {
      normalizedEmail,
      copiedClientData: false,
    },
    now: input.now,
  });

  return {
    accepted: true,
    email: normalizedEmail,
  };
}

export async function createCommercialAdminInvite(
  admin: SupabaseClient,
  input: {
    email: string;
    inviteToken?: string;
    tenantName?: string;
    paidThrough?: string | null;
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
    expectedRevision: number;
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
    expectedRevision: input.expectedRevision,
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

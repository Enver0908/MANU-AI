import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCommercialInviteById, loadTenantEntitlementByTenantId, type CommercialInviteRow } from "./commercial-billing-store";
import { normalizeCommercialEmail } from "./phase-83b-commercial-entitlement-model";
import type { CommercialOnboardingEventType } from "./phase-84e-customer-onboarding";
import { deriveDefaultDietitianDisplayName } from "./phase-84e-customer-onboarding";

function isUniqueConstraintError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "23505" || /duplicate key value violates unique constraint/i.test(error?.message ?? "");
}

function mapInviteRow(row: CommercialInviteRow) {
  return {
    id: row.id,
    normalizedEmail: row.normalized_email,
    status: row.status,
    tenantId: row.tenant_id,
    tenantSeedMetadata: row.tenant_seed_metadata ?? {},
    checkoutSessionId: row.checkout_session_id,
  };
}

export async function insertCommercialOnboardingEvent(
  admin: SupabaseClient,
  input: {
    eventType: CommercialOnboardingEventType;
    normalizedEmail: string;
    authUserId?: string | null;
    commercialInviteId?: string | null;
    tenantId?: string | null;
    checkoutSessionId?: string | null;
    payloadSummary?: Record<string, unknown>;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const { error } = await admin.from("commercial_onboarding_events").insert({
    event_type: input.eventType,
    normalized_email: normalizeCommercialEmail(input.normalizedEmail),
    auth_user_id: input.authUserId ?? null,
    commercial_invite_id: input.commercialInviteId ?? null,
    tenant_id: input.tenantId ?? null,
    checkout_session_id: input.checkoutSessionId ?? null,
    payload_summary: input.payloadSummary ?? {},
    created_at: now,
  });

  if (error) {
    throw error;
  }
}

export async function loadClaimableCheckoutSessionForEmail(admin: SupabaseClient, email: string) {
  const normalizedEmail = normalizeCommercialEmail(email);
  const { data, error } = await admin
    .from("commercial_invites")
    .select("checkout_session_id, status, tenant_id")
    .eq("normalized_email", normalizedEmail)
    .eq("status", "consumed")
    .not("checkout_session_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data?.checkout_session_id || !data.tenant_id) {
    return null;
  }

  const entitlement = await loadTenantEntitlementByTenantId(admin, data.tenant_id);
  if (!entitlement || entitlement.status !== "active") {
    return null;
  }

  return data.checkout_session_id as string;
}

export async function loadCommercialInviteByCheckoutSessionId(
  admin: SupabaseClient,
  checkoutSessionId: string,
) {
  const { data: inviteRow, error: inviteError } = await admin
    .from("commercial_invites")
    .select("*")
    .eq("checkout_session_id", checkoutSessionId)
    .maybeSingle();

  if (inviteError) {
    throw inviteError;
  }
  if (inviteRow) {
    return mapInviteRow(inviteRow as CommercialInviteRow);
  }

  const { data: entitlementRow, error: entitlementError } = await admin
    .from("tenant_entitlements")
    .select("tenant_id, commercial_invite_id, status, checkout_session_id")
    .eq("checkout_session_id", checkoutSessionId)
    .maybeSingle();

  if (entitlementError) {
    throw entitlementError;
  }
  if (!entitlementRow?.commercial_invite_id) {
    return null;
  }

  const invite = await loadCommercialInviteById(admin, entitlementRow.commercial_invite_id);
  if (!invite) {
    return null;
  }

  return {
    id: invite.id,
    normalizedEmail: invite.normalizedEmail,
    status: invite.status,
    tenantId: invite.tenantId ?? entitlementRow.tenant_id,
    tenantSeedMetadata: invite.tenantSeedMetadata,
    checkoutSessionId,
  };
}

export async function loadTenantOwnerUserId(admin: SupabaseClient, tenantId: string) {
  const { data, error } = await admin
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data?.user_id ?? null;
}

export async function loadUserTenantClaimState(
  admin: SupabaseClient,
  input: { tenantId: string; userId: string },
) {
  const [{ data: membership, error: membershipError }, { data: dietitian, error: dietitianError }] =
    await Promise.all([
      admin
        .from("tenant_memberships")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .eq("user_id", input.userId)
        .maybeSingle(),
      admin
        .from("dietitians")
        .select("id, tenant_id")
        .eq("auth_user_id", input.userId)
        .maybeSingle(),
    ]);

  if (membershipError) {
    throw membershipError;
  }
  if (dietitianError) {
    throw dietitianError;
  }

  return {
    hasMembershipOnTenant: Boolean(membership),
    hasDietitianProfileOnTenant: Boolean(dietitian && dietitian.tenant_id === input.tenantId),
    dietitianTenantId: dietitian?.tenant_id ?? null,
  };
}

export async function claimCommercialOnboardingWorkspace(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    userId: string;
    normalizedEmail: string;
    commercialInviteId: string;
    checkoutSessionId: string;
    tenantSeedMetadata?: Record<string, unknown>;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const claimState = await loadUserTenantClaimState(admin, {
    tenantId: input.tenantId,
    userId: input.userId,
  });

  if (claimState.dietitianTenantId && claimState.dietitianTenantId !== input.tenantId) {
    throw new Error("dietitian_profile_bound_elsewhere");
  }

  const { error: membershipError } = await admin.from("tenant_memberships").upsert(
    {
      tenant_id: input.tenantId,
      user_id: input.userId,
      role: "owner",
      created_at: now,
    },
    { onConflict: "tenant_id,user_id" },
  );
  if (membershipError) {
    throw membershipError;
  }

  let finalClaimState = claimState;
  let recoveredDuplicateDietitianProfile = false;
  if (!claimState.hasDietitianProfileOnTenant) {
    const { error: dietitianError } = await admin.from("dietitians").insert({
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      display_name: deriveDefaultDietitianDisplayName({
        inviteEmail: input.normalizedEmail,
        tenantSeedMetadata: input.tenantSeedMetadata,
      }),
      timezone: "Europe/Istanbul",
      ui_language: "tr",
      auth_user_id: input.userId,
      created_at: now,
    });
    if (dietitianError) {
      if (!isUniqueConstraintError(dietitianError)) {
        throw dietitianError;
      }

      finalClaimState = await loadUserTenantClaimState(admin, {
        tenantId: input.tenantId,
        userId: input.userId,
      });
      if (finalClaimState.dietitianTenantId && finalClaimState.dietitianTenantId !== input.tenantId) {
        throw new Error("dietitian_profile_bound_elsewhere");
      }
      if (!finalClaimState.hasDietitianProfileOnTenant) {
        throw dietitianError;
      }
      recoveredDuplicateDietitianProfile = true;
    } else {
      finalClaimState = {
        ...claimState,
        hasDietitianProfileOnTenant: true,
        dietitianTenantId: input.tenantId,
      };
    }
  }

  await insertCommercialOnboardingEvent(admin, {
    eventType: "claim_completed",
    normalizedEmail: input.normalizedEmail,
    authUserId: input.userId,
    commercialInviteId: input.commercialInviteId,
    tenantId: input.tenantId,
    checkoutSessionId: input.checkoutSessionId,
    payloadSummary: {
      idempotent: (claimState.hasMembershipOnTenant && finalClaimState.hasDietitianProfileOnTenant)
        || recoveredDuplicateDietitianProfile,
    },
    now,
  });

  return {
    tenantId: input.tenantId,
    alreadyClaimed: (claimState.hasMembershipOnTenant && finalClaimState.hasDietitianProfileOnTenant)
      || recoveredDuplicateDietitianProfile,
  };
}

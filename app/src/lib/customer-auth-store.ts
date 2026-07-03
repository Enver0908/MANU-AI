import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadTenantEntitlementByTenantId,
  type CommercialInviteRow,
} from "./commercial-billing-store";
import { normalizeCommercialEmail } from "./phase-83b-commercial-entitlement-model";

async function loadLatestCommercialInviteByEmail(admin: SupabaseClient, email: string) {
  const normalizedEmail = normalizeCommercialEmail(email);
  const { data, error } = await admin
    .from("commercial_invites")
    .select("*")
    .eq("normalized_email", normalizedEmail)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as CommercialInviteRow | null) ?? null;
}

export async function isRegisteredCommercialCustomerEmail(admin: SupabaseClient, email: string) {
  const normalizedEmail = normalizeCommercialEmail(email);
  const invite = await loadLatestCommercialInviteByEmail(admin, normalizedEmail);
  if (invite) {
    return true;
  }

  const { data, error } = await admin
    .from("billing_customers")
    .select("id")
    .eq("normalized_email", normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function hasClaimablePaidWorkspace(
  admin: SupabaseClient,
  input: { email: string; userId?: string | null },
) {
  const invite = await loadLatestCommercialInviteByEmail(admin, input.email);
  if (!invite || invite.status !== "consumed" || !invite.tenant_id) {
    return false;
  }

  const entitlement = await loadTenantEntitlementByTenantId(admin, invite.tenant_id);
  if (!entitlement || entitlement.status !== "active") {
    return false;
  }

  if (!input.userId) {
    return true;
  }

  const { data: membership, error } = await admin
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", input.userId)
    .eq("tenant_id", invite.tenant_id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return !membership;
}

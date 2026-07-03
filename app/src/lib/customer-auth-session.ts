import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase";
import { loadTenantEntitlementByTenantId } from "./commercial-billing-store";
import { hasClaimablePaidWorkspace as resolveClaimablePaidWorkspace } from "./customer-auth-store";
import type { CustomerSessionFacts } from "./phase-84d-customer-auth";
import type { CommercialEntitlementStatus } from "./phase-83b-commercial-entitlement-model";

export async function resolveCustomerSessionFacts(
  supabase: SupabaseClient,
): Promise<CustomerSessionFacts> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      isAuthenticated: false,
      normalizedEmail: null,
      hasTenantMembership: false,
      hasDietitianProfile: false,
      entitlementStatus: null,
      hasClaimablePaidWorkspace: false,
    };
  }

  const normalizedEmail = user.email?.trim().toLowerCase() ?? null;
  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: dietitian } = membership
    ? await supabase
        .from("dietitians")
        .select("id")
        .eq("tenant_id", membership.tenant_id)
        .eq("auth_user_id", user.id)
        .maybeSingle()
    : { data: null };

  let entitlementStatus: CommercialEntitlementStatus | null = null;
  const admin = getSupabaseAdminClient();
  if (membership && admin) {
    const entitlement = await loadTenantEntitlementByTenantId(admin, membership.tenant_id);
    entitlementStatus = entitlement?.status ?? null;
  }

  const claimablePaidWorkspace = normalizedEmail && admin
    ? await resolveClaimablePaidWorkspace(admin, {
        email: normalizedEmail,
        userId: user.id,
      })
    : false;

  return {
    isAuthenticated: true,
    normalizedEmail,
    hasTenantMembership: Boolean(membership),
    hasDietitianProfile: Boolean(dietitian),
    entitlementStatus,
    hasClaimablePaidWorkspace: claimablePaidWorkspace,
  };
}

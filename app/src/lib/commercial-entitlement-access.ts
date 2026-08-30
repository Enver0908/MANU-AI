import { loadTenantEntitlementByTenantId } from "./commercial-billing-store";
import { AppAuthError } from "./auth-context";
import {
  deriveCommercialEntitlementErrorCode,
  evaluateCommercialEntitlementApiAccess,
  isCommercialEntitlementEnforcementEnabled,
} from "./phase-83g-entitlement-hardening";
import { getSupabaseAdminClient } from "./supabase";

export async function assertActiveCommercialEntitlement(tenantId: string) {
  if (!isCommercialEntitlementEnforcementEnabled()) {
    return;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new AppAuthError(403, "entitlement_check_unavailable");
  }

  const entitlement = await loadTenantEntitlementByTenantId(admin, tenantId);
  const access = evaluateCommercialEntitlementApiAccess({
    isAuthenticated: true,
    hasTenantMembership: true,
    hasDietitianProfile: true,
    entitlementStatus: entitlement?.status ?? null,
    billingMethod: entitlement?.billingMethod ?? null,
    paidThrough: entitlement?.paidThrough ?? null,
    enforcementEnabled: true,
  });

  if (!access.allowed) {
    throw new AppAuthError(403, access.errorCode ?? deriveCommercialEntitlementErrorCode(entitlement?.status ?? null, access.blockingReasons));
  }
}

export async function loadCommercialEntitlementStatusForTenant(tenantId: string) {
  if (!isCommercialEntitlementEnforcementEnabled()) {
    return null;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  const entitlement = await loadTenantEntitlementByTenantId(admin, tenantId);
  return entitlement?.status ?? null;
}

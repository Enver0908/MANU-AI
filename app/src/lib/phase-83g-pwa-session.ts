import {
  evaluateCommercialEntitlementExpiry,
  type CommercialBillingMethod,
  type CommercialEntitlementStatus,
} from "./phase-83b-commercial-entitlement-model";

export function shouldTreatAuthStateAsStaleForPwa(input: {
  status: string;
  entitlementStatus?: CommercialEntitlementStatus | null;
  billingMethod?: CommercialBillingMethod | null;
  paidThrough?: string | null;
  enforcementEnabled: boolean;
  now?: string;
}) {
  if (input.status === "unauthenticated" || input.status === "no_membership") {
    return true;
  }
  if (!input.enforcementEnabled) {
    return false;
  }
  if (input.status !== "authenticated") {
    return true;
  }
  if (input.entitlementStatus !== "active") {
    return true;
  }
  return !evaluateCommercialEntitlementExpiry({
    entitlementStatus: input.entitlementStatus,
    billingMethod: input.billingMethod ?? null,
    paidThrough: input.paidThrough ?? null,
    now: input.now,
  }).activeNow;
}

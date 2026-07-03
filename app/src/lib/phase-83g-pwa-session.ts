import type { CommercialEntitlementStatus } from "./phase-83b-commercial-entitlement-model";

export function shouldTreatAuthStateAsStaleForPwa(input: {
  status: string;
  entitlementStatus?: CommercialEntitlementStatus | null;
  enforcementEnabled: boolean;
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
  return input.entitlementStatus !== "active";
}

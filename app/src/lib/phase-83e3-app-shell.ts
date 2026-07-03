import type { CommercialEntitlementStatus } from "./phase-83b-commercial-entitlement-model";

/**
 * Phase 83E-3 authenticated app shell: pure, testable access-gate logic.
 *
 * This module maps server-resolved auth + entitlement facts to the gate screen
 * the authenticated shell must render. It performs no IO. The mapping is
 * fail-closed: any unknown or missing state resolves to a blocking gate, never
 * to `ok`. This only reflects state that the server already computed; it is not
 * Phase 83G enforces the same active entitlement requirement on protected dashboard APIs
 * through resolveAppTenantContext().
 */

export type DashboardAccessGate =
  | "ok"
  | "no_membership"
  | "no_dietitian_profile"
  | "no_invite"
  | "checkout_incomplete"
  | "inactive_subscription"
  | "revoked_access";

export function deriveDashboardAccessGate(input: {
  hasTenantMembership: boolean;
  hasDietitianProfile: boolean;
  entitlementStatus: CommercialEntitlementStatus | null;
}): DashboardAccessGate {
  if (!input.hasTenantMembership) {
    return "no_membership";
  }
  if (!input.hasDietitianProfile) {
    return "no_dietitian_profile";
  }

  switch (input.entitlementStatus) {
    case "active":
      return "ok";
    case "invited":
    case "checkout_started":
      return "checkout_incomplete";
    case "past_due":
    case "canceled":
      return "inactive_subscription";
    case "revoked":
      return "revoked_access";
    case null:
      return "no_invite";
    default:
      // Fail closed for any unexpected status.
      return "no_invite";
  }
}

export type ShellStatusTone = "emerald" | "amber" | "red" | "stone";

/** Human-facing subscription status label + tone for the shell header. */
export function describeSubscriptionStatus(
  status: CommercialEntitlementStatus | null,
): { label: string; tone: ShellStatusTone } {
  switch (status) {
    case "active":
      return { label: "Abonelik aktif", tone: "emerald" };
    case "invited":
    case "checkout_started":
      return { label: "Ödeme bekliyor", tone: "amber" };
    case "past_due":
      return { label: "Ödeme gecikti", tone: "amber" };
    case "canceled":
      return { label: "Abonelik iptal", tone: "red" };
    case "revoked":
      return { label: "Erişim iptal", tone: "red" };
    case null:
    default:
      return { label: "Abonelik yok", tone: "stone" };
  }
}

/** Install-state label + tone for the shell header. */
export function describeInstallState(installReady: boolean): { label: string; tone: ShellStatusTone } {
  return installReady
    ? { label: "Kurulum hazır", tone: "emerald" }
    : { label: "Kurulum kapalı", tone: "stone" };
}

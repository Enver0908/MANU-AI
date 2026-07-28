import { describe, expect, it } from "vitest";
import { hasCapability } from "./auth-context";
import { evaluateBillingPortalAccess } from "./phase-83c-stripe-billing-gate";
import { SETTINGS_TABS, resolveSettingsTab } from "./phase-85-stage-4d-settings-contracts";
import { genericMagicLinkAcceptedResponse } from "./phase-85-stage-4d-account-security";

describe("phase 85 stage 4d closure contracts", () => {
  it("keeps settings tab allowlist and invalid tab fallback", () => {
    expect(SETTINGS_TABS).toEqual(["profile", "security", "workspace", "billing", "application"]);
    expect(resolveSettingsTab("billing")).toBe("billing");
    expect(resolveSettingsTab("invalid")).toBe("profile");
  });

  it("limits own-profile mutation to active tenant members across roles", () => {
    for (const role of ["owner", "admin", "dietitian", "assistant", "auditor"] as const) {
      expect(hasCapability(role, "update_own_profile")).toBe(true);
    }
    expect(hasCapability("member", "update_own_profile")).toBe(false);
  });

  it("keeps billing portal owner/admin only and magic-link enumeration-safe", () => {
    const dietitianPortal = evaluateBillingPortalAccess({
      isAuthenticated: true,
      hasTenantMembership: true,
      hasDietitianProfile: true,
      entitlementStatus: "active",
      stripeCustomerId: "cus_test",
      role: "dietitian",
    });
    expect(dietitianPortal.allowed).toBe(false);

    const magicLink = genericMagicLinkAcceptedResponse();
    expect(magicLink.sent).toBe(true);
    expect(JSON.stringify(magicLink)).not.toContain("@");
  });
});

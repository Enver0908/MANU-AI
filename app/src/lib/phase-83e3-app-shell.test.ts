import { describe, expect, it } from "vitest";
import {
  deriveDashboardAccessGate,
  describeInstallState,
  describeSubscriptionStatus,
} from "./phase-83e3-app-shell";

describe("phase 83e-3 app shell gates", () => {
  it("requires membership then dietitian profile before entitlement", () => {
    expect(
      deriveDashboardAccessGate({
        hasTenantMembership: false,
        hasDietitianProfile: false,
        entitlementStatus: "active",
      }),
    ).toBe("no_membership");
    expect(
      deriveDashboardAccessGate({
        hasTenantMembership: true,
        hasDietitianProfile: false,
        entitlementStatus: "active",
      }),
    ).toBe("no_dietitian_profile");
  });

  it("unlocks the dashboard only for an active entitlement", () => {
    expect(
      deriveDashboardAccessGate({
        hasTenantMembership: true,
        hasDietitianProfile: true,
        entitlementStatus: "active",
      }),
    ).toBe("ok");
  });

  it("maps each non-active entitlement status to a distinct blocked gate", () => {
    const base = { hasTenantMembership: true, hasDietitianProfile: true } as const;
    expect(deriveDashboardAccessGate({ ...base, entitlementStatus: null })).toBe("no_invite");
    expect(deriveDashboardAccessGate({ ...base, entitlementStatus: "invited" })).toBe(
      "checkout_incomplete",
    );
    expect(deriveDashboardAccessGate({ ...base, entitlementStatus: "checkout_started" })).toBe(
      "checkout_incomplete",
    );
    expect(deriveDashboardAccessGate({ ...base, entitlementStatus: "past_due" })).toBe(
      "inactive_subscription",
    );
    expect(deriveDashboardAccessGate({ ...base, entitlementStatus: "canceled" })).toBe(
      "inactive_subscription",
    );
    expect(deriveDashboardAccessGate({ ...base, entitlementStatus: "revoked" })).toBe(
      "revoked_access",
    );
  });

  it("gives distinct tone/label for subscription and install states", () => {
    expect(describeSubscriptionStatus("active").tone).toBe("emerald");
    expect(describeSubscriptionStatus("revoked").tone).toBe("red");
    expect(describeSubscriptionStatus(null).label.length).toBeGreaterThan(0);
    expect(describeInstallState(true).tone).toBe("emerald");
    expect(describeInstallState(false).tone).toBe("stone");
  });
});

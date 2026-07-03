import { describe, expect, it } from "vitest";
import {
  canAdminCancelStripeSubscription,
  canAdminRevokeAppAccess,
  deriveStripeSubscriptionCancelPlan,
  describeCommercialBlockingReason,
  describeEntitlementStatusLabel,
  describeOnboardingBlockingReason,
  validateStripeSubscriptionCancelRequest,
} from "./phase-84g-subscription-operations";

describe("phase 84g subscription operations", () => {
  it("validates stripe cancel requests", () => {
    expect(validateStripeSubscriptionCancelRequest({ tenantId: "tenant-1" }).valid).toBe(true);
    expect(validateStripeSubscriptionCancelRequest({}).blockingReasons).toContain("tenant_id_required");
  });

  it("requires sandbox stripe and subscription id for cancel plan", () => {
    expect(
      deriveStripeSubscriptionCancelPlan({
        entitlementStatus: "active",
        stripeSubscriptionId: "sub_123",
        stripeSandboxConfigured: true,
      }).allowed,
    ).toBe(true);
    expect(
      deriveStripeSubscriptionCancelPlan({
        entitlementStatus: "active",
        stripeSubscriptionId: null,
        stripeSandboxConfigured: true,
      }).blockingReasons,
    ).toContain("stripe_subscription_id_missing");
    expect(
      deriveStripeSubscriptionCancelPlan({
        entitlementStatus: "canceled",
        stripeSubscriptionId: "sub_123",
        stripeSandboxConfigured: true,
      }).blockingReasons,
    ).toContain("stripe_subscription_already_canceled");
  });

  it("distinguishes app revoke from stripe cancel affordances", () => {
    expect(canAdminRevokeAppAccess("active")).toBe(true);
    expect(canAdminRevokeAppAccess("revoked")).toBe(false);
    expect(
      canAdminCancelStripeSubscription({
        entitlementStatus: "revoked",
        stripeSubscriptionId: "sub_123",
        stripeSandboxConfigured: true,
      }),
    ).toBe(true);
  });

  it("maps entitlement labels and blocking reasons to Turkish copy", () => {
    expect(describeEntitlementStatusLabel("revoked")).toContain("kapatıldı");
    expect(describeEntitlementStatusLabel("canceled")).toContain("Stripe");
    expect(describeOnboardingBlockingReason("entitlement_not_active")).toContain("aktif değil");
    expect(describeCommercialBlockingReason("invite status must be active (current: consumed)")).toContain(
      "kullanılmış",
    );
  });
});

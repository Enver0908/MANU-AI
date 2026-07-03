import { describe, expect, it } from "vitest";
import {
  derivePurchaseGateView,
  deriveCheckoutOutcome,
  describePurchaseBlockingReason,
  isLikelyEmail,
} from "./phase-83e2-purchase-ux";

describe("phase 83e-2 purchase ux", () => {
  it("accepts well-formed emails and rejects malformed ones", () => {
    expect(isLikelyEmail("Diyetisyen@Example.COM")).toBe(true);
    expect(isLikelyEmail("  user@site.io ")).toBe(true);
    expect(isLikelyEmail("not-an-email")).toBe(false);
    expect(isLikelyEmail("missing@domain")).toBe(false);
    expect(isLikelyEmail("")).toBe(false);
  });

  it("unlocks checkout only for an explicit eligible=true 2xx response", () => {
    const view = derivePurchaseGateView(200, { eligible: true, normalizedEmail: "a@b.com" });
    expect(view).toEqual({ kind: "eligible", normalizedEmail: "a@b.com" });
  });

  it("fails closed to waitlist when eligibility is false", () => {
    const view = derivePurchaseGateView(200, {
      eligible: false,
      blockingReasons: ["invite not found for email"],
    });
    expect(view.kind).toBe("waitlist");
    if (view.kind === "waitlist") {
      expect(view.reasons).toContain("invite not found for email");
    }
  });

  it("treats a 503 or unconfigured error as not_configured, never eligible", () => {
    expect(derivePurchaseGateView(503, {}).kind).toBe("not_configured");
    expect(
      derivePurchaseGateView(200, { error: "commercial_billing_not_configured" }).kind,
    ).toBe("not_configured");
  });

  it("treats other non-2xx responses as an error, never eligible", () => {
    expect(derivePurchaseGateView(400, { eligible: true }).kind).toBe("error");
    expect(derivePurchaseGateView(500, {}).kind).toBe("error");
  });

  it("returns a redirect only when checkout succeeds with a url", () => {
    expect(deriveCheckoutOutcome(200, { checkoutUrl: "https://stripe.test/x" })).toEqual({
      redirectUrl: "https://stripe.test/x",
    });
    expect(deriveCheckoutOutcome(200, {})).toHaveProperty("errorMessage");
  });

  it("maps checkout failures to specific fail-closed messages", () => {
    expect(deriveCheckoutOutcome(503, { error: "stripe_sandbox_not_configured" })).toHaveProperty(
      "errorMessage",
    );
    const forbidden = deriveCheckoutOutcome(403, { error: "invite_not_eligible_for_checkout" });
    expect("errorMessage" in forbidden && forbidden.errorMessage.length).toBeGreaterThan(0);
  });

  it("describes known blocking reasons in Turkish with a safe default", () => {
    expect(describePurchaseBlockingReason("invite not found for email")).toContain("davet");
    expect(describePurchaseBlockingReason("invite token does not match")).toContain("kod");
    expect(describePurchaseBlockingReason("invite has expired")).toContain("süresi");
    expect(describePurchaseBlockingReason("some unmapped reason").length).toBeGreaterThan(0);
  });
});

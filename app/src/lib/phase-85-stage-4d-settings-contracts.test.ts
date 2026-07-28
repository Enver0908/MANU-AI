import { describe, expect, it } from "vitest";
import {
  assertSettingsReadModelHasNoInternalIds,
  buildFallbackSettingsAccountReadModel,
  buildSettingsHref,
  canViewSubscriptionStatus,
  maskEmailForSettings,
  projectBillingVisibility,
  resolveSettingsTab,
  SETTINGS_ROOT_PATH,
  SETTINGS_TABS,
} from "./phase-85-stage-4d-settings-contracts";

describe("phase-85-stage-4d settings contracts", () => {
  it("allowlists settings tabs and defaults invalid values to profile", () => {
    expect(SETTINGS_TABS).toEqual(["profile", "security", "workspace", "billing", "application"]);
    expect(resolveSettingsTab("security")).toBe("security");
    expect(resolveSettingsTab("billing")).toBe("billing");
    expect(resolveSettingsTab("unknown")).toBe("profile");
    expect(resolveSettingsTab(undefined)).toBe("profile");
    expect(resolveSettingsTab(null)).toBe("profile");
  });

  it("builds deep-link hrefs without leaking raw ids", () => {
    expect(buildSettingsHref("profile")).toBe(SETTINGS_ROOT_PATH);
    expect(buildSettingsHref("workspace")).toBe(`${SETTINGS_ROOT_PATH}?tab=workspace`);
  });

  it("masks emails and restricts subscription visibility to owner/admin", () => {
    expect(maskEmailForSettings("dietitian@example.com")).toBe("di***@example.com");
    expect(maskEmailForSettings("a@example.com")).toBe("a***@example.com");
    expect(maskEmailForSettings("not-an-email")).toBeNull();
    expect(canViewSubscriptionStatus("owner")).toBe(true);
    expect(canViewSubscriptionStatus("admin")).toBe(true);
    expect(canViewSubscriptionStatus("dietitian")).toBe(false);
    expect(canViewSubscriptionStatus("assistant")).toBe(false);
    expect(canViewSubscriptionStatus("auditor")).toBe(false);
  });

  it("projects billing visibility by role without exposing entitlement to non-admins", () => {
    expect(
      projectBillingVisibility({
        role: "owner",
        entitlementStatus: "active",
        mode: "configured",
      }),
    ).toEqual({
      visibility: "subscription_status",
      entitlementStatus: "active",
      workspaceAccessActive: true,
    });

    expect(
      projectBillingVisibility({
        role: "dietitian",
        entitlementStatus: "active",
        mode: "configured",
      }),
    ).toEqual({
      visibility: "workspace_access_active",
      entitlementStatus: null,
      workspaceAccessActive: true,
    });

    expect(
      projectBillingVisibility({
        role: "owner",
        entitlementStatus: "active",
        mode: "fallback",
      }),
    ).toEqual({
      visibility: "unavailable",
      entitlementStatus: null,
      workspaceAccessActive: false,
    });
  });

  it("builds a fallback read model without internal ids", () => {
    const model = buildFallbackSettingsAccountReadModel("en");
    expect(model.runtime.mode).toBe("fallback");
    expect(model.runtime.identityActionsAvailable).toBe(false);
    expect(model.runtime.billingActionsAvailable).toBe(false);
    expect(model.runtime.pwaActionsAvailable).toBe(false);
    expect(model.profile.timezone).toBe("Europe/Istanbul");
    expect(model.workspace.settingsRevision).toBe(0);
    expect(model.security.available).toBe(false);
    expect(model.application.installState).toBe("unavailable");
    expect(() => assertSettingsReadModelHasNoInternalIds(model)).not.toThrow();
  });
});

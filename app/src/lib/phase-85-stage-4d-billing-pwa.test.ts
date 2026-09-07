import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSettingsHref, projectBillingVisibility } from "./phase-85-stage-4d-settings-contracts";
import {
  evaluateMobileInstallCenterAccess,
  isMobileInstallAuditEventType,
  sanitizeMobileInstallUserAgentSummary,
} from "./phase-83d-pwa-install-gate";

describe("phase 85 stage 4d billing and PWA", () => {
  it("builds billing settings return URL for portal redirect", () => {
    expect(buildSettingsHref("billing")).toBe("/dashboard/settings?tab=billing");
    expect(buildSettingsHref("application")).toBe("/dashboard/settings?tab=application");
  });

  it("accepts only allowlisted mobile install audit event types", () => {
    expect(isMobileInstallAuditEventType("install_prompt_shown")).toBe(true);
    expect(isMobileInstallAuditEventType("offline_banner_shown")).toBe(true);
    expect(isMobileInstallAuditEventType("stale_session_detected")).toBe(true);
    expect(isMobileInstallAuditEventType("userAgentSummary")).toBe(false);
    expect(isMobileInstallAuditEventType("")).toBe(false);
  });

  it("sanitizes user-agent summaries server-side without client body reliance", () => {
    const sanitized = sanitizeMobileInstallUserAgentSummary(
      "Mozilla/5.0 Chrome +905551112233 dietitian@example.com",
    );
    expect(sanitized).not.toContain("+905551112233");
    expect(sanitized).not.toContain("dietitian@example.com");
    expect(sanitized.length).toBeLessThanOrEqual(240);
  });

  it("projects billing portal recovery states without exposing Stripe ids", () => {
    expect(
      projectBillingVisibility({
        role: "owner",
        entitlementStatus: "past_due",
        mode: "configured",
        stripeConfigured: true,
        stripeCustomerId: "cus_test_123",
      }).portalState,
    ).toBe("available");

    expect(
      projectBillingVisibility({
        role: "dietitian",
        entitlementStatus: "active",
        mode: "configured",
        stripeConfigured: true,
        stripeCustomerId: "cus_test_123",
      }).portalState,
    ).toBe("forbidden");

    expect(
      projectBillingVisibility({
        role: "owner",
        entitlementStatus: "active",
        mode: "configured",
        stripeConfigured: false,
        stripeCustomerId: "cus_test_123",
      }).portalState,
    ).toBe("sandbox_unconfigured");
  });

  it("returns sanitized mobile install blocked reason codes", () => {
    expect(
      evaluateMobileInstallCenterAccess({
        isAuthenticated: true,
        hasTenantMembership: false,
        hasDietitianProfile: false,
        entitlementStatus: "past_due",
      }).blockingReasonCodes,
    ).toEqual(["membership_required", "profile_required", "entitlement_inactive"]);
  });

  it("keeps the PWA audit migration idempotent and duplicate-safe before indexing", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260728180000_phase_85_stage_4d_remediation_security_billing_pwa.sql",
      ),
      "utf8",
    );

    const archivePosition = migration.indexOf("create table if not exists mobile_install_audit_event_duplicate_archive");
    const cleanupPosition = migration.indexOf("delete from mobile_install_audit_events events");
    const uniqueIndexPosition = migration.indexOf("mobile_install_audit_events_daily_unique_idx");

    expect(archivePosition).toBeGreaterThan(-1);
    expect(cleanupPosition).toBeGreaterThan(archivePosition);
    expect(uniqueIndexPosition).toBeGreaterThan(cleanupPosition);
    expect(migration).toContain("alter table mobile_install_audit_event_duplicate_archive enable row level security");
    expect(migration).toContain("revoke all on table mobile_install_audit_event_duplicate_archive");
    expect(migration).toContain("on conflict (archived_id) do nothing");
  });
});

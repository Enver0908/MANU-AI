import { describe, expect, it } from "vitest";
import { buildSettingsHref } from "./phase-85-stage-4d-settings-contracts";
import {
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
    expect(sanitized.length).toBeLessThanOrEqual(240);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPwaRuntimeEnvironment,
  detectIosSafariUserAgent,
  detectPwaInstalledMode,
  evaluateMobileInstallCenterAccess,
  isMobileInstallAuditEventType,
  sanitizeMobileInstallUserAgentSummary,
  shouldServiceWorkerCachePath,
  summarizePhase83dPwaInstallGate,
} from "./phase-83d-pwa-install-gate";

describe("phase 83d pwa install gate", () => {
  it("never caches API routes in the service worker policy", () => {
    expect(shouldServiceWorkerCachePath("/api/app-state")).toBe(false);
    expect(shouldServiceWorkerCachePath("/api/commercial/checkout")).toBe(false);
    expect(shouldServiceWorkerCachePath("/api/clients/123/export")).toBe(false);
  });

  it("allows shell and static asset caching only", () => {
    expect(shouldServiceWorkerCachePath("/dashboard")).toBe(true);
    expect(shouldServiceWorkerCachePath("/app-install")).toBe(true);
    expect(shouldServiceWorkerCachePath("/manifest.webmanifest")).toBe(true);
    expect(shouldServiceWorkerCachePath("/_next/static/chunks/main.js")).toBe(true);
    expect(shouldServiceWorkerCachePath("/clients")).toBe(false);
  });

  it("blocks mobile install center for non-active subscribers", () => {
    const blocked = evaluateMobileInstallCenterAccess({
      isAuthenticated: true,
      hasTenantMembership: true,
      hasDietitianProfile: true,
      entitlementStatus: "checkout_started",
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.blockingReasons).toContain(
      "entitlement status must be active (current: checkout_started)",
    );

    const allowed = evaluateMobileInstallCenterAccess({
      isAuthenticated: true,
      hasTenantMembership: true,
      hasDietitianProfile: true,
      entitlementStatus: "active",
    });
    expect(allowed.allowed).toBe(true);
  });

  it("detects installed display mode and iOS Safari", () => {
    expect(
      detectPwaInstalledMode({ displayMode: "standalone", navigatorStandalone: false }).isInstalled,
    ).toBe(true);
    expect(
      detectPwaInstalledMode({ displayMode: "browser", navigatorStandalone: true }).isInstalled,
    ).toBe(true);

    expect(
      detectIosSafariUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
    expect(
      detectIosSafariUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
  });

  it("builds runtime environment flags for install UX routing", () => {
    const env = buildPwaRuntimeEnvironment({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/121.0.0.0 Mobile Safari/537.36",
      displayMode: "browser",
      isOnline: true,
      supportsBeforeInstallPrompt: true,
    });

    expect(env.isIosSafari).toBe(false);
    expect(env.supportsBeforeInstallPrompt).toBe(true);
    expect(env.isInstalled).toBe(false);
  });

  it("validates audit event types and sanitizes user agent summaries", () => {
    expect(isMobileInstallAuditEventType("install_prompt_shown")).toBe(true);
    expect(isMobileInstallAuditEventType("unknown_event")).toBe(false);
    expect(sanitizeMobileInstallUserAgentSummary("Chrome +905551112233")).not.toContain("+905551112233");
  });

  it("documents install gate summary without secrets", () => {
    const summary = summarizePhase83dPwaInstallGate();
    expect(summary.installRoute).toBe("/app-install");
    expect(summary.manifestStartUrl).toBe("/dashboard");
    expect(summary.apiCachePolicy).toBe("network_only");
  });

  it("keeps public service worker on network-only for API routes", () => {
    const swSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
    expect(swSource).toContain('pathname.startsWith("/api/")');
    expect(swSource).not.toContain('cache.addAll(["/", "/dashboard"');
  });
});

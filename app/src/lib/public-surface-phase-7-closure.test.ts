import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AIYA_ADMIN_APP_URL,
  AIYA_APP_URL,
  AIYA_BRAND_NAME,
  AIYA_TECHNICAL_COMPATIBILITY_NAMES,
} from "./brand";
import { POST_AUTH_REDIRECT_ALLOWLIST_PREFIXES, sanitizePostAuthRedirectPath } from "./phase-84d-customer-auth";
import { SHELL_SESSION_INACTIVITY_MS } from "./phase-85-stage-5-shell-session-policy";
import { classifyShellServiceWorkerRequest } from "./phase-85-stage-5-shell-pwa";

const appRoot = process.cwd();
const srcRoot = path.join(appRoot, "src");
const repoDocs = path.resolve(appRoot, "..", "docs");

const REMOVED_UNUSED_UI_FILES = [
  "components/dashboard/simulator-panel.tsx",
  "components/dashboard/operational-foundation-panel.tsx",
  "components/dashboard/active-client-control.tsx",
  "components/dashboard/client-status-strip.tsx",
  "components/dashboard/copilot-panel.tsx",
  "components/dashboard/handoffs-panel.tsx",
  "components/aiya-marketing-page.tsx",
  "components/contact-lead-form.tsx",
] as const;

const KEPT_BACKEND_SURFACES = [
  "app/api/simulator/route.ts",
  "app/api/simulator/visual/route.ts",
  "app/api/simulator/voice/route.ts",
  "app/api/operational-foundation/route.ts",
  "app/api/commercial/checkout/route.ts",
  "app/api/commercial/webhook/route.ts",
] as const;

const PRIOR_EVIDENCE_FILES = [
  "PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_0_BASELINE_EVIDENCE.md",
  "PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_1_DASHBOARD_PRODUCTION_SURFACE_EVIDENCE.md",
  "PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_2_TWO_HOUR_SESSION_EVIDENCE.md",
  "PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_3_PASSWORD_ONBOARDING_EVIDENCE.md",
  "PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_4_ADMIN_CUSTOMER_LIFECYCLE_EVIDENCE.md",
  "PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_5_PUBLIC_SITE_CTA_BRAND_METADATA_EVIDENCE.md",
  "PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_6_PWA_INSTALL_RESPONSIVE_A11Y_EVIDENCE.md",
] as const;

function readSrc(relativePath: string) {
  return readFileSync(path.join(srcRoot, relativePath), "utf8");
}

describe("P7.1 unused frontend import graph", () => {
  it("reports only proven-unused UI files as removed and keeps live panels imported", () => {
    const result = spawnSync(process.execPath, ["scripts/analyze-frontend-import-graph.mjs"], {
      cwd: appRoot,
      encoding: "utf8",
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    for (const relativePath of REMOVED_UNUSED_UI_FILES) {
      expect(existsSync(path.join(srcRoot, relativePath)), relativePath).toBe(false);
    }

    const dashboardApp = readSrc("components/dashboard-app.tsx");
    expect(dashboardApp).toContain("OverviewPanel");
    expect(dashboardApp).toContain("MessagingPanel");
    expect(dashboardApp).toContain("VoicePanel");
    expect(dashboardApp).not.toContain("SimulatorPanel");
    expect(dashboardApp).not.toContain("OperationalFoundationPanel");
    expect(dashboardApp).not.toContain("CopilotPanel");
    expect(dashboardApp).not.toContain("HandoffsPanel");

    const page = readSrc("app/page.tsx");
    expect(page).toContain("ContactSection");
    expect(page).not.toContain("AiyaMarketingPage");
    expect(page).not.toContain("ContactLeadForm");
  });
});

describe("P7.2 kept backend and billing contracts", () => {
  it("does not delete simulator, operational-foundation, or Stripe routes", () => {
    for (const relativePath of KEPT_BACKEND_SURFACES) {
      expect(existsSync(path.join(srcRoot, relativePath)), relativePath).toBe(true);
    }
  });
});

describe("P7.4 active runtime brand and demo-text scan", () => {
  it("keeps public/auth/dashboard runtime free of retired visible brand and demo chrome", () => {
    const files = [
      "app/page.tsx",
      "components/public/PublicNavbar.tsx",
      "components/public/HeroSection.tsx",
      "components/public/PublicFooter.tsx",
      "components/customer-login-form.tsx",
      "components/dashboard-app.tsx",
      "components/dashboard/dashboard-navigation.tsx",
      "components/dashboard/overview-panel.tsx",
    ];
    for (const relativePath of files) {
      let source = readSrc(relativePath);
      for (const token of AIYA_TECHNICAL_COMPATIBILITY_NAMES) {
        source = source.replaceAll(token, "");
      }
      expect(source, relativePath).not.toMatch(/siriusai\.store/i);
      expect(source, relativePath).not.toMatch(/\bSiriusAI\b/);
      expect(source, relativePath).not.toContain("NO-GO");
      expect(source, relativePath).not.toContain("Demoyu sıfırla");
      expect(source, relativePath).not.toContain("Operasyon paneli");
      expect(source, relativePath).not.toContain("Gelen mesaj simülatörü");
    }
    expect(AIYA_BRAND_NAME).toBe("AIya");
    expect(AIYA_APP_URL).toBe("https://aiyaworkspace.com");
    expect(AIYA_ADMIN_APP_URL).toBe("https://admin.aiyaworkspace.com");
  });
});

describe("P7.5 tenant and service-role boundaries", () => {
  it("keeps reactivate from copying client data or pulling WhatsApp history", () => {
    const store = readSrc("lib/commercial-admin-store.ts");
    expect(store).toContain("copiedClientData: false");
    expect(store).not.toMatch(/whatsapp[\s\S]{0,80}backfill/i);
    const reactivateSql = readFileSync(
      path.join(appRoot, "supabase/migrations/20260903100000_commercial_entitlement_reactivation.sql"),
      "utf8",
    );
    expect(reactivateSql).toContain("copiedClientData");
    expect(reactivateSql).toContain("false");
  });
});

describe("P7.6 unified auth and access lifecycle contracts", () => {
  it("keeps invite, password login, magic-link fallback, revoke, and reactivate", () => {
    const adminModel = readSrc("lib/phase-83f-commercial-admin.ts");
    expect(adminModel).toContain('"activate" | "renew" | "reactivate"');
    const login = readSrc("components/customer-login-form.tsx");
    expect(login).toContain("E-posta ve şifreyle giriş");
    expect(login).toContain("Giriş bağlantısı gönder");
    const onboarding = readSrc("components/onboarding-claim-panel.tsx");
    expect(onboarding).toMatch(/readOnly|read-only|invitedEmail/i);
    const consoleSource = readSrc("components/commercial-admin-console.tsx");
    expect(consoleSource).toContain("invite_customer");
    expect(consoleSource).toContain("Erişimi kapat");
    expect(POST_AUTH_REDIRECT_ALLOWLIST_PREFIXES).toContain("/app-install");
    expect(sanitizePostAuthRedirectPath("/install")).toBeNull();
  });
});

describe("P7.7 PWA privacy and session contracts", () => {
  it("keeps network-only auth/dashboard, two-hour idle, and offline lock copy", () => {
    expect(SHELL_SESSION_INACTIVITY_MS).toBe(7_200_000);
    expect(classifyShellServiceWorkerRequest({ pathname: "/api/app-state" })).toBe("network_only");
    expect(classifyShellServiceWorkerRequest({ pathname: "/login", mode: "navigate" })).toBe("network_only");
    const shell = readSrc("components/dashboard/dashboard-shell.tsx");
    expect(shell).toContain("shellOfflineTitle");
    const provider = readSrc("components/dashboard/shell-provider.tsx");
    expect(provider).toContain("demo-logout");
    expect(provider).toContain("go_offline");
  });
});

describe("P7.9 prior phase evidence still exists", () => {
  it("finds Phase 0-6 evidence files with closed verdicts", () => {
    for (const file of PRIOR_EVIDENCE_FILES) {
      const absolute = path.join(repoDocs, file);
      expect(existsSync(absolute), file).toBe(true);
      const body = readFileSync(absolute, "utf8");
      expect(body).toMatch(/PASS_LOCAL_PHASE_[0-6]_CLOSED|PASS_LOCAL_DOCUMENTATION_ONLY/);
    }
  });

  it("finds Phase 7 final evidence with a local-closed verdict", () => {
    const absolute = path.join(
      repoDocs,
      "PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_7_FINAL_EVIDENCE.md",
    );
    expect(existsSync(absolute)).toBe(true);
    const body = readFileSync(absolute, "utf8");
    expect(body).toContain("PASS_LOCAL_PHASE_7_CLOSED");
    for (const step of ["P7.1", "P7.2", "P7.3", "P7.4", "P7.5", "P7.6", "P7.7", "P7.8", "P7.9", "P7.10", "P7.11", "P7.12"]) {
      expect(body).toContain(step);
      expect(body).toMatch(new RegExp(`\\| ${step} \\|[\\s\\S]*?IMPLEMENTED_AND_INSPECTED`));
    }
  });
});

describe("P7.1 remaining live component graph", () => {
  it("keeps imported dashboard and public panels while removed files stay gone", () => {
    expect(existsSync(path.join(srcRoot, "components/dashboard/overview-panel.tsx"))).toBe(true);
    expect(existsSync(path.join(srcRoot, "components/dashboard/voice-panel.tsx"))).toBe(true);
    expect(existsSync(path.join(srcRoot, "components/public/ContactSection.tsx"))).toBe(true);
    expect(existsSync(path.join(srcRoot, "components/ui/index.ts"))).toBe(true);
    for (const relativePath of REMOVED_UNUSED_UI_FILES) {
      expect(existsSync(path.join(srcRoot, relativePath)), relativePath).toBe(false);
    }
  });
});

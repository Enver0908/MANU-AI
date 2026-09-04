import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AIYA_BRAND_NAME } from "./brand";
import { POST_AUTH_REDIRECT_ALLOWLIST_PREFIXES, sanitizePostAuthRedirectPath } from "./phase-84d-customer-auth";
import { shouldServiceWorkerCachePath as shouldPhase83dCachePath } from "./phase-83d-pwa-install-gate";
import {
  classifyShellServiceWorkerRequest,
  isLegacyShellCacheName,
  listAllowedShellCacheNames,
  SHELL_ASSET_CACHE_NAME,
  SHELL_LEGACY_CACHE_PREFIX,
  SHELL_STATIC_CACHE_NAME,
  shouldServiceWorkerCachePath,
} from "./phase-85-stage-5-shell-pwa";
import { t } from "./i18n";
import {
  isShellSessionInactivityLocked,
  resolveShellForegroundSessionAction,
  SHELL_SESSION_INACTIVITY_MS,
  shouldWriteShellSessionActivityTouch,
} from "./phase-85-stage-5-shell-session-policy";
import { reduceShellProviderState, createInitialShellProviderState, createFallbackShellBootstrap } from "./phase-85-stage-5-shell-provider-state";

const appRoot = process.cwd();
const srcRoot = join(appRoot, "src");
const publicDir = join(appRoot, "public");

function read(relativePath: string) {
  return readFileSync(join(appRoot, relativePath), "utf8");
}

describe("P6.1 PWA wiring inventory", () => {
  it("keeps manifest, service worker, install route, and shell registration connected", () => {
    expect(existsSync(join(publicDir, "manifest.webmanifest"))).toBe(true);
    expect(existsSync(join(publicDir, "sw.js"))).toBe(true);
    expect(existsSync(join(srcRoot, "app/app-install/page.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/app-install-center.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/pwa-runtime.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/pwa-subscriber-shell.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "lib/phase-85-stage-5-shell-pwa.ts"))).toBe(true);

    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('manifest: "/manifest.webmanifest"');
    expect(layout).toContain("PwaRuntime");

    const pwaRuntime = read("src/components/pwa-runtime.tsx");
    expect(pwaRuntime).toContain("return null");
    expect(pwaRuntime).not.toContain("serviceWorker.register");

    const shellProvider = read("src/components/dashboard/shell-provider.tsx");
    expect(shellProvider).toContain('navigator.serviceWorker');
    expect(shellProvider).toContain('register("/sw.js")');
    expect(shellProvider).toContain("SKIP_WAITING");
    expect(shellProvider).toContain("controllerchange");
    expect(shellProvider).toContain("runBootstrap");

    const installPage = read("src/app/app-install/page.tsx");
    expect(installPage).toContain('path: "/app-install"');
    expect(installPage).toContain("resolveMobileInstallAccess");
  });
});

describe("P6.2 auth redirects use /app-install only", () => {
  it("allows /app-install and rejects retired /install as a post-auth next path", () => {
    expect(POST_AUTH_REDIRECT_ALLOWLIST_PREFIXES).toContain("/app-install");
    expect(POST_AUTH_REDIRECT_ALLOWLIST_PREFIXES).not.toContain("/install");
    expect(sanitizePostAuthRedirectPath("/app-install")).toBe("/app-install");
    expect(sanitizePostAuthRedirectPath("/app-install?source=pwa")).toBe("/app-install?source=pwa");
    expect(sanitizePostAuthRedirectPath("/install")).toBeNull();
    expect(sanitizePostAuthRedirectPath("/install/android")).toBeNull();
  });
});

describe("P6.3 manifest AIya identity", () => {
  it("keeps AIya name, start URL, scope, display, and icon references", () => {
    const manifest = JSON.parse(readFileSync(join(publicDir, "manifest.webmanifest"), "utf8")) as {
      name: string;
      short_name: string;
      start_url: string;
      scope: string;
      display: string;
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };
    expect(manifest.name).toBe(AIYA_BRAND_NAME);
    expect(manifest.short_name).toBe(AIYA_BRAND_NAME);
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.some((icon) => icon.src === "/icons/aiya-192.png" && icon.sizes === "192x192")).toBe(true);
    expect(manifest.icons.some((icon) => icon.src === "/icons/aiya-512.png")).toBe(true);
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    expect(existsSync(join(publicDir, "icons/aiya-180.png"))).toBe(true);
    expect(existsSync(join(publicDir, "icons/aiya-192.png"))).toBe(true);
    expect(existsSync(join(publicDir, "icons/aiya-512.png"))).toBe(true);
  });
});

describe("P6.4 service worker network-only lock", () => {
  it("does not cache API, auth, navigation, or dashboard HTML", () => {
    const swSource = read("public/sw.js");
    expect(swSource).toContain('pathname.startsWith("/api/")');
    expect(swSource).toContain('request.mode === "navigate"');
    expect(swSource).toContain('pathname === "/login"');
    expect(swSource).toContain('pathname === "/onboarding"');
    expect(swSource).toContain('pathname === "/auth/callback"');
    expect(swSource).toContain('pathname === "/app-install"');
    expect(swSource).not.toContain('cache.addAll(["/", "/dashboard"');
    expect(classifyShellServiceWorkerRequest({ pathname: "/api/app-state" })).toBe("network_only");
    expect(classifyShellServiceWorkerRequest({ pathname: "/api/auth/password-login", method: "POST" })).toBe(
      "network_only",
    );
    expect(classifyShellServiceWorkerRequest({ pathname: "/login", mode: "navigate" })).toBe("network_only");
    expect(classifyShellServiceWorkerRequest({ pathname: "/onboarding", mode: "cors" })).toBe("network_only");
    expect(classifyShellServiceWorkerRequest({ pathname: "/auth/callback" })).toBe("network_only");
    expect(classifyShellServiceWorkerRequest({ pathname: "/dashboard", mode: "navigate" })).toBe("network_only");
    expect(shouldServiceWorkerCachePath("/login")).toBe(false);
    expect(shouldServiceWorkerCachePath("/onboarding")).toBe(false);
    expect(shouldPhase83dCachePath("/login")).toBe(false);
    expect(shouldPhase83dCachePath("/onboarding")).toBe(false);
    expect(shouldPhase83dCachePath("/auth/callback")).toBe(false);
    expect(shouldPhase83dCachePath("/api/clients")).toBe(false);
  });

  it("keeps compatibility cache names and only caches static assets", () => {
    expect(isLegacyShellCacheName(`${SHELL_LEGACY_CACHE_PREFIX}v2`)).toBe(true);
    expect(listAllowedShellCacheNames()).toEqual([SHELL_STATIC_CACHE_NAME, SHELL_ASSET_CACHE_NAME]);
    expect(SHELL_STATIC_CACHE_NAME.startsWith("siriusai-static-")).toBe(true);
    expect(SHELL_ASSET_CACHE_NAME.startsWith("siriusai-assets-")).toBe(true);
    expect(classifyShellServiceWorkerRequest({ pathname: "/_next/static/chunks/main.js" })).toBe(
      "cache_first_static",
    );
    expect(classifyShellServiceWorkerRequest({ pathname: "/manifest.webmanifest" })).toBe(
      "stale_while_revalidate_asset",
    );
  });
});

describe("P6.5 offline privacy-lock", () => {
  it("clears protected bootstrap and shows fail-closed offline copy without health data", () => {
    let state = createInitialShellProviderState("live");
    state = reduceShellProviderState(state, {
      type: "bootstrap_succeeded",
      sequence: 1,
      bootstrap: createFallbackShellBootstrap({ displayName: "Ada" }),
    });
    state = reduceShellProviderState(state, { type: "go_offline" });
    expect(state.runtime).toBe("offline");
    expect(state.bootstrap).toBeNull();
    expect(t("tr", "shellOfflineTitle")).toBe("İnternet bağlantısı gerekli");
    expect(t("tr", "shellOfflineMessage")).toContain("çevrimdışıyken açılamaz");
    expect(t("tr", "shellOfflineMessage")).not.toMatch(/danışan|hasta|PHI|sağlık kaydı/i);
  });
});

describe("P6.6 Phase 1 chrome stays out of the authenticated shell", () => {
  it("does not restore simulator or operational inspection chrome in the live dashboard shell", () => {
    const dashboardApp = read("src/components/dashboard-app.tsx");
    const navigation = read("src/components/dashboard/dashboard-navigation.tsx");
    const dashboardLayout = read("src/app/dashboard/layout.tsx");
    const dashboardShell = read("src/components/dashboard/dashboard-shell.tsx");
    expect(dashboardApp).not.toContain("visual-simulator-panel");
    expect(navigation).not.toContain("Gelen mesaj simülatörü");
    expect(navigation).not.toContain("Demoyu sıfırla");
    expect(navigation).not.toContain("Operasyon paneli");
    expect(dashboardLayout).not.toContain("display-mode");
    expect(dashboardShell).not.toContain("display-mode");
    expect(dashboardShell).not.toContain("standalone");
  });
});

describe("P6.7 two-hour PWA session policy", () => {
  it("uses the same two-hour idle lock for hidden-tab and foreground resume", () => {
    expect(SHELL_SESSION_INACTIVITY_MS).toBe(7_200_000);
    expect(
      shouldWriteShellSessionActivityTouch({
        visibilityState: "hidden",
        online: true,
        runtime: "ready",
        activityPending: true,
        nowMs: 120_000,
        lastActivitySentAtMs: 0,
      }),
    ).toBe(false);
    expect(
      resolveShellForegroundSessionAction({
        visibilityState: "hidden",
        serverSession: "active",
      }).touchActivity,
    ).toBe(false);
    expect(
      isShellSessionInactivityLocked({
        lastInteractiveAt: "2026-09-04T00:00:00.000Z",
        now: "2026-09-04T02:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      resolveShellForegroundSessionAction({
        visibilityState: "visible",
        serverSession: "locked",
      }),
    ).toMatchObject({ lockAndRedirect: true, touchActivity: false });
    const shellProvider = read("src/components/dashboard/shell-provider.tsx");
    expect(shellProvider).toContain('if (mode === "fallback") return;');
    expect(shellProvider).toContain('fetch("/api/session/activity"');
    expect(shellProvider).toContain("SHELL_SESSION_LOGIN_HREF");
  });
});

describe("P6.8 P6.9 install guidance and cache inspection", () => {
  it("shows manual Android install guidance when the install prompt is unavailable", () => {
    const installCenter = read("src/components/app-install-center.tsx");
    expect(installCenter).toContain('data-testid="install-center-manual-android-guide"');
    expect(installCenter).toContain("Ana ekrana ekle veya Uygulamayı yükle");
    expect(installCenter).toContain("Klinik veriler cihazda önbelleğe alınmaz");
    expect(installCenter).not.toContain("try Chrome later");
  });

  it("inspects the service-worker fetch handler so network-only paths never cache.put", () => {
    const swSource = read("public/sw.js");
    expect(swSource).toContain('self.addEventListener("fetch"');
    expect(swSource).toContain("classifyRequest(event.request)");
    expect(swSource).toContain("networkOnly(event.request)");
    expect(swSource).not.toMatch(/if \(klass === "network_only"\)[\s\S]{0,80}cache\.put/);
  });
});

import type { CommercialEntitlementStatus } from "./phase-83b-commercial-entitlement-model";

export const PHASE_83D_VERSION = "phase83d-pwa-install-gate-v1";

export const MOBILE_INSTALL_AUDIT_EVENT_TYPES = [
  "install_prompt_shown",
  "install_accepted",
  "install_dismissed",
  "ios_instructions_viewed",
  "offline_banner_shown",
  "stale_session_detected",
] as const;

export type MobileInstallAuditEventType = (typeof MOBILE_INSTALL_AUDIT_EVENT_TYPES)[number];
export type MobileInstallBlockedReasonCode =
  | "unauthenticated"
  | "membership_required"
  | "profile_required"
  | "entitlement_required"
  | "entitlement_inactive";

export const SERVICE_WORKER_SHELL_PATHS = [] as const;

export const SERVICE_WORKER_STATIC_ASSET_PREFIXES = [
  "/_next/static/",
  "/icon.svg",
  "/icons/",
  "/manifest.webmanifest",
] as const;

export type MobileInstallCenterAccessInput = {
  isAuthenticated: boolean;
  hasTenantMembership: boolean;
  hasDietitianProfile: boolean;
  entitlementStatus: CommercialEntitlementStatus | null;
};

export type PwaRuntimeEnvironment = {
  displayMode: "browser" | "standalone" | "minimal-ui" | "fullscreen" | "unknown";
  isInstalled: boolean;
  isOnline: boolean;
  isIosSafari: boolean;
  isInAppBrowser: boolean;
  supportsBeforeInstallPrompt: boolean;
};

export function shouldServiceWorkerCachePath(pathname: string) {
  if (!pathname || pathname.startsWith("/api/")) {
    return false;
  }

  // Stage 5 Faz 7: navigation / dashboard HTML is network-only for privacy.
  if (
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/app-install" ||
    pathname.startsWith("/app-install/")
  ) {
    return false;
  }

  return SERVICE_WORKER_STATIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isMobileInstallAuditEventType(value: string): value is MobileInstallAuditEventType {
  return (MOBILE_INSTALL_AUDIT_EVENT_TYPES as readonly string[]).includes(value);
}

export function sanitizeMobileInstallUserAgentSummary(userAgent: string) {
  const trimmed = userAgent.trim().slice(0, 240);
  return trimmed
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]");
}

export function evaluateMobileInstallCenterAccess(input: MobileInstallCenterAccessInput) {
  const blockingReasons: string[] = [];
  const blockingReasonCodes: MobileInstallBlockedReasonCode[] = [];
  if (!input.isAuthenticated) {
    blockingReasons.push("authentication required");
    blockingReasonCodes.push("unauthenticated");
  }
  if (!input.hasTenantMembership) {
    blockingReasons.push("tenant membership required");
    blockingReasonCodes.push("membership_required");
  }
  if (!input.hasDietitianProfile) {
    blockingReasons.push("dietitian profile required");
    blockingReasonCodes.push("profile_required");
  }
  if (!input.entitlementStatus) {
    blockingReasons.push("entitlement record required");
    blockingReasonCodes.push("entitlement_required");
  } else if (input.entitlementStatus !== "active") {
    blockingReasons.push(`entitlement status must be active (current: ${input.entitlementStatus})`);
    blockingReasonCodes.push("entitlement_inactive");
  }

  return {
    allowed: blockingReasons.length === 0,
    blockingReasons,
    blockingReasonCodes: [...new Set(blockingReasonCodes)],
  };
}

export function detectPwaInstalledMode(input: {
  displayMode?: string | null;
  navigatorStandalone?: boolean;
}) {
  const displayMode = input.displayMode ?? "browser";
  const installed =
    displayMode === "standalone" ||
    displayMode === "minimal-ui" ||
    displayMode === "fullscreen" ||
    input.navigatorStandalone === true;

  return {
    displayMode: (displayMode || "unknown") as PwaRuntimeEnvironment["displayMode"],
    isInstalled: installed,
  };
}

export function detectIosSafariUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
  return isIos && isSafari;
}

/** Detect common in-app browsers that cannot complete PWA install. */
export function detectInAppBrowserUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  return /fbav|fban|fb_iab|instagram|line\/|twitter|linkedinapp|wv\)|; wv|micromessenger|tiktok|snapchat|pinterest/.test(
    ua,
  );
}

export function buildPwaRuntimeEnvironment(input: {
  userAgent: string;
  displayMode?: string | null;
  navigatorStandalone?: boolean;
  isOnline?: boolean;
  supportsBeforeInstallPrompt?: boolean;
}): PwaRuntimeEnvironment {
  const installed = detectPwaInstalledMode({
    displayMode: input.displayMode,
    navigatorStandalone: input.navigatorStandalone,
  });

  return {
    displayMode: installed.displayMode,
    isInstalled: installed.isInstalled,
    isOnline: input.isOnline ?? true,
    isIosSafari: detectIosSafariUserAgent(input.userAgent),
    isInAppBrowser: detectInAppBrowserUserAgent(input.userAgent),
    supportsBeforeInstallPrompt: input.supportsBeforeInstallPrompt ?? false,
  };
}

export function summarizePhase83dPwaInstallGate() {
  return {
    phase83dVersion: PHASE_83D_VERSION,
    installRoute: "/app-install",
    manifestStartUrl: "/dashboard",
    serviceWorkerShellPaths: [...SERVICE_WORKER_SHELL_PATHS],
    navigationCachePolicy: "network_only",
    apiCachePolicy: "network_only",
    auditEventTypes: [...MOBILE_INSTALL_AUDIT_EVENT_TYPES],
  };
}

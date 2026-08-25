/**
 * Stage 5 Faz 7 PWA offline / update / privacy contracts.
 * Pure helpers only — no DOM side effects.
 */

import {
  compareShellVersions,
  resolveShellDeploymentVersion,
  resolveShellMinClientVersion,
} from "./phase-85-stage-5-shell-contracts";
import {
  resolveClientCompatibilityVersion,
  resolveShellSwCacheVersion,
} from "./release-identity";

export const PHASE_85_STAGE_5_SHELL_PWA_VERSION = "p85-stage-5-shell-pwa-v1";

export const SIRIUSAI_CLIENT_VERSION_HEADER = "x-siriusai-client-version";
export const SIRIUSAI_MUTATION_KIND_HEADER = "x-siriusai-mutation-kind";

export const SHELL_SW_CACHE_VERSION = resolveShellSwCacheVersion();
export const SHELL_STATIC_CACHE_NAME = `siriusai-static-${SHELL_SW_CACHE_VERSION}`;
export const SHELL_ASSET_CACHE_NAME = `siriusai-assets-${SHELL_SW_CACHE_VERSION}`;
export const SHELL_LEGACY_CACHE_PREFIX = "manu-ai-shell-";
export const SHELL_STATIC_CACHE_MAX_ENTRIES = 100;

export const SHELL_ACTIVITY_MIN_INTERVAL_MS = 60_000;

export const SHELL_SW_SKIP_WAITING_MESSAGE = "SKIP_WAITING";

export type ShellSwCacheClass =
  | "network_only"
  | "cache_first_static"
  | "stale_while_revalidate_asset";

export type ShellMutationKind = "save" | "other";

export type ShellMutationUpdateGate = "open" | "save_only" | "blocked";

export type AuthenticatedMutationPolicy =
  | "public_exempt"
  | "session_exempt"
  | "save_allowed_when_outdated"
  | "blocked_when_outdated";

/**
 * Navigation HTML/RSC and /api/* are never cacheable.
 * Hashed /_next/static is cache-first. Icons/manifest are SWR.
 */
export function classifyShellServiceWorkerRequest(input: {
  pathname: string;
  method?: string;
  mode?: string;
}): ShellSwCacheClass {
  const method = (input.method ?? "GET").toUpperCase();
  if (method !== "GET") return "network_only";

  const pathname = input.pathname || "/";
  if (pathname.startsWith("/api/")) return "network_only";
  if (input.mode === "navigate") return "network_only";

  // Exact dashboard/shell HTML navigations must stay network-only even if mode is omitted.
  if (
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/app-install" ||
    pathname.startsWith("/app-install/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/")
  ) {
    return "network_only";
  }

  if (pathname.startsWith("/_next/static/")) return "cache_first_static";

  if (
    pathname === "/manifest.webmanifest" ||
    pathname === "/icon.svg" ||
    pathname.startsWith("/icons/")
  ) {
    return "stale_while_revalidate_asset";
  }

  return "network_only";
}

/** Compatibility wrapper for Phase 83D callers — true only for SW-cacheable GETs. */
export function shouldServiceWorkerCachePath(pathname: string) {
  const klass = classifyShellServiceWorkerRequest({ pathname, method: "GET", mode: "cors" });
  return klass !== "network_only";
}

export function isLegacyShellCacheName(cacheName: string) {
  return cacheName.startsWith(SHELL_LEGACY_CACHE_PREFIX);
}

export function listAllowedShellCacheNames() {
  return [SHELL_STATIC_CACHE_NAME, SHELL_ASSET_CACHE_NAME] as const;
}

export function resolveClientBuildVersion(env: NodeJS.ProcessEnv = process.env) {
  return resolveClientCompatibilityVersion(env);
}

export function isClientUpdateRequired(
  clientVersion: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  const version = clientVersion?.trim() || "";
  if (!version) return true;
  return compareShellVersions(version, resolveShellMinClientVersion(env)) < 0;
}

/**
 * Webhooks, auth, and logout stay outside client-version enforcement.
 */
export function isClientVersionCheckExemptPath(pathname: string) {
  const policy = resolveAuthenticatedMutationPolicy(pathname, "POST");
  return policy === "public_exempt" || policy === "session_exempt";
}

export function isAuthenticatedMutationMethod(method: string) {
  const normalized = method.toUpperCase();
  return normalized === "POST" || normalized === "PUT" || normalized === "PATCH" || normalized === "DELETE";
}

export function resolveAuthenticatedMutationPolicy(
  pathname: string,
  method: string,
): AuthenticatedMutationPolicy {
  if (!isAuthenticatedMutationMethod(method)) return "public_exempt";

  if (
    pathname.startsWith("/api/whatsapp/webhook") ||
    pathname.startsWith("/api/commercial/webhook") ||
    pathname.startsWith("/api/contact/leads") ||
    pathname.startsWith("/api/commercial/checkout") ||
    pathname.startsWith("/api/commercial/invite-status") ||
    pathname.startsWith("/api/commercial/mobile-install-audit") ||
    pathname.startsWith("/api/commercial/onboarding/") ||
    pathname.startsWith("/api/admin/auth/") ||
    pathname === "/api/demo-login" ||
    pathname.startsWith("/api/demo-login/")
  ) {
    return "public_exempt";
  }

  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/api/demo-logout" ||
    pathname.startsWith("/api/demo-logout/") ||
    pathname === "/api/session/activity" ||
    pathname.startsWith("/api/session/activity/")
  ) {
    return "session_exempt";
  }

  if (
    (pathname === "/api/account/profile" && method.toUpperCase() === "PATCH") ||
    (pathname === "/api/dietitian/preferences" && method.toUpperCase() === "PATCH") ||
    (pathname === "/api/clients/forms" && method.toUpperCase() === "POST")
  ) {
    return "save_allowed_when_outdated";
  }

  return "blocked_when_outdated";
}

export function resolveShellMutationUpdateGate(input: {
  updateRequired: boolean;
  optionalUpdateWaiting: boolean;
}): ShellMutationUpdateGate {
  if (input.updateRequired) return "save_only";
  if (input.optionalUpdateWaiting) return "open";
  return "open";
}

export function isShellMutationAllowed(
  gate: ShellMutationUpdateGate,
  kind: ShellMutationKind,
) {
  if (gate === "open") return true;
  if (gate === "blocked") return false;
  return kind === "save";
}

export function shouldBlockOptionalPwaReload(input: {
  dirty: boolean;
  updateRequired: boolean;
}) {
  if (input.updateRequired) return false;
  return input.dirty;
}

export function buildShellReconnectHomeHref() {
  return "/dashboard";
}

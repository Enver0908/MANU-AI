/**
 * Provider-independent shell Web Vitals sink (Stage 5 Faz 9).
 * Production default is no-op. Payloads never include client IDs or raw URL params.
 */

export type ShellResponsiveClass = "compact" | "medium" | "wide";

/** Static route class only — never a raw URL or query string. */
export type ShellMetricRouteClass =
  | "home"
  | "clients"
  | "messages"
  | "alerts"
  | "notifications"
  | "simulator"
  | "voice"
  | "forms"
  | "ai_chat"
  | "settings"
  | "more"
  | "unknown";

export type ShellMetricPayload = {
  name: string;
  value: number;
  rating: string | null;
  responsiveClass: ShellResponsiveClass;
  routeClass: ShellMetricRouteClass;
};

export type ShellMetricSink = (payload: ShellMetricPayload) => void;

const noopShellMetricSink: ShellMetricSink = () => {};

let activeSink: ShellMetricSink = noopShellMetricSink;

export function getShellMetricSink() {
  return activeSink;
}

export function setShellMetricSink(sink: ShellMetricSink | null) {
  activeSink = sink ?? noopShellMetricSink;
}

export function resetShellMetricSink() {
  activeSink = noopShellMetricSink;
}

export function reportShellMetric(payload: ShellMetricPayload) {
  const safe: ShellMetricPayload = {
    name: String(payload.name || "unknown"),
    value: Number.isFinite(payload.value) ? payload.value : 0,
    rating: payload.rating ? String(payload.rating) : null,
    responsiveClass: payload.responsiveClass,
    routeClass: payload.routeClass,
  };
  activeSink(safe);
}

export function resolveShellResponsiveClass(widthPx: number): ShellResponsiveClass {
  if (widthPx < 768) return "compact";
  if (widthPx < 1200) return "medium";
  return "wide";
}

export function resolveShellMetricRouteClass(pathname: string): ShellMetricRouteClass {
  if (pathname.startsWith("/dashboard/ai-chat")) return "ai_chat";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  if (pathname.startsWith("/dashboard/more")) return "more";
  if (!pathname.startsWith("/dashboard")) return "unknown";
  return "home";
}

export function sanitizeShellMetricPayload(input: Record<string, unknown>): ShellMetricPayload | null {
  const name = typeof input.name === "string" ? input.name : null;
  const value = typeof input.value === "number" ? input.value : null;
  if (!name || value === null || !Number.isFinite(value)) return null;
  if ("clientId" in input || "url" in input || "search" in input || "href" in input) {
    return null;
  }
  const responsiveClass = input.responsiveClass;
  const routeClass = input.routeClass;
  if (responsiveClass !== "compact" && responsiveClass !== "medium" && responsiveClass !== "wide") {
    return null;
  }
  const allowedRoutes = new Set([
    "home",
    "clients",
    "messages",
    "alerts",
    "notifications",
    "simulator",
    "voice",
    "forms",
    "ai_chat",
    "settings",
    "more",
    "unknown",
  ]);
  if (typeof routeClass !== "string" || !allowedRoutes.has(routeClass)) return null;
  return {
    name,
    value,
    rating: typeof input.rating === "string" ? input.rating : null,
    responsiveClass,
    routeClass: routeClass as ShellMetricRouteClass,
  };
}

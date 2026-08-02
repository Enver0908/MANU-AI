import { describe, expect, it, beforeEach } from "vitest";
import {
  reportShellMetric,
  resetShellMetricSink,
  sanitizeShellMetricPayload,
  setShellMetricSink,
  resolveShellMetricRouteClass,
  resolveShellResponsiveClass,
} from "./phase-85-stage-5-shell-metric-sink";

describe("phase-85-stage-5-shell-metric-sink", () => {
  beforeEach(() => {
    resetShellMetricSink();
  });

  it("defaults to no-op and never forwards clientId or raw URL fields", () => {
    const received: unknown[] = [];
    setShellMetricSink((payload) => received.push(payload));
    reportShellMetric({
      name: "LCP",
      value: 1200,
      rating: "good",
      responsiveClass: "compact",
      routeClass: "home",
    });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      name: "LCP",
      value: 1200,
      rating: "good",
      responsiveClass: "compact",
      routeClass: "home",
    });
    expect(sanitizeShellMetricPayload({
      name: "LCP",
      value: 1,
      responsiveClass: "wide",
      routeClass: "home",
      clientId: "c1",
    })).toBeNull();
    expect(sanitizeShellMetricPayload({
      name: "LCP",
      value: 1,
      responsiveClass: "wide",
      routeClass: "home",
      url: "/dashboard?clientId=1",
    })).toBeNull();
  });

  it("maps viewport width and pathname to static classes", () => {
    expect(resolveShellResponsiveClass(390)).toBe("compact");
    expect(resolveShellResponsiveClass(900)).toBe("medium");
    expect(resolveShellResponsiveClass(1400)).toBe("wide");
    expect(resolveShellMetricRouteClass("/dashboard/ai-chat/abc")).toBe("ai_chat");
    expect(resolveShellMetricRouteClass("/dashboard/settings")).toBe("settings");
    expect(resolveShellMetricRouteClass("/dashboard")).toBe("home");
  });
});

"use client";

import { useReportWebVitals } from "next/web-vitals";
import { usePathname } from "next/navigation";
import {
  reportShellMetric,
  resolveShellMetricRouteClass,
  resolveShellResponsiveClass,
} from "@/lib/phase-85-stage-5-shell-metric-sink";

/**
 * Reports Next Web Vitals through the provider-independent ShellMetricSink.
 * Default sink is no-op in production until a local lab harness registers one.
 */
export function ShellWebVitalsReporter() {
  const pathname = usePathname() || "/dashboard";

  useReportWebVitals((metric) => {
    if (typeof window === "undefined") return;
    reportShellMetric({
      name: metric.name,
      value: metric.value,
      rating: "rating" in metric && typeof metric.rating === "string" ? metric.rating : null,
      responsiveClass: resolveShellResponsiveClass(window.innerWidth),
      routeClass: resolveShellMetricRouteClass(pathname),
    });
  });

  return null;
}

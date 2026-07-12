"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildDashboardHref,
  mergeDashboardUrlState,
  parseDashboardSearchParams,
  type DashboardSection,
  type DashboardUrlState,
} from "./phase-85-stage-4b-dashboard-routing";

export function useDashboardUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlState = useMemo(() => parseDashboardSearchParams(searchParams), [searchParams]);

  const navigateDashboard = useCallback(
    (patch: Partial<DashboardUrlState>, options?: { replace?: boolean }) => {
      const next = mergeDashboardUrlState(urlState, patch);
      const href = buildDashboardHref(pathname, next);
      if (options?.replace) {
        router.replace(href);
        return;
      }
      router.push(href);
    },
    [pathname, router, urlState],
  );

  const openSection = useCallback(
    (section: DashboardSection, patch: Partial<DashboardUrlState> = {}) => {
      navigateDashboard({ ...patch, section });
    },
    [navigateDashboard],
  );

  return {
    urlState,
    section: urlState.section,
    navigateDashboard,
    openSection,
  };
}

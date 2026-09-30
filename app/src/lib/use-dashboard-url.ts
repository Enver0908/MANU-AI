"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildDashboardHref,
  commitDashboardHref,
  mergeDashboardUrlState,
  parseDashboardSearchParams,
  shouldUseClientOnlyDashboardNavigation,
  subscribeDashboardHrefChange,
  type DashboardSection,
  type DashboardUrlState,
} from "./phase-85-stage-4b-dashboard-routing";

function queryFromLocation(searchParams: { toString(): string }) {
  if (typeof window === "undefined") return searchParams.toString();
  return window.location.search.replace(/^\?/, "");
}

/**
 * App Router `useSearchParams` can stay stale after same-page query updates.
 * Prefer the committed `window.location` query after `commitDashboardHref`.
 */
export function useCommittedDashboardSearchParams() {
  const searchParams = useSearchParams();
  const [committedQuery, setCommittedQuery] = useState(() => queryFromLocation(searchParams));

  useEffect(() => {
    const sync = () => {
      setCommittedQuery(queryFromLocation(searchParams));
    };
    sync();
    return subscribeDashboardHrefChange(sync);
  }, [searchParams]);

  return useMemo(() => new URLSearchParams(committedQuery), [committedQuery]);
}

export function useDashboardUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useCommittedDashboardSearchParams();
  const urlState = useMemo(() => parseDashboardSearchParams(searchParams), [searchParams]);
  const urlStateRef = useRef(urlState);
  urlStateRef.current = urlState;

  const navigateDashboard = useCallback(
    (patch: Partial<DashboardUrlState>, options?: { replace?: boolean }) => {
      const current =
        typeof window === "undefined"
          ? urlStateRef.current
          : parseDashboardSearchParams(new URLSearchParams(window.location.search));
      const next = mergeDashboardUrlState(current, patch);
      urlStateRef.current = next;
      const href = buildDashboardHref(pathname, next);
      if (shouldUseClientOnlyDashboardNavigation(pathname, href)) {
        commitDashboardHref(href, options?.replace ? "replace" : "push");
        return;
      }
      if (options?.replace) {
        router.replace(href);
        return;
      }
      router.push(href);
    },
    [pathname, router],
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

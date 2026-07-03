/**
 * Phase 83E-6 states, accessibility, and polish: pure constants shared by dashboard
 * loading/empty/error surfaces. No IO and no clinical behavior.
 */

/** Visible focus ring for keyboard navigation (emerald primary, WCAG-friendly offset). */
export const FOCUS_RING_CLASS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800";

/** Shared pulse animation block for skeleton placeholders. */
export const SKELETON_BLOCK_CLASS = "animate-pulse rounded-control bg-stone-200/80";

/** Skip-link target id on the dashboard main content region. */
export const DASHBOARD_MAIN_ID = "dashboard-main";

/** aria-live politeness for non-blocking status banners (e.g. offline). */
export const STATUS_BANNER_LIVE = "polite" as const;

/** aria-live politeness for blocking recovery banners (e.g. stale session). */
export const ALERT_BANNER_LIVE = "assertive" as const;

# Phase 85 Stage 7.3 Dashboard/PWA Remediation Evidence

Date: 2026-08-23

Status: STAGE_7_3_DASHBOARD_PWA_REMEDIATION

Stage 5: STAGE_5_CLOSED

Stage 6: STAGE_6_CLOSED

Physical iPhone: WAIVED_NOT_EXECUTED

Production: NO-GO

## Result

Stage 7.3 closed the dashboard and installed-PWA program on shared shell chrome, overview, client workspace presentation, form/nutrition/menu density, AI control state text, messaging/alerts/notifications layout, role-capability assertions, helper tests, and the phase-scoped verify gate. Snapshot baselines were not refreshed; that wait is bound to user visual approval of the representative before/after set.

## Assigned findings

Stage 7.1 recorded two P1s on `pwa.pwa-offline-lock.dietitian.tr.chromium-desktop` (`document-title`, `html-has-lang`) and assigned them to **7.3**. Both are **resolved**.

Root cause: the Stage 7 runner reloaded `/dashboard` after `setOffline(true)` with `serviceWorkers: "block"`. Chromium then painted its interstitial document, which has no `lang` and no title. Product `layout.tsx` already sets `lang="tr"` and a non-empty title. The in-app shell already unmounts protected content on `offline`.

Fix: drive `shell-offline` and `pwa-offline-lock` with `setOffline(true)` plus `window` `offline` dispatch. Do not reload. The product document stays mounted, the shell blocker is shown, protected chrome is unmounted, and axe sees `lang` plus `title`. Service-worker network-only navigation policy is unchanged.

The remaining P2 (Tab focus stayed on BODY in the same offline-lock scenario) stays **open** on **7.4**.

After this phase, Stage 7.3-owned open P0/P1/P2 count is **0**.

## Shared shell work

- Header, compact bottom nav, and main column keep `min-w-0` and safe-area padding.
- Compact/rail/wide command labels use `.command-label` wrapping instead of meaning-losing truncation.
- Active-client control remains in the header; bell and update banners remain in the existing Stage 5 slots.
- Offline blocker exposes `data-shell-runtime="offline"` and `shell-retry` without replacing Stage 5 runtime ownership.
- Protected content stays unmounted while the offline blocker is shown.

## Dashboard surfaces

- Overview keeps daily work first and an active-client panel. No invented KPI tiles.
- Roster stays side-by-side on desktop and roster → hub → task on mobile through the existing Stage 6 workspace.
- Form save sits in a sticky bar above the compact nav, with extra panel padding so focus is not covered.
- AI control adds explicit text for readiness, takeover, read-only, and stale/mismatch. Clinical risk colors are not reused as generic status.
- Messaging keeps desktop split and mobile drill-down. Alerts and notifications keep sticky filters plus empty/pending/error/stale copy.
- Simulator, AI chat, voice, forms library, and settings consume the same shared primitives; mutation contracts are unchanged.
- Role assertions lock the existing capability matrix: owner/admin/dietitian may mutate; assistant/auditor remain read-only. No new permission is derived.

## Tests

- Vitest helpers: catalog dashboard/PWA surfaces, capability matrix, offline driver has no reload, shell contract strings, privacy scan.
- Playwright `stage-7-phase-7-3.spec.ts`: Chromium dashboard routes, overview hierarchy, in-app offline lock, Android 44px chrome, 320px reflow, keyboard chrome, WebKit iPhone/iPad smoke, Firefox smoke.
- `node scripts/verify-stage-7.mjs --self-test` still fails on unscoped open P1 and passes the 7.2 phase filter.
- `node scripts/verify-stage-7.mjs --phase=7.3` is the dashboard/PWA verify gate.
- Production build is part of the 7.3 verification set.
- Visual snapshot baselines are unchanged.

## Representative visuals for user approval

Before/after set to review (baselines must not update until this set is approved):

- Dashboard shell desktop and Android
- Client hub and form
- Nutrition / menu
- Messaging list / detail
- Alerts / notifications
- AI control / read-only

Current after-state is the local dashboard/PWA UI after this phase. Capture those screens during review; do not treat Playwright snapshot refresh as 7.3 closure.

## Explicit non-claims

- Production remains NO-GO.
- Physical iPhone remains WAIVED_NOT_EXECUTED.
- Stage 7.4 accessibility/browser/performance closure is not started.
- API, store, mutation, Stage 6 workspace hook, and service-worker cache/PHI policy are unchanged.
- Stage 5 shell and Stage 6 workflow contracts remain closed.

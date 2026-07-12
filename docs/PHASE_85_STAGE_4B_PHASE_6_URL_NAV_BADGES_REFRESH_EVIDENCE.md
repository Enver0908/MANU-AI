# Phase 85 Stage 4B Phase 6 — URL Navigation, Badges, and Refresh Evidence

Date: 2026-07-12  
Branch: `codex/phase-85-interstage-clinical-memory`  
Scope: Stage 4B Faz 6 (routing shell + bounded inbox hook; full alerts/notifications UX deferred to Faz 7–8)

## Goal

Open Stage 4B surfaces in the same browser tab with back/forward-compatible URL state, navigation badges, header bell routing, and bounded polling without reloading full `app-state`.

## URL contract

- `/dashboard?section=alerts`
- `/dashboard?section=notifications`
- `/dashboard?section=messages&clientId=...&conversationId=...&source=alert&sourceId=...&messageId=...`
- Filter params preserved in URL:
  - `alertSeverity`, `alertQuery`
  - `notificationStatus`, `notificationPriority`, `notificationCategory`, `notificationQuery`
- Legacy aliases: `conversation` → `messages`, `handoffs` → `alerts`
- Unknown `section` → safe `overview` fallback

## Implemented changes

### Routing helpers (`phase-85-stage-4b-dashboard-routing.ts`)

- Allowlist parse/serialize + `buildDashboardHref`
- API query mapping for bounded list endpoints
- `formatStage4BBadgeCount` (`0`, normal, `99+`)
- `resolveAlertsBadgeCount` (red + yellow)

### Hooks

- `use-dashboard-url.ts` — `useRouter` / `useSearchParams` navigation with merge-preserving patches
- `use-stage-4b-inbox.ts` — bounded `/api/alerts` + `/api/notifications` fetch
  - Initial mount fetch
  - 30s visible-tab polling
  - Focus refresh
  - Background tab pause (`visibilityState`)
  - In-flight dedupe per resource key
  - 60s / 120s capped error backoff; manual refresh resets backoff
  - Keeps last successful lists on error (no wipe)

### Dashboard shell (`dashboard-app.tsx`)

- Replaced local `view` state with URL-derived `section`
- Sidebar: **Uyarılar** replaces **Devirler**; desktop **Bildirimler** entry added
- Header bell opens notifications section (dropdown removed)
- Mobile bottom nav: Uyarılar beside Görüşme; notifications via bell only
- Placeholder inbox section panels (`stage-4b-inbox-section-panel.tsx`) wired to hook + URL filters
- `messages` without `clientId` shows explicit empty target state (no implicit client selection)
- `dashboard/page.tsx` wraps app in `Suspense` for `useSearchParams`

### Navigation components (`dashboard-navigation.tsx`)

- Desktop sidebar + mobile nav with badge overlays
- Header bell component

## Verification

```powershell
cd app
npm run lint
npm test
npm run build
npm run test:visual
```

Targeted unit coverage:

- `phase-85-stage-4b-dashboard-routing.test.ts`
- `phase-85-stage-4b-inbox-scheduler.test.ts`

Visual smoke updated: handoffs nav → alerts section panel.

## Out of scope (Faz 7–8)

- Full `alerts-panel.tsx` thin-row UX
- Full notifications workflow panel
- Stage 4B-2 user-facing “Mesajlaşma” label rename

Production pilot remains **NO-GO**.

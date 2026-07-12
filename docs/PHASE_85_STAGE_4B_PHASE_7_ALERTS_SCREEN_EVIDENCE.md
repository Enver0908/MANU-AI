# Phase 85 Stage 4B Phase 7 — Alerts Screen Evidence

Date: 2026-07-12  
Branch: `codex/phase-85-interstage-clinical-memory`  
Scope: Stage 4B Faz 7 (Uyarılar Ekranı)

## Goal

Deliver a dense, safe, filterable alerts list for active red/yellow clinical locks with thin-row UX, URL-synced filters, cursor pagination, and one-click navigation to the conversation target without mutating alert lifecycle.

## Implemented changes

### Helpers (`alerts-panel-helpers.ts`)

- Client name fallback, elapsed/SLA presentation (no invented SLA when `unconfigured`)
- Severity segment labels with active totals
- Filter-aware empty-state key resolution
- Alert kind → human-readable type label mapping
- Target navigation guard (`clientId` required)

### Shared row (`stage-4b-list-row.tsx`)

- Accessible 44px+ button row with severity dot, client, type, safe reason (+N), elapsed/SLA, chevron
- Fixed-height skeleton row for loading

### Alerts panel (`alerts-panel.tsx`)

- Sticky search + 3-way severity segments (`Tümü`, `Kırmızı`, `Sarı`) with counts
- Flat divided list (no card-in-card)
- Initial skeleton, filter-specific empty states, inline error + manual refresh
- `Daha fazla` cursor append via hook
- Row click delegates to dashboard `openAlertTarget` (no read/close)

### Inbox hook (`use-stage-4b-inbox.ts`)

- `alertItems`, `alertsNextCursor`, `loadMoreAlerts`, `isLoadingMoreAlerts`
- Refresh replaces page 1; load-more appends
- Default page size aligned to API (`30`)

### Routing (`phase-85-stage-4b-dashboard-routing.ts`)

- `buildStage4BAlertsRequestQuery` accepts `cursor` + `limit`

### Dashboard shell (`dashboard-app.tsx`)

- Alerts section uses `AlertsPanel` instead of placeholder inbox panel
- Notifications placeholder unchanged (Faz 8)

### i18n (`i18n.ts`)

- Segment empty states, load more, SLA labels, alert type labels, target error (7 languages)

## Verification

```powershell
cd app
npm run lint
npm test
npm run build
npm run test:visual
```

Targeted unit coverage:

- `alerts-panel-helpers.test.ts`
- `phase-85-stage-4b-dashboard-routing.test.ts` (cursor/limit)

Visual smoke: `alerts-panel` + severity tab visible.

## Out of scope (Faz 8+)

- Full notifications workflow panel
- Alert dismiss/delete or closed-alert history on this screen
- Stage 4B-2 Mesajlaşma rename

Production pilot remains `NO-GO`.

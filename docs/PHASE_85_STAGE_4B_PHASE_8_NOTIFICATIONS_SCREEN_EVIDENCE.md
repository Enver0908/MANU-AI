# Phase 85 Stage 4B Phase 8 — Notifications Screen Evidence

Date: 2026-07-12  
Branch: `codex/phase-85-interstage-clinical-memory`  
Scope: Stage 4B Faz 8 (Bildirimler Ekranı)

## Goal

Present system notifications in an operational inbox separated from clinical alert colors, with per-actor read/ack lifecycle, structured navigation, and type-specific review actions.

## Implemented changes

### Helpers (`notifications-panel-helpers.ts`)

- Neutral priority presentation (no clinical red/yellow reuse)
- Kind icon mapping, receipt status, occurrence/time formatting
- Status segment labels with counts and filter-aware empty states
- Actor mutation guard (`canMutateStage4BNotificationReceipt`)
- Target navigation guard and unsupported-media review gate

### Mutations (`stage-4b-notification-mutations.ts`)

- `read`, `acknowledge`, `read-all`, `complete-review` API wrappers (no optimistic ack)

### Shared row (`stage-4b-list-row.tsx`)

- `Stage4BNotificationRow` with kind icon, safe title/summary, priority badge, receipt state, separate ack command
- Unsupported-media review-complete action after read+ack
- Fixed-height skeleton row

### Notifications panel (`notifications-panel.tsx`)

- Sticky search + `Aktif / Okunmamış / Geçmiş` segments with counts
- Priority and category filters
- `Tümünü okundu işaretle` in unread view only (no bulk acknowledge)
- Row click: read (mutating actors) then structured target navigation; assistants navigate only
- Cursor pagination via inbox hook
- Inline error states for refresh/mutation/target failures

### Inbox hook (`use-stage-4b-inbox.ts`)

- `notificationItems`, `notificationsNextCursor`, `loadMoreNotifications`
- Default page size `30`

### Dashboard shell (`dashboard-app.tsx`)

- Notifications section uses `NotificationsPanel`
- `openNotificationTarget` handles `messages`, `clients`, and `ai-control` targets
- Removed placeholder `stage-4b-inbox-section-panel.tsx`

### i18n (`i18n.ts`)

- Panel labels, receipt states, mutation errors, empty states (7 languages)

## Verification

```powershell
cd app
npm run lint
npm test
npm run build
npm run test:visual
```

Targeted unit coverage:

- `notifications-panel-helpers.test.ts`
- `phase-85-stage-4b-dashboard-routing.test.ts` (notifications cursor/limit)

Visual smoke: `notifications-panel` + Aktif tab visible.

## Post-closure remediation reconciliation - 2026-07-12

The visual contract now includes real `draft_invalidated` rows, screenshot assertions across all four viewport projects, keyboard focus and selected-tab checks, mobile text containment, and overflow guards. The role contract keeps assistant/auditor receipt actions unavailable. The full visual run passed 36/36.

## Out of scope (Faz 10 closure)

Canonical closure evidence: `docs/PHASE_85_STAGE_4B_UYARI_VE_BILDIRIMLER_EVIDENCE.md`

Production pilot remains `NO-GO`.

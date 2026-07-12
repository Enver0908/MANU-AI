# Phase 85 Stage 4B — Phase 2 Persistence, Receipt Model, RLS Evidence

Status: **implemented (local verification)**  
Date: 2026-07-12  
Scope: append-only migration, receipt model, store wiring, RLS/RPC — no UI panels (Phase 4).

## Delivered

### Migration
- `app/supabase/migrations/20260711090000_phase_85_stage_4b_alerts_notifications.sql`
- Extended `notifications` with `kind`, `priority`, `client_id`, `conversation_id`, `message_id`, `handoff_id`, `occurrence_count`, `last_occurred_at`
- Safe UUID backfill for legacy `entity_id` values
- `notification_receipts` table + composite FKs + indexes
- RLS: notifications SELECT-only via `p85_stage_4b_can_read_notification`; receipt SELECT for owner/admin or own dietitian
- RPCs: `p85_stage_4b_list_notifications_v1`, `p85_stage_4b_list_alerts_v1`, `p85_stage_4b_mark_notification_read_v1`, `p85_stage_4b_acknowledge_notification_v1`, `p85_stage_4b_mark_all_notifications_read_v1`

### Application layer
- `app/src/lib/phase-85-stage-4b-notifications.ts` — normalization, visibility, receipt mutations, `buildTestNotification`
- `ManuAppState.notificationReceipts` + extended `NotificationRecord`
- `supabase-store.ts` — load/map receipts, `clientId` visibility scope, RPC read/ack
- `simulator.ts` / `app-state-store` path — per-actor receipt mutations (no global `notification.read` mutation)
- `data-governance.ts` — export/anonymize scope by `clientId` / `handoffId`
- Notification producers touched for required fields: historical retrieval, simulator handoff/window, transcript human-control

### Tests
- `phase-85-stage-4b-notifications.test.ts` (5 tests)
- Updated fixtures: simulator, phase-79b, operational-health, phase-85-if-e/h, api-errors
- RLS seed aligned to `TEST_HANDOFF_CASE_ID`; direct notification UPDATE blocked; receipt RPC + assistant isolation test added

## Verification run

```text
npx vitest run src/lib/phase-85-stage-4b-notifications.test.ts src/app/api/api-errors.test.ts  → 17/17 pass
npm run lint  → 0 errors (pre-existing warnings only)
npm run build → pass
```

`npm run test:rls` — requires local Supabase reset with new migration; run before merge when Docker/Supabase is available.

## Locked rules preserved

- Alerts remain projection-only (no `alerts` table)
- Receipt PK: `(tenant_id, notification_id, dietitian_id)`; missing receipt = unread for actor
- Assistant/auditor cannot mutate receipts; `client_id IS NULL` tenant-operational notifications owner/admin only
- Legacy `read` / `acknowledged_at` columns retained; new paths use receipts

## Post-closure remediation reconciliation - 2026-07-12

The original Phase 2 evidence is historical. The append-only migration `20260712120000_phase_85_stage_4b_postclosure_remediation.sql` adds actor-aware v2 bounded RPCs, tenant/user/dietitian/role validation, fail-closed linked-resource projection, atomic unsupported-media review, and persisted dietitian form schema/response inputs used by the Supabase SLA reader. The current RLS test matrix contains 33 tests but is blocked because Docker Desktop is unavailable; no skipped test is counted as a pass. See `docs/PHASE_85_STAGE_4B_POST_CLOSURE_REMEDIATION_EVIDENCE.md`.

## Out of scope (Phase 3+)

- Full notification producer/dedupe lifecycle for all system events
- Dashboard notification/alerts UI panels
- Receipt projection into list DTOs for windowed reads (operational-health still counts legacy `read`)

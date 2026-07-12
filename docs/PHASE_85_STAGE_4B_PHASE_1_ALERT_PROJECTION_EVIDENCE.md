# Phase 85 Stage 4B - Phase 1 Alert Projection Evidence

Date: 2026-07-12
Status: complete
Baseline branch: `codex/phase-85-interstage-clinical-memory`
Baseline commit before Phase 1 closure: `53f37b5 Close Phase 85 Stage 4B Phase 0 documentation lock`

## Scope

Phase 1 implemented clinical alert projection, reason taxonomy, SLA calculation, sorting/filtering helpers, safe DTO contracts, i18n reason labels, and fallback/Supabase projection parity. No migration, API route, UI panel, notification receipt, or provider/channel integration was added.

## Completed Items

- Added `app/src/lib/phase-85-stage-4b-contracts.ts` with Stage 4B domain/list DTO contracts.
- Added `app/src/lib/phase-85-stage-4b-alerts.ts` with `projectClinicalAlerts`, reason mapping, SLA helpers, sorting, and filtering.
- Re-exported Stage 4B types from `app/src/lib/types.ts`.
- Wired fallback projection through `projectClinicalAlertsFromState` in `simulator.ts`.
- Wired scoped Supabase parity through `projectClinicalAlertsFromSupabaseState` in `supabase-store.ts`.
- Added seven-language alert reason i18n keys in `app/src/lib/i18n.ts`.
- Added targeted tests in `app/src/lib/phase-85-stage-4b-alerts.test.ts`.

## Locked Behavior Verified

- Yellow source: `yellowRiskHold.status === "active"`.
- Red source: `redRiskLock.status === "locked"`.
- Red suppresses yellow for the same client.
- Stable IDs: `red:<handoffId>` and `yellow:<clientId>:<firstMessageId>`.
- Safe DTO excludes raw reason codes, message bodies, health data, and handoff text.
- Broken conversation linkage falls back to `clients` target without foreign entity IDs.
- SLA supports red `15dk`/`30dk`/`1s`, yellow `1s`/`2s`/`4s`/`Ayni gun`, timezone-aware same-day deadline, and `unconfigured` for invalid/missing values.

## Verification

- Targeted Vitest: `phase-85-stage-4b-alerts.test.ts` 11/11.
- `npm run lint`: 0 errors, 2 pre-existing warnings.
- `npm run build`: passed.
- `git diff --check`: passed.
- Forbidden future-major-phase naming scan: passed.
- Added-line secret/token pattern scan: passed.

## Explicit Non-Claims

- Stage 4B API routes, persistence migration, RLS, UI panels, and badges are not implemented.
- Stage 4B is not closed; Phase 2 persistence/receipt work is next.
- Production pilot remains `NO-GO`.
- R-405 remains open.
- Real provider/channel/health-data paths remain disabled.

## Next Action

Implement Stage 4B Phase 2: append-only notification columns, `notification_receipts`, backfill, composite FK/index/RLS/RPC.

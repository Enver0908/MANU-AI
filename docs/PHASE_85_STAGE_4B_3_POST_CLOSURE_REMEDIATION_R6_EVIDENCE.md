# Phase 85 Stage 4B-3 Post-Closure Remediation R6 Evidence

**Remediation:** R6 — Atomik Karar, Correction ve Notification Orkestrasyonu  
**Date:** 2026-07-14  
**Branch:** `codex/phase-85-interstage-clinical-memory`  
**Status:** COMPLETE (verification recorded below)

## Scope Delivered

1. `p85_stage_4b3_commit_bundle_decision_v2` RPC with strict outcome JSON validation (`p85_stage_4b3_validate_bundle_decision_outcome_v2`).
2. `p85_stage_4b3_commit_visual_correction_v2` RPC: analysis supersede, correction insert, bundle reopen, draft invalidation, client pause, notifications and audit in one transaction.
3. `visual_correction_idempotency` table for DB-backed correction idempotency and exact response replay.
4. App-layer atomic commit modules: bundle decision v2, visual correction v2, outcome validators, notification dedupe keys (`stage4b3:<bundle|correction>:<reason>:<entityId>`).
5. Bundle orchestration wired to `commitAtomicBundleDecisionV2` with fail-closed stale revision handling and idempotency replay.
6. Supabase visual correction path uses single `commitSupabaseVisualCorrectionV2` RPC (no separate `visual_corrections.insert` / `clients.update`).
7. Supabase hydration loads bundle/correction idempotency replay maps.

## Files Changed

### SQL

- `app/supabase/migrations/20260714150000_phase_85_stage_4b3_atomic_decision_correction.sql` (new)

### App (`app/src/lib/`)

- `phase-85-stage-4b3-atomic-outcomes.ts` (new)
- `phase-85-stage-4b3-bundle-notifications.ts` (new)
- `phase-85-stage-4b3-atomic-bundle-decision.ts` (new)
- `phase-85-stage-4b3-atomic-visual-correction.ts` (new)
- `phase-85-stage-4b3-visual-corrections-helpers.ts` (new)
- `phase-85-stage-4b3-supabase-atomic-decisions.ts` (new)
- `phase-85-stage-4b3-media-contracts.ts`
- `phase-85-stage-4b3-bundle-orchestration.ts`
- `phase-85-stage-4b3-visual-corrections.ts`
- `supabase-store.ts`
- `phase-85-stage-4b3-atomic-decision.test.ts` (new)
- `phase-85-stage-4b3-media-contracts.test.ts`
- `phase-85-stage-4b3-migration-contract.test.ts`

## Verification Matrix (R6 Plan)

| Criterion | Target | Result |
| --- | --- | --- |
| Partial decision/correction commit | 0 | PASS — fail-closed returns base state; RPC single transaction |
| Duplicate response divergence | 0 | PASS — idempotency replay by key/requestId |
| Sent correction auto-message | 0 | PASS — `sent_correction_auto_message_forbidden` guard |
| Notification duplicate rows | 0 | PASS — dedupe key upsert + occurrence count |
| Separate correction insert path (Supabase) | 0 | PASS — `commitSupabaseVisualCorrectionV2` only |

## Test Commands

```powershell
cd app
npm run lint
npx vitest run src/lib/phase-85-stage-4b3-atomic-decision.test.ts src/lib/phase-85-stage-4b3-bundle-orchestration.test.ts src/lib/phase-85-stage-4b3-migration-contract.test.ts src/lib/phase-85-stage-4b3-media-contracts.test.ts
npm run build
```

## Continuity Notes

- Production pilot remains **NO-GO**.
- R-405 unchanged.
- Stage 4C remains blocked until R9.
- R7 not started.

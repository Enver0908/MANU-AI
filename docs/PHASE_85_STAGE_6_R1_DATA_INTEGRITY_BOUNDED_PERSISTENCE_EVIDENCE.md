# Phase 85 Stage 6 R1 Data Integrity And Bounded Persistence Evidence

Date: 2026-08-19

Status: **R1 COMPLETE LOCALLY**

Stage 5 status: **STAGE_5_CLOSED**

Production status: **NO-GO**

Current supersession note, 2026-08-21: this file is historical R1 remediation evidence. Its Phase 4-not-started boundary was true at this checkpoint and is superseded by later Stage 6 Phase 4, remediation, Android real-device evidence, and final closure records. Stage 6 is now locally `STAGE_6_CLOSED`; the iPhone validation path is explicitly `WAIVED_NOT_EXECUTED`, not PASS; production remains `NO-GO`.

## Result

Stage 6 Supabase-backed dashboard mutations now use a durable tenant/request-scoped idempotency ledger instead of process-local replay state. The ledger reserves each mutation request as `pending`, blocks concurrent duplicate execution with `409 idempotency_request_in_progress`, stores only the bounded mutation response on successful completion, and rejects response payloads that contain a broad `state` field.

Fallback/local development mode still uses the existing process-local idempotency store because Supabase is not configured in that mode. This does not open offline editing, mutation queues, service-worker caching, provider/channel egress, live billing, production schema rollout, or real health-data paths.

## Implementation

- Added append-only migration `app/supabase/migrations/20260819120000_phase_85_stage_6_r1_mutation_idempotency.sql`.
- Added `stage_6_mutation_idempotency` with primary key `(tenant_id, request_id)`, `pending`/`complete` status, bounded response shape checks, and deny-all direct RLS.
- Added `runSupabaseStage6IdempotentMutation` in `app/src/lib/supabase-store.ts`.
- Routed Supabase Stage 6 mutations through the durable helper for client create/patch, form save, food-rule save, menu create/save/activate, context update create, AI activation, and takeover release.
- Kept Stage 6 mutation responses bounded as `ClientScopedMutationResponse`; no broad `/api/app-state` response was introduced.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npx vitest run src/lib/phase-85-stage-6-r1-mutation-idempotency.test.ts src/lib/phase-85-stage-6-api.test.ts src/lib/phase-85-stage-6-dashboard-contracts.test.ts src/lib/phase-85-stage-6-client-workspace.test.ts --no-file-parallelism --maxWorkers=1` | PASS: 4 files / 15 tests |
| First `npm test -- --run ...` attempt | NOT PASS: runner produced no result and was manually stopped; not counted as verification |
| `git diff --check` | PASS with CRLF warnings only |
| `npm run lint` | PASS: 0 errors / 70 pre-existing warnings |
| `npm run build` | PASS |
| `npx supabase db reset` | PASS: local Supabase stack started, full migration chain reapplied, including `20260819120000_phase_85_stage_6_r1_mutation_idempotency.sql` |
| `npm run test:rls` | PASS: 1 file / 56 tests / 56 passed / 0 skipped |
| Secret/sensitive scan over changed R1 paths | PASS with pre-existing `supabase-store.ts` `source_text` field-name matches only; no new secret/raw prompt/health-data value was added |
| Cross-tenant/idempotency scan over changed R1 paths | PASS for R1 scope: Supabase paths use `runSupabaseStage6IdempotentMutation`; fallback-only process-local idempotency remains in fallback branches |
| Stale status scan over updated current-authority docs | PASS with expected historical `R-405 was open at that checkpoint` matches below the current-authority blocks |

## Open Risks

- The durable helper prevents concurrent duplicate execution after the ledger reservation is inserted. If a domain write succeeds but the final ledger completion write fails, retry returns `409 idempotency_request_in_progress`; this blocks duplicate writes but requires operator cleanup or a future recovery RPC.
- Existing fallback mode remains process-local and is limited to local development/test operation without Supabase.

## Boundary

At this historical R1 checkpoint, Stage 6 Phase 4 had not started. Stage 5 shell responsibilities remained closed and were not redesigned. Production remains `NO-GO`.

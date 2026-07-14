# Phase 85 Stage 4B-3 Post-Closure Remediation - R4 Evidence

Date: 2026-07-14
Status: **R4 complete; R5 is next; Stage 4C blocked**

## Scope

R4 makes bundle correlation race-safe on the durable foundation: dietitian and business-human messages append to active bundles with actor labels and 120-second timer reset, worker release uses explicit outcomes instead of unconditional `success:true`, and `decided` cannot be written without `decision_id`.

## Deliverables

- `app/supabase/migrations/20260714130000_phase_85_stage_4b3_bundle_correlation_v2.sql`
- `app/src/lib/phase-85-stage-4b3-bundle-worker-outcomes.ts`
- `app/src/lib/phase-85-stage-4b3-bundle-worker-outcomes.test.ts`
- Updated: `phase-85-stage-4b3-message-bundles.ts`, `phase-85-stage-4b3-media-worker.ts`, `phase-85-stage-4b3-bundle-orchestration.ts`, `phase-85-if-c-channel-event-ledger.ts`, `simulator.ts`, `supabase-store.ts`, migration contract and bundle ingress tests

## Decisions Locked

- `p85_stage_4b3_append_bundle_item_v2` is the unified append RPC for dietitian items (manual reply transaction) with idempotent `(bundle_id, message_id)` semantics, cap enforcement, processing lease invalidation, and `ready_at = observed_at + 120s`.
- `p85_stage_4b3_release_bundle_work_v2` now accepts outcome taxonomy: `success`, `review_required`, `retryable_failure`, `terminal_failure`, `human_handled`.
- `success` release clears lease only when bundle is already `decided` with `decision_id`; otherwise raises `bundle_success_requires_decided`.
- `human_handled` maps bundle to `cancelled` with `failure_code=human_handled`; orchestration is skipped when bundle contains a dietitian actor item.
- Business-human echo no longer supersedes bundles; it appends a dietitian-labeled item and resets silence.
- Manual reply (in-memory and Supabase mutation payload) appends dietitian items to the active bundle when present.
- DB constraint `inbound_message_bundles_decided_requires_decision_id` blocks orphan `decided` rows.

## Explicit Non-Changes

- No multimodal source authority rewrite (R5).
- No route auth fallback removal (R7).
- No Stage 4C authorization.
- Production remains `NO-GO`; R-405 remains open.

## Verification

- Local Supabase reset: R4 migration applied cleanly.
- Targeted Vitest: bundle ingress, worker outcomes, orchestration, migration contract, durable ingress — 34/34 passed.
- App lint: 0 errors (pre-existing warnings only).
- App production build: passed.
- `git diff --check`: passed.

## Risk Posture After R4

- R-4B3-05 partially addressed: worker no longer marks bundles `decided` without a committed `decision_id`.
- R-4B3-10 partially addressed: dietitian and business-human paths append to bundles with timer reset instead of silent supersede.
- R-4B3-09 remains open for R5+ multimodal authority work.

## Next Phase

R5 is the next authorized phase: multimodal source authority and safety chain correction on the reliable bundle envelope.

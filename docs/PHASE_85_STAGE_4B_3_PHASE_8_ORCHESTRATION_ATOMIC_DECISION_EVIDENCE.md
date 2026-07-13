# Phase 85 Stage 4B-3 - Phase 8 Orchestration, Atomic Decision Commit, and Correction Workflow Evidence

Date: 2026-07-14

## Scope

Phase 8 wires multimodal bundles into the shared inbound turn pipeline, commits bundle decisions atomically with expected conversation/bundle revisions and idempotency, and adds the visual correction workflow (before draft, pending draft, after sent). Text simulation parity is preserved through extracted simulator helpers. No bounded media API, conversation UI, or production provider egress is introduced.

## Files Added

- `app/src/lib/phase-85-stage-4b3-bundle-orchestration.ts` — `runMultimodalBundleInboundTurn`, bounded context manifest, safety-to-core mapping
- `app/src/lib/phase-85-stage-4b3-bundle-decisions.ts` — `commitInboundBundleDecision`, idempotency via `processedBundleDecisionKeys`
- `app/src/lib/phase-85-stage-4b3-visual-corrections.ts` — `submitVisualCorrection` (supersede/invalidate/manual follow-up, no auto corrective send)
- `app/src/lib/phase-85-stage-4b3-bundle-orchestration.test.ts` — orchestration + correction tests
- `app/supabase/migrations/20260713130000_phase_85_stage_4b3_atomic_bundle_decisions.sql` — `bundle_decision_idempotency` + `p85_stage_4b3_commit_bundle_decision_v1` RPC

## Files Updated

- `app/src/lib/simulator.ts` — shared pipeline: `prepareInboundTurnPipeline`, `runInboundTurnCore`, `appendInboundCoreResult`, `InboundCoreResult`; `runInboundSimulation` refactored to use them; risk override merges preserve full `RiskDecision` shape
- `app/src/lib/phase-85-stage-4b3-media-worker.ts` — async worker; optional `runOrchestration`; returns `bundleTurns[]`
- `app/src/lib/phase-85-if-c-channel-event-ledger.ts` — awaits async bundle worker
- `app/src/lib/phase-85-stage-4b3-media-contracts.ts` — `processedBundleDecisionKeys` on `Stage4B3MediaStateSlice`
- `app/src/lib/supabase-store.ts` — hydrates `processedBundleDecisionKeys` from `bundle_decision_idempotency`
- `app/src/lib/phase-85-stage-4b3-message-bundles.test.ts` — async worker calls
- `app/src/lib/phase-85-stage-4b3-migration-contract.test.ts` — Phase 8 migration contract
- `app/src/lib/phase-85-stage-4b3-media-contracts.test.ts` — `processedBundleDecisionKeys: []`

## Locked Behavior

- Multimodal inbound turn uses the pre-stored bundle anchor message; no duplicate inbound message writes.
- `runInboundSimulation` remains a text wrapper over the shared inbound turn pipeline.
- Safety chain output maps to `InboundCoreResult`: green exact-menu → deterministic `visual_progress_ack_v1` send; yellow → draft; red/handoff → no client send.
- `buildBoundedVisualContextManifest` exposes observation IDs, confidence band, reason codes, and source authority IDs only (no raw OCR/provider payload).
- `commitInboundBundleDecision` atomically marks bundle `completed`, binds `decisionId`, records idempotency key; stale bundle/conversation revision or duplicate conflicting key → fail-closed.
- Migration RPC `p85_stage_4b3_commit_bundle_decision_v1` enforces service-role-only atomic commit with idempotency table; direct user access denied by RLS.
- Visual corrections: pending draft → invalidate + reopen bundle; after sent → AI pause (`manual` + `humanTakeoverLocked`), manual follow-up audit, zero new auto-sent corrective messages.
- Media worker orchestration is gated by `runOrchestration: true` (default ledger path still processes understanding/safety only).

## Verification

Executed on 2026-07-14:

- `cd app && npx vitest run src/lib/phase-85-stage-4b3-bundle-orchestration.test.ts src/lib/phase-85-stage-4b3-message-bundles.test.ts src/lib/phase-85-stage-4b3-migration-contract.test.ts src/lib/simulator.test.ts` — 60/60 passed.
- `cd app && npm run build` — passed.

## Handoff

Next implementation work is Stage 4B-3 Phase 9: bounded media DTOs, authenticated streaming endpoint, and conversation UI preview/review/correction panel. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real Meta/Gemini egress remains closed.

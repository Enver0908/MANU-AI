# Phase 85 Stage 4B-4 Post-Closure Remediation - R6 Evidence

Date: 2026-07-15
Status: **R6 complete; R7 next; Stage 4C blocked**

## Scope

R6 separates dietitian transcript corrections from provider observations, hardens correction lineage and decision supersession, reruns unsent bundles after correction, and exposes corrected bounded DTO status without provider confidence leakage.

## Deliverables

- `phase-85-stage-4b4-atomic-transcript-correction.ts` v3: dietitian corrections use `observation: null`, null provider confidence lineage, target-message validation, decision supersession, outcome v2.
- `phase-85-stage-4b4-voice-contracts.ts`: `buildDietitianCorrectionTranscriptionLineage`, required `targetMessageId` on correction requests, corrected DTO status from active revision.
- `phase-85-stage-4b4-transcript-corrections.ts` v2: async submit with ready-bundle rerun and `rerunDecisionId` binding.
- `phase-85-stage-4b4-transcript-correction-bounded.ts`: required `targetMessageId` parsing and auth guards unchanged.
- `phase-85-stage-4b4-bounded-audio.ts`: correction lookup by active revision/message lineage.
- Migration `20260715140000_phase_85_stage_4b4_correction_lineage.sql`: dietitian-confidence constraint, scope validation RPC, decision supersession RPC, outcome v2 support.

## Verification

```powershell
git diff --check
cd app
npx vitest run src/lib/phase-85-stage-4b4-transcript-corrections.test.ts src/lib/phase-85-stage-4b4-transcript-correction-bounded.test.ts src/lib/phase-85-stage-4b4-bounded-audio.test.ts src/lib/phase-85-stage-4b4-migration-contract.test.ts --no-file-parallelism
npm run lint
npm run build
```

## Locked Invariants

- Human corrections are `origin=dietitian_correction` with null provider confidence fields and no fake provider observation.
- Correction ledger is append-only; source revisions become `superseded`.
- Sent-message corrections open manual follow-up only; no automatic client send.
- Stale draft/decision rows are invalidated and superseded; rerun produces a new decision id stored on the correction.
- Red/human-takeover locks are preserved during correction.
- Bounded API exposes `corrected` status and active transcript text only; confidence and provider payload keys remain forbidden.

## Next Phase

R7 is next: bounded API, secure audio streaming, and UI correctness. Stage 4C remains blocked until R9 fresh complete PASS.

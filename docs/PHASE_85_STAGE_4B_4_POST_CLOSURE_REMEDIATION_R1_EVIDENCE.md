# Phase 85 Stage 4B-4 Post-Closure Remediation - R1 Evidence

Date: 2026-07-15
Status: **R1 complete; R2 next; Stage 4C blocked**

## Scope

R1 locks domain contracts, transcription/correction lineage fields, segment-derived quality metrics, and PostgreSQL invariants for the Stage 4B-4 voice remediation track. Runtime behavior outside contract enforcement (source authority, durable workers, provider egress, UI/API) remains for R2-R9.

## Deliverables

- Extended `phase-85-stage-4b4-voice-contracts.ts` to `p85-stage-4b4-voice-contracts-v2` with `origin`, transcript quality columns, speaker state, supersession lineage, and correction lineage aliases.
- Segment parser now requires `1..128` segments, non-empty segment text, monotonic timing, and derives uncertain-span count from segments.
- Quality gate derives acceptance thresholds from segment minima and rejects `multiple_speakers` / `unknown` speaker states.
- Updated Supabase mappers, admission, transcription worker, atomic correction, and bounded RPC projections for the new fields.
- Additive migration `app/supabase/migrations/20260715100000_phase_85_stage_4b4_remediation_contracts.sql` with backfill, CHECK constraints, tenant/message/revision uniqueness, media asset transcription FK, supersession/correction validation RPCs, and corrected transcript-correction RPC writes.

## Verification

```powershell
git diff --check
cd app
npx vitest run src/lib/phase-85-stage-4b4-voice-contracts.test.ts src/lib/phase-85-stage-4b4-supabase-mappers.test.ts src/lib/phase-85-stage-4b4-migration-contract.test.ts src/lib/phase-85-stage-4b4-transcription-worker.test.ts src/lib/phase-85-stage-4b4-transcript-corrections.test.ts src/lib/phase-85-stage-4b4-audio-admission.test.ts --no-file-parallelism
npm run lint
npm run build
```

Results on 2026-07-15:

- Targeted R1 Vitest: **42/42 passed**
- `npm run lint`: **0 errors** (pre-existing warnings only)
- `npm run build`: **passed**

## Locked Invariants

- `origin` is only `mock_provider` or `dietitian_correction`.
- `speakerState` is only `single_speaker | multiple_speakers | unknown`; only `single_speaker` may auto-accept.
- `transcriptionId` on corrections remains a deprecated alias; new writes populate `sourceTranscriptionId` and lineage columns.
- JSON observation remains audit payload; typed columns are the bounded projection source for DB invariants.

## Next Phase

R2 is next: verified inbound source authority and bounded audio admission/decode. Stage 4C remains blocked until R9 fresh complete PASS.

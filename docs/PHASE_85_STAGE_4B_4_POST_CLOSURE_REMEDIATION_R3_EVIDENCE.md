# Phase 85 Stage 4B-4 Post-Closure Remediation - R3 Evidence

Date: 2026-07-15
Status: **R3 complete; R4 next; Stage 4C blocked**

## Scope

R3 delivers the durable admission and transcription worker pipeline: lease-safe RPC commits from `download_pending` through terminal transcription state, deterministic WAV storage keys, bridge job enqueue on accepted transcripts, and separate admission/transcription worker CLIs.

## Deliverables

- Migration `20260715110000_phase_85_stage_4b4_durable_pipeline.sql`:
  - `audio_transcript_bridge_jobs` queue with tenant idempotency keys
  - `p85_stage_4b4_claim_audio_admission_work_v2` / `complete_audio_admission_v2` / `fail_audio_admission_v2`
  - `p85_stage_4b4_claim_transcription_work_v2` / `renew_transcription_lease_v2` / `complete_transcription_v2` / `fail_transcription_work_v2`
  - 60s lease TTL, 1s/5s admission/transcription retry backoff, max 3 attempts
- `phase-85-stage-4b4-durable-admission-worker.ts` — claim → fetch → canonicalize → upload → RPC commit saga
- `phase-85-stage-4b4-durable-pipeline-saga.ts` — upload rollback, admission commit, transcription complete/fail helpers
- `phase-85-stage-4b4-durable-audio-worker.ts` v2 — RPC-only terminal commits; no direct table updates; 20s lease renew during provider call
- Worker scripts: `worker:audio:stage4b4:admission`, `:transcription`, combined supervisor via `worker:audio:stage4b4`
- Supabase canonical ingress remains enqueue-only (`autoProcessAudioPending: false` in `supabase-store.ts`)

## Verification

```powershell
git diff --check
cd app
npx vitest run src/lib/phase-85-stage-4b4-durable-pipeline.test.ts src/lib/phase-85-stage-4b4-migration-contract.test.ts --no-file-parallelism
npm run lint
npm run build
```

## Locked Invariants

- Workers do not mutate `media_assets` or `audio_transcription_records` directly; terminal transitions go through v2 RPCs with lease-token CAS.
- Duplicate webhook replay cannot create a second revision-1 transcription (`ON CONFLICT` on tenant/media/revision).
- Upload-success + RPC-failure enqueues object cleanup via existing `p85_stage_4b3_enqueue_media_object_operation_v2`.
- Accepted transcription completion atomically enqueues a bridge job with deterministic idempotency key.
- Security admission failures terminalize to bundle `review_required`; transient failures backoff before terminal failure.

## Next Phase

R4 is next: fail-closed provider gate and transcription quality hardening. Stage 4C remains blocked until R9 fresh complete PASS.

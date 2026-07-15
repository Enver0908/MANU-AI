# Phase 85 Stage 4B-4 Post-Closure Remediation - R4 Evidence

Date: 2026-07-15
Status: **R4 complete; R5 next; Stage 4C blocked**

## Scope

R4 hardens the fail-closed transcription provider gate and quality acceptance path so uncertain, disabled, timed-out, malformed, or low-confidence transcripts cannot reach bridge enqueue and no pending transcription survives retry exhaustion.

## Deliverables

- `phase-85-stage-4b4-provider-gate.ts` v2: mock-only flag remains; `MANU_ALLOW_REAL_STT_EGRESS` and `realSttEgressAllowed` removed; `STAGE_4B4_EXTERNAL_TRANSCRIPTION_EGRESS_COUNT = 0`.
- `phase-85-stage-4b4-transcription-provider.ts` v2: 30s deadline wrapper (`invokeStage4B4TranscriptionProviderWithDeadline`), provider-failure → quality enum mapping.
- `phase-85-stage-4b4-transcript-quality.ts` v2: immutable `buildAudioTranscriptionQualitySnapshot` and exported `evaluateAudioTranscriptionQuality`.
- `phase-85-stage-4b4-voice-contracts.ts`: added `provider_timeout` / `retry_limit_exceeded` quality codes; quality gate derives acceptance only from recomputed segment/locale/speaker metrics.
- `phase-85-stage-4b4-transcription-worker.ts` v2: gate-disabled and provider failures terminalize to `review_required`; no `failed` terminal for quality/provider paths.
- `phase-85-stage-4b4-durable-audio-worker.ts` v3: deadline-wrapped provider calls; gate-disabled claims close as `provider_disabled`; durable RPC failures map to `review_required`.
- Migration `20260715120000_phase_85_stage_4b4_fail_closed_quality_gate.sql`: `fail_transcription_work_v2` always terminalizes to `review_required` with enum rejection reasons.

## Verification

```powershell
git diff --check
cd app
npx vitest run src/lib/phase-85-stage-4b4-provider-gate.test.ts src/lib/phase-85-stage-4b4-transcription-provider.test.ts src/lib/phase-85-stage-4b4-transcription-worker.test.ts src/lib/phase-85-stage-4b4-voice-contracts.test.ts src/lib/phase-85-stage-4b4-migration-contract.test.ts src/lib/phase-85-stage-4b4-durable-pipeline.test.ts --no-file-parallelism
npm run lint
npm run build
```

## Locked Invariants

- Only `MANU_ALLOW_MOCK_VOICE_TRANSCRIPTION` can enable transcription execution outside production/hosted sandbox.
- Provider observation fields are not trusted for acceptance; derived segment confidence, locale, uncertain spans, and speaker state gate acceptance.
- Provider-disabled, timeout exhaustion, malformed observation, and quality misses produce `review_required` with fixed `AUDIO_QUALITY_CODES` only.
- Accepted transcripts remain the sole path to bridge enqueue via `complete_transcription_v2`.
- External transcription egress count is structurally zero.

## Next Phase

R5 is next: durable transcript bridge, bundle deadline, and atomic risk orchestration. Stage 4C remains blocked until R9 fresh complete PASS.

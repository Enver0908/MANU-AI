# Phase 85 Stage 4B-4 - Phase 9 Retention, DSAR, Legal Hold, and Operational Visibility Evidence

Date: 2026-07-15

## Scope

Phase 9 completes the 30-day audio retention lifecycle, DSAR/anonymization redaction for voice assets and transcription evidence, legal-hold deferral without playback re-enablement, bounded `voice_transcripts.json` export, and aggregate audio lifecycle operational health.

## Files Added

- `app/src/lib/phase-85-stage-4b4-audio-lifecycle.ts`
- `app/src/lib/phase-85-stage-4b4-audio-lifecycle-saga.ts`
- `app/src/lib/phase-85-stage-4b4-audio-lifecycle.test.ts`
- `app/supabase/migrations/20260714200000_phase_85_stage_4b4_audio_lifecycle_bounded_reads.sql`
- `docs/PHASE_85_STAGE_4B_4_PHASE_9_RETENTION_DSAR_LEGAL_HOLD_EVIDENCE.md`

## Locked Behavior

- Voice assets expire at 30 days; browser playback eligibility closes with `excluded_voice_expired`.
- Legal hold defers physical audio object deletion but does not restore playback eligibility.
- Accepted/corrected transcript text remains in message body after audio expiry; provider segments/confidence are redacted.
- DSAR removal clears audio object keys, redacts transcription evidence, and passes `evaluateStage4B4AudioRedactionInvariants`.
- Export `voice_transcripts.json` contains bounded metadata only; no object keys, confidence, or raw observation payloads.

## Verification

```powershell
cd app
npx vitest run src/lib/phase-85-stage-4b4-audio-lifecycle.test.ts
npx vitest run src/lib/phase-85-stage-4b4-migration-contract.test.ts
npm run build
```

Production pilot remains `NO-GO`. Stage 4C remains blocked until Stage 4B-4 closes.

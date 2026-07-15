# Phase 85 Stage 4B-4 Post-Closure Remediation - R7 Evidence

Date: 2026-07-15
Status: **R7 complete; R8 next; Stage 4C blocked**

## Scope

R7 exposes bounded voice transcript DTOs with active text and safe status, hardens RFC 7233 single-range audio streaming without full-object buffering, and aligns voice review/correction UI with correction lineage.

## Deliverables

- Migration `20260715150000_phase_85_stage_4b4_bounded_reads_v2.sql`: `p85_stage_4b4_load_bounded_voice_v2` with transcript text, origin, correction lineage, safe status; `p85_stage_4b3_resolve_media_stream_v2` extended with `byte_size` and `etag`.
- `phase-85-stage-4b4-bounded-audio-rpc.ts` v2 mapper: preserves `transcript_text` when `observation` is null; maps correction lineage fields.
- `phase-85-stage-4b4-voice-contracts.ts`: `sanitizeBoundedTranscriptTextForDto`, `unavailable` transcript status, redaction/length guard in DTO builder.
- `phase-85-stage-4b4-audio-storage.ts`: `statObject` and `downloadObjectRange` port methods.
- `phase-85-stage-4b3-media-stream.ts`: range-native audio streaming, real-size `416` headers, consistent `ETag`/`Accept-Ranges`/`Content-Length`.
- UI: `conversation-message-voice-transcript.tsx`, bubble transcript status, review panel `targetMessageId` + post-correction refresh.

## Verification

```powershell
git diff --check
cd app
npx vitest run src/lib/phase-85-stage-4b4-bounded-audio-rpc.test.ts src/lib/phase-85-stage-4b4-bounded-audio.test.ts src/lib/phase-85-stage-4b4-media-range.test.ts src/lib/phase-85-stage-4b3-media-stream.test.ts src/lib/phase-85-stage-4b4-migration-contract.test.ts --no-file-parallelism
npm run lint
npm run build
```

## Locked Invariants

- Bounded DTO carries transcript text and safe status only; confidence, provider payload, hash, and storage keys remain forbidden.
- Audio is always served through authorized server-mediated streaming with single-range semantics; multi-range returns `416` with `Content-Range: bytes */N`.
- Storage adapter reads only the requested byte span for audio; full WAV download-and-slice path removed for audio variant.
- UI shows pending, review, accepted, corrected, expired, and unavailable states without confidence display.
- Correction submit requires `targetMessageId`; corrected label and latest text refresh from bounded projection after mutation.

## Next Phase

R8 is next: retention, DSAR, legal hold, and orphan reconciliation. Stage 4C remains blocked until R9 fresh complete PASS.

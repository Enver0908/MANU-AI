# Phase 85 Stage 4B-4 - Phase 2 Database, Storage, RLS, and Queue Foundation Evidence

Date: 2026-07-15

## Scope

Phase 2 adds the private audio persistence and worker-queue foundation for Stage 4B-4. It introduces append-only migrations `20260714170000_phase_85_stage_4b4_audio_foundation.sql` and `20260714180000_phase_85_stage_4b4_audio_queue.sql`, Supabase mappers, `loadSupabaseState` audio collection loading, migration contract tests, and RLS integration coverage. No webhook ingress, transcription worker runtime, UI surface, or provider egress was enabled.

## Files Added

- `app/supabase/migrations/20260714170000_phase_85_stage_4b4_audio_foundation.sql`
- `app/supabase/migrations/20260714180000_phase_85_stage_4b4_audio_queue.sql`
- `app/src/lib/phase-85-stage-4b4-supabase-mappers.ts`
- `app/src/lib/phase-85-stage-4b4-supabase-mappers.test.ts`
- `app/src/lib/phase-85-stage-4b4-migration-contract.test.ts`

## Files Updated

- `app/src/lib/phase-85-stage-4b3-media-contracts.ts`
- `app/src/lib/phase-85-stage-4b3-supabase-mappers.ts`
- `app/src/lib/phase-85-stage-4b3-message-bundles.ts`
- `app/src/lib/phase-85-stage-4b3-bounded-media-rpc.ts`
- `app/src/lib/phase-85-stage-4b3-closure.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/lib/supabase-rls.integration.test.ts`

## Locked Foundation

- Private storage bucket: `p85-stage-4b4-audio` (`public = false`, `audio/wav`, 10 MiB limit).
- Tables: `audio_transcription_records`, `audio_transcript_corrections`, `audio_transcript_correction_idempotency`.
- Schema extensions: `media_assets` audio columns (`media_kind`, `voice_message`, duration/codec/channel/sample-rate, `sanitized_audio_object_key`, `transcription_id`); bundle `audio_count` / `audio_duration_ms` caps (4 notes, 600s); bundle item `voice` type and `transcription_id`.
- RLS: deny-all direct access on all three audio tables; `revoke` from `anon`/`authenticated`; `service_role` only.
- Worker RPCs: `p85_stage_4b4_claim_audio_admission_work_v1`, `p85_stage_4b4_release_audio_admission_work_v1`, `p85_stage_4b4_claim_transcription_work_v1`, `p85_stage_4b4_release_transcription_work_v1` with `FOR UPDATE SKIP LOCKED`, 120-second leases, lease tokens, max 3 retries.
- `channel_events.event_kind` check extended with `client_message_audio`.
- Tenant-composite FK integrity via `unique (tenant_id, id)` on `audio_transcription_records` and bundle-item transcription FK.

## Verification

Executed on 2026-07-15:

- `cd app && npx supabase db reset` — passed.
- `cd app && npm run lint` — 0 errors, 8 pre-existing warnings.
- `cd app && npx vitest run src/lib/phase-85-stage-4b4-migration-contract.test.ts src/lib/phase-85-stage-4b4-supabase-mappers.test.ts src/lib/phase-85-stage-4b3-supabase-mappers.test.ts` — 11/11 passed.
- `cd app && npm run test:rls` with local Supabase env (`http://127.0.0.1:54321`) — 41/41 passed, zero skipped.
- `cd app && npm run build` — passed.

## Handoff

Next implementation work is Stage 4B-4 Phase 3: canonical WhatsApp audio ingress admission. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real provider/channel/STT egress paths remain closed.

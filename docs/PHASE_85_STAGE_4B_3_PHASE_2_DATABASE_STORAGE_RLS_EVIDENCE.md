# Phase 85 Stage 4B-3 - Phase 2 Database, Storage, RLS, and Queue Foundation Evidence

Date: 2026-07-13

## Scope

Phase 2 adds the private media persistence and worker-queue foundation for Stage 4B-3. It introduces append-only migration `20260713120000_phase_85_stage_4b3_media_foundation.sql`, Supabase mappers, `loadSupabaseState` media collection loading, migration contract tests, and RLS integration coverage. No webhook ingress, UI surface, runtime image processing, or provider egress was enabled.

## Files Added

- `app/supabase/migrations/20260713120000_phase_85_stage_4b3_media_foundation.sql`
- `app/src/lib/phase-85-stage-4b3-supabase-mappers.ts`
- `app/src/lib/phase-85-stage-4b3-supabase-mappers.test.ts`
- `app/src/lib/phase-85-stage-4b3-migration-contract.test.ts`

## Files Updated

- `app/src/lib/supabase-store.ts`
- `app/src/lib/supabase-rls.integration.test.ts`

## Locked Foundation

- Tables: `media_assets`, `visual_analysis_records`, `inbound_message_bundles`, `inbound_message_bundle_items`, `visual_corrections`.
- Private storage bucket: `p85-stage-4b3-media` (`public = false`, JPEG/PNG, 5 MiB limit).
- RLS: conversation-scoped `SELECT` via `can_read_conversation`; direct `anon`/`authenticated` writes denied on all five tables.
- Visual corrections read policy excludes `assistant` and `auditor` roles.
- Worker RPCs: `p85_stage_4b3_claim_media_asset_worker`, `p85_stage_4b3_release_media_asset_lease`, `p85_stage_4b3_claim_inbound_message_bundle_worker`, `p85_stage_4b3_release_inbound_bundle_lease` with `FOR UPDATE SKIP LOCKED`, 60-second leases, max 3 retries.
- Partial unique index: one active bundle per conversation (`open|ready|processing`).
- `channel_events.event_kind` check extended with `client_message_image`.
- Tenant-composite FK integrity via `unique (tenant_id, id)` on `media_assets`, `visual_analysis_records`, and `inbound_message_bundles`.

## Verification

Executed on 2026-07-13:

- `cd app && npx supabase db reset` — passed after tenant-composite unique constraints were added to referenced media tables.
- `cd app && npm run lint` — 0 errors, 3 pre-existing warnings.
- `cd app && npx vitest run src/lib/phase-85-stage-4b3-migration-contract.test.ts src/lib/phase-85-stage-4b3-supabase-mappers.test.ts` — 7/7 passed.
- `cd app && npm run test:rls` with local Supabase env (`http://127.0.0.1:54321`) — 38/38 passed, zero skipped.
- `cd app && npm run build` — passed.

## Handoff

Next implementation work is Stage 4B-3 Phase 3: media ingress admission and sanitization. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real provider/channel/vision egress paths remain closed.

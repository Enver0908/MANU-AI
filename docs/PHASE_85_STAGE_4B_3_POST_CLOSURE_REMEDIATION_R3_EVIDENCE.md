# Phase 85 Stage 4B-3 Post-Closure Remediation - R3 Evidence

Date: 2026-07-14
Status: **R3 complete; R4 is next; Stage 4C blocked**

## Scope

R3 routes mock image ingress through durable canonical commit RPCs, sanitizes uploads in memory before any persistent write, binds Supabase private storage for sanitized objects, replaces Vitest-subprocess worker scripts with a real durable media worker loop, and rejects Meta provider media fetch URLs.

## Deliverables

- `app/supabase/migrations/20260714120000_phase_85_stage_4b3_canonical_ingress_v2.sql`
- `app/src/lib/phase-85-stage-4b3-fixture-resolver.ts`
- `app/src/lib/phase-85-stage-4b3-supabase-media-storage.ts`
- `app/src/lib/phase-85-stage-4b3-durable-media-transport.ts`
- `app/src/lib/phase-85-stage-4b3-durable-media-admission.ts`
- `app/src/lib/phase-85-stage-4b3-supabase-canonical-ingress.ts`
- `app/src/lib/phase-85-stage-4b3-durable-media-worker.ts`
- `app/scripts/worker-media-stage4b3-runner.ts`
- `app/scripts/worker-media-stage4b3.mjs` (no Vitest subprocess)
- Tests: `phase-85-stage-4b3-durable-ingress.test.ts`, migration contract R3 block

## Decisions Locked

- `p85_stage_4b3_commit_canonical_inbound_v2` atomically writes channel event, message, optional media asset, bundle, and bundle item with provider-event and content-hash idempotency.
- `p85_stage_4b3_commit_sanitized_media_v2` commits lease-gated sanitized asset metadata after private storage upload.
- Partial full/thumb upload rolls back the successful object; delete failure enqueues `media_object_operations`.
- DB commit failure after upload enqueues both object keys for deletion saga retry.
- Fixture resolver allowlists `MOCK_MEDIA_<scene>` IDs and regenerates deterministic JPEG bytes; `MOCK_MEDIA_UPLOAD_*` is excluded from fixture regeneration.
- Meta / HTTPS provider media IDs are rejected (`transport_unavailable`).
- Terminal admission failure after retry ceiling sets bundle `review_required` and inserts `visual_message_review` notification.
- Supabase webhook/simulator image ingress uses canonical inbound v2 RPC; text ingress remains on `commit_inbound_simulation`.
- Worker loop: bounded batch, per-item timeout, lease renewal, graceful SIGINT/SIGTERM shutdown.

## Explicit Non-Changes

- No bundle worker semantics rewrite (R4).
- No route auth fallback removal (R7).
- No Stage 4C authorization.
- Production remains `NO-GO`; R-405 remains open.

## Verification

- Local Supabase reset: R3 migration applied cleanly.
- Targeted Vitest: durable ingress + canonical ingress + media admission + migration contract + local worker runner passed 27/27.
- App lint: 0 errors (pre-existing warnings only).
- App production build: passed.
- `git diff --check`: passed.

## Risk Posture After R3

- R-4B3-01 partially addressed: image ingress now persists via dedicated atomic RPC instead of generic simulation delta only.
- R-4B3-02 partially addressed: media worker script no longer spawns Vitest; durable claim/sanitize/commit loop runs as standalone process.
- R-4B3-09, R-4B3-05, R-4B3-10 remain open for R4+.

## Next Phase

R4 is the next authorized phase: bundle correlation, dietitian message append/reset, and worker result semantics on the durable foundation.

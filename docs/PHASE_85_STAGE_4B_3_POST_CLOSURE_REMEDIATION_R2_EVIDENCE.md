# Phase 85 Stage 4B-3 Post-Closure Remediation - R2 Evidence

Date: 2026-07-14
Status: **R2 complete; R3 is next; Stage 4C blocked**

## Scope

R2 adds append-only Supabase migrations for V2 bundle status, actor fields, retrieval/evidence expiry, lease-protected durable queues, deny-all authenticated direct reads on Stage 4B-3 media tables, service-role-only bounded metadata/stream RPCs, and minimal app mapper/status compatibility. Webhook ingress, real workers, route auth hardening, and UI verification remain out of scope.

## Deliverables

- `app/supabase/migrations/20260714100000_phase_85_stage_4b3_remediation_contract_rls.sql`
- `app/supabase/migrations/20260714110000_phase_85_stage_4b3_durable_media_queue.sql`
- App compatibility: `phase-85-stage-4b3-media-contracts.ts`, bundle/decision/bounded-media modules, Supabase mappers
- Tests: `phase-85-stage-4b3-migration-contract.test.ts`, `supabase-rls.integration.test.ts` (deny-read + V2 lease/bounded RPC matrix)

## Migration Decisions Locked

- Legacy bundle `completed` rows map to `decided` when `decision_id` is present, otherwise `failed` with `failure_code=legacy_completed_without_decision`.
- V2 bundle statuses: `open`, `ready`, `processing`, `decided`, `review_required`, `superseded`, `failed`, `cancelled` (no `completed`).
- Bundle items gain `actor_type`, `sender_id`, `reply_to_message_id` with tenant-composite FK guards.
- `visual_analysis_records` gains `retrieval_eligible` (default true) and `evidence_expires_at`.
- `media_assets` and `inbound_message_bundles` gain `lease_token`; commit RPC writes `decided` instead of `completed`.
- Authenticated direct `SELECT` on Stage 4B-3 media tables is denied; `p85_stage_4b3_load_bounded_media_metadata_v1` execute revoked from authenticated.
- `media_object_operations` is service-role-only deletion saga queue with lease/retry fields.
- V2 worker RPCs: `claim_media_work_v2`, `release_media_work_v2`, `claim_bundle_v2`, `release_bundle_work_v2` (`FOR UPDATE SKIP LOCKED`, 60s lease, max 3 retry).
- V2 bounded RPCs: `load_bounded_media_v2`, `resolve_media_stream_v2` (service_role only; no raw `observation` in metadata projection).
- Private storage bucket reasserted; anon/authenticated storage policies dropped.

## Explicit Non-Changes

- No webhook V2 ingress switch.
- No real worker runtime replacement (R3).
- No media route auth fallback removal (R7).
- No Stage 4C authorization.
- Production remains `NO-GO`; R-405 remains open.

## Verification

- Local Supabase reset: all migrations applied cleanly.
- RLS integration: **39/39 passed, 0 skipped** (owner/admin/dietitian/assistant/auditor/unassigned/cross-tenant matrix; direct table read/write denial; V2 lease token CAS; authenticated bounded-media v2 denial; service-role bounded projection without raw observation).
- Targeted Vitest: migration-contract + media-contract + mapper + bundle-orchestration tests passed 36/36.
- App lint: 0 errors (pre-existing warnings only).
- App production build: passed.
- `git diff --check`: passed.

## Risk Posture After R2

- R-4B3-08 partially addressed: authenticated direct media table reads removed; bounded v2 RPC is service-role only. Route auth fallback and browser DTO leak closure remain R7.
- R-4B3-11 partially addressed: `retrieval_eligible`, `evidence_expires_at`, and `media_object_operations` queue foundation exist; full lifecycle enforcement remains R8.
- R-4B3-01, R-4B3-02, R-4B3-09, R-4B3-13 remain open pending R3+.

## Next Phase

R3 is the next authorized phase: canonical ingress, sanitization, and real worker runtime on the durable queue foundation.

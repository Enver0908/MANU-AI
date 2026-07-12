# Phase 85 Stage 4B-2 Post-Closure Remediation - Phase R3 Evidence

Status: **Implementation complete; environment RLS gate open (2026-07-12)**

Branch: `codex/phase-85-interstage-clinical-memory`

R3 baseline: `c83bfff Complete Stage 4B-2 remediation R2 unread aggregates`

## Scope

R3 corrects the authorized mutation boundary for manual replies and draft mutations. The migration is append-only. No alerts table, real provider/channel path, live billing, monitoring, backup, secret-manager, or real health-data path is opened.

## Implemented corrections

- Added `20260712180000_phase_85_stage_4b2_r3_atomic_mutations.sql`.
- Added `p85_stage_4b2_actor_can_mutate_conversation`, which permits owner/admin and dietitian primary/care-team scope only; viewer, assistant, auditor, unassigned, and cross-tenant contexts fail closed.
- Added payload-scope validation for the target conversation/client and existing target messages before the state delta can execute.
- Added `p85_stage_4b2_commit_conversation_mutation_v2`, which reserves the tenant/request idempotency key, locks the row, locks the target client and draft message where applicable, replays a committed response, or executes authorization, client-lock, red-lock, revision, domain commit, and response persistence in one transaction.
- Manual replies and draft mutations now call the v2 RPC and return its response. The old post-commit idempotency write path is no longer used by these first-party mutation callers.
- Cached request replay happens before stale local state derivation, preserving exact response replay after the original domain revision has advanced.
- Yellow `review_send_manual` rejects a red lock observed after the client row is locked and before any domain write; the transaction rolls back with `red_lock_superseded`.
- Added a static migration contract test and retained the mutation/state regression coverage.

## Transaction and data flow

The API parses and bounds the request. The Supabase store loads the operation state only to derive the canonical state delta and bounded response candidate. The RPC then claims `(tenant_id, request_id)`, waits on an existing request lock when necessary, validates actor/assignment/target scope, locks the client, validates conversation revisions, invokes the existing domain commit inside the same transaction, stores the exact response JSON, and returns it. A concurrent duplicate therefore receives one committed response and cannot create a second domain result.

For yellow review, client locking follows the existing client-before-conversation activation order. A red activation that wins the lock is observed as a red lock and rejects review; a review that wins commits before a later red event can be created. The red manual reply contract remains unchanged: it does not clear the red lock.

## Verification

- Targeted Stage 4B-2 Vitest: 6 files, 35 passed, 1 existing skipped full-scale case, 0 failed.
- Core suite: 234 passed, 0 failed.
- `npm run lint`: passed with 0 errors and 4 existing warnings.
- `npm run build`: passed; TypeScript and route generation completed.
- `git diff --check`: passed before documentation updates.
- Full app suite: timed out after 120 seconds in the OneDrive workspace without producing a completion result; it is not claimed as passed.
- RLS suite: **not passed**. Docker/local Supabase is unavailable; 35 required tests were skipped.

## Completion decision

R3 is complete for the application and migration implementation scope. The RLS role matrix, concurrent duplicate proof, red/yellow database race proof, and SQL-backed scale evidence remain environment-level closure gates until local Supabase is available. R4 is next; Stage 4C remains blocked, production pilot remains `NO-GO`, R-405 remains open, and real integrations remain disabled.

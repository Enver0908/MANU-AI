# Phase 85 Stage 4B-2 Phase 2 Receipt Persistence, Sequence Backfill, and RLS Evidence

Status: **complete — persistence/RLS only; no read APIs, UI, or message mutations**

Implementation branch: `codex/phase-85-interstage-clinical-memory`

## 1. Scope

Phase 2 makes actor-owned conversation unread state durable in Supabase: append-only `conversation_read_receipts`, deterministic `messages.conversation_sequence` backfill, monotonic mark-read RPC, tenant-safe RLS, lifecycle receipt cleanup on client removal, store mappers, and integration tests. It does not add `/api/conversations` routes, dashboard UI, manual/yellow mutations, provider/channel paths, billing, monitoring, backup, secret-manager, or real health-data paths.

## 2. Preconditions and Baseline

- Phase 1 domain/DTO/authorization projection was committed in `867e1b7`.
- Production pilot remains `NO-GO`.
- R-405 remains open.
- Stage 4C remains blocked.
- Real provider, channel, billing, monitoring, backup, secret-manager, and health-data paths remain closed.

## 3. Implemented Files

- `app/supabase/migrations/20260712140000_phase_85_stage_4b2_receipt_persistence_rls.sql`: deterministic sequence backfill, `conversation_read_receipts` table/indexes/composite FKs, `p85_stage_4b2_actor_can_read_conversation`, `p85_stage_4b2_count_conversation_unread`, `p85_stage_4b2_mark_conversation_read_v1`, lifecycle receipt deletion hook, RLS select policy, updated `commit_client_removal_lifecycle`.
- `app/src/lib/types.ts`: `conversationReadReceipts` on `ManuAppState`.
- `app/src/lib/seed-data.ts`: empty receipt seed array.
- `app/src/lib/data-governance.ts`: removes conversation receipts when a client is anonymized or removed.
- `app/src/lib/supabase-store.ts`: receipt load/map, dietitian role map, `markSupabaseConversationRead`, demo cleanup table entry, controlled RPC error mapping.
- `app/src/lib/phase-85-stage-4b2-receipt-lifecycle.test.ts`: fallback lifecycle receipt cleanup tests.
- `app/src/lib/supabase-rls.integration.test.ts`: actor-owned monotonic receipt matrix test and cleanup hook.

## 4. Locked Behaviors Proven

- One receipt row per `(tenant_id, conversation_id, dietitian_id)` with composite tenant integrity.
- Legacy null `conversation_sequence` rows backfill deterministically by `observed_at/persisted_at/created_at/id` without colliding with existing sequences.
- Mark-read uses `GREATEST(old, requested)` and never moves the marker backward.
- Unread count uses only `client_inbound` messages with sequence greater than the actor marker; `content_unavailable` counts; `revoked` and `redacted` do not.
- Owner/admin/dietitian/assistant actors with conversation visibility may advance only their own receipt; auditor and cross-tenant/hidden conversation access fail closed as `conversation_not_found`.
- Sequence beyond the conversation max or non-positive sequence returns `conversation_read_sequence_invalid`.
- Direct receipt table writes are blocked by RLS; assistant may mark-read through RPC but cannot insert receipts directly.
- Dietitian and assistant receipts remain independent for the same conversation.
- Client removal lifecycle deletes conversation receipts for the removed client's conversations.
- Receipt rows are removed from fallback state on anonymization/removal and are not part of client export surfaces.

## 5. Verification

- Dedicated Phase 2 lifecycle Vitest: 2 passed, 0 failed.
- Phase 1 regression file: 8 passed, 0 failed.
- Combined Stage 4B-2 targeted set: 10 passed, 0 failed.
- Full app `npm test`: 143 files, 911 passed, 5 skipped, 0 failed.
- `npm run lint`: exit 0, 0 errors, 3 pre-existing warnings.
- `npm run build`: passed, including TypeScript validation and route output.
- `npm run test:rls`: 1 file and 34 tests skipped because Docker/Supabase was unavailable; this is an environment skip, not a pass.
- `git diff --check`: required before commit.
- Secret/token scan and forbidden future-phase naming scan: required before commit.

## 6. Explicit Non-Changes

No `/api/conversations` route, bounded list/detail projection module, dashboard messaging UI, manual reply mutation, yellow reviewed-manual mutation, provider credential, webhook, live channel, billing, monitoring, backup, secret-manager, or real health-data path was added.

## 7. Handoff to Phase 3

Phase 3 may now implement server-independent bounded list/detail/read projections on top of the durable receipt and sequence model. It must consume Phase 1 DTO contracts and Phase 2 persistence semantics without widening DTOs or reintroducing full-state messaging reads. Stage 4C remains blocked until all Stage 4B-2 phases and evidence close.

## 8. Final Closure Checks

- Changed runtime files are limited to the migration, lifecycle/store/type/seed modules, and targeted tests listed above.
- Production pilot remains `NO-GO`; R-405 remains open; real integration paths remain closed.
- Next authorized implementation unit is Phase 3.

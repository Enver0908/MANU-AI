# Phase 85 Stage 4B-2 Phase 4 Actor-Aware Read APIs Evidence

Status: **complete — read APIs only; no UI, manual/yellow mutations, or provider/channel paths**

Implementation branch: `codex/phase-85-interstage-clinical-memory`

## 1. Scope

Phase 4 exposes bounded conversation list, transcript detail, and mark-read endpoints without loading full `ManuAppState`. Supabase paths use actor-validating security-definer projection RPCs plus Phase 3 projection builders. Fallback paths use the same DTO contracts and bounded fallback helpers. It does not add dashboard UI, manual/yellow mutations, routing hooks, provider/channel paths, billing, monitoring, backup, secret-manager, or real health-data paths.

## 2. Preconditions and Baseline

- Phase 3 bounded projection was committed in `4a5ab49`.
- Production pilot remains `NO-GO`.
- R-405 remains open.
- Stage 4C remains blocked.
- Real provider, channel, billing, monitoring, backup, secret-manager, and health-data paths remain closed.

## 3. Implemented Files

- `app/supabase/migrations/20260712150000_phase_85_stage_4b2_read_api_projection_rpcs.sql`: `p85_stage_4b2_load_list_projection_source_v1`, `p85_stage_4b2_load_detail_projection_source_v1`.
- `app/src/lib/phase-85-stage-4b2-read-api.ts`: auditor gate, mark-read parsing/state mutation, bounded mutation DTO builder, `Cache-Control: no-store` response helper.
- `app/src/lib/supabase-store.ts`: `listSupabaseConversations`, `getSupabaseConversationMessages`, `markSupabaseConversationReadWithResponse`, controlled RPC error mapping for `conversation_read_forbidden`.
- `app/src/lib/app-state-store.ts`: `markFallbackConversationRead`.
- `app/src/app/api/conversations/route.ts`: `GET /api/conversations`.
- `app/src/app/api/conversations/[id]/messages/route.ts`: `GET /api/conversations/[id]/messages`.
- `app/src/app/api/conversations/[id]/read/route.ts`: `POST /api/conversations/[id]/read`.
- `app/src/lib/phase-85-stage-4b2-read-api.test.ts`: fallback list/detail/mark-read, auditor gate, no-store headers, stale anchor fail-closed.
- `app/src/lib/supabase-rls.integration.test.ts`: projection bundle RPC actor-scope test hook.

## 4. Locked Behaviors Proven

- `GET /api/conversations` returns bounded `ConversationListResponse` with status/query/cursor/limit parsing from Phase 1/3.
- `GET /api/conversations/[id]/messages` returns bounded `ConversationDetailResponse` with older/newer cursors and anchor windows.
- `POST /api/conversations/[id]/read` accepts `{ throughSequence }`, advances only the actor receipt monotonically, and returns bounded `ConversationMutationResponse`.
- Auditor actors are rejected with `403 conversation_read_forbidden` before projection work.
- Hidden or cross-tenant conversations resolve to indistinguishable `404 conversation_not_found`.
- Invalid limit/query/cursor/sequence values return `400`.
- All conversation API responses include `Cache-Control: no-store`.
- Supabase list/detail paths use dedicated projection RPCs and do not call `loadSupabaseState` or `/api/app-state`.
- Fallback and Supabase paths preserve the same allowlisted DTO surface; responses do not leak handoffs, health profile, or full app state.

## 5. Verification

- Dedicated Phase 4 read API Vitest: 5 passed, 0 failed.
- Phase 3 messaging regression: 4 passed, 0 failed.
- Phase 1 regression: 8 passed, 0 failed.
- Full app `npm test`: 145 files, 920 passed, 5 skipped, 0 failed.
- `npm run lint`: exit 0, 0 errors, 3 pre-existing warnings.
- `npm run build`: passed; new routes `/api/conversations`, `/api/conversations/[id]/messages`, `/api/conversations/[id]/read` emitted.
- `npm run test:rls`: not re-run in this phase; prior environment skip remains not counted as pass.
- `git diff --check`: required before commit.
- Secret/token scan and forbidden future-phase naming scan: required before commit.

## 6. Explicit Non-Changes

No dashboard messaging UI, routing hook, manual reply mutation, yellow reviewed-manual mutation, provider credential, webhook, live channel, billing, monitoring, backup, secret-manager, or real health-data path was added.

## 7. Handoff to Phase 5

Phase 5 may now implement manual reply, yellow reviewed-manual, and draft mutation endpoints on top of the bounded detail contract and existing receipt semantics. Stage 4C remains blocked until all Stage 4B-2 phases and evidence close.

## 8. Final Closure Checks

- Changed runtime files are limited to the migration, read API modules, store helpers, routes, and targeted tests listed above.
- Production pilot remains `NO-GO`; R-405 remains open; real integration paths remain closed.
- Next authorized implementation unit is Phase 5.

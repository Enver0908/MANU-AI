# Phase 85 Stage 4B-2 Phase 3 Bounded List and Transcript Projection Evidence

Status: **complete — projection engine only; no read APIs, UI, or message mutations**

Implementation branch: `codex/phase-85-interstage-clinical-memory`

## 1. Scope

Phase 3 adds server-independent bounded conversation list and transcript projection for both fallback `ManuAppState` and Supabase-shaped snake-case rows. It centralizes list/detail builders, inbox unread badge formatting, scale fixtures, and fallback store helpers. It does not add `/api/conversations` routes, dashboard UI, manual/yellow mutations, mark-read mutation wiring in fallback state, provider/channel paths, billing, monitoring, backup, secret-manager, or real health-data paths.

## 2. Preconditions and Baseline

- Phase 1 domain/DTO/authorization projection was committed in `867e1b7`.
- Phase 2 receipt persistence/RLS was committed in `b154cab`.
- Production pilot remains `NO-GO`.
- R-405 remains open.
- Stage 4C remains blocked.
- Real provider, channel, billing, monitoring, backup, secret-manager, and health-data paths remain closed.

## 3. Implemented Files

- `app/src/lib/phase-85-stage-4b2-messaging.ts`: projection source adapters (`conversationProjectionSourceFromAppState`, `conversationProjectionSourceFromSnakeRows`), bounded list/detail builders, anchor window (25 before + target + 24 after), inbox unread total/badge helpers (`99+` cap), and 250-conversation scale fixture.
- `app/src/lib/phase-85-stage-4b2-api.ts`: keeps permission/query/cursor parsing, preview/message projection, unread counting; re-exports list/detail builders from the messaging module.
- `app/src/lib/app-state-store.ts`: `listFallbackConversations()` and `getFallbackConversationDetail()` over the bounded projection builders.
- `app/src/lib/phase-85-stage-4b2-messaging.test.ts`: fallback vs camel vs snake parity, scale bounds, edge cases, and fallback helper smoke tests.

## 4. Locked Behaviors Proven

- List default page size 30 and max 100; detail default 50 and max 100.
- List sort is `lastActivityAt DESC, conversationId DESC`, including stable tie-break for equal timestamps.
- Last activity derives from all transcript records in the conversation, not only inbound messages.
- Search applies only to client display name; message body search is not added.
- Draft preview uses the fixed “Taslak inceleme bekliyor” label; unavailable/revoked/redacted content uses safe fixed preview/body rules from Phase 1.
- Per-actor unread uses sequence semantics from Phase 1/2: only `client_inbound` with `conversationSequence > lastReadSequence`; `content_unavailable` counts; `revoked` and `redacted` do not.
- Revoked/redacted messages remain in chronological detail output with `body: null` and content status preserved; they are excluded from unread only.
- Null legacy `conversation_sequence` rows do not break projection or unread math.
- Inbox unread badge formats totals above 99 as `99+`.
- Invalid list/detail cursors fail closed through `AppDomainError`.
- Fallback `ManuAppState`, camel projection source, and snake-case adapter produce identical list/detail DTO output (golden parity).
- Scale fixture with 250 conversations returns at most 100 list items, exposes `nextCursor`, and keeps serialized output bounded.

## 5. Verification

- Dedicated Phase 3 messaging Vitest: 4 passed, 0 failed.
- Phase 1 regression file: 8 passed, 0 failed.
- Phase 2 lifecycle file: 2 passed, 0 failed.
- Full app `npm test`: 144 files, 915 passed, 5 skipped, 0 failed.
- `npm run lint`: exit 0, 0 errors, 3 pre-existing warnings.
- `npm run build`: passed after restoring `ConversationProjectionClient` import in `phase-85-stage-4b2-api.ts`.
- `npm run test:rls`: not re-run in this phase; prior environment skip remains not counted as pass.
- `git diff --check`: required before commit.
- Secret/token scan and forbidden future-phase naming scan: required before commit.

## 6. Explicit Non-Changes

No `/api/conversations` route, dashboard messaging UI, manual reply mutation, yellow reviewed-manual mutation, fallback mark-read mutation helper, provider credential, webhook, live channel, billing, monitoring, backup, secret-manager, or real health-data path was added.

## 7. Handoff to Phase 4

Phase 4 may now expose actor-aware read APIs (`GET /api/conversations`, `GET /api/conversations/[id]/messages`, `POST /api/conversations/[id]/read`) on top of the Phase 3 projection engine and Phase 2 receipt RPC/RLS without loading full `ManuAppState`. Stage 4C remains blocked until all Stage 4B-2 phases and evidence close.

## 8. Final Closure Checks

- Changed runtime files are limited to the messaging projection modules, fallback store helpers, and targeted tests listed above.
- Production pilot remains `NO-GO`; R-405 remains open; real integration paths remain closed.
- Next authorized implementation unit is Phase 4.

# Phase 85 Stage 4B-2 Phase 5 Manual, Yellow Review, and Draft Mutations Evidence

Status: **complete — mutation APIs only; no dashboard routing/UI refresh layer**

Implementation branch: `codex/phase-85-interstage-clinical-memory`

## 1. Scope

Phase 5 makes conversation-scoped message mutations idempotent, CAS-controlled, and clinically consistent. Manual replies and draft actions return bounded `ConversationMutationResponse` instead of full `ManuAppState`. Yellow AI drafts complete only through `review_send_manual`, which creates a new `dietitian_manual` message linked by `sourceMessageId`, invalidates the AI draft, resolves yellow hold when safe, and never marks the AI draft `sent`. Red manual replies do not close `redRiskLock`.

## 2. Preconditions and Baseline

- Phase 4 read APIs were committed in `32487e3`.
- Production pilot remains `NO-GO`.
- R-405 remains open.
- Stage 4C remains blocked.
- Real provider, channel, billing, monitoring, backup, secret-manager, and health-data paths remain closed.

## 3. Implemented Files

- `app/supabase/migrations/20260712160000_phase_85_stage_4b2_mutation_idempotency.sql`: `conversation_mutation_idempotency`, idempotency RPCs, `commit_manual_reply` CAS guard via `p85_if_r3_assert_expected_conversation_revisions`.
- `app/src/lib/phase-85-stage-4b2-mutations.ts`: request parsing, permission gate, bounded mutation DTO builder, fallback idempotency store.
- `app/src/lib/phase-85-stage-4b2-mutations.test.ts`: manual reply, idempotency, CAS 409, yellow review, red lock preservation.
- `app/src/lib/simulator.ts`: `appendDietitianManualReplyByConversation`, `reviewSendManualFromYellowDraftInState`, revision-aware draft helpers.
- `app/src/lib/app-state-store.ts`: `addFallbackManualReplyWithResponse`, `applyFallbackDraftMutationWithResponse`.
- `app/src/lib/supabase-store.ts`: `addSupabaseManualReply`, `applySupabaseDraftMutation`, projection-backed mutation response builders.
- `app/src/app/api/messages/manual/route.ts`: bounded manual reply contract.
- `app/src/app/api/messages/drafts/[id]/route.ts`: `approve` / `edit_send` / `dismiss` / `review_send_manual`.
- `app/src/lib/use-manu-state.ts`: temporary bridge — mutation then `/api/app-state` refetch until Phase 6 merge hook.
- `app/src/lib/phase-85-stage-4b2-contracts.ts`: manual/draft request types.

## 4. Locked Behaviors Proven

- `POST /api/messages/manual` requires `conversationId` (or legacy `clientId` resolution), `body`, UUID `requestId`, and `expectedConversationRevision`.
- `POST /api/messages/drafts/[id]` requires `action`, UUID `requestId`, and `expectedConversationRevision`; `review_send_manual` additionally requires `expectedClientContextRevision`.
- Duplicate `requestId` returns the same bounded mutation response without duplicate writes.
- Stale `expectedConversationRevision` returns `409 reactivation_conflict_conversation_revision`.
- Blocked/opted-out channel permission returns `409 context_changed_before_send`.
- Yellow draft direct approve remains blocked (`non_green_ai_draft_client_send_blocked`); `review_send_manual` sends reviewed manual provenance instead.
- AI yellow draft status never becomes `sent`; original draft becomes `blocked` and decision `draft_invalidated`.
- Red manual reply leaves `redRiskLock.status === "locked"`.
- Mutation responses are bounded DTOs with `Cache-Control: no-store`; no full `ManuAppState` leak.

## 5. Verification

- Dedicated Phase 5 mutation Vitest: 9 passed, 0 failed.
- API error regression updated for new draft contract: passed.
- Full app `npm test`: 146 files, 929 passed, 5 skipped, 0 failed.
- `npm run lint`: exit 0, 0 errors, 3 pre-existing warnings.
- `npm run build`: passed.
- `npm run test:rls`: not re-run in this phase; prior environment skip remains not counted as pass.

## 6. Explicit Non-Changes

No messaging list/detail UI, URL routing hook, polling scheduler, optimistic mutation UI, provider credential, webhook, live channel, billing, monitoring, backup, secret-manager, or real health-data path was added.

## 7. Handoff to Phase 6

Phase 6 may now add URL state, bounded client hooks, polling, and proper mutation-to-state merge so dashboard no longer refetches full app state after each message mutation. Stage 4C remains blocked until all Stage 4B-2 phases and evidence close.

## 8. Final Closure Checks

- Changed runtime files are limited to the migration, mutation modules, simulator/store/route updates, hook bridge, and targeted tests listed above.
- Production pilot remains `NO-GO`; R-405 remains open; real integration paths remain closed.
- Next authorized implementation unit is Phase 6.

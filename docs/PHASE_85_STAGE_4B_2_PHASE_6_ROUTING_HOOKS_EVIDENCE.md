# Phase 85 Stage 4B-2 Phase 6 Routing, Hooks, Refresh, and State Merge Evidence

Status: **complete — URL/hook/merge infrastructure only; no messaging list UI (Phase 7)**

Implementation branch: `codex/phase-85-interstage-clinical-memory`

## 1. Scope

Phase 6 adds URL-driven messaging route state, bounded list/detail refresh hooks, mutation-to-legacy state merge helpers, and dashboard wiring. Conversation list UI and split inbox layout remain Phase 7. Provider/channel paths remain closed.

## 2. Preconditions and Baseline

- Phase 5 mutation APIs committed in `312ca72`.
- Production pilot remains `NO-GO`.
- R-405 remains open.
- Stage 4C remains blocked.

## 3. Implemented Files

- `app/src/lib/phase-85-stage-4b-dashboard-routing.ts`: `conversationStatus`, `conversationQuery`, messaging route canonicalization, bounded API query builders, unread badge helper.
- `app/src/lib/phase-85-stage-4b2-messaging-scheduler.ts`: 30s list / 15s detail polling intervals, 60/120s backoff.
- `app/src/lib/phase-85-stage-4b2-state-merge.ts`: merge detail/mutation DTOs into `ManuAppState`; post-mutation app-state refresh gate.
- `app/src/lib/use-stage-4b2-messaging.ts`: list/detail fetch, polling, focus/visibility refresh, in-flight dedupe, AbortController, post-render mark-read.
- `app/src/lib/use-manu-state.ts`: `AppRequestError`, mutation merge + selective app-state resync, `reviewSendManualFromDraft`.
- `app/src/lib/app-errors.ts`: `AppRequestError` for client fetch errors.
- `app/src/components/dashboard-app.tsx`: messaging hook wiring, URL canonicalization, 409 composer preservation, mutation refresh orchestration.
- Tests: `phase-85-stage-4b-dashboard-routing.test.ts`, `phase-85-stage-4b2-state-merge.test.ts`, `phase-85-stage-4b2-messaging-scheduler.test.ts`.

## 4. Locked Behaviors Proven

- URL supports `section=messages`, `conversationId`, `messageId`, `conversationStatus`, `conversationQuery`.
- Legacy `clientId` deep links canonicalize to authoritative `conversationId`.
- List polling uses 30s; open detail polling uses 15s; hidden tabs pause polling; errors backoff to 60/120s.
- Focus and visibility changes trigger immediate refresh.
- In-flight dedupe and AbortController prevent overlapping list/detail fetches.
- Mark-read runs only after detail render (`requestAnimationFrame`), not before visible transcript.
- Mutation responses merge into legacy state; manual/draft mutations additionally resync full app state for client/decision side effects.
- Mutation success is not optimistic; `409` preserves composer text and triggers detail refresh.
- Bounded DTOs are merged without leaking list/detail payloads as full app state.

## 5. Verification

- Dedicated Phase 6 unit tests: 9 new/extended cases passed.
- Full app `npm test`: 148 files, 938 passed, 5 skipped, 0 failed.
- `npm run lint`: exit 0, 0 errors, 3 pre-existing warnings.
- `npm run build`: passed.

## 6. Explicit Non-Changes

No messaging list row UI, split inbox layout, nav unread badge UI, ConversationPanel pagination UI, or provider/channel path was added.

## 7. Handoff to Phase 7

Phase 7 may now build the Mesajlaşma inbox list/detail UI on top of `useStage4B2Messaging` and canonical URL state. Stage 4C remains blocked until all Stage 4B-2 phases and evidence close.

## 8. Final Closure Checks

- Production pilot remains `NO-GO`; R-405 remains open; real integration paths remain closed.
- Next authorized implementation unit is Phase 7.

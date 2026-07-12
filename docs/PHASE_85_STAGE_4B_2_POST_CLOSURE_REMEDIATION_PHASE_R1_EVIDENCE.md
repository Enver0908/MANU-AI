# Phase 85 Stage 4B-2 Post-Closure Remediation - Phase R1 Evidence

Status: **Complete (2026-07-12)**

Branch: `codex/phase-85-interstage-clinical-memory`

R1 baseline: `f66c4cc Lock Stage 4B-2 post-closure remediation R0`

## Scope

R1 corrected the shared domain, DTO, permission, cursor, numeric-input, and mutation-precondition contracts identified by the post-closure audit. The change is intentionally limited to the application contract/projection layer and its tests. No migration, route, RPC, provider, channel, billing, monitoring, backup, secret-manager, health-data, or production-pilot path was opened.

## Implemented corrections

- `app/src/lib/phase-85-stage-4b2-contracts.ts` now exposes Stage 4B-2 contract/API `v2` and separates `canActivateAi` from `canConfigureAi`.
- Red-locked clients retain atomic AI activation permission, while AI configuration remains denied until the lock is closed by activation.
- `ConversationListResponse` now carries `unreadConversationCount` and `unreadMessageCount` over the full actor-visible projection, independent of page size, search, or unread filter.
- Cursor decoding rejects empty, oversized, and non-base64url input; positive integer parsing rejects unsafe integers.
- Yellow `review_send_manual` requires `expectedClientContextRevision`; green actions retain their existing optional behavior.
- Consumer helpers, fixtures, API/read/mutation tests, and visual fixtures use the split permission contract.

## Data-flow boundary

The read path first derives the actor-visible conversation projection, then applies search/status filtering and cursor pagination. Aggregate unread values are computed from the unfiltered visible projection. The mutation parser validates the yellow client-context precondition before the operation reaches the mutation service. Permission projection is derived from actor scope, assignment, client risk state, and the split operation capability.

## Verification

- Targeted Vitest: 7 files, 36 tests passed, 0 failed.
- `npm run lint`: passed with 0 errors and 4 warnings. Three warnings are pre-existing outside this track; the existing Stage 4B-2 warning is at `app/src/lib/use-stage-4b2-messaging.ts:194`.
- `npm run build`: passed; TypeScript compilation and route generation completed.
- RLS suite: not claimed as passed. R1 changed no SQL/RLS artifact; the environment-level suite remains the previously documented Docker-blocked gate with 35 skipped tests.

## Completion decision

R1 is complete for its contract/projection scope. R1 does not close server-side assignment authorization, database-bounded Supabase reads, transactional idempotency, yellow/red race handling, unread UI integration, responsive/deep-link behavior, or final RLS/release evidence. Those remain in R2-R7. Stage 4C remains blocked, production pilot remains `NO-GO`, R-405 remains open, and real provider/channel/health-data paths remain disabled.

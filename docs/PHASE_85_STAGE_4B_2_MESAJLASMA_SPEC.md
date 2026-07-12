# Phase 85 Stage 4B-2 — Mesajlaşma Runtime Specification

Date: 2026-07-12  
Status: **implemented; conditional closure with environment-blocked RLS re-run**  
Canonical plan: `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_ACTION_PLAN.md`  
Closure evidence: `docs/PHASE_85_STAGE_4B_2_CLOSURE_EVIDENCE.md`

## 1. Boundary

Stage 4B-2 owns the dietitian-facing conversation inbox and transcript workflow:

- bounded conversation list with per-actor unread state;
- paginated conversation detail with provenance/status labels;
- yellow draft review → reviewed `dietitian_manual` send;
- red manual reply without closing the red lock;
- conversation-scoped AI control and activation UX;
- **Görüşme → Mesajlaşma** navigation consolidation (`section=messages`).

Stage 4B-2 does not add real WhatsApp, Telegram, Gemini, external LLM, live billing, monitoring, backup, secret-manager, or health-data paths. Stage 4B alert/notification ownership remains unchanged. Stage 4C is authorized only after this specification and closure evidence are complete.

## 2. Navigation and URL contract

- Internal dashboard section id: `messages`.
- User-visible label in all supported languages: **Mesajlaşma** (no duplicate Görüşme entry).
- URL parameters: `section=messages`, `conversationId`, `messageId`, `conversationStatus`, `conversationQuery`, optional `source` (`alert` | `notification`).
- Desktop/tablet: ~360px list + flexible detail split.
- Mobile: list drill-down to detail with back navigation.
- List polling: 30s visible-tab; open detail: 15s visible-tab; focus refresh with in-flight dedupe, `AbortController`, and 60/120s backoff.

## 3. Unread contract

Unread counts only `origin=client_inbound` messages where:

- `conversationSequence > lastReadSequence` for the requesting actor's receipt;
- `contentStatus` is not `revoked` or `redacted`.

Dietitian and assistant receipts are fully independent. Nav badge shows total personal unread capped at `99+`. Mark-read uses monotonic `GREATEST(old, requested)` semantics.

## 4. List and detail DTO contract

List (`ConversationInboxItem`):

- filters: `status=all|unread`, client-name `query` only (no message-body search);
- keyset cursor pagination; default 30 / max 100 rows;
- sort: `lastActivityAt DESC, conversationId DESC`;
- safe preview text; draft preview shows **Taslak inceleme bekliyor**; revoked/redacted content uses fixed safe labels.

Detail (`ConversationMessageDto`):

- default 50 / max 100 messages per page;
- first load returns the latest page; `older` / `newer` keyset cursors;
- `anchorMessageId` window: 25 before + target + 24 after within tenant/conversation;
- messages returned chronologically to the UI;
- DTOs exclude health profile, raw risk reasons, audit metadata, operational bindings, and full `ManuAppState`.

All read responses carry `Cache-Control: no-store`.

## 5. Mutation contract

Manual reply (`POST /api/messages/manual`):

- body 1–4096 Unicode code points;
- `requestId` UUID, `expectedConversationRevision`, and required `expectedClientContextRevision` where applicable;
- creates `dietitian_manual` provenance;
- under red lock: message is added; lock/handoff/AI passivity unchanged;
- idempotent `requestId` replay returns the same result.

Yellow draft review (`POST /api/messages/drafts/[id]` with `review_send_manual`):

- never sends the AI draft as `sent`;
- creates a new `dietitian_manual` message with `sourceMessageId` linking the draft;
- invalidates the draft and closes yellow hold/session;
- restores prior AI state when not red-locked.

Red closure:

- only via existing `POST /api/clients/[id]/activate-ai` with expected conversation and client-context revisions.

Mutation responses return conversation-scoped DTOs, not full `ManuAppState`.

## 6. Persistence and Supabase path

Append-only migrations:

- `20260712140000_phase_85_stage_4b2_receipt_persistence_rls.sql` — `conversation_read_receipts`, sequence backfill, RLS;
- `20260712150000_phase_85_stage_4b2_read_api_projection_rpcs.sql` — actor-aware list/detail/mark-read RPCs;
- `20260712160000_phase_85_stage_4b2_mutation_idempotency.sql` — CAS/idempotent mutation RPCs.

The server-side Supabase store uses actor-validating security-definer RPCs for list, detail, mark-read, and mutations. Service-role calls validate tenant user, dietitian, and role against tenant membership before returning data or mutating receipts.

## 7. Access contract

| Role | List/detail visibility | Mark read | Manual reply | Draft review | AI configure | AI activate |
| --- | --- | --- | --- | --- | --- | --- |
| owner/admin | tenant-wide assigned clients | own receipt | yes | yes | yes | yes |
| dietitian | primary / `care_team` clients | own receipt | yes | yes | yes | yes |
| viewer | assigned clients | own receipt | no | no | no | no |
| assistant | assigned clients only | own receipt only | no | no | no | no |
| auditor | empty | denied | denied | denied | denied | denied |
| cross-tenant / unassigned | empty or `404` | denied | denied | denied | denied | denied |

Permission DTO fields: `canRead`, `canMarkRead`, `canReply`, `canReviewDraft`, `canActivateAi`, `canConfigureAi`. Under a red lock, activation remains allowed for an authorized actor while configuration is denied. UI hides composer, draft review, and AI controls when permissions deny them.

## 8. API surface

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/conversations` | Bounded inbox list |
| GET | `/api/conversations/[id]/messages` | Paginated transcript detail |
| POST | `/api/conversations/[id]/read` | Monotonic mark-read |
| POST | `/api/messages/manual` | Manual reply mutation |
| POST | `/api/messages/drafts/[id]` | Yellow draft review/send |
| POST | `/api/clients/[id]/activate-ai` | Red atomic activation (existing) |

Malformed query/cursor parameters return `400`; forbidden role `403`; invisible or mismatched resource `404`; stale revision/conflict `409`.

## 9. UI modules

- `messaging-panel.tsx`, `conversation-list-row.tsx` — inbox list and navigation;
- `conversation-panel.tsx` and subcomponents — bubbles, header, composer, draft review, AI controls;
- `use-stage-4b2-messaging.ts` — bounded client state, polling, pagination;
- `phase-85-stage-4b-dashboard-routing.ts`, `use-dashboard-url.ts` — URL sync;
- `dashboard-navigation.tsx` — Mesajlaşma entry and unread badge.

Visual smoke: `tests/visual/messaging.visual.spec.ts` across desktop, tablet, mobile-android, and mobile-ios for list, detail, yellow draft, red manual, and assistant read-only states.

## 10. Stage 4B and P85-IF integration

- Alert/notification clicks open bounded anchored detail in Mesajlaşma;
- post-send/activation mutations refresh Mesajlaşma and Uyarılar/Bildirimler independently;
- anonymization removes read receipts and redacts message bodies;
- client export excludes `conversationReadReceipts` with leak guards;
- broken source links surface `detailUnavailable` without silent success.

## 11. Verification boundary

Local code, fallback behavior, mock channel behavior, Stage 4B-2 integration/scale rehearsal, production-scale 79G, build, lint, release verification, and 40 Playwright visual snapshots are verified. The current RLS suite is **not** claimed as passed because Docker Desktop/local Supabase is unavailable (35 tests skipped). No provider, live channel, live billing, monitoring, backup, secret-manager, or real health-data path is opened by this specification.

Production pilot remains **NO-GO**. R-405 remains open.

## Stage 4C Consumer Gate — 2026-07-12

Stage 4C planning and implementation remain blocked while post-closure remediation is active. The required consumer gate is `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_ACTION_PLAN.md` phases R1-R7, including a zero-skip RLS run and independent release verification. Stage 4C must not weaken non-green AI draft blocking, red atomic activation, per-actor receipts, bounded list/detail reads, or Stage 4B alert/notification contracts.
## Post-Closure Remediation R2 - 2026-07-12

The Supabase conversation list/detail boundary now uses append-only v2 RPCs with bounded SQL projection branches, actor-scoped unread aggregates, and v2 receipt authorization guards. The current RLS suite remains environment-blocked and is not claimed as passed. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R2_EVIDENCE.md`; R3 remains next.

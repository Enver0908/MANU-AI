# Phase 85 Stage 4B-2 - Mesajlasma Eylem Plani

Historical status, 2026-07-13: implementation and post-closure remediation R0-R7 were complete locally. R7 evidence superseded older active-remediation handoffs in this historical execution plan: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`. Stage 4B-3 was next before Stage 4C at that checkpoint and later closed; production remains `NO-GO`; R-405 is technically resolved under the later Stage 5 dependency report.

Status: **implementation Phases 0-11 and post-closure remediation R0-R7 complete locally; advisory hardening complete; historical stage.** Runtime spec: `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_SPEC.md`. Closure authority for this stage: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md` and `docs/PHASE_85_STAGE_4B_2_SECURITY_ADVISORY_RLS_HARDENING_EVIDENCE.md`. Later Stage 4B-3 through Stage 7 work is locally closed under subsequent evidence.

Baseline branch: `codex/phase-85-interstage-clinical-memory`

Baseline commit: `f4d949d Remediate Phase 85 Stage 4B closure findings`

Production pilot remains `NO-GO`. R-405 was open at this historical checkpoint and is technically resolved under the later Stage 5 dependency report. Real WhatsApp, Telegram, Gemini, external LLM, live billing, monitoring, backup, secret manager, and real health-data paths remain disabled.

## 1. Purpose

This document is the decision-complete implementation contract for Phase 85 Stage 4B-2 Mesajlasma. It is written on top of the completed Stage 4B Uyarilar/Bildirimler implementation, the P85-IF post-closure contracts, and the existing dashboard, simulator, Supabase, channel, lifecycle, and AI-control code.

Stage 4B-2 owns the dietitian-facing conversation inbox and transcript workflow. It does not reopen P85-IF, replace Stage 4B alert/notification ownership, or authorize a real provider/channel path.

## 2. Locked Stage Order

1. Stage 4A Danisan Kontrol Paneli - complete.
2. P85-IF-A through P85-IF-I and post-closure audit - complete.
3. Stage 4B Uyari ve Bildirimler - complete locally; historical Docker block superseded by complete-chain zero-skip RLS and advisory hardening.
4. Stage 4B-2 Mesajlasma - historical implementation evidence (2026-07-12); remediation is active under `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_ACTION_PLAN.md`.
5. Stage 4B-3 Multimodal Gorsel Guvenligi ve Yanit Orkestrasyonu - **current after Phase 0 lock**.
6. Stage 4C Diyetisyen Icin AI Chat - **blocked until Stage 4B-3 closes**.

The internal dashboard section identifier remains `messages`. Only the visible label changes from the temporary Gorusme label to Mesajlasma. No permanent duplicate Gorusme entry may remain.

## 3. Non-Negotiable Boundaries

- No `alerts` table is added. Stage 4B alert ownership remains unchanged.
- Stage 4B-2 does not add real WhatsApp/Telegram credentials, webhook activation, provider calls, external delivery, live billing, monitoring, backup, secret-manager, or health-data paths.
- Message list/detail DTOs are bounded and never return full `ManuAppState`.
- Conversation text is visible only inside an authorized conversation surface; alert/notification DTO restrictions remain unchanged.
- P85-IF provenance, retrieval eligibility, human-control, red-risk, yellow-hold, conversation revision, and lifecycle rules remain authoritative.
- Direct AI activation continues through `/api/clients/[id]/activate-ai` with expected conversation and client-context revisions.
- A red manual reply is recorded but never resolves `redRiskLock`, handoff, or human-control state.
- Existing non-green AI draft client-send blocking remains active.

## 4. Product and Clinical Behavior

### 4.1 Conversation list

The list displays thin rows ordered by `lastActivityAt DESC, conversationId DESC`.

Each row contains client full name, channel, one-line last-message preview, time, unread count/indicator, and a safe local status affordance. It does not show raw clinical risk reasons.

List search applies only to client full name. It does not perform broad message-body search. Filters are `all` and `unread`.

If the latest item is an unsent AI draft, its preview is the fixed text `Taslak inceleme bekliyor`; the draft body is not used as the row preview.

### 4.2 Unread state

Unread state is per actor and per conversation. The persistent record stores `lastReadSequence`, not a mutable boolean per message.

Only `client_inbound` messages with `conversationSequence` greater than the actor marker count as unread. `revoked` and `redacted` messages do not count; `content_unavailable` client messages do count so an unsupported inbound event is not silently hidden.

The client calls mark-read only after the detail page has loaded, is visible, and the rendered message window has a known `throughSequence`. The server advances the marker monotonically with `GREATEST` and never moves it backwards.

Dietitian and assistant receipts are independent. Opening a conversation as an assistant never clears the dietitian's unread count.

### 4.3 Conversation detail

The detail is a WhatsApp-like transcript workspace, not a provider clone. It uses chronological message bubbles, date separators, provenance/status labels, safe unavailable-content placeholders, older/newer pagination, and anchor scrolling.

The initial request returns the newest 50 messages. `anchorMessageId` returns a bounded 25-before/anchor/24-after window. No request returns an unbounded full transcript.

### 4.4 Yellow workflow

When a yellow hold has an active draft, the detail shows the draft editor and an explicit dietitian review confirmation.

The original `ai_generated` draft is never changed to client-sendable `sent` status when its decision risk is non-green. A successful review creates a new `dietitian_manual` message, records `sourceMessageId` to the reviewed draft, invalidates the AI draft, closes the yellow hold/session, restores the previous AI status/mode when no red lock exists, and writes the audit/reconciliation events atomically.

If a red lock exists or appears before commit, the yellow review command returns `409` and does not write a partial result. The dietitian uses the red manual composer instead.

### 4.5 Red workflow

The red detail state always provides a manual reply composer and a separate atomic AI activation control. Sending a manual reply invalidates stale pending drafts and increments conversation revision, but leaves `redRiskLock` active.

AI activation is the only red closure command. It closes the linked handoff/session, clears the lock, applies the established reactivation reason code, and passes expected-revision checks before any client-visible state changes.

### 4.6 In-detail AI control

The detail exposes active/passive AI control. Active uses the existing atomic activation path. Passive uses the existing capability-gated client control path with prompt-affecting revision/draft invalidation behavior.

When red-locked, activation remains enabled but mode/persona/schedule configuration remains disabled. Assistant and auditor never receive AI controls.

## 5. Locked Role Matrix

| Role | Conversation visibility | Unread receipt | Manual reply | Draft review | AI control |
| --- | --- | --- | --- | --- | --- |
| owner/admin | tenant-wide | own receipt | allowed by existing capability | allowed by existing capability | allowed by existing capability |
| dietitian, primary/care_team | visible assigned scope | own receipt | allowed | allowed | allowed |
| dietitian, viewer assignment | visible assigned scope | own receipt | denied | denied | denied |
| assistant, assigned scope | read-only transcript | own receipt only | denied | denied | denied |
| auditor | no conversation visibility | denied | denied | denied | denied |

The assistant receipt mutation is a non-clinical UI-state exception. It does not grant any message, draft, AI, handoff, risk, or client-record mutation capability.

## 6. Public Type and API Contracts

The new `phase-85-stage-4b2-contracts.ts` module defines `ConversationReadReceiptRecord`, `ConversationInboxItem`, `ConversationListResponse`, `ConversationMessageDto`, `ConversationDetailResponse`, `ConversationPermissions`, `ConversationMutationResponse`, and versioned cursor payloads.

`GET /api/conversations?status=all|unread&query=&cursor=&limit=` returns a maximum of 100 allowlisted rows. Default page size is 30 and query length is capped at 80 characters.

`GET /api/conversations/[id]/messages?direction=older|newer&cursor=&anchorMessageId=&limit=` returns a maximum of 100 messages, bounded pagination metadata, the conversation revision, the current actor receipt, and permission flags.

`POST /api/conversations/[id]/read` accepts `{ throughSequence: integer }` and returns the actor receipt plus the new unread count. It cannot mutate any clinical or conversation content.

`POST /api/messages/manual` accepts conversation id, body, `requestId`, and expected conversation revision. `POST /api/messages/drafts/[id]` keeps green approve/edit/dismiss behavior and adds an explicit yellow reviewed-manual action with body, request id, and expected revisions.

All mutation responses are bounded `ConversationMutationResponse` objects. First-party callers must stop expecting a full `ManuAppState` from these messaging mutations; scoped merge helpers update the existing dashboard state where legacy panels still need it.

Message bodies are trimmed, non-empty, capped at 4096 Unicode code points, rendered as text, and never interpreted as HTML.

## 7. Persistence and RLS Contract

The append-only Stage 4B-2 migration adds `conversation_read_receipts` with tenant/conversation/dietitian composite integrity, `last_read_sequence`, `read_at`, `created_at`, and `updated_at`.

Existing nullable `messages.conversation_sequence` rows are backfilled deterministically. New message paths must preserve monotonic sequence assignment and the `(tenant_id, conversation_id, conversation_sequence)` index.

Server-side RPCs validate session user, tenant membership, dietitian profile, role, client assignment, conversation ownership, and operation capability. Resource absence and cross-tenant access resolve to indistinguishable `404` responses.

Direct receipt writes are restricted to the actor's own receipt and visible conversation. Assistant can write only its own marker; auditor cannot read or write receipts. Message, client, draft, handoff, risk-lock, and AI-control writes remain capability-gated separately.

Client anonymization/removal lifecycle must delete or minimize conversation receipts consistently with the existing P85-IF-I lifecycle contract. Receipt rows are not added to client-facing exports.

## 8. Phase Execution Plan

Every phase is implemented separately, verified separately, documented separately, and committed separately. A later phase may not silently absorb an incomplete earlier phase.

### Phase 0 - Decision and Documentation Lock

**Purpose:** Persist the complete Stage 4B-2 contract and establish the controlled handoff from Stage 4B.

**Scope:** stage order, role matrix, unread semantics, DTO/API contracts, yellow/red rules, mock-only boundary, phase sequence, verification and closure protocol.

**Prerequisites:** clean worktree; baseline branch and commit verified; Stage 4B evidence and P85-IF post-closure contracts read.

**Affected components/files:** this document, `PHASE_85_STAGE_4B_2_PHASE_0_DOCUMENTATION_EVIDENCE.md`, all continuity/readiness documents listed in the evidence file.

**Architecture decisions:** no runtime code, SQL migration, provider, channel, billing, monitoring, backup, secret-manager, or health-data change is allowed in Phase 0.

**Steps/technical method/data flow/dependencies:** write the canonical action plan; record the Phase 0 evidence; update Stage 4B/P85-IF/roadmap/pilot/risk handoff text; scan for contradictory next-stage wording and forbidden naming.

**Errors and edges:** any document claiming Stage 4B-2 runtime is complete, Stage 4C is open, production pilot is GO, R-405 is closed, or a real provider is connected fails the phase.

**Tests/validation/completion:** `git diff --check`, document path/reference scan, secret/token scan, forbidden-name scan, worktree check, lint, build, and unchanged core/app test baselines must be recorded. Phase 0 completes only after the separate documentation commit exists and no runtime diff is present.

### Phase 1 - Domain Types, DTOs, and Authorization Projection

**Purpose:** Implement pure types and projection rules before database/API work.

**Scope:** list/detail/mutation DTOs, role permissions, preview redaction, query/limit/cursor parsing, and fallback-compatible projection interfaces.

**Prerequisites:** Phase 0 evidence and locked contracts committed.

**Affected components/files:** `types.ts`, new `phase-85-stage-4b2-contracts.ts`, new messaging projection/API modules, auth helpers, seed-state types, targeted tests.

**Architecture decisions:** DTOs must not contain `ManuAppState`; unread is sequence-based; search is client-name-only; assistant receives transcript/read receipt only.

**Steps/technical method/data flow/dependencies:** define DTOs, normalize safe previews, derive permissions from role plus assignment, and produce identical fallback/Supabase response shapes.

**Errors and edges:** invalid query/limit/cursor, missing conversation, viewer write, assistant domain mutation, auditor access, redacted/unavailable message and empty transcript.

**Tests/validation/completion:** unit/golden tests prove role matrix, allowlists, deterministic sorting, preview limits and cursor contracts with zero raw state leakage.

**Phase 1 completion record (2026-07-12):** `types.ts` now owns the client-assignment access-level domain types. `phase-85-stage-4b2-contracts.ts` defines the bounded list/detail/mutation DTOs, actor receipt shape, permission flags, projection source interfaces, and versioned cursors. `phase-85-stage-4b2-api.ts` implements tenant/assignment-aware permissions, fail-closed operation checks, name-only search, bounded query/limit/cursor parsing, safe preview/message projection, actor-specific sequence unread counting, deterministic list ordering, and bounded detail windows. No route, migration, receipt write, provider/channel path, or full-state messaging response was added in this phase.

Phase 1 verification passed the dedicated 8-test file, the combined Stage 4B regression set (`7 files, 61 passed, 1 skipped`), and the full app suite (`142 files, 909 passed, 5 skipped`). The next authorized implementation unit is Phase 2.

### Phase 2 - Receipt Persistence, Sequence Backfill, and RLS

**Purpose:** Make unread state durable, actor-specific, monotonic, and tenant-safe.

**Scope:** append-only migration, receipt table/indexes, sequence backfill, RLS policies, actor-aware read-marker RPC.

**Prerequisites:** Phase 1 DTOs and actor matrix.

**Affected components/files:** new Stage 4B-2 migration, Supabase mappers/store, lifecycle hooks, RLS integration tests.

**Architecture decisions:** one receipt row per tenant/conversation/dietitian; `GREATEST` prevents backward movement; no per-message boolean receipt table.

**Steps/technical method/data flow/dependencies:** backfill sequence; create composite FKs/indexes; validate membership/role/assignment; insert/update only own receipt; return bounded counts.

**Errors and edges:** cross-tenant composite mismatch, sequence beyond conversation, concurrent mark-read, anonymized client and assistant/auditor access.

**Tests/validation/completion:** local reset, real RLS role matrix, two-tenant isolation, monotonic marker race, receipt cleanup and sequence backfill must pass without skipped RLS being counted.

**Phase 2 completion record (2026-07-12):** migration `20260712140000_phase_85_stage_4b2_receipt_persistence_rls.sql` adds `conversation_read_receipts`, deterministic `conversation_sequence` backfill, actor-validating `p85_stage_4b2_mark_conversation_read_v1`, unread counting aligned with Phase 1 semantics, RLS select policy, lifecycle receipt deletion on client removal, Supabase store load/map/mark helpers, and fallback lifecycle receipt cleanup. No read API route, UI, or message mutation was added in this phase.

Phase 2 verification passed the dedicated 2-test lifecycle file, the Phase 1 8-test regression file, and the full app suite (`143 files, 911 passed, 5 skipped`). `npm run test:rls` skipped 34/34 because Docker/Supabase was unavailable and is not counted as pass.

**Phase 3 completion record (2026-07-12):** `phase-85-stage-4b2-messaging.ts` centralizes bounded list/detail projection for fallback and Supabase-shaped sources, inbox unread badge formatting, scale fixtures, and fallback store helpers (`listFallbackConversations`, `getFallbackConversationDetail`). No read API route, UI, or message mutation was added in this phase.

Phase 3 verification passed the dedicated 4-test messaging file, Phase 1/2 regression files, and the full app suite (`144 files, 915 passed, 5 skipped`). `npm run build` passed after restoring the `ConversationProjectionClient` import in `phase-85-stage-4b2-api.ts`.

**Phase 4 completion record (2026-07-12):** append-only migration `20260712150000_phase_85_stage_4b2_read_api_projection_rpcs.sql` adds actor-scoped projection RPCs; `/api/conversations`, `/api/conversations/[id]/messages`, and `/api/conversations/[id]/read` expose bounded list/detail/mark-read responses with `Cache-Control: no-store`; Supabase store helpers avoid full app-state reads. No dashboard UI or message mutation was added in this phase.

Phase 4 verification passed the dedicated 5-test read API file, Phase 3/1 regression files, and the full app suite (`145 files, 920 passed, 5 skipped`). The next authorized implementation unit is Phase 5.

### Phase 3 - Bounded Conversation and Transcript Projection

**Purpose:** Build server-independent deterministic list/detail/read projections.

**Scope:** newest activity, safe preview, unread count, message eligibility, cursor comparison, anchor window and pagination.

**Prerequisites:** Phase 2 persistence semantics.

**Affected components/files:** messaging projection modules, fallback store, seed fixtures, unit tests.

**Architecture decisions:** list default 30/max 100; detail default 50/max 100; anchor window 25/1/24; chronological response ordering.

**Steps/technical method/data flow/dependencies:** derive list from visible conversations; join client display metadata; compute per-actor unread; map content status; emit versioned opaque cursors.

**Errors and edges:** empty conversation, equal timestamps, null legacy sequence, stale anchor, draft as latest event, revoked/redacted/unavailable content.

**Tests/validation/completion:** fallback golden cases and scale fixture prove bounded memory/output, stable sort and Supabase parity.

### Phase 4 - Actor-Aware Read APIs

**Purpose:** Expose conversation list/detail/read without full-state reads.

**Scope:** GET list, GET transcript, POST mark-read, auth/error mapping and no-store headers.

**Prerequisites:** Phase 3 projections and Phase 2 RPC/RLS.

**Affected components/files:** `/api/conversations/**`, `supabase-store.ts`, fallback API functions, API tests and route error helpers.

**Architecture decisions:** service-role RPC boundary with application actor validation; resource absence is fail-closed; no broad `/api/app-state` call.

**Steps/technical method/data flow/dependencies:** parse request; resolve actor; invoke bounded RPC; map only allowlisted DTO; return cursor/receipt/permission metadata.

**Errors and edges:** `400` malformed input, `401` unauthenticated, `403` globally forbidden actor, `404` hidden/mismatched resource, `409` invalid revision/receipt race.

**Tests/validation/completion:** API contract, cross-tenant, assistant, auditor, viewer, cursor, anchor, no-store and bounded-query tests pass.

### Phase 5 - Manual, Yellow Review, Draft, and Activation Mutations

**Purpose:** Make all detail actions atomic, idempotent and clinically consistent.

**Scope:** manual reply, green draft actions, yellow reviewed-manual action, red manual behavior, passive control and existing activation integration.

**Prerequisites:** Phase 4 read API and existing simulator/P85-IF invariants.

**Affected components/files:** `simulator.ts`, `app-state-store.ts`, `supabase-store.ts`, message routes, activation response/merge helpers, mutation/RLS tests.

**Architecture decisions:** request id is idempotency key; expected conversation revision is mandatory; yellow AI draft never becomes sent; red lock is untouched by manual reply.

**Steps/technical method/data flow/dependencies:** lock conversation/client/draft; validate revisions and permissions; write message/draft/client/session/handoff/audit changes in one RPC; return bounded mutation DTO.

**Errors and edges:** duplicate request, concurrent inbound, red arrival during yellow review, stale context, blocked permission, removed client, empty/oversized body.

**Tests/validation/completion:** green approve, yellow same-body adoption, yellow edit, yellow-red race, red manual no-close, duplicate retry and atomic rollback cases pass.

### Phase 6 - URL, Hooks, Refresh, and State Merge

**Purpose:** Give list/detail a stable URL and bounded client data lifecycle.

**Scope:** URL state, list/detail hooks, polling, dedupe, abort, retry/backoff and legacy dashboard merge.

**Prerequisites:** Phase 4 read APIs and Phase 5 mutation DTOs.

**Affected components/files:** dashboard routing, dashboard URL hook, new messaging hook, `use-manu-state.ts`, `dashboard-app.tsx`.

**Architecture decisions:** `section=messages` is canonical; `conversationId` is authoritative; list polling is 30s, visible detail polling 15s; focus/visibility refresh is immediate; mutation success is never optimistic.

**Steps/technical method/data flow/dependencies:** fetch bounded pages; mark read only after visible render; merge scoped DTOs into legacy state where required; preserve composer text on errors.

**Errors and edges:** stale URL source, list/detail race, aborted request, hidden tab, new inbound after snapshot and `409` retry.

**Tests/validation/completion:** routing round-trip, history navigation, polling scheduler, in-flight dedupe, abort, unread refresh and mutation failure tests pass.

### Phase 7 - Conversation List and Navigation UI

**Purpose:** Replace the temporary Gorusme entry with an ergonomic Mesajlasma inbox.

**Scope:** thin list rows, filters, search, split desktop layout, mobile drill-down and nav badge.

**Prerequisites:** Phase 6 hook/routing.

**Affected components/files:** new messaging panel/list-row components, `dashboard-navigation.tsx`, `dashboard-app.tsx`, `i18n.ts`, visual tests.

**Architecture decisions:** desktop/tablet uses list plus detail split; mobile uses list-to-detail navigation; 44px targets and no horizontal overflow are mandatory; Stage 5 keeps ownership of broad shell redesign.

**Steps/technical method/data flow/dependencies:** render loading/empty/error/retry/load-more; select row into URL; display personal unread badge; keep alert/notification views separate.

**Errors and edges:** long names/previews, 320px viewport, no conversations, stale selected conversation, assistant read-only and auditor empty state.

**Tests/validation/completion:** component/unit tests plus desktop/tablet/Android/iOS screenshots, keyboard focus and text containment pass.

### Phase 8 - WhatsApp-Like Detail, Draft, Red Reply, and AI Controls

**Purpose:** Convert the current `ConversationPanel` into the complete detail workflow.

**Scope:** transcript, pagination, anchor, provenance, draft editor, manual composer, red banner, AI active/passive control and mobile sticky composer.

**Prerequisites:** Phase 5 mutation contracts, Phase 6 hook and Phase 7 list navigation.

**Affected components/files:** `conversation-panel.tsx`, shared message bubble/draft controls, new detail/header/composer components, human-control/AI-control helpers, visual tests.

**Architecture decisions:** assistant/viewer can read but cannot mutate; red activation remains enabled while configuration is disabled; yellow review is explicitly manual provenance; no raw clinical reason is added to list rows.

**Steps/technical method/data flow/dependencies:** render bounded messages; load older/newer pages; focus anchor; send only through server mutation; refresh after every committed action; keep red banner after manual reply.

**Errors and edges:** stale draft, red lock, unavailable media, revoked content, blocked permission, keyboard resize, duplicate click and network timeout.

**Tests/validation/completion:** detail state matrix, role controls, red/yellow behavior, focus/scroll, mobile composer and sensitive text rendering pass.

### Phase 9 - Lifecycle and Stage 4B Integration

**Purpose:** Connect Mesajlasma to existing alert, notification, provenance, human-control and data-lifecycle contracts.

**Scope:** alert/notification targets, post-mutation refresh, client removal/anonymization, export boundaries, replay and scale integration.

**Prerequisites:** Phase 8 UI and all mutation/read APIs.

**Affected components/files:** Stage 4B target handlers, lifecycle closure/data governance, Supabase removal RPC, export leak guards, replay/integration modules.

**Architecture decisions:** alerts/notifications remain separate views; source ids are routing hints only; no notification read/ack operation resolves a clinical state; receipt data is not a client export payload.

**Steps/technical method/data flow/dependencies:** alert click opens anchored detail; notification click opens bounded target; mutation refreshes list/detail/Stage 4B counts; anonymization minimizes transcript and receipt state together.

**Errors and edges:** broken/stale source link, duplicate inbound, delivery failure, yellow-to-red race, removed client and role reassignment.

**Tests/validation/completion:** lifecycle/redaction/export leak, channel replay, Stage 4B integration and production-scale bounded-read rehearsal pass.

### Phase 10 - Full Verification and Release Gate

**Purpose:** Produce independent evidence that the locked contract is implemented without regressions.

**Scope:** targeted app/core tests, RLS, lint, build, replay, scale, release, visual, accessibility, sensitive-data, secret and naming scans.

**Prerequisites:** Phase 9 integration evidence.

**Affected components/files:** all Stage 4B-2 tests, Playwright visual projects, release verification and evidence scripts.

**Architecture decisions:** skipped RLS is not a pass; visual evidence must cover list, normal detail, yellow draft, red reply, assistant receipt, mobile and desktop.

**Steps/technical method/data flow/dependencies:** run targeted Vitest, core suite, `npm run lint`, `npm run build`, real `npm run test:rls`, channel replay, `STAGE_4B_FULL_SCALE=1`-style bounded rehearsal, visual projects, `git diff --check`, secret scan and forbidden-name scan.

**Errors and edges:** any skipped/failed/timed-out required evidence, full-state messaging read, role leak, horizontal overflow, stale CAS or provider path opening blocks closure.

**Tests/validation/completion:** every required result is recorded with exact counts and no synthetic pass; this phase closes only when all gates are green.

### Phase 11 - Evidence, Canonical Documents, and Handoff

**Purpose:** Close Stage 4B-2 locally and hand off Stage 4C without changing production readiness.

**Scope:** master evidence, continuity documents, risk register, pilot dossiers and final separate commit.

**Prerequisites:** Phase 10 pass and clean diff check.

**Affected components/files:** README, PLAN, PROJECT_PLAN, HANDOFF, app README, frontend/P85-IF/next/direct/pilot/gate/risk documents, Stage 4B-2 evidence files.

**Architecture decisions:** production pilot remains `NO-GO`; R-405 was open at this historical checkpoint and is technically resolved under the later Stage 5 dependency report; no hosted-sandbox document changes without deploy. The Stage 4C prerequisite was satisfied when the evidence pack, R0-R7 remediation, and advisory hardening closed locally.

**Steps/technical method/data flow/dependencies:** update exact verification counts, API/schema/role contracts, open blockers and next-stage lock; commit once after all checks; verify final worktree clean.

**Errors and edges:** contradictory “Stage 4B-2 complete” claims, missing RLS status, changed pilot posture, real integration references or uncommitted files block handoff.

**Tests/validation/completion:** final status, commit, diff check, forbidden-name scan and evidence reference scan pass; only then is Stage 4C the next authorized planning target.

## 9. Required Verification Matrix

- Domain: Stage 4B-2 contract, projection, role, unread, cursor, mutation and lifecycle Vitest tests.
- Core: existing dietitian-ai-assistant suite remains green; no core orchestration contract is changed by the messaging UI track.
- Persistence/RLS: migration reset, two-tenant isolation, owner/admin/dietitian/viewer/assistant/auditor matrix, composite FK, receipt monotonicity and anonymization.
- API/security: bounded response, no full-state fetch, `404` fail-closed targets, idempotency, CAS, rate limits, no-store and body limits.
- Channel/replay: mock inbound, duplicate, unsupported media, yellow-to-red, human-control and delivery ledger behavior remains unchanged.
- Scale: bounded list/detail reads at direct-pilot rehearsal scale; no O(tenant-wide transcript) response.
- Visual/accessibility: desktop, tablet, Android and iOS screenshots; 44px targets, keyboard focus, text containment and no overflow.
- Release: lint, build, release verification, `git diff --check`, secret/token scan and forbidden future-phase naming scan.

## 10. Phase 0 Completion Record

Phase 0 locks this action plan, its role/read-receipt clarification, the yellow reviewed-manual boundary, the red atomic-activation boundary, bounded message APIs, append-only persistence/RLS direction, exact phase sequence, verification matrix, documentation set, production `NO-GO`, R-405 open status, and real-integration shutdown.

Phase 0 changes no runtime code, SQL migration, API route, provider, channel adapter, billing, monitoring, backup, secret-manager, or real health-data path. Evidence: `docs/PHASE_85_STAGE_4B_2_PHASE_0_DOCUMENTATION_EVIDENCE.md`.

## Post-closure remediation R4 completion record - 2026-07-12

The separate remediation plan `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_ACTION_PLAN.md` now records R4 complete. R4 corrected the Phase 6 hook/deep-link lifecycle, Phase 7 tablet split and aggregate unread presentation, and Phase 8 transcript-only rendering when legacy client state is absent. The implementation evidence is `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R4_EVIDENCE.md`; R5 remains the next authorized remediation unit.
## Post-closure remediation R5 completion record - 2026-07-13

The separate remediation plan now records R5 complete for application-level test and scale evidence. The R5 harness covers full app regression, bounded 10k conversation/detail behavior, SQL contract markers, lifecycle/export leak guards, full replay, and accessibility projects. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R5_EVIDENCE.md`; RLS/EXPLAIN and independent release verification remain open for R6.

## Post-closure remediation R6 verification record - 2026-07-13

The separate remediation plan records the historical R6 environment block and its actual re-closure through RLS 35/35 plus executed SQL buffer evidence. R7 is complete; evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`. Stage 4B-3 was next at that checkpoint and later closed.

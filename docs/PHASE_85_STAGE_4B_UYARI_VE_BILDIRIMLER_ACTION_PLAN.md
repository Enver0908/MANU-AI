# Phase 85 Stage 4B - Uyari ve Bildirimler Eylem Plani

Date: 2026-07-11
Status: implementation complete; post-closure remediation verified (2026-07-12); current RLS re-run blocked by unavailable Docker
Canonical baseline: commit `5048e22` (`Align Stage 4A with P85-IF contracts`)
Required branch: `codex/phase-85-interstage-clinical-memory`

## 1. Purpose

This document records every product, architecture, lifecycle, access, UX, persistence, and verification decision approved for Phase 85 Stage 4B. It is the decision-complete implementation contract for the next code change. An implementer must not invent an alternative alert source, notification lifecycle, navigation model, role scope, or red-risk closure path.

Stage 4B adds two separate full dashboard views:

- **Uyarilar:** active client-origin yellow and red clinical-operational states.
- **Bildirimler:** system-origin operational events with structured kind, priority, personal read state, acknowledgement, and domain-specific resolution.

Stage 4B does not implement the future WhatsApp-like messaging inbox. That work is inserted as mandatory **Stage 4B-2** between Stage 4B and Stage 4C.

## 2. Locked Stage Order

The canonical sequence is:

1. Stage 4A - completed.
2. P85-IF-A through P85-IF-I - completed.
3. P85-IF remediation R1-R6 and post-closure audit - completed.
4. Stage 4A post-P85-IF compatibility remediation - completed at `5048e22`.
5. Stage 4B - Uyari ve Bildirimler - **implementation complete; conditional local closure** (2026-07-12). Evidence: `docs/PHASE_85_STAGE_4B_UYARI_VE_BILDIRIMLER_EVIDENCE.md` and `docs/PHASE_85_STAGE_4B_POST_CLOSURE_REMEDIATION_EVIDENCE.md`.
6. Stage 4B-2 - Mesajlasma - **next**; mandatory after Stage 4B; owns conversation list/detail, unread message state, WhatsApp-like detail, yellow draft workflow, red manual reply, and in-detail AI control.
7. Stage 4C - blocked until Stage 4B-2 is complete.
8. Stage 4D, Stage 5, Stage 6, and Stage 7 follow in their existing order.

No new major-phase name may be introduced for this work; all naming remains under Phase 85.

## 3. Non-Negotiable Boundaries

- Stage 4B is one official stage. Its internal phases are implementation checkpoints, not separate Phase 85 tracks.
- Stage 4B closes with one evidence pack, one commit, and a clean worktree.
- No `alerts` table is created. Alerts are projections of authoritative client risk state.
- Clinical alerts are not stored or rendered as system notifications.
- The existing Handoff/Devirler dashboard view is replaced by Uyarilar. Handoff domain records and APIs remain because orchestration still uses them.
- The existing single-client Gorusme view remains available during Stage 4B as the alert/notification destination.
- Stage 4B-2 removes the permanent standalone Gorusme navigation entry and replaces it with Mesajlasma: conversation list first, conversation detail second.
- Stage 4B-2 conversation list uses thin rows, newest conversation first, client full name, last-message preview/time, and a small unread indicator.
- Stage 4B-2 conversation detail reuses/refactors the current ConversationPanel into a WhatsApp-like full transcript. It owns yellow draft review/edit/approval, red-risk manual reply, and convenient AI active/passive control in the conversation detail.
- No overview cards or overview alert/notification bands are added.
- No browser tab is opened. All destinations are in-app dashboard sections in the same browser tab.
- No real WhatsApp, Telegram, Gemini/provider, live billing, monitoring, backup, secret manager, or real health-data path is enabled.
- Production pilot remains `NO-GO`; R-405 remains open.
- The Phase 84 hosted-sandbox document is not changed unless a deployment occurs.

## 4. Locked Product Decisions

### 4.1 Uyarilar

- Yellow source: `client.yellowRiskHold.status === "active"`.
- Red source: `client.redRiskLock.status === "locked"`.
- A red lock suppresses a simultaneous yellow row for the same client.
- A yellow hold with multiple `messageIds` is one grouped alert.
- Closed/reactivated states do not appear.
- Red rows sort before yellow rows; each severity sorts newest first.
- A row contains client full name, severity, human-readable alert type, one safe sentence explaining the cause, time/SLA evidence, and a navigation arrow.
- Raw message text, health details, prompts, provider output, raw handoff text, and internal reason codes are prohibited in the list DTO and UI.
- Clicking an alert does not read, acknowledge, hide, dismiss, or resolve it. It opens the linked client conversation.
- Active alerts cannot be deleted or hidden.
- Alert filters are `Tumu`, `Kirmizi`, `Sari`, with active counts and client-name search.
- The screen contains active alerts only. Historical closure remains in domain/audit evidence.

### 4.2 Red closure

- A red event passivates AI and remains active until an authorized dietitian directly activates AI.
- Direct AI activation is sufficient proof that the dietitian handled the condition.
- No extra handoff tab, side panel, resolution modal, free-text reason, or second confirmation step is added.
- Activation must use `POST /api/clients/[id]/activate-ai` with expected conversation and client-context revisions.
- The existing fallback domain function and `p85_if_r3_activate_client_ai` RPC must atomically activate AI, mark the red lock reactivated, resolve the linked handoff, close the human-control session, invalidate stale unsafe work, and record `direct_dietitian_reactivation_v1`.
- Manual reply alone does not close a red alert.
- A `409`, authorization failure, or integrity failure leaves AI passive and the alert visible.
- `ai-assistant-control-panel.tsx` must split activation disablement from configuration disablement. A red lock disables mode/persona/schedule configuration but must not disable the activation control.
- Human-control UI must offer the same atomic activation path instead of requiring separate handoff resolution.

### 4.3 Yellow closure and Stage 4B-2 boundary

- Stage 4B displays and routes yellow alerts but does not implement the future messaging inbox or redesign draft approval.
- The authoritative alert disappears only when `yellowRiskHold` is resolved by an existing valid domain transition, including controlled direct activation or a safely revalidated client-sendable response.
- The current prohibition on sending non-green AI drafts to a client remains intact.
- Stage 4B must not weaken `non_green_ai_draft_client_send_blocked` to make yellow rows disappear.
- Stage 4B-2 must separately specify the safe dietitian-authored edit/approve/send workflow for yellow drafts.

### 4.4 Bildirimler

System notification kinds are:

- `structured_record_update_required`
- `competing_authoritative_instructions`
- `unsupported_media_review`
- `safe_reply_unavailable`
- `delivery_failed`
- `communication_permission_closed`
- `ai_window_expired`
- `ai_paused_by_verified_human`
- `draft_invalidated`
- `human_control_integrity`
- compatibility-only `legacy_system` and `legacy_handoff`

`ai_window_expired` and `ai_paused_by_verified_human` are separate kinds so priority is deterministic from kind and never parsed from title/body.

Priority mapping:

- `intervention_required`: competing instructions, safe reply unavailable, delivery failed, human-control integrity.
- `review_required`: structured update, unsupported media, communication permission closed, verified-human AI pause, draft invalidated.
- `info`: expected AI window expiration.

Category mapping:

- `records`: structured update, competing instructions.
- `conversation_review`: unsupported media, safe reply unavailable, draft invalidated.
- `channel_delivery`: delivery failure, communication permission closed.
- `ai_control`: AI window expiration, verified-human pause, integrity.

Normal green replies, successful deliveries, ordinary draft approvals, duplicate events, and ordinary client messages do not create system notifications. Unread client-message state belongs to Stage 4B-2. Quarantine, trust-binding, account-attribution, and cross-tenant operational details remain owner/admin-only under P85-IF-R5.

### 4.5 Notification lifecycle

- `read`: the current actor opened/viewed the notification.
- `acknowledged`: the current actor explicitly accepted ownership; this does not resolve the event.
- `resolved`: the linked domain condition was corrected or the kind-specific review process completed.
- `info` notifications move to personal history when read; they do not require acknowledgement.
- Resolved events remain in history and are not deleted.
- `Tumunu okundu isaretle` is allowed.
- Bulk acknowledge and bulk resolve are prohibited.
- No generic `resolve notification` action is added.

Structured target mapping:

- Structured record update -> linked client target panel.
- Competing authoritative instructions -> conversation and source messages.
- Unsupported media -> conversation and source message.
- Safe reply unavailable -> conversation and linked open system-block/handoff context.
- Delivery failed -> conversation and outbound message.
- Communication permission closed -> client channel/permission area.
- AI window expiration or verified-human pause -> AI Asistan Kontrolu.
- Draft invalidated -> conversation and linked draft/source.
- Human-control integrity -> AI Asistan Kontrolu and session evidence.

Targets are built from kind and linked entity fields, never from raw persisted URLs or title/body text. An inaccessible target produces a safe fail-closed error.

Resolution rules:

- Structured update: existing baseline/revision-controlled endpoint.
- Competing instructions: newer authenticated context/structured revision beyond the stored baseline.
- Unsupported media: kind-specific review completion after read and acknowledge, with audit evidence.
- Safe reply unavailable: a later verified manual reply or controlled activation in the same conversation.
- Delivery failed: the same delivery later reaches sent/delivered/read.
- Permission closed: permission returns to `ready`.
- AI window expired: personal read moves it to history.
- Verified-human AI pause: controlled activation.
- Draft invalidated: replacement draft or later verified/manual outbound work.
- Human-control integrity: lock/session/AI state becomes consistent.

Reconciliation runs in the relevant mutation path. GET requests remain read-only.

## 5. Locked Role Matrix

| Role | Alerts/notifications visibility | Receipt mutation | Domain actions |
| --- | --- | --- | --- |
| owner | tenant-wide | own read/ack | existing capabilities |
| admin | tenant-wide | own read/ack | existing capabilities |
| dietitian | primary plus directly/assigned visible clients | own read/ack | existing capabilities |
| assistant | assigned clients only, read-only | prohibited | prohibited unless already granted elsewhere; Stage 4B adds none |
| auditor | no client-linked alert or notification visibility | prohibited | prohibited |

Every endpoint must validate linked client/entity visibility, not tenant membership alone. Inaccessible and cross-tenant IDs return a non-enumerating `404` or an empty scoped list as defined by the endpoint.

## 6. Locked Navigation and Responsive Contract

Canonical URLs:

- `/dashboard?section=alerts`
- `/dashboard?section=notifications`
- `/dashboard?section=messages&clientId=...&conversationId=...&source=alert&sourceId=...&messageId=...`

Rules:

- `messages` is the stable internal section identifier in Stage 4B and Stage 4B-2.
- Query parameters are allowlisted and server-side entity access is revalidated.
- Browser back/forward must restore section and filters.
- Alert filters use `alertSeverity` and `alertQuery`.
- Notification filters use `notificationStatus`, `notificationPriority`, `notificationCategory`, and `notificationQuery`.
- Devirler becomes Uyarilar.
- Bildirimler is an independent navigation item.
- The header bell opens the full Bildirimler page; the existing dropdown is removed.
- Alert nav badge is active red+yellow count. Notification nav/bell badge is current actor unread count. Counts cap at `99+`.
- Mobile bottom navigation places Uyarilar beside the current Gorusme entry.
- Bildirimler remains reachable through the persistent mobile header bell, not an extra bottom-nav item.
- Filters are sticky, touch targets are at least 44px, and no horizontal overflow is permitted.
- Comprehensive mobile shell redesign remains Stage 5.

## 7. Locked Clinical Reason and SLA Contract

Safe reason categories are:

- emergency symptom
- serious allergic reaction
- glucose/medication safety
- crisis/self-harm
- pregnancy/lactation
- symptom/medical condition
- medication/supplement
- lab result
- nutrition plan change
- minor/body-image
- allergy/restriction/product content
- context ambiguity
- security review
- generic clinical review fallback

Mapping uses server-side reason codes only. UI text analysis is prohibited. Multiple reasons use the highest-priority category plus `+N`; raw codes remain audit-only. Unknown codes use the generic fallback. All supported UI languages receive i18n keys.

SLA source:

- Red uses `red_response_sla` from the current dietitian form response.
- Yellow uses `yellow_review_sla`.
- Red values: `15dk=15`, `30dk=30`, `1s=60` minutes.
- Yellow values: `1s=60`, `2s=120`, `4s=240` minutes.
- `Ayni gun` means end of the same calendar day in the dietitian profile timezone.
- Missing or invalid values show elapsed time only; no default is invented.
- Red clock starts at `lockedAt`/handoff creation; yellow clock starts at `startedAt`.
- Resolution stops the clock.
- No external escalation, push, email, monitoring, or hard system-notification SLA is introduced.

## 8. Public Types and API Contracts

New domain types:

- `ClinicalAlertSeverity = "red" | "yellow"`
- `ClinicalAlertKind`
- `NotificationKind`
- `NotificationPriority`
- `NotificationCategory`
- `NotificationReceiptRecord`
- `Stage4BNavigationTarget`
- `ClinicalAlertListItem`
- `SystemNotificationListItem`

`ClinicalAlertListItem` allowlist:

- ids required for safe routing: alert, client, conversation, source message, active draft, handoff.
- client full name.
- severity and mapped kind.
- i18n reason key and additional-reason count.
- started time, elapsed time, computed deadline/state.
- structured target.

`SystemNotificationListItem` allowlist:

- event and linked entity IDs required for access-checked routing.
- kind, priority, category.
- safe i18n title/summary keys.
- client full name when visible.
- occurrence count and event timestamps.
- current actor read/ack state and global resolved state.
- structured target.

The list DTOs must not contain persisted raw notification `body`, raw message body, provider payload, clinical free text, prompt context, raw reason array, or trust/quarantine evidence.

Endpoints:

- `GET /api/alerts?severity=all|red|yellow&query=&cursor=&limit=`
- `GET /api/notifications?status=active|unread|history&priority=&category=&query=&cursor=&limit=`
- `POST /api/notifications/[id]/read`
- `POST /api/notifications/[id]/acknowledge`
- `POST /api/notifications/read-all`
- `POST /api/notifications/[id]/complete-review` only for unsupported-media review
- existing `POST /api/notifications/[id]/resolve-structured-update`
- existing `POST /api/clients/[id]/activate-ai`

Default page size is 30, maximum is 100, and search is capped at 80 characters. Cursors are versioned opaque base64url payloads. Alerts keyset-sort by severity rank, start time, and ID. Active/unread notifications sort by priority rank, last occurrence, and ID. History sorts by resolution/read history timestamp and ID.

## 9. Persistence Contract

An append-only Stage 4B migration will extend `notifications` with:

- `kind`
- `priority`
- `client_id`
- `conversation_id`
- `message_id`
- `handoff_id`
- `occurrence_count default 1`
- `last_occurred_at`

Legacy `type`, `read`, `acknowledged_at`, `title`, and `body` remain for compatibility. New UI and APIs ignore global read/ack columns.

`notification_receipts` uses primary key `(tenant_id, notification_id, dietitian_id)` and contains `read_at`, `acknowledged_at`, `created_at`, and `updated_at`. Absence of a receipt means unread for an actor allowed to own receipts.

Physical open-event dedupe is `tenant + kind + entity/source`; recipient-specific state is represented by receipt uniqueness. Repeated open events increment `occurrence_count` and update `last_occurred_at`. A recurrence after resolution creates a new lifecycle row.

Authenticated direct notification writes are removed/restricted; system producers use the existing service persistence boundary. RLS must enforce the role matrix and tenant-composite entity links. Supabase and fallback implementations must share behavior.

## 10. Implementation Phases

### Phase 0 - Contract and documentation baseline

**Purpose:** persist this decision record and align continuity documents before runtime work.
**Scope:** stage order, boundaries, Stage 4B-2 insertion, pilot/risk posture.
**Prerequisites:** branch and clean baseline verified.
**Affected files:** this plan plus README, PLAN, PROJECT_PLAN, HANDOFF, app README, frontend/P85-IF/next/direct/pilot/gate/risk documents.
**Architecture:** this document is canonical; no code or migration in this phase.
**Steps:** add this plan; add concise planning-lock sections to all continuity documents; scan for contradictory next-stage wording.
**Data flow:** none.
**Dependencies:** P85-IF post-closure and Stage 4A compatibility evidence.
**Errors/edges:** do not mark Stage 4B implemented; do not change hosted-sandbox claims.
**Tests:** diff check, naming scan, link/path check, status check.
**Validation:** all canonical docs point to this plan and preserve NO-GO/R-405.
**Completion:** documentation-only commit and clean worktree.

### Phase 1 - Alert projection, taxonomy, and SLA

**Purpose:** derive safe active alerts from authoritative domain state.
**Scope:** types, projection, reason mapping, SLA, sorting, filtering, safe DTO.
**Prerequisites:** existing yellow/red records and form responses.
**Affected files:** `types.ts`, new Stage 4B contracts/alerts modules, `simulator.ts`, `supabase-store.ts`, `i18n.ts`.
**Architecture:** red precedence, no alerts table, no raw content, fallback/Supabase parity.
**Steps:** implement projection; validate joins; map reason codes; compute SLA; expose stable IDs/targets.
**Technical method:** pure projection helpers plus bounded SQL projection; deterministic tie-break ordering.
**Data flow:** risk state -> visibility -> joins -> reason/SLA -> safe DTO.
**Dependencies:** core reason codes, dietitian form registry, visible-client scope.
**Errors/edges:** unknown reason, missing link, removed client, simultaneous red/yellow, invalid SLA.
**Tests:** precedence, grouping, taxonomy, no-leak, SLA, ordering, 5,000-client fixture.
**Validation:** identical safe output on fallback and Supabase.
**Completion:** projection tests pass with no persistence/UI changes required to interpret alerts.

### Phase 2 - Persistence, receipts, and RLS

**Purpose:** normalize system events and personal read/ack state.
**Scope:** append-only notification columns, receipt table, backfill, FK/index/RLS/RPC.
**Prerequisites:** locked types and role matrix.
**Affected files:** new migration, `types.ts`, stores, governance, seeds, RLS tests.
**Architecture:** event fact plus per-actor receipt; no per-recipient duplicated event facts.
**Steps:** add nullable columns; deterministic backfill; enforce constraints; add receipt RLS; add bounded list/mutation RPCs; update mappers.
**Technical method:** tenant-composite FKs, partial open-dedupe index, service-only event mutation, actor-own receipt policy.
**Data flow:** event -> notification fact -> actor receipt projection.
**Dependencies:** memberships, dietitians, assignments, current RLS helpers.
**Errors/edges:** legacy unknown records, cross-tenant links, assistant/auditor mutation, missing receipt.
**Tests:** local reset, backfill, two-tenant role matrix, composite FK, receipt isolation, baseline RLS.
**Validation:** existing 30/30 baseline does not regress and new cases pass.
**Completion:** clean reset and all RLS tests green.

### Phase 3 - Notification producers and lifecycle

**Purpose:** emit every approved system notification at its real domain event.
**Scope:** classification, priority/category, dedupe, occurrence, reconciliation.
**Prerequisites:** persistence contract complete.
**Affected files:** Stage 4B notification module, historical retrieval, transcript/human control, simulator, adapters, delivery ledger, stores.
**Architecture:** no title/body parsing; clinical events excluded from system surface; GET is read-only.
**Steps:** centralize upsert; update existing producers; add missing delivery/permission/pause/draft/integrity producers; wire type-specific resolution triggers.
**Technical method:** deterministic key, partial unique open lifecycle, mutation-time reconciliation.
**Data flow:** domain event -> kind/priority -> safe linkage -> upsert -> domain correction -> resolve.
**Dependencies:** core blocked reasons, channel ledger, context revisions, activation lifecycle.
**Errors/edges:** duplicates, recurrence, producer transaction failure, clinical/nonclinical handoff split.
**Tests:** every kind, non-event controls, dedupe increment, recurrence, resolution policies.
**Validation:** same event never appears on both alert and notification surfaces.
**Completion:** producer matrix fully covered.

### Phase 4 - Bounded APIs and targets

**Purpose:** provide tenant-safe cursor APIs without full-state browser filtering.
**Scope:** list endpoints, receipt mutations, read-all, type-specific review, target mapping.
**Prerequisites:** phases 1-3.
**Affected files:** new alert/notification routes, existing notification routes, auth/store helpers.
**Architecture:** server-side visibility; opaque keyset cursor; allowlisted targets.
**Steps:** validate query; resolve actor; apply role/client scope; call bounded store; produce safe DTO; mutate actor receipt/domain only.
**Technical method:** max 100 rows, 80-char search, non-enumerating errors, structured target builders.
**Data flow:** request -> auth/scope -> bounded query -> safe DTO; mutation -> receipt/domain -> audit.
**Dependencies:** auth context, RLS RPCs, contracts.
**Errors/edges:** malformed cursor, stale target, cross-tenant ID, 409 conflict, persistence unavailable.
**Tests:** auth, role matrix, filters, cursor, safe DTO, fail-closed targets.
**Validation:** no full app-state fetch and no linked-entity visibility bypass.
**Completion:** API suite green.

### Phase 5 - Atomic red activation UX

**Purpose:** make direct AI activation the complete red-alert resolution action.
**Scope:** Stage 4A control, conversation control, activation endpoint integration, refresh.
**Prerequisites:** P85-IF-R3/F activation contracts.
**Affected files:** AI control panel, ConversationPanel, human-control banner, activation route, state hook.
**Architecture:** activation enabled under red lock; configuration remains disabled; no generic handoff resolution UX.
**Steps:** split disable flags; add clear CTA; pass expected revisions; refresh state and Stage 4B resources after success; preserve state on failure.
**Technical method:** existing atomic fallback/RPC path only; no optimistic activation.
**Data flow:** red row -> conversation -> activate -> atomic closure -> alert refresh.
**Dependencies:** phase 4 target routing and existing activation RPC.
**Errors/edges:** stale revision, concurrent activation, removed client, lock/session mismatch.
**Tests:** successful atomic closure, 409 no-op, manual reply does not close, direct PATCH remains blocked.
**Validation:** one successful activation removes the red row.
**Completion:** both control surfaces share the same behavior.

### Phase 6 - URL shell, badges, and refresh

**Purpose:** make views deep-linkable, history-safe, and current without realtime provider work.
**Scope:** URL section state, nav, bell, badges, polling, mobile placement.
**Prerequisites:** phase 4 APIs.
**Affected files:** `dashboard-app.tsx`, new Stage 4B resource hook, shell/nav styles/tests.
**Architecture:** URL is navigation state; Stage 4B resources are separate from full Manu state.
**Steps:** parse allowlisted query; replace local view state; wire nav/bell; add badges; add initial/focus/30s polling and manual refresh.
**Technical method:** visibility pause, in-flight dedupe, 60/120s capped backoff, AbortController.
**Data flow:** URL -> hook -> panels/badges -> push/history.
**Dependencies:** Next router and list APIs.
**Errors/edges:** unknown section, background tab, failed refresh, stale target, long filters.
**Tests:** parse/serialize, back/forward, filter preservation, polling, badge cap.
**Validation:** no browser tab, no dropdown, no full-state polling.
**Completion:** shell behavior green on desktop/mobile.

### Phase 7 - Uyarilar view

**Purpose:** deliver the approved dense clinical alert list.
**Scope:** search, segments, rows, target routing, responsive/accessible states.
**Prerequisites:** phases 1, 4, and 6.
**Affected files:** new alerts panel and shared row, dashboard shell, styles, i18n, visual tests.
**Architecture:** one flat list; no cards, history, delete, dismiss, or raw content.
**Steps:** build sticky controls; render safe row; route click; add load-more, skeleton, empty/error/manual refresh.
**Technical method:** stable dimensions, 44px targets, wrapping/truncation, Lucide arrow/icon controls.
**Data flow:** safe DTO -> filters -> row -> messages target.
**Dependencies:** shared design tokens and router.
**Errors/edges:** long name, no SLA, missing conversation, row closes during polling.
**Tests:** red ordering, filters, click, no close-on-click, responsive/accessibility.
**Validation:** no overlap or horizontal overflow at all four Playwright viewports.
**Completion:** alert workflow usable end to end.

### Phase 8 - Bildirimler view

**Purpose:** deliver structured system event work management.
**Scope:** active/unread/history, priority/category/search, read/ack/read-all, targets.
**Prerequisites:** phases 2-4 and 6.
**Affected files:** new notifications panel/shared row, shell/bell, styles, i18n, visual tests.
**Architecture:** neutral operational styling; actor receipts; no generic resolve.
**Steps:** build filters; render safe titles/summaries; wire read/ack/read-all; expose unsupported-media review completion; route all other actions to domain targets.
**Technical method:** mutation without optimistic false success; refresh counts/list after success.
**Data flow:** event+receipt -> row -> receipt mutation -> target/domain action -> history.
**Dependencies:** receipt APIs and target matrix.
**Errors/edges:** read succeeds but target is stale, concurrent ack, assistant read-only, legacy record.
**Tests:** lifecycle, receipt isolation, filters, targets, safe rendering, responsive/accessibility.
**Validation:** clinical colors/content are not reused as system severity.
**Completion:** notification workflow usable end to end.

### Phase 9 - Verification and closure

**Purpose:** prove Stage 4B without weakening P85-IF, Stage 4A, RLS, channel, scale, or governance.
**Scope:** targeted/full tests, RLS, replay, scale, visual, leak scans, docs, evidence, commit.
**Prerequisites:** phases 1-8 complete.
**Affected files:** tests, visual fixtures, scale/replay evidence, new Stage 4B evidence document, all continuity documents.
**Architecture:** real providers remain disconnected; evidence records actual command outcomes only.
**Steps:** run targeted tests; local reset/RLS; role matrix; channel replay; production-scale; core/app suites; lint/build; visual; leak/secret/naming/diff scans; update docs; commit once.
**Technical method:** fixed clocks for visual/SLA tests, synthetic 100x50 data, allowlist leak assertions.
**Data flow:** fixtures through fallback/Supabase/API/UI and evidence aggregation.
**Dependencies:** local Supabase, Vitest, Playwright, existing rehearsal scripts.
**Errors/edges:** unavailable RLS is a blocker, not a pass; generated artifacts remain untracked/ignored.
**Tests:** all commands in Section 11.
**Validation:** no regression, no secret, no forbidden naming, clean status.
**Completion:** one Stage 4B commit; Stage 4B-2 becomes next; Stage 4C remains blocked.

## 11. Required Verification

Run and record:

1. Targeted Stage 4B Vitest for projection, taxonomy, SLA, priority, dedupe, receipts, API, target mapping, and activation.
2. `cd dietitian-ai-assistant && npm test`.
3. `cd app && npm test`.
4. Local Supabase reset followed by `npm run test:rls`.
5. `npm run rehearse:channel:replay`.
6. `npm run rehearse:production-scale:79g`, extended to cover Stage 4B bounded reads.
7. `npm run lint`.
8. `npm run build`.
9. `npm run test:visual` for 1440x900, 768x1024, Android 390x844, and iOS 390x844.
10. Sensitive-data DTO/export/redaction tests.
11. `npm run release:verify`.
12. `git diff --check`.
13. Secret/token scan with dummy-test-value review.
14. Forbidden future-major-phase naming scan.
15. `git status --short` before and after the single commit.

## 12. Required Documentation at Stage Closure

Update:

- `README.md`
- `PLAN.md`
- `PROJECT_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `app/README.md`
- `docs/PHASE_85_FRONTEND_REDESIGN_AND_DESIGN_SYSTEM_SPEC.md`
- `docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_PLAN.md`
- `docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_SPEC.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`
- `docs/PILOT_READINESS_EVIDENCE_PACK.md`
- `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`
- `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`
- `docs/RISK_REGISTER.md`
- Stage 4B spec/evidence documents.

## 13. Acceptance Criteria

Stage 4B is complete only when all of the following are true:

- Uyarilar and Bildirimler are separate full dashboard views.
- Alerts derive only from active authoritative yellow/red state.
- Red suppresses yellow for the same client.
- Alert DTOs contain no raw clinical/message content.
- Alert click opens the existing conversation and does not close the alert.
- Successful atomic AI activation is the complete red-alert closure action.
- System notifications use structured kinds, deterministic priority, event dedupe, and actor receipts.
- Read, acknowledge, and resolution are separate.
- The role matrix is enforced in API and RLS.
- APIs are bounded, cursor-based, and fail closed.
- Header bell opens the full notification view.
- Mobile Uyarilar is beside Gorusme; no overlap/overflow exists.
- Stage 4B-2 implementation has not leaked into Stage 4B.
- Full verification and evidence pass.
- Production remains `NO-GO`, R-405 remains open, real integration paths remain disabled, and the worktree is clean.

## Phase 0 Execution Record - 2026-07-11

Status: complete.
Evidence: `docs/PHASE_85_STAGE_4B_PHASE_0_DOCUMENTATION_EVIDENCE.md`.

Phase 0 locked the stage order, Stage 4B/4B-2/4C boundaries, alert-versus-notification ownership, atomic red activation rule, role/access posture, pilot/R-405 posture, real-integration boundaries, required documentation set, and implementation-ready Phase 1-9 sequence. No runtime code, SQL migration, provider, channel, billing, monitoring, backup, secret-manager, or health-data path was changed by Phase 0.

Phase 1 completed on 2026-07-12: clinical alert projection, reason taxonomy, SLA calculation, sorting/filtering helpers, safe DTO contracts, i18n reason labels, and fallback/Supabase projection parity. Evidence: `docs/PHASE_85_STAGE_4B_PHASE_1_ALERT_PROJECTION_EVIDENCE.md`. Targeted tests 11/11; lint and production build passed.

## Stage 4B-2 Phase 1 Handoff - 2026-07-12

Stage 4B-2 Phase 1 has now completed its pure domain/DTO/authorization projection foundation. The implementation evidence is `docs/PHASE_85_STAGE_4B_2_PHASE_1_DOMAIN_DTO_AUTHORIZATION_EVIDENCE.md`; receipt persistence, RLS, routes, UI, and mutations remain Stage 4B-2 work and do not reopen this Stage 4B plan. Stage 4C remains blocked.

## Stage 4B Post-Closure Remediation Execution Record - 2026-07-12

The original local closure evidence was re-audited before handoff. The remediation added bounded actor-aware Supabase v2 RPCs, persistent dietitian-form SLA inputs, fail-closed target linkage, client-specific draft lifecycle producers, atomic unsupported-media receipt gating, assistant/auditor UI restrictions, route error-boundary hardening, and screenshot/keyboard/accessibility assertions. Full core/app, scale, replay, release, build, lint, and visual verification passed. The current RLS suite has 33 skipped tests because Docker Desktop is unavailable; those tests are explicitly not counted as pass. Detailed evidence: `docs/PHASE_85_STAGE_4B_POST_CLOSURE_REMEDIATION_EVIDENCE.md` and runtime contract: `docs/PHASE_85_STAGE_4B_UYARI_VE_BILDIRIMLER_SPEC.md`.

The next implementation track remains Stage 4B-2 Mesajlasma. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real provider/channel/health-data paths remain disabled.

## Stage 4B-2 Consumer Documentation Lock - 2026-07-12

The complete Stage 4B-2 action plan is now `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_ACTION_PLAN.md`; Phase 0 evidence is `docs/PHASE_85_STAGE_4B_2_PHASE_0_DOCUMENTATION_EVIDENCE.md`.

Stage 4B-2 consumes Stage 4B alert/notification targets but owns the conversation list, unread message receipts, bounded transcript detail, yellow reviewed-manual workflow, red manual reply workflow, and in-detail AI control. Assistant access is explicitly assigned-conversation read-only with own message receipt mutation; viewer assignment is read-only; auditor has no conversation visibility. This consumer lock adds no Stage 4B runtime work and does not change the Stage 4B no-alert-table, red-precedence, safe-list-DTO, notification-lifecycle, or production `NO-GO` decisions.

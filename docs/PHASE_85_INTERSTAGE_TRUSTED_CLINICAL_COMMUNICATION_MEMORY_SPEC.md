# Phase 85 Interstage Foundation - Trusted Clinical Communication And Memory Spec

Date: 2026-07-10
Canonical code: `P85-IF`
Track: `P85-IF-A`, `P85-IF-B`, and `P85-IF-C`
Status: P85-IF-A complete; P85-IF-B trust-root/provenance data model complete; P85-IF-C secure ingress/ledger/routing/quarantine complete; P85-IF-D complete transcript and human control complete; P85-IF-E full-history retrieval and prompt authority V2 complete; P85-IF-F risk resolution, AI reactivation, and concurrency complete with R3 remediation; P85-IF-G controlled off-channel AI chat intake complete with R4 remediation; P85-IF-H minimal operational visibility complete with R5 owner/admin operational access remediation; P85-IF-I lifecycle/RLS/closure complete. P85-IF is closed; Stage 4B is next after the approved remediation sequence.
Placement: Phase 85 Stage 4A complete -> P85-IF -> Phase 85 Stage 4B.
Production pilot: `NO-GO`.
Deployment: none.

## 1. Purpose

This document is the canonical implementation contract for Phase 85 Interstage Foundation (`P85-IF`). It is created by P85-IF-A and governs P85-IF-B through P85-IF-I.

P85-IF exists because Stage 4B Uyari ve Bildirimler cannot safely build alert and notification experiences until channel actor provenance, complete transcript semantics, historical retrieval, human/AI coordination, risk resolution, and off-channel context intake are explicit and testable.

P85-IF-A is documentation-only. P85-IF-B adds schema/model foundation only. Neither track enables real provider, real channel, monitoring, backup, secret-manager, live billing, or real health-data behavior.

## 2. Locked Boundaries

The following boundaries are fixed for all P85-IF tracks:

- The five canonical message origins remain `client_inbound`, `ai_generated`, `dietitian_manual`, `system_event`, and `imported_unknown`.
- `smb_message_echoes` represents a WhatsApp Business App or linked-device human message. It is not an AI echo.
- A Business App echo proves an authorized business-side human only. It does not prove a specific dietitian unless an exclusive verified actor policy or authenticated MANU action proves that dietitian.
- `authorDietitianId` can be written only for authenticated MANU actions or exclusive verified account policies.
- A verified external human message is stored as `dietitian_manual`, never passed through the client inbound AI/risk pipeline, and never triggers an AI reply loop.
- Notification read or acknowledge never resolves yellow/red clinical risk.
- Yellow/red risk resolution requires an authenticated dietitian AI activation action.
- Full transcript persistence does not mean raw full-transcript prompt injection.
- Historical retrieval must be tenant/client/conversation scoped and provenance preserving.
- A relevant newer WhatsApp dietitian instruction temporarily outranks older structured records, but it must create a structured-record update notification.
- P85-IF owns data/API semantics and minimal evidence visibility. Stage 4B owns the full alert/notification product experience.
- Real WhatsApp, Telegram, Gemini/provider, live billing, monitoring, backup, secret manager, and real health-data paths remain disconnected.
- Production pilot remains `NO-GO`.
- R-405 remains open unless independently remediated or externally accepted through the existing R-405 procedure.
- R-406 current local Supabase/RLS evidence was refreshed for R5 on 2026-07-10 with local `npm run test:rls` passing 26/26; production pilot remains blocked by other open gates.

R5 operational access remediation: trust-binding, actor-binding, channel-event, event-only revision, and inbound-quarantine inspection details must not travel through common app-state. Owner/admin inspection is served only by `GET /api/operational-foundation` behind `read_operational_foundation`, and select RLS for operational trust/quarantine tables is owner/admin only. Dietitians retain message provenance, human-control, risk activity, and context-intake workflow visibility without direct operational payload-digest/trust-root inspection.

## 3. Current Runtime Baseline

The existing runtime already has useful foundations:

- Canonical message origins and basic provenance fields exist in `MessageRecord`.
- App/manual dietitian replies are persisted as `dietitian_manual` with `authorDietitianId`.
- Client inbound simulation, preflight, yellow hold, red lock, handoff, notification, audit, and draft invalidation paths exist.
- Mock WhatsApp normalization supports one text inbound message.
- `processed_inbound_events` provides tenant-scoped inbound idempotency.
- `channel_deliveries` records mock outbound delivery status.
- PromptContext uses bounded recent-message context plus rolling summary.
- Answerability can use structured records, context updates, and dietitian manual messages.
- Client context updates and chat update proposals exist, but they are not the P85-IF-G context-intake workflow.

The current runtime does not yet have:

- provider-account trust roots;
- WABA/business-phone first tenant resolution;
- exact provider event kind matrix;
- `smb_message_echoes` ingestion;
- business-human actor proof;
- event ledger separate from message ledger;
- canonical provider account/message IDs on messages;
- edit/revoke/media/history lifecycle;
- recoverable event quarantine;
- complete transcript retrieval beyond the recent window;
- retrieval-evidenced dietitian manual answerability;
- human-control sessions;
- direct AI activation semantics for manual/yellow/red sessions;
- off-channel context-intake proposal state machine.

## 4. Provider Event Matrix

Each normalized provider payload must produce zero or more `NormalizedChannelEvent` records. Batch payloads are decomposed so each entry/change/message/status/history item is processed independently.

| Provider field or condition | Canonical event kind | Expected origin | AI/risk pipeline | Persistence target | Required outcome |
| --- | --- | --- | --- | --- | --- |
| `messages` text from client counterparty | `client_message_text` | `client_inbound` | Yes, after full routing succeeds | transcript, channel event ledger | Store inbound; run existing risk/preflight/AI path. |
| `messages` supported non-text client content | `client_message_media_unsupported` | `client_inbound` with unavailable content or quarantine | No client-facing AI output | channel event ledger, review requirement | Fail closed, pause affected client where required, create review notification. |
| `smb_message_echoes` text | `business_human_echo_text` | `dietitian_manual` | Never | transcript, human-control session, channel event ledger | Store as verified business human; auto-pause AI if active; invalidate stale work. |
| `smb_message_echoes` unsupported media | `business_human_echo_media_unsupported` | `dietitian_manual` with unavailable content or review event | Never | channel event ledger, review requirement | Store minimized evidence or quarantine; do not make it promptable. |
| `statuses` for API outbound | `outbound_status` | none | Never | delivery/status ledger | Correlate to existing outbound delivery; do not create a transcript message. |
| `history` client message | `history_client_message` | `client_inbound` or `imported_unknown` until routed | Never for historical import | transcript or quarantine | Reconcile by provider message ID; use provider time; no AI trigger. |
| `history` business human message | `history_business_human_message` | `dietitian_manual` or `imported_unknown` until actor proof | Never | transcript or quarantine | Reconcile by provider message ID; no AI trigger. |
| edit event for known message | `message_edit` | unchanged | Never directly | revision ledger | Add immutable revision; invalidate prompt/outbound evidence that used prior body. |
| revoke/delete event for known message | `message_revoke` | unchanged | Never | revision ledger, message content status | Mark non-promptable/non-answerable; retain minimized audit evidence. |
| edit/revoke for unknown message | `message_revision_unknown_target` | none | Never | quarantine | Recoverable quarantine until target is imported or event expires. |
| malformed payload | `malformed_event` | none | Never | quarantine/rejection ledger | Reject or quarantine without transcript write. |
| duplicate event ID | `duplicate_event` | unchanged | Never | event ledger | Mark duplicate idempotently; no second side effect. |
| duplicate provider message ID | `duplicate_message` | unchanged | Never | message ledger | Reconcile to existing transcript message; do not duplicate. |
| unknown WABA/business phone | `unknown_account` | none | Never | quarantine | Fail closed before client lookup. |
| unknown client/counterparty | `unknown_client` | none | Never | quarantine | Fail closed after tenant account resolution. |
| multiple client matches | `ambiguous_client` | none | Never | quarantine | Fail closed with no AI path. |
| cross-tenant collision | `cross_tenant_collision` | none | Never | quarantine, high-severity audit | Fail closed; never infer tenant from client phone alone. |
| unsupported provider field | `unsupported_event` | none | Never | event ledger or quarantine | Record minimized evidence; no transcript or AI effect. |

## 5. Actor Resolution Truth Table

Actor resolution is performed after account binding and counterparty resolution. Actor proof never comes from message text.

| Evidence | Actor type | Message sender | Origin | `authorDietitianId` | Actor-resolution basis | AI path |
| --- | --- | --- | --- | --- | --- | --- |
| Direct WhatsApp `messages` from resolved client counterparty | `client` | `client` | `client_inbound` | null | provider counterparty plus client channel binding | Existing client inbound path. |
| Authenticated MANU manual reply | `exact_dietitian` | `dietitian` | `dietitian_manual` | authenticated dietitian ID | MANU session and RBAC | No client inbound path. |
| WhatsApp `smb_message_echoes` on shared account | `business_operator` | `dietitian` | `dietitian_manual` | null | verified account plus event kind | No client inbound path; opens/joins human-control session. |
| WhatsApp `smb_message_echoes` on exclusive verified dietitian account | `exact_dietitian` | `dietitian` | `dietitian_manual` | bound dietitian ID | exclusive actor binding plus event kind | No client inbound path; opens/joins human-control session. |
| API outbound AI message created by MANU | `ai` | `assistant` | `ai_generated` | null | AI decision plus outbound ledger | Send-time revalidation only. |
| System lifecycle event | `system` | `system` | `system_event` | null | internal deterministic operation | No provider path. |
| History item with insufficient actor proof | `unknown` | `system` or inferred placeholder only | `imported_unknown` | null | incomplete historical proof | Non-promptable until resolved. |
| Event where client identity overlaps business actor identity | `conflict` | none | none | null | actor/counterparty conflict | Quarantine; no transcript write. |
| Event where exact dietitian assignment conflicts with client assignment | `conflict` | none | none | null | assignment mismatch | Quarantine; no transcript write. |

`dietitian_manual` records must satisfy either exact dietitian proof or verified business-human proof. The legacy core helper that requires `authorDietitianId` for every `dietitian_manual` message must be reworked in P85-IF-B/D so verified business-human messages can be represented without fabricating a person.

## 6. Tenant And Conversation Resolution

Resolution order is mandatory:

1. Resolve provider account: provider, WABA ID, business phone-number ID, and normalized display number must map to one active `ChannelAccountBindingRecord`.
2. Resolve tenant from that account binding.
3. Resolve counterparty identity within that tenant. Client phone/channel identity is never allowed to select tenant before provider account binding.
4. Verify client lifecycle, channel permission, channel binding, and tenant membership.
5. Resolve actor from exact event kind plus actor binding.
6. Resolve conversation by tenant, client, and channel, creating only through an approved path when needed.
7. Apply event-kind behavior.

Failing any step is fail-closed. No event reaches the orchestrator before tenant, client, actor, and conversation resolution all succeed.

## 7. Fail-Closed Matrix

| Condition | Required handling | Promptable? | Replayable? | Notification/alert |
| --- | --- | --- | --- | --- |
| Unknown account binding | Quarantine before client lookup | No | Yes | System notification for trust binding review. |
| Revoked account binding | Quarantine and audit | No | Yes after reactivation or remapping | System notification. |
| Unknown client | Quarantine under resolved tenant/account | No | Yes after client binding | System notification. |
| Multiple clients match | Quarantine with minimized match count | No | Yes after identity repair | System notification. |
| Actor conflict | Quarantine and high-severity audit | No | Yes after trust repair | System notification. |
| Client/business identity overlap | Quarantine | No | Yes after binding repair | System notification. |
| Assignment mismatch | Quarantine | No | Yes after owner/admin repair | System notification. |
| Cross-tenant collision | Quarantine and security audit | No | No automatic replay | System notification, owner/admin review. |
| Unsupported media | Store unavailable/review evidence or quarantine | No | Not as source text | Non-risk review notification. |
| Invalid timestamp | Use observed time only and flag provider time invalid | Depends on event kind and actor proof | Yes | System notification only if repeated/degraded. |
| Malformed event | Reject or quarantine minimized payload digest | No | Yes when parseable repair exists | System notification if repeated. |
| Duplicate event | Mark duplicate with no side effects | Existing record only | No need | None by default. |
| Duplicate message | Reconcile by canonical provider message ID | Existing record only | No need | None by default. |
| Edit of prompt-used content | Add revision and invalidate dependent draft/outbound | Latest valid content only | Not as new inbound | System notification if clinical source changed. |
| Revoke of prompt-used content | Mark source non-promptable/non-answerable | No | No | System notification if active source changed. |

## 8. Human-Control Session State Machine

`HumanControlSessionRecord` is the coordination object for manual pause, external human auto-pause, yellow hold, red lock, and direct AI activation.

### States

- `none`: no active human-control session.
- `manual_paused`: authenticated MANU pause or existing human takeover lock.
- `external_human_active`: verified Business App/linked-device human response observed while AI was active or passive.
- `yellow_hold_active`: yellow risk produced a supervised draft/hold.
- `red_lock_active`: red risk opened a handoff and locked AI.
- `reactivation_pending`: authenticated dietitian requested AI active, but CAS/preflight checks are still validating.
- `resolved`: session resolved by valid direct AI activation or manual resume.
- `superseded`: session replaced by stronger state such as red lock after yellow hold.
- `expired`: non-risk stale session expired by policy without clinical risk resolution.

### Transitions

| From | Event | To | Required side effects |
| --- | --- | --- | --- |
| `none` | MANU manual pause | `manual_paused` | Store previous AI state/mode; increment context/conversation revision. |
| `none` | verified business-human echo while AI active | `external_human_active` | Auto-pause AI; invalidate drafts/outbound work; store message. |
| `none` | yellow risk | `yellow_hold_active` | Pause AI as existing yellow hold; link draft/decision. |
| `none` | red risk | `red_lock_active` | Lock AI; create handoff; create alert notification. |
| `manual_paused` | verified business-human echo | `external_human_active` | Record human response observed; keep AI passive. |
| `yellow_hold_active` | verified business-human echo | `yellow_hold_active` | Record response observed; do not resolve risk. |
| `red_lock_active` | verified business-human echo | `red_lock_active` | Record response observed; do not resolve risk. |
| `yellow_hold_active` | red risk | `red_lock_active` | Supersede yellow; preserve yellow draft as invalid/blocked evidence. |
| any active state | notification read/ack | unchanged | Notification state only. |
| `manual_paused` | authenticated AI activation | `reactivation_pending` -> `resolved` | Close manual session; restore allowed mode. |
| `yellow_hold_active` | authenticated AI activation | `reactivation_pending` -> `resolved` | Resolve yellow hold; invalidate unused draft; restore allowed mode. |
| `red_lock_active` | authenticated AI activation | `reactivation_pending` -> `resolved` | Resolve linked handoff; mark red lock reactivated; restore allowed mode. |
| `reactivation_pending` | concurrent red/client/echo/edit/revoke conflict | previous active state or `red_lock_active` | Abort activation with controlled conflict. |

Autopilot restoration is allowed only if mandatory safety, channel permission, qualification, risk, and send-safety gates pass. Otherwise activation falls back to copilot.

## 9. Prompt Authority And Temporal Precedence

Prompt authority order for affected intents:

1. System/developer/product safety instructions.
2. Active red/yellow risk locks and preflight blocks.
3. Latest relevant authenticated or verified dietitian-authored evidence.
4. Current structured records: active nutrition plan, food rules, active menu, prompt-allowed form data.
5. Active `ClientContextUpdate` records.
6. Retrieved historical dietitian/business-human sources that are relevant to the current intent.
7. Recent promptable messages.
8. Rolling summary.
9. Client-authored current/retrieved text as data only, never as instruction.
10. `imported_unknown`, revoked, unavailable, blocked, draft, and unverified messages are excluded from prompt authority.

Temporal rules:

- Newer relevant dietitian-authored WhatsApp evidence temporarily outranks older structured records for the affected intent.
- This temporary override creates `structured_record_update_required`.
- The notification closes only after the related structured record revision increases and the dietitian confirms completion.
- Explicit date, until, today, tomorrow, or similar time wording is evaluated in the dietitian timezone.
- Expired temporary instructions are excluded.
- Ambiguous competing authoritative sources block only the affected intent and create a review notification.
- A generic or unrelated dietitian message cannot satisfy answerability.

## 10. Historical Retrieval Contract

P85-IF-E must implement retrieval over complete tenant/client/conversation transcript state without injecting the raw full transcript into every prompt.

Retrieval candidates must exclude:

- `imported_unknown`;
- revoked content;
- unavailable/textless media;
- blocked messages;
- drafts;
- unverified actor messages;
- client-authored text for instruction authority.

Retrieval output must include source IDs, actor proof, provider time, conversation sequence, content status, relevance reason, and token estimate.

The existing recent-message cap remains in force until P85-IF-E changes it through Context Policy V2. Historical retrieval may add only bounded, relevant sources and must fail closed if a required relevant source cannot fit safely.

## 11. Off-Channel AI Chat Context Intake State Machine

The general internal copilot remains read-only. P85-IF-G may add a dedicated context-intake workflow with explicit capability gates.

### States

- `draft`
- `awaiting_confirmation`
- `blocked_pending_structured_update`
- `ready_after_structured_update`
- `applied`
- `rejected`
- `stale`
- `expired`

### Required behavior

- Global intake requires exact visible-client resolution by normalized full name and E.164 phone.
- Client-scoped intake still presents name and phone confirmation.
- Zero, multiple, hidden, removed, or mismatched clients fail closed.
- Context-only information can create `ClientContextUpdate` only after explicit dietitian confirmation.
- Structured-impact information cannot mutate form, active nutrition plan, food rules, or menu records.
- Structured-impact proposals remain blocked until the relevant dashboard record revision changes.
- After revision evidence, the dietitian must confirm again before apply.
- Apply increments context revision, invalidates drafts, and writes audit/source evidence.

## 12. Schema And API Contract For Later Tracks

P85-IF-B must introduce or extend records append-only. Names below are canonical logical contracts; implementation may map them to TypeScript and Supabase names while preserving semantics.

### Required records

- `ChannelAccountBindingRecord`
- `ChannelActorBindingRecord`
- `ChannelEventRecord`
- `ChannelMessageRevisionRecord`
- `HumanControlSessionRecord`
- `RiskActivityEventRecord`
- `ContextIntakeProposalRecord`

### Required `MessageRecord` extensions

- provider account binding ID;
- provider event ID;
- provider message ID;
- actor type;
- actor binding ID;
- author interface;
- actor-resolution basis;
- provider sent timestamp;
- observed timestamp;
- persisted timestamp;
- conversation sequence;
- content status;
- retrieval eligibility.

### API ownership

- Owner/admin can create, verify, activate, revoke, inspect, and replay trust-root/quarantine records.
- Dietitians can view bindings and request changes; they cannot silently activate a trust root.
- Owner/admin/dietitian can operate client-scoped human-control and direct activation where RBAC permits.
- Assistant/auditor remain read-only unless a later explicit contract grants scoped access.
- Existing auth, entitlement, onboarding, billing, admin, and PWA contracts remain unchanged.

## 13. Threat Model

| Threat | Failure mode | Required control |
| --- | --- | --- |
| Actor inversion | Business-human message treated as client inbound and triggers AI | Exact event-kind normalization, actor truth table, no-AI path for `smb_message_echoes`. |
| False dietitian attribution | Shared Business App message assigned to a specific dietitian | Two-layer proof; `authorDietitianId` null unless exact proof exists. |
| Tenant confusion | Phone number routes event to wrong tenant | Provider account binding first; tenant before client lookup. |
| Cross-tenant collision | Same counterparty appears under multiple tenants | Account-scoped uniqueness and collision quarantine. |
| AI/human race | AI sends after human has taken over | Conversation revision CAS, draft/outbound invalidation, send-time revalidation. |
| Notification/risk conflation | Read/ack treated as clinical resolution | Direct AI activation is the only yellow/red resolution path. |
| Stale source answerability | Unrelated manual message unlocks green answer | Retrieval-evidenced intent relevance. |
| Lost old instruction | Last-eight window drops relevant dietitian instruction | Full-history scoped retrieval. |
| Revoked/edited content use | Old content remains promptable | Immutable revisions and source invalidation. |
| Off-channel wrong-client update | AI Chat applies context to wrong client | Name + phone proof and exact visible-client resolution. |
| Structured mutation bypass | Chat updates form/menu/plan directly | Structured-impact block until dashboard record revision changes. |
| Quarantine data leakage | Raw health text exposed in aggregate ops | Minimized payload digests and raw-text-free aggregate views. |
| Silent webhook loss | Failed event is discarded | Recoverable event ledger and replay status. |
| Real-provider accidental enablement | Production path opened during foundation work | Keep real providers/channels disconnected and gate future work. |

## 14. Stage 4B Handoff Boundary

P85-IF defines:

- alert versus notification semantics;
- data records and state transitions;
- minimal verification UI needs;
- source-message/deep-link contracts;
- risk-resolution semantics;
- notification creation triggers for structured-record update, channel trust degradation, unsupported content, and quarantine review.

Stage 4B owns:

- complete alert/notification center UX;
- navigation, filters, grouping, priorities, read/ack ergonomics;
- mobile/PWA layout and visual polish;
- final copy and seven-language UI expansion;
- complete operational workflow design.

No Stage 4B runtime implementation is approved by this spec.

## 15. Track Acceptance Criteria

### P85-IF-B

- Trust-root, provenance, event, revision, session, risk activity, and context-intake data model exists.
- Migrations are append-only and legacy rows are null-tolerant.
- RLS/RBAC/tenant isolation tests cover every new record.
- No runtime provider path behavior changes before P85-IF-C/D.

Implementation status on 2026-07-10: complete. App domain types now include nullable message provenance fields plus `ChannelAccountBindingRecord`, `ChannelActorBindingRecord`, `ChannelEventRecord`, `ChannelMessageRevisionRecord`, `HumanControlSessionRecord`, `RiskActivityEventRecord`, and `ContextIntakeProposalRecord`. Supabase full-state mappers read the new tables and map legacy message rows with null/default provenance values. Migration `app/supabase/migrations/20260710120000_phase_85_if_b_trust_root_provenance.sql` adds the append-only schema, uniqueness checks, provenance constraints, and RLS/RBAC policies. P85-IF-C remains responsible for secure ingress, routing, quarantine, replay runtime, and any channel event processing behavior.

### P85-IF-C

- Secure mock webhook gate includes feature flag, secret, and production/hosted-sandbox refusal.
- Normalization handles event kinds independently in batches.
- Account binding, client, actor, and conversation routing fail closed.
- Recoverable quarantine and replay contracts are implemented.
- Real Meta signature verification remains a future unimplemented production gate.

Implementation status on 2026-07-10: complete. `phase-85-if-c-channel-event-normalizer.ts`, `phase-85-if-c-channel-event-routing.ts`, and `phase-85-if-c-channel-event-ledger.ts` implement the normalization, fail-closed routing, secure gate, ledger, quarantine, and seven-day mock replay/expiry described above. Only fully-resolved `client_message_text` events delegate to the existing, unmodified `processMockChannelInbound` path; this engine is additive and not yet wired into the live `/api/whatsapp/webhook` route (no account binding is seeded by default). P85-IF-D remains responsible for business-human echo transcript storage, human-control session auto-pause, and edit/revoke/media/history lifecycle behavior.

### P85-IF-D

- Complete transcript persists across active, passive, risk, and manual sessions.
- Business-human echo stores as verified `dietitian_manual` without AI loop.
- Human-control session auto-pause, draft invalidation, edit/revoke/media/history behavior are test-locked.

Implementation status on 2026-07-10: complete. `phase-85-if-d-transcript-human-control.ts` and `phase-85-if-d-supabase-mappers.ts` implement routed transcript persistence, human-control coordination, revision lifecycle, unsupported-media review notifications, and outbound-status correlation. Evidence: `docs/PHASE_85_IF_D_TRANSCRIPT_HUMAN_CONTROL_EVIDENCE.md`. P85-IF-E is next.

### P85-IF-E

- Full-history deterministic retrieval exists in fallback and Supabase paths.
- Dietitian manual answerability requires retrieval-evidenced relevance.
- Temporal precedence, structured update notification, edit/revoke exclusion, and cross-tenant isolation are test-locked.

Implementation status on 2026-07-10: complete. `historical-retrieval.js`, `CONTEXT_POLICY_V2`, retrieval-evidenced answerability, `phase-85-if-e-historical-retrieval.ts`, `phase-85-if-e-supabase-search.ts`, and migration `20260710150000_phase_85_if_e_conversation_message_search.sql` implement bounded historical retrieval, overflow fail-closed behavior, structured-record update notifications, and Supabase FTS RPC. Evidence: `docs/PHASE_85_IF_E_HISTORICAL_RETRIEVAL_EVIDENCE.md`. P85-IF-F is complete.

### P85-IF-F

- Direct AI activation resolves manual, yellow, and red sessions through one controlled operation.
- Send-time CAS/revalidation blocks stale outbound and concurrent human/AI races.
- Unsafe autopilot restoration falls back to copilot.

Implementation status on 2026-07-10: complete with R3 remediation. `phase-85-if-f-risk-reactivation.ts`, `phase-85-if-f-conversation-revision.ts`, controlled activation in `simulator.ts`, `/api/clients/[id]/activate-ai`, migration `20260710160000_phase_85_if_f_conversation_revision.sql`, and remediation migration `20260710200000_phase_85_if_remediation_atomic_activation.sql` implement canonical risk resolution, required activation CAS, service-role-only atomic Supabase activation, inbound/draft expected-conversation revision guards, and human-control session closure. Evidence: `docs/PHASE_85_IF_F_RISK_REACTIVATION_EVIDENCE.md`. P85-IF-G is complete.

### P85-IF-G

- Dedicated context-intake workflow resolves clients safely and cannot mutate structured records.
- Structured-impact proposals block until dashboard revision evidence and second confirmation.
- RBAC, RLS, export, redaction, replay, stale proposal, and draft invalidation are covered.

Implementation status on 2026-07-10: complete with R4 remediation. `phase-85-if-g-context-intake.ts`, context-intake API routes, Copilot panel intake workflow, Supabase persistence, migration `20260710170000_phase_85_if_g_context_intake.sql`, remediation migration `20260710210000_phase_85_if_remediation_client_safe_context_intake.sql`, export/redaction hooks, and targeted/RLS tests implement dedicated off-channel intake with client-safe resolution, structured blocking, double confirmation, service-role-only atomic Supabase proposal mutations, wrong-client `404`, stale proposal `409`, and read-only copilot separation. Evidence: `docs/PHASE_85_IF_G_CONTEXT_INTAKE_EVIDENCE.md` and `docs/PHASE_85_IF_R4_CONTEXT_INTAKE_REMEDIATION_EVIDENCE.md`. P85-IF-H is complete.

### P85-IF-H

- Minimal evidence UI exposes provenance, human-control, trust-binding, quarantine, source-link, and channel health state.
- Full Stage 4B alert/notification UX remains untouched.
- Desktop/mobile smoke verifies no Stage 4A regression.

Implementation status on 2026-07-10: complete. `phase-85-if-h-operational-visibility.ts`, conversation provenance badges, human-control banner with direct AI activation, overview channel-trust aggregates, owner/admin inspection tables, structured source-message links, seven-language strings, and targeted tests implement minimal operational visibility without building Stage 4B. Evidence: `docs/PHASE_85_IF_H_OPERATIONAL_VISIBILITY_EVIDENCE.md`. P85-IF-I is next.

### P85-IF-I

- Export, anonymization, deletion, RLS, replay, operational evidence, risk register, and closure docs are complete.
- Full verification is green except documented local Supabase skips.
- P85-IF closes and Stage 4B becomes the next Phase 85 planning target.

Implementation status on 2026-07-10: complete. `phase-85-if-i-lifecycle-closure.ts`, export/redaction extensions in `data-governance.ts` and `phase-74-data-lifecycle-policy.ts`, unified lifecycle evidence in `phase-79e-lifecycle-redaction-evidence.ts`, Supabase RLS coverage for interstage tables, risk-register closure narratives, and targeted tests implement P85-IF-I closure without enabling live providers or production pilot. Evidence: `docs/PHASE_85_IF_I_LIFECYCLE_CLOSURE_EVIDENCE.md`. P85-IF is closed; Stage 4B is next.

## 16. Verification Contract

For P85-IF-A:

- `git diff --check`
- secret/token scan
- forbidden future-phase naming scan
- `git status --short`

For later runtime tracks, select the relevant subset and then run the full required chain at P85-IF-I:

- targeted Vitest and core Node tests;
- `npm run lint`;
- `npm run build`;
- UI visual smoke for UI-affecting tracks;
- channel replay for ingress/egress/replay tracks;
- production-scale rehearsal where AI/routing/retrieval behavior is affected;
- current local RLS suite when Supabase is available;
- `npm run release:verify` at closure.

## 17. P85-IF-A Closure Statement

P85-IF-A is complete when this spec is committed with continuity documentation updates. It creates no runtime behavior and does not approve production pilot, Stage 4B runtime work, real providers/channels, live billing, monitoring, backup, secret manager, or real health-data processing.

At P85-IF-A closure, the next track was P85-IF-B. P85-IF-B through P85-IF-D are now complete; P85-IF-E is next.

Verification on 2026-07-10:

- Core `npm test`: 225/225 passed.
- App `npm test`: 734 passed / 4 skipped.
- App `npm run lint`: 0 errors, 3 pre-existing warnings.
- App `npm run build`: passed.
- `git diff --check`: clean.
- New-spec secret/token scan: clean.
- Forbidden future-phase naming scan: clean.
- Visual, channel replay, production-scale, and RLS tests were not required for P85-IF-A because no runtime, UI, channel, schema, or RLS behavior changed.

## 18. P85-IF-B Closure Statement

P85-IF-B is complete when the trust-root/provenance data model is committed with app types, fallback state, Supabase mappers, append-only migration, focused tests, and continuity documentation updates. It does not approve production pilot, Stage 4B runtime work, real providers/channels, live billing, monitoring, backup, secret manager, or real health-data processing.

The next track is P85-IF-C: secure ingress, ledger, routing, and quarantine.

Verification on 2026-07-10:

- Targeted app Vitest `src/lib/phase-85-if-b-provenance-model.test.ts` and `src/lib/phase-85-if-b-migration-contract.test.ts`: 6/6 passed.
- App `npm test`: 740 passed / 4 skipped.
- App `npm run lint`: 0 errors, 3 pre-existing warnings.
- App `npm run build`: passed.
- Core `npm test`: 225/225 passed.
- App `npm run test:rls`: skipped 21/21 because local Supabase was unavailable, so R-406 current re-run remains pending.
- `git diff --check`: clean.
- Secret/token scan: clean.
- Forbidden future-phase naming scan: clean.
- Final `git status --short`: required after commit closure.

## 19. P85-IF-C Closure Statement

P85-IF-C is complete when the secure ingress, ledger, routing, and quarantine engine is committed with app-level normalization/routing/ledger modules, golden fixtures, focused tests, and continuity documentation updates. It does not approve production pilot, Stage 4B runtime work, real providers/channels, live billing, monitoring, backup, secret manager, or real health-data processing, and it does not wire the new engine into the live `/api/whatsapp/webhook` route.

Scope decisions recorded at closure:

- Only fully-resolved `client_message_text` events delegate to the existing, unmodified `processMockChannelInbound` orchestrator path, so current client-facing AI/risk behavior is unchanged. All other event kinds (business-human echoes, statuses, history, edit/revoke, media, quarantine cases) are ledger-recorded only.
- The new engine is intentionally not wired into the live `/api/whatsapp/webhook` route in this track: no `ChannelAccountBindingRecord` is seeded in the fallback/demo state by default, and requiring one on the live route would fail-closed the existing demo/tests. Storing business-human echoes as verified `dietitian_manual`, auto-pausing AI, and human-control session integration remain P85-IF-D scope per section 8.
- Supabase-side ledger persistence (insert/replay via RPC) was deferred; this track's acceptance criteria does not list a Supabase requirement, unlike P85-IF-D/E.

The next track is P85-IF-D: complete transcript and human control.

Verification on 2026-07-10:

- Post-commit remediation evidence: `docs/PHASE_85_IF_C_SECURE_INGRESS_ROUTING_REMEDIATION_EVIDENCE.md`.
- Targeted app Vitest `phase-85-if-c-channel-event-normalizer.test.ts`, `phase-85-if-c-channel-event-routing.test.ts`, and `phase-85-if-c-channel-event-ledger.test.ts`: 40/40 passed.
- Full app Vitest: 780 passed, 4 skipped, 0 failed across 125 files.
- Core package tests: 225/225 passed.
- App `npm run lint`: 0 errors, 3 pre-existing warnings (unchanged baseline).
- App `npm run build`: passed, including TypeScript and static page generation.
- Full mock channel replay rehearsal: passed.
- `git diff --check`: clean apart from repository-wide CRLF conversion warnings.
- Secret/token scan: clean.
- Forbidden future-phase naming scan: clean.
- `npm run test:rls`: not re-run; R-406 current re-run remains pending.
- Visual verification: not required because no UI changed.
- Final `git status --short`: required after remediation commit closure.

P85-IF-C is evidence-complete. P85-IF-D is evidence-complete. P85-IF-E is the next track.

## 20. P85-IF-D Closure Statement

P85-IF-D is complete when routed transcript persistence, human-control coordination, revision lifecycle, unsupported-media review handling, outbound-status correlation, Supabase row mappers, append-only migration, focused tests, and continuity documentation are committed. It does not approve production pilot, Stage 4B runtime work, real providers/channels, live billing, monitoring, backup, secret manager, or real health-data processing, and it does not wire the ingress engine into the live `/api/whatsapp/webhook` route.

Evidence: `docs/PHASE_85_IF_D_TRANSCRIPT_HUMAN_CONTROL_EVIDENCE.md`.

The next track is P85-IF-E: full-history retrieval and prompt authority.

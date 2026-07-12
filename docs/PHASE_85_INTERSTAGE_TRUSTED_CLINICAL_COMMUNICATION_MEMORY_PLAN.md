# Phase 85 Interstage Foundation - Trusted Clinical Communication And Memory Plan

Date: 2026-07-10
Canonical code: `P85-IF`
Status: Planning complete; P85-IF-A through P85-IF-I complete; R6 lifecycle/RLS re-closure verified; Stage 4B may resume.
Placement: Phase 85 Stage 4A complete -> P85-IF -> Phase 85 Stage 4B.
Production pilot: `NO-GO`.
Deployment: none.

## 1. Program Position And Purpose

P85-IF is an independent, cross-cutting foundation program inserted between Phase 85 Stage 4A and Stage 4B. It does not replace Phase 85, complete Phase 85, or become a new top-level numbered phase. After P85-IF closes, execution returns to Phase 85 Stage 4B Uyarilar ve Bildirimler.

The program exists because the Stage 4B alert/notification experience cannot be built safely on the current channel and memory semantics. The current code can model correct provenance after a message is already labeled, but the WhatsApp ingestion boundary cannot yet prove whether a direct event was written by the client or by an authorized human using the WhatsApp Business App. The current AI context also uses a bounded recent-message window, so database transcript completeness does not guarantee that an older dietitian instruction reaches the model.

P85-IF therefore establishes the trusted foundation for:

- complete WhatsApp transcript persistence;
- tenant, client, conversation, channel-account, and actor resolution;
- verified business-human versus exact-dietitian attribution;
- human/AI coordination and stale-send prevention;
- full-history, provenance-preserving retrieval;
- explicit risk resolution through the authenticated AI reactivation action;
- controlled off-channel information intake through AI Chat;
- Stage 4B alert versus notification semantics;
- audit, export, redaction, RLS, replay, and operational evidence.

## 2. Locked Product Decisions

1. Every supported WhatsApp message is stored in the correct tenant/client/conversation transcript, whether AI is active, risk-paused, or manually paused.
2. The five canonical message origins remain unchanged: `client_inbound`, `ai_generated`, `dietitian_manual`, `system_event`, and `imported_unknown`.
3. Actor proof is two-layered. A Business App echo proves an authorized business-side human, but not necessarily a specific individual. Exact `authorDietitianId` is written only when an authenticated MANU action or an exclusive verified account policy proves it.
4. `smb_message_echoes` represents a WhatsApp Business App or linked-device human message. It is not an AI echo. API outbound correlation remains in the send/delivery ledger and status webhook path.
5. A verified external human message never runs the client inbound AI/risk pipeline. It is stored as `dietitian_manual`, invalidates stale work, and cannot trigger an AI reply loop.
6. If a verified dietitian/business-human message arrives while AI is active, the system automatically pauses AI and opens a human-control session.
7. Yellow/red risk pauses can be resolved only by an authenticated dietitian turning AI active again. That single action closes the linked risk state and reactivates AI; notification read/ack and WhatsApp messages alone never resolve risk.
8. Risk reactivation restores the pre-lock mode. Autopilot restoration still requires the existing mandatory safety gates; otherwise the system falls back to copilot.
9. All transcript content remains in the database, but the full transcript is never injected raw into every prompt. Query-time, tenant/client-scoped historical retrieval selects relevant evidence from the complete transcript.
10. A relevant newer WhatsApp dietitian instruction temporarily outranks older structured form/plan/menu context. The system creates a non-risk notification asking the dietitian to update the relevant structured panel.
11. Alerts are yellow/red clinical risk events. Notifications are system information such as structured-record update requests, channel trust degradation, or unsupported-content review.
12. Off-channel information enters through AI Chat as a proposal. Context-only information can be committed after explicit dietitian confirmation. Form, active nutrition plan, food-rule, or menu changes cannot be committed until the corresponding dashboard records are manually updated and re-confirmed.
13. The general internal copilot remains read-only. Only the dedicated, capability-gated context-intake workflow may create and apply a reviewed `ClientContextUpdate` proposal.
14. Real WhatsApp, Telegram, Gemini/provider, live billing, monitoring, backup, secret manager, and real health-data paths remain disconnected throughout P85-IF.

## 3. Target End-To-End Flow

```mermaid
flowchart TD
    A[WhatsApp provider event] --> B[Verify mock gate and normalize exact event kind]
    B --> C[Resolve WABA and business phone binding to tenant]
    C --> D[Resolve counterparty to one client and conversation]
    D --> E{Event kind}
    E -->|client message| F[client_inbound: store and run existing risk/preflight/AI path]
    E -->|smb_message_echoes| G[dietitian_manual: verified business human]
    E -->|API status| H[Update outbound delivery ledger only]
    E -->|history| I[Import/reconcile without AI trigger]
    E -->|edit/revoke/media| J[Apply revision/content-status policy]
    G --> K[Pause AI if active]
    K --> L[Invalidate drafts and in-flight stale outbound]
    L --> M[Link message to human-control session]
    F --> N{Yellow/red risk?}
    N -->|yes| O[Pause AI and open risk-linked human session]
    N -->|no| P[Continue allowed existing behavior]
    O --> Q[Client and dietitian continue WhatsApp conversation]
    Q --> R[All messages persist with actor and time evidence]
    R --> S[Dietitian turns AI active in MANU]
    S --> T[Resolve linked risk and restore safe previous mode]
    T --> U[Future client messages use recent context plus trusted historical retrieval]
```

## 4. Program Structure

| Track | Scope | Runtime status |
| --- | --- | --- |
| P85-IF-A | Canonical spec, provider contract, threat model, state machines | Complete |
| P85-IF-B | Trust-root, provenance, identity, event, and session data model | Complete |
| P85-IF-C | Secure mock webhook, normalization, ledger, routing, quarantine | Complete |
| P85-IF-D | Complete transcript, human-control coordination, edit/revoke/media | Complete |
| P85-IF-E | Full-history retrieval, prompt authority, answerability relevance | Complete |
| P85-IF-F | Yellow/red resolution, direct AI reactivation, concurrency safety | Complete |
| P85-IF-G | Controlled off-channel AI Chat context intake | Complete |
| P85-IF-H | Minimal operational visibility and Stage 4B contract handoff | Complete |
| P85-IF-I | Lifecycle, RLS, export, evidence, verification, closure | Complete |

R5 remediation note, 2026-07-10: P85-IF-H operational visibility now has a hard API/RLS boundary. Common app-state redacts trust-binding, actor-binding, channel-event, event-only revision, and inbound-quarantine inspection details. Owner/admin inspection is retrieved only through `GET /api/operational-foundation` with `read_operational_foundation`; direct unauthorized access returns 403. Migration `20260710220000_phase_85_if_remediation_operational_access_boundaries.sql` restricts select RLS for the operational trust/quarantine tables to owner/admin. Evidence: `docs/PHASE_85_IF_R5_OPERATIONAL_ACCESS_BOUNDARIES_EVIDENCE.md`.

R6 remediation note, 2026-07-11: P85-IF-I lifecycle/RLS re-closure now persists Supabase removal/anonymization redaction for P85-IF records, adds owner/admin tenant channel-binding revoke RPC/API with tenant automation rollback disabled, adds export leak detection, and requires explicit full verification inputs for program closure evidence. Verification passed with targeted lifecycle 14/14, local Supabase reset, local RLS 28/28, lint, production build, full app 825 passed / 4 skipped, channel replay, production-scale rehearsal, `git diff --check`, secret scan, and forbidden future-phase naming scan. Evidence: `docs/PHASE_85_IF_R6_LIFECYCLE_RLS_RE_CLOSURE_EVIDENCE.md`.

## 5. P85-IF-A - Canonical Contract And Threat Model

### Objective

Create `docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_SPEC.md` as the implementation contract. No runtime code changes occur in this track.

Status: complete on 2026-07-10. The canonical spec now exists; P85-IF-B and P85-IF-C later completed, and P85-IF-D is next.

### Required specification content

- Exact provider event matrix for `messages`, `statuses`, `smb_message_echoes`, `history`, edit, revoke, media, malformed, batch, duplicate, and unsupported events.
- Actor-resolution truth table covering client, exact dietitian, verified business human, AI outbound, system, and unknown actor.
- Tenant resolution order: provider/WABA/business-phone binding first; client/counterparty identity second; actor third; conversation fourth.
- Fail-closed matrix for unknown account, unknown client, multiple clients, actor conflict, revoked binding, unsupported media, invalid timestamp, malformed event, and cross-tenant collision.
- Human-control session state machine for manual pause, external human auto-pause, yellow hold, red lock, and direct AI reactivation.
- Prompt authority and temporal precedence contract for structured records, context updates, recent messages, retrieved historical messages, edited/revoked content, and imported unknown content.
- Off-channel AI Chat proposal state machine and structured-update prerequisite.
- Stage 4B handoff boundary: P85-IF defines data/API semantics and minimal evidence UI only; Stage 4B owns the complete alert/notification center, filters, list ergonomics, mobile/PWA experience, and final visual design.

### Acceptance

- Spec, threat model, edge-case matrix, schema/API contract, subtrack acceptance criteria, and verification commands are complete.
- Production `NO-GO` and R-405 open are preserved; local P85 post-closure RLS evidence may be recorded without treating it as production authorization.
- `git diff --check` and secret scan are clean.

## 6. P85-IF-B - Trust Root And Provenance Data Model

### Canonical records

- `ChannelAccountBindingRecord`: provider, WABA ID, business phone-number ID, normalized display number, tenant, operating mode, active/revoked lifecycle, verification timestamps, and `exclusive_dietitian | shared_authorized_team` policy.
- `ChannelActorBindingRecord`: tenant, account binding, optional dietitian, actor type, attribution basis, valid-from/to, verified/revoked metadata, and audit ownership.
- `ChannelEventRecord`: exact event kind, provider account/event/message IDs, from/to/counterparty identities, payload digest, provider time, observed time, processing status, quarantine link, retry/replay metadata, and internal sequence.
- `ChannelMessageRevisionRecord`: original message, edit/revoke action, provider event, prior/current content status, revision sequence, and timestamps.
- `HumanControlSessionRecord`: client, conversation, reason, previous AI state/mode, linked handoffs/holds/messages, response-observed counters, resolution/reactivation metadata, and lifecycle status.
- `RiskActivityEventRecord`: response observed, AI paused, draft invalidated, risk resolved, AI reactivated, and source evidence links.
- `ContextIntakeProposalRecord`: target client proof, source channel, source text, extracted context draft, structured-impact flags, baseline revisions, status, confirmation, and apply evidence.

### Message contract

`MessageRecord` gains provider account/message ID, actor type, actor binding, author interface, actor-resolution basis, `providerSentAt`, `observedAt`, `persistedAt`, `conversationSequence`, content status, and retrieval eligibility.

Database constraints enforce:

- origin/sender/author consistency;
- `dietitian_manual` requires exact dietitian proof or verified business-human proof;
- `ai_generated` requires an AI decision;
- client and conversation tenant consistency;
- actor/dietitian assignment consistency where exact attribution is claimed;
- canonical provider-message uniqueness;
- globally unique provider account routing identity;
- two-way client/business identity conflict rejection;
- soft revoke instead of destructive identity deletion.

### API and authorization

- Owner/admin can create, verify, activate, revoke, and inspect account/actor bindings.
- Dietitians can view bindings and request changes but cannot silently activate a trust root.
- Assistant/auditor cannot mutate bindings.
- Existing auth, entitlement, onboarding, billing, and PWA contracts remain unchanged.

### Acceptance

- Fallback and Supabase types/mappers/seeds are null-tolerant for legacy rows.
- Migration, RPC, RLS, RBAC, uniqueness, conflict, and tenant-isolation tests pass.
- No existing message behavior changes before P85-IF-C/D enable the new path.

Status: complete on 2026-07-10. P85-IF-B added app-level nullable provenance/message contract fields, canonical trust-root/event/revision/session/risk/context-intake records, Supabase mappers, append-only migration `app/supabase/migrations/20260710120000_phase_85_if_b_trust_root_provenance.sql`, and focused provenance model tests. P85-IF-C later completed secure ingress; P85-IF-D is next.

## 7. P85-IF-C - Secure Ingress, Ledger, Routing, And Quarantine

### Normalization and security

- Normalization returns `NormalizedChannelEvent[]`; every entry/change/message in a batch is processed independently.
- Event kind is derived from the exact provider field, never inferred from message text.
- Mock webhook requires both the existing feature gate and `MANU_MOCK_WHATSAPP_WEBHOOK_SECRET`, refuses production execution, and remains disabled on the hosted sandbox.
- A future real adapter must verify Meta signatures before normalization; this remains an unimplemented production gate.

### Routing

1. Resolve provider account/WABA/business phone to one active tenant binding.
2. Resolve `to`/counterparty identity to one tenant-scoped client.
3. Verify client lifecycle, channel permission, and conversation relationship.
4. Resolve actor from event kind and trust binding.
5. Reject actor/client overlap, ambiguous identity, inactive binding, or assignment mismatch.

### Idempotency and quarantine

- Canonical event uniqueness and canonical message uniqueness are separate so status/edit/revoke events can reference an existing message without duplicating it.
- Event statuses are `received`, `normalized`, `quarantined`, `committed`, `duplicate`, `replayed`, `rejected`, and `expired`.
- Quarantined events are not terminally discarded. Authorized replay transitions the same event record and remains idempotent.
- Mock synthetic replay content has a seven-day expiry. Real clinical content cannot use this path until encryption, retention, and secret-management gates are externally approved.

### Acceptance

- Golden fixtures cover direct client message, business echo, status, history, edit, revoke, media, batch, malformed, unknown, ambiguous, conflict, duplicate, and replay.
- Two tenants with the same client phone remain isolated by provider account binding.
- No event reaches the orchestrator until tenant, client, actor, and conversation resolution all succeed.

Status: complete and post-commit audited on 2026-07-10. `docs/PHASE_85_IF_C_SECURE_INGRESS_ROUTING_REMEDIATION_EVIDENCE.md` records all closed findings, including duplicate-ID/digest conflicts. Verification passed: targeted 40/40, app 780 passed / 4 skipped, core 225/225, lint 0 errors with 3 unchanged warnings, production build, and full mock channel replay. The engine remains additive and disconnected from the live webhook; business-human transcript persistence and human-control behavior were completed in P85-IF-D.

## 8. P85-IF-D - Complete Transcript And Human Control

### Client messages

- Client inbound is stored whether AI is active, risk-paused, or manually paused.
- Existing risk classification still runs for client inbound while AI is passive so a new red condition is not hidden.
- Preflight continues to block client-facing AI output while paused/locked.

### Business-human messages

- Business App/linked-device echo is stored as `sender=dietitian`, `origin=dietitian_manual`, `actorType=business_operator`, and `authorInterface=whatsapp_business_surface`.
- Exact `authorDietitianId` remains null for shared bindings; exclusive verified policy may supply it with an explicit attribution basis.
- The AI/risk pipeline is never invoked for this event.
- If AI is active, the event atomically pauses AI, opens a human-control session, increments conversation/context revision, invalidates drafts, and cancels stale outbound preparation.
- If AI is already passive, the event joins the existing session and records `human_response_observed`.

### Content lifecycle

- Edit creates an immutable revision and invalidates decisions/drafts that used the prior revision.
- Revoke marks the message non-promptable/non-answerable while retaining minimized audit evidence.
- Unsupported or textless media creates `content_unavailable`, pauses the affected client, and produces a review requirement; it never becomes approved clinical source text.
- History events reconcile by provider message ID, use provider timestamps, and never trigger new AI replies or risk decisions.

### Acceptance

- No client/dietitian actor inversion and no human-to-AI response loop.
- Full transcript remains ordered and queryable through active/passive/risk/manual sessions.
- Edit, revoke, media, history, draft invalidation, and auto-pause tests pass in fallback and Supabase paths.

Status: complete on 2026-07-10. Evidence: `docs/PHASE_85_IF_D_TRANSCRIPT_HUMAN_CONTROL_EVIDENCE.md`. Verification passed: targeted P85-IF-D 7/7 plus updated P85-IF-C ledger 11/11, app 787 passed / 4 skipped, core 225/225, lint 0 errors with 3 unchanged warnings, production build, and full mock channel replay. P85-IF-E is next.

## 9. P85-IF-E - Full-History Retrieval And Prompt Authority V2

### Retrieval architecture

- Fallback uses the existing deterministic lexical-retrieval pattern over the complete tenant/client conversation corpus.
- Supabase uses a tenant/client/conversation-scoped PostgreSQL full-text search RPC and index; it does not depend on the bounded app-state loader.
- Real embedding retrieval remains disconnected and launch-gated.
- Retrieval candidates exclude `imported_unknown`, revoked, unavailable, blocked, draft, and unverified-actor messages.

### Context Policy V2

- Existing maximum eight recent promptable messages remains.
- Historical retrieval adds at most six sources and at most 600 estimated tokens: up to four relevant dietitian/business-human sources and two supporting client/sent-AI sources.
- Ranking order is exact source/reference, shared clinical entity, deterministic lexical relevance, actor trust, provider time, and conversation sequence.
- Relevant newest dietitian evidence is never silently dropped for budget. If it cannot fit safely, generation blocks with missing/overflow historical context.

### Authority and answerability

- Generic `dietitian_manual_message` presence no longer satisfies answerability.
- Only a retrieval-evidenced `relevant_dietitian_manual_message` may support the matching intent.
- Generic greetings, unrelated logistics, and low-overlap messages cannot unlock plan/substitution/education answerability.
- Client-authored retrieved text remains untrusted data and stays inside client-data boundaries.
- Newer relevant WhatsApp dietitian instruction temporarily outranks older structured context.
- Explicit date/until/today wording is evaluated in the dietitian timezone; expired temporary instructions are excluded. Instructions without explicit expiry remain until superseded or the related structured record is confirmed updated.
- Ambiguous competing authoritative sources block only the affected intent and create a review notification.

### Structured update notification

- A detected WhatsApp change to form, active nutrition plan, food rules, or menu creates `structured_record_update_required`.
- The notification links the source message and target dashboard panel.
- It closes only after the related record revision changes and the dietitian confirms completion.
- This notification is not yellow/red risk and does not enter risk SLA calculations.

### Acceptance

- A dietitian instruction remains retrievable after more than eight later messages.
- A standalone `Merhaba` cannot satisfy a plan lookup.
- Temporal expiry, supersession, structured override, edit/revoke, cross-tenant isolation, and low-confidence fail-closed behavior are test-locked.

Status: complete on 2026-07-10. Evidence: `docs/PHASE_85_IF_E_HISTORICAL_RETRIEVAL_EVIDENCE.md`. Verification passed: targeted core historical retrieval 5/5 plus app P85-IF-E 4/4, app 791 passed / 4 skipped, core 230/230, lint 0 errors with 3 unchanged warnings, production build, and full mock channel replay. P85-IF-F is next.

## 10. P85-IF-F - Risk Resolution, AI Reactivation, And Concurrency

### Session and resolution semantics

- Manual pause opens a non-risk human-control session.
- Yellow/red pause opens a risk-linked human-control session and records previous AI status/mode.
- WhatsApp response records human involvement but never resolves the risk.
- Notification read/ack remains notification state only.

### Direct AI activation rule

When an authenticated dietitian turns AI active:

- a manual-pause session closes without creating clinical-resolution evidence;
- an active yellow/red session resolves its linked hold/handoff;
- unused yellow drafts are invalidated as handled through external human conversation;
- red lock is marked reactivated and linked handoff is resolved;
- AI becomes active in the previous mode;
- unsafe autopilot restoration falls back to copilot;
- a fixed audit reason code records direct dietitian reactivation without an extra free-text form.

Existing red resolve/reactivate APIs remain backward-compatible. A unified controlled activation operation may orchestrate the existing red path and the new yellow/manual paths without weakening authorization or preflight.

### Concurrency and send safety

- Every conversation mutation increments a monotonic conversation revision.
- AI decisions and outbound records capture the revision used for generation.
- Before provider send/commit, compare-and-swap revalidation verifies the latest revision, promptable source IDs, risk lock, channel permission, and AI state.
- A concurrent human message, edit/revoke, new client inbound, context update, or risk transition cancels stale outbound work.
- A concurrent new red event prevents reactivation and returns a controlled conflict.

### Acceptance

- Yellow/red direct activation, manual resume, previous-mode restoration, copilot fallback, stale draft, stale outbound, and concurrent red/echo races are covered.
- No direct client patch can bypass the canonical risk-resolution operation.

Status: complete on 2026-07-10. Evidence: `docs/PHASE_85_IF_F_RISK_REACTIVATION_EVIDENCE.md`. Verification passed: targeted P85-IF-F 6/6, app 798 passed / 4 skipped, lint 0 errors with 3 unchanged warnings, production build, and full mock channel replay. P85-IF-G is complete.

## 11. P85-IF-G - Controlled Off-Channel AI Chat Intake

### Client resolution

- Global AI Chat requires normalized full name plus normalized E.164 phone and must resolve exactly one visible client.
- Client-scoped AI Chat uses the selected client ID but still presents name and phone confirmation.
- Zero, multiple, hidden, removed, or mismatched clients fail closed without a proposal.

### Proposal model

The proposal includes source (`phone`, `zoom`, `in_person`, `other`), occurred-at time, title, summary, details, importance, raw source reference, expected client context revision, structured-impact flags, and baseline form/plan/food-rule/menu revisions.

Statuses are `draft`, `awaiting_confirmation`, `blocked_pending_structured_update`, `ready_after_structured_update`, `applied`, `rejected`, `stale`, and `expired`.

### Context-only information

- AI Chat presents a structured preview.
- Explicit dietitian confirmation is mandatory.
- Apply creates only `ClientContextUpdate`, increments context revision, invalidates drafts, and records audit/source evidence.

### Structured information

- Form, active plan, food-rule, or menu impact moves the proposal to `blocked_pending_structured_update`.
- No client context update or automatic structured mutation occurs.
- AI Chat names the required panel and provides a deep link.
- The required record revision must increase before recheck.
- After revision evidence, the dietitian confirms again; apply creates a context update referencing the updated structured records.
- Pending structured impact blocks only affected intents until completed or explicitly rejected.

### Acceptance

- Wrong-client, ambiguous-client, pure-context, structured-block, revision recheck, double-confirmation, stale proposal, replay, RBAC, RLS, export, redaction, and draft invalidation tests pass.
- General copilot tools remain read-only outside this dedicated workflow.

Status: complete on 2026-07-10. Evidence: `docs/PHASE_85_IF_G_CONTEXT_INTAKE_EVIDENCE.md`. Verification passed: targeted P85-IF-G 9/9, app 807 passed / 4 skipped, lint 0 errors with 3 unchanged warnings, and production build. P85-IF-H is next.

## 12. P85-IF-H - Minimal Operational Visibility And Stage 4B Handoff

P85-IF-H implements only the visibility needed to operate and verify the new foundation:

- provenance labels for client, AI, exact MANU dietitian, and verified WhatsApp business human;
- a compact human-control session banner with pause reason, latest response time, and direct AI activation control;
- source-message links for structured update requirements;
- owner/admin trust-binding and quarantine inspection controls;
- safe aggregate channel trust counters and degraded/blocked state;
- seven-language strings required by these minimal controls.

P85-IF-H explicitly does not build the complete Stage 4B product experience. Stage 4B retains ownership of the alert/notification center, navigation, filters, grouping, prioritization, read/ack ergonomics, mobile/PWA behavior, final copy, and visual polish.

### Acceptance

- Minimal controls expose no raw health text in aggregate health surfaces.
- Desktop/mobile visual smoke verifies no overlap, overflow, or broken Stage 4A workflows.
- Existing auth, onboarding, billing, entitlement, admin, and PWA contracts remain unchanged.

Status: complete on 2026-07-10. Evidence: `docs/PHASE_85_IF_H_OPERATIONAL_VISIBILITY_EVIDENCE.md`. P85-IF-I closed the P85-IF program.

## 13. P85-IF-I - Lifecycle, RLS, Evidence, Verification, And Closure

### Data lifecycle

- Client export version includes messages, revisions, human sessions, risk activity, retrieval source references, and applied/pending context-intake evidence where client-scoped.
- Anonymization/deletion redacts message bodies, provider IDs, counterparty identities, revision content, quarantine payloads, retrieval evidence, proposal source text, delivery copies, and session links.
- Audit retains only minimized hashes, reason codes, timestamps, and non-identifying aggregate evidence.
- Tenant account/actor bindings stay out of client export but participate in tenant revoke/deletion lifecycle.

### RLS and operational evidence

- RLS covers every new table, provider-account tenant routing, assignment scope, shared/exclusive actor policy, quarantine operations, retrieval RPC, and context-intake proposal.
- Local Supabase absence produces a documented skip and cannot count as closure; a later passing local run may update current local RLS evidence without approving production traffic.
- Risk register records actor-proof, silent webhook loss, stale structured records, retrieval false positives/negatives, quarantine retention, shared-device attribution, and concurrent human/AI sends.

### Verification chain

- targeted Vitest and core Node test suites;
- full `npm test`;
- `npm run lint`;
- `npm run build`;
- `npm run test:visual` for UI-affecting tracks;
- `npm run release:verify`;
- `npm run rehearse:channel:replay`;
- `npm run rehearse:production-scale:79g` where affected;
- `git diff --check`;
- secret/token scan;
- current local RLS suite when Supabase is available.

### Documentation and commit protocol

Each P85-IF track updates the required continuity documents and receives its own commit. P85-IF-I updated the complete evidence/dossier set and returned control to Stage 4B; Stage 4B planning subsequently completed.

No deploy occurs during P85-IF unless separately authorized. If a future sandbox deploy is explicitly approved, hosted evidence and Phase 84 hosted-sandbox notes must be updated separately.

Status: complete on 2026-07-10. Evidence: `docs/PHASE_85_IF_I_LIFECYCLE_CLOSURE_EVIDENCE.md`. P85-IF is closed; the approved Stage 4B implementation is now the next Phase 85 target.

## 14. Critical Acceptance Scenarios

1. AI is risk-paused; client and dietitian continue on WhatsApp; every message is stored with the correct actor; dietitian turns AI active; risk resolves and AI continues with trusted historical context.
2. Dietitian manually pauses AI before a WhatsApp conversation; the transcript is complete; resume closes only the manual session and does not create a false clinical-resolution event.
3. Dietitian forgets to pause AI; the first verified Business App echo atomically pauses AI and prevents a stale AI send.
4. A shared Business App account proves a business human but does not fabricate an individual dietitian author.
5. A dietitian instruction remains available after eight later messages; a generic greeting cannot satisfy answerability.
6. A newer WhatsApp instruction conflicts with the old menu/plan; WhatsApp temporarily wins and a non-risk structured-update notification is created.
7. Off-channel context-only information is proposed and applied after confirmation; structured changes remain blocked until the dashboard record revision changes.
8. Unknown/ambiguous actor, unsupported media, malformed event, revoked identity, cross-tenant collision, and replay remain fail-closed.
9. Edit/revoke invalidates stale prompt and outbound evidence.
10. Concurrent new red inbound prevents an outdated reactivation or client-facing send.

## 15. Problem-To-Track Traceability

| Problem | Closure track |
| --- | --- |
| Actor is unknown or same chat is mistaken for actor proof | P85-IF-A/B/C/D |
| Business App echo path is missing | P85-IF-C/D |
| Business account does not prove an individual dietitian | P85-IF-B/D |
| Tenant/client/counterparty routing is incomplete | P85-IF-B/C |
| Full database transcript is not full AI memory | P85-IF-E |
| Last-eight history loses older dietitian instructions | P85-IF-E |
| Unrelated dietitian message unlocks answerability | P85-IF-E |
| Human and AI can race or answer together | P85-IF-D/F |
| Notification/read/response/resolution semantics are conflated | P85-IF-F/H |
| Quarantine is terminal or unreplayable | P85-IF-C/I |
| Provider/event/message ledger is incomplete | P85-IF-B/C/I |
| Off-channel information can target the wrong client | P85-IF-G |
| Structured changes are applied without panel ownership | P85-IF-G |
| Data copies escape export/redaction/RLS coverage | P85-IF-I |

## 16. Program Definition Of Done

P85-IF closes only when:

- P85-IF-A through P85-IF-I are implemented and committed independently;
- no known actor/provenance branch silently defaults to client or dietitian;
- complete transcript persistence and historical retrieval are test-proven;
- risk resolution is tied to authenticated AI reactivation;
- human/AI concurrency is fail-closed at send time;
- off-channel intake is client-safe, reviewable, and unable to mutate structured panels;
- Stage 4B receives stable alert/notification contracts without P85-IF consuming its full UI scope;
- export/redaction/RLS/replay/operational evidence cover all new records;
- full verification is green except explicitly documented local Supabase skips;
- R-405 remains open unless independently remediated or accepted;
- current local Supabase evidence must be explicit when claimed;
- production pilot remains `NO-GO`;
- real providers, real channels, and real health data remain disabled.

## 17. P85-IF Remediation Post-Closure Audit - 2026-07-11

The six-step P85-IF remediation plan was re-audited after R1-R6 closure. The audit found gaps in R1 message-provenance tenant-composite integrity, R2 structured baseline/resolution authority, R3 activation/inbound lock ordering, R6 runtime export leak enforcement, and remediation traceability. R4 and R5 were reviewed with no new code findings.

Post-closure fixes are complete:

- R1: append-only message provenance and actor-binding tenant-composite migration.
- R2: real app-state structured baselines plus target-panel-specific structured notification resolution.
- R3: deterministic client-before-conversation lock ordering for expected conversation revision checks.
- R6: client export leak detection wired into the real export path.
- Traceability: dedicated post-closure evidence documents for R1, R2, R3, and the overall audit.

Verification passed targeted app/core tests, local Supabase reset, local RLS 30/30, lint, build, full app 828 passed / 4 skipped, core 234/234, channel replay, and unified production-scale rehearsal. This updates the P85-IF closure baseline without approving production pilot, closing R-405, or opening real provider/channel/health-data paths. Stage 4B planning is complete and implementation is next.

## 18. Stage 4A Post-P85-IF Compatibility Remediation - 2026-07-11

P85-IF remains closed. A separate compatibility remediation was completed because Stage 4A was implemented before P85-IF and R1-R6 post-closure changes. The remediation aligns Stage 4A UI operations with the P85-IF contracts:

- AI activation uses the atomic activation endpoint with expected conversation/client context revisions.
- Direct active-state client PATCH remains blocked by backend contracts; passive-state patch remains allowed.
- Human takeover release uses the dedicated release endpoint and exposes active session evidence.
- Structured context-intake impact flags display readable target-panel labels and navigation.
- Structured-update notifications expose minimal target-panel navigation and target-revision resolution.

Evidence: `docs/PHASE_85_STAGE_4A_POST_IF_REMEDIATION_EVIDENCE.md`. Full Stage 4B notification product work remains next; no real provider/channel/health-data path was opened.

## Stage 4B Consumer Contract - 2026-07-11

Stage 4B now has an approved implementation plan at `docs/PHASE_85_STAGE_4B_UYARI_VE_BILDIRIMLER_ACTION_PLAN.md`. It consumes P85-IF records without reopening P85-IF: active yellow/red lifecycle state becomes the Uyarilar projection; provenance-safe source IDs become access-checked conversation targets; structured retrieval, unsupported media, verified-human pause, delivery, permission, draft invalidation, and integrity events become typed system notifications. Trust/quarantine internals stay outside dietitian surfaces.

Red reactivation remains the P85-IF-F/R3 atomic activation transition. Stage 4B must not add an independent handoff resolution path or weaken non-green send blocking.

## Stage 4B Consumer Remediation Reconciliation - 2026-07-12

Stage 4B has consumed the P85-IF contracts through bounded actor-aware Supabase resources, provenance-safe target linkage, lifecycle-aware draft invalidation, atomic unsupported-media review, and role-scoped receipt mutations. The remediation does not reopen the P85-IF track or any real provider/channel path. Evidence: `docs/PHASE_85_STAGE_4B_POST_CLOSURE_REMEDIATION_EVIDENCE.md`. Stage 4B-2 Mesajlasma is next; Stage 4C remains blocked.

## Stage 4B-2 Consumer Phase 0 Lock - 2026-07-12

Stage 4B-2 now has a decision-complete consumer plan at `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_ACTION_PLAN.md`. It consumes P85-IF transcript, provenance, conversation revision, human-control, risk-reactivation, retrieval, lifecycle, and RLS authority without reopening P85-IF. The messaging read receipt is a new per-actor UI-state contract; assistant may advance only its own assigned-conversation receipt, while assistant remains unable to perform domain mutations.

The yellow reviewed-manual command must preserve non-green AI draft blocking, and red manual reply must preserve the atomic activation-only closure rule. Phase 0 changes no P85-IF runtime or migration.

## Stage 4B-2 Consumer Phase 4 Handoff - 2026-07-12

Phase 4 added actor-aware conversation read APIs and bounded Supabase projection RPCs without reopening P85-IF provider/channel paths or adding dashboard UI or message mutations. Evidence: `docs/PHASE_85_STAGE_4B_2_PHASE_4_READ_APIS_EVIDENCE.md`. Phase 5 manual/yellow/draft mutations are next.

## Stage 4B-2 Consumer Phase 3 Handoff - 2026-07-12

Phase 3 added server-independent bounded list/detail transcript projection for fallback and Supabase-shaped sources, inbox unread badge formatting, scale fixtures, and fallback store helpers without reopening P85-IF provider/channel paths or adding messaging read APIs/UI. Evidence: `docs/PHASE_85_STAGE_4B_2_PHASE_3_BOUNDED_PROJECTION_EVIDENCE.md`. Phase 4 actor-aware read APIs are next.

## Stage 4B-2 Consumer Phase 2 Handoff - 2026-07-12

Phase 2 added durable per-actor conversation read receipts, deterministic sequence backfill, monotonic mark-read RPC/RLS, lifecycle receipt cleanup, and Supabase store wiring without reopening P85-IF provider/channel paths or adding messaging read APIs/UI. Evidence: `docs/PHASE_85_STAGE_4B_2_PHASE_2_RECEIPT_PERSISTENCE_RLS_EVIDENCE.md`. Phase 3 bounded projection is next.

## Stage 4B-2 Consumer Phase 1 Handoff - 2026-07-12

Phase 1 implemented only the consumer-side domain foundation: assignment access-level types, bounded DTOs, actor-aware permissions, safe preview/message projection, sequence unread calculation, and versioned cursors. It did not reopen or modify P85-IF persistence, lifecycle, provider/channel, or health-data paths. Evidence: `docs/PHASE_85_STAGE_4B_2_PHASE_1_DOMAIN_DTO_AUTHORIZATION_EVIDENCE.md`. Phase 2 receipt persistence/RLS is next.
## Stage 4B-2 Post-Closure Remediation R0 - 2026-07-12

P85-IF remains authoritative and is not reopened. Stage 4B-2 audit remediation must preserve provenance, conversation revision, human-control, red/yellow, lifecycle, export, and RLS contracts. The active remediation plan is `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_ACTION_PLAN.md`; Stage 4C remains blocked.
## Stage 4B-2 Post-Closure Remediation R1 - 2026-07-12

R1 completed the application contract correction for Stage 4B-2 messaging. It does not alter P85-IF authority, real provider/channel shutdowns, production `NO-GO`, or R-405. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R1_EVIDENCE.md`; next remediation unit: R2.

## Stage 4B-2 Post-Closure Remediation R2 - 2026-07-12

R2 keeps P85-IF as the authority for transcript/provenance and adds only bounded Supabase projection and receipt guards for the Stage 4B-2 consumer. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R2_EVIDENCE.md`; next remediation unit: R3.
## Stage 4B-2 Post-Closure Remediation R3 - 2026-07-12

R3 preserves P85-IF conversation revision, risk, human-control, provenance, and lifecycle authority while moving messaging manual/draft idempotency and authorization into one transaction-scoped RPC boundary. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R3_EVIDENCE.md`.
## Stage 4B-2 Post-Closure Remediation R4 - 2026-07-12

R4 preserves P85-IF as the clinical/provenance authority. It changes only client-side messaging route resolution, bounded hook consumption, unread presentation, and responsive rendering. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R4_EVIDENCE.md`.
## Stage 4B-2 Post-Closure Remediation R5 - 2026-07-13

R5 preserves P85-IF clinical, provenance, lifecycle, and human-control authority. It adds evidence harnesses and tests around the messaging consumer without opening a new runtime authority or integration path. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R5_EVIDENCE.md`.

## Stage 4B-2 Post-Closure Remediation R6 - 2026-07-13

R6 preserves P85-IF clinical, provenance, lifecycle, and human-control authority. It independently verifies the application/runtime evidence, but does not substitute application tests for the blocked real Supabase/RLS role matrix or SQL EXPLAIN evidence. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R6_EVIDENCE.md`.

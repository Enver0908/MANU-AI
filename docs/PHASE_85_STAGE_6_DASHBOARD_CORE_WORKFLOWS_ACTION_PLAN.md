# Phase 85 Stage 6 Dashboard Core Workflows Action Plan

Date: 2026-08-19

Status: **PHASE 3 COMPLETE; R1-R3 REMEDIATION COMPLETE LOCALLY; PHASE 4 NOT STARTED**

Production status: **NO-GO**

## 1. Authority And Objective

This document is the canonical execution plan for Stage 6 Dashboard Core Workflows. Stage 5 is closed by `docs/PHASE_85_STAGE_5_CLOSURE_DECISION.json` with `stageStatus=STAGE_5_CLOSED` and zero blockers. Stage 6 consumes the closed Stage 5 shell contracts; it does not reopen shell architecture, production rollout, provider/channel egress, live billing, offline mutation, or real health-data paths.

The primary user is a dietitian. The primary surface is the installed mobile PWA, while the existing productive desktop layout remains supported. Selecting a client means making that client active and opening that client's workspace. Every client switch must pass through the existing central dirty-state guard.

Implementation is divided into five phases. Only one phase may be implemented at a time. Before each implementation phase, the exact scope and concrete changes must be presented to the user and explicitly approved. Commit, push, merge, PR, deployment, production-gate changes, and the next phase each require separate explicit instructions.

Post-Phase 3 R1 remediation (2026-08-19): Stage 6 Supabase-backed dashboard mutations now use durable tenant/request-scoped idempotency reservation and bounded response replay via `stage_6_mutation_idempotency`. Evidence: `docs/PHASE_85_STAGE_6_R1_DATA_INTEGRITY_BOUNDED_PERSISTENCE_EVIDENCE.md`. Stage 6 Phase 4 remains not started; production remains `NO-GO`.

Post-Phase 3 R2 remediation (2026-08-19): workspace reads are keyed by tenant/client/domain, URL is the sole viewed-client/task authority, bounded form reads drive the form editor, and all touched client editors expose awaited saving/error/conflict/dirty state. Menu plan switching and pending text cannot silently discard work. Evidence: `docs/PHASE_85_STAGE_6_R2_WORKSPACE_STATE_CONFLICT_DIRTY_NAVIGATION_EVIDENCE.md`. Stage 6 Phase 4 remains not started; production remains `NO-GO`.

Post-Phase 3 R3 remediation (2026-08-20): alerts/notifications inbox requests are resource- and filter-owned, latest-request-wins, abortable, mutation-invalidated, and duplicate-free across pagination. Clean local Supabase reset and RLS 56/56 with zero skipped prove the retained route/persistence isolation boundary. Evidence: `docs/PHASE_85_STAGE_6_R3_INBOX_CONCURRENCY_SECURITY_CLOSURE_EVIDENCE.md`. R1-R3 remediation is complete locally; Stage 6 Phase 4 remains not started and requires separate approval.

Phase 4 execution note (2026-08-20): automated bounded-flow, concurrency, RLS, build, dependency, shell, and strict local-lab performance gates passed, but Stage 6 is not closed. The new desktop/mobile axe gate found blocking accessibility defects in forms, nutrition, menu, and client AI controls, and no post-Stage-6 physical iPhone/Android browser/PWA evidence exists. Evidence: `docs/PHASE_85_STAGE_6_PHASE_4_INTEGRATION_CLOSURE_EVIDENCE.md`.

## 2. Locked Scope

Included:

- Dashboard home, client list, active-client workspace, forms, nutrition/food-rule profile, menu plans, client-scoped AI controls, messaging, alerts, notifications, and More navigation.
- Mobile and desktop interaction models over the same domain contracts.
- Tenant/account/actor/membership/capability enforcement at route and persistence boundaries.
- Bounded reads, atomic and idempotent mutations, expected-revision conflict control, stale-response protection, and metadata-only audit evidence.
- Turkish-first accessible UI, Stage 5 performance baseline preservation, and physical-device closure evidence.

Excluded:

- Stage 5 shell redesign, service-worker strategy changes, offline editing, persistent draft caches, or mutation queues.
- Real WhatsApp/Telegram/provider egress, external LLM activation, live billing, production schema rollout, deployment, and real client health data.
- Production readiness status changes. Production remains `NO-GO` unless separately authorized and independently proven.

## 3. Architectural Invariants

### 3.1 State ownership

| State | Canonical owner | Rule |
| --- | --- | --- |
| Session, shell bootstrap, offline/update state, active client, destination navigation, dirty-state coordination | Stage 5 `ShellProvider` and shell libraries | Stage 6 consumes public shell APIs and does not duplicate this state. |
| Shareable route selection, list filters, conversation/client identifiers, workspace task | URL state | Back/forward and deep links must remain deterministic. Sensitive draft content is never placed in the URL. |
| Persisted client/domain data | Bounded server APIs and persistence layer | UI success follows server acknowledgement; no optimistic clinical overwrite. |
| Unsaved editor values | Local component memory | Every editor registers `clean`, `dirty`, `saving`, or `error` with the central dirty registry. No local/session storage. |
| Transitional legacy hydration | `useManuState` and `/api/app-state` | Retained only for compatibility while bounded contracts replace mutation-triggered full refreshes. No new feature may deepen dependency on the broad snapshot. |

### 3.2 Active-client contract

1. Selecting a client from the list requests a shell active-client transition.
2. The shell dirty registry evaluates all mounted editors before the active client or route changes.
3. `saving` blocks switching. `dirty` or `error` opens the existing Stay / Discard / Save and continue flow.
4. After acceptance, shell preferences persist `activeClientId` with revision protection, URL state is updated, and the client workspace opens.
5. Opening a client-linked conversation, alert, or notification uses the same transition path; it may not silently replace active context.
6. General AI Chat under More starts unscoped and may bind a client only after explicit selection inside that workflow.

### 3.3 Security and data boundary

- Every route resolves the authenticated tenant context and checks the required capability before reading or mutating data.
- Persistence/RPC functions re-check tenant ownership, actor membership, assignment access, lifecycle state, and referenced record ownership.
- Service-role access may execute a bounded persistence operation but may never substitute for end-user authorization.
- Mutations carry a request/idempotency identifier and expected revision where concurrent editing is possible.
- Audit output contains identifiers, action type, result, revision, and timestamps only. Raw prompts, message/file content, health details, secrets, and free-text form answers are excluded from logs and evidence.
- Supabase is the security authority. Fallback mode is limited to local development and visual/test workflows and must implement the same public API shapes and error semantics.

### 3.4 Network and failure behavior

- API and protected application traffic remains network-only and fail-closed.
- Offline state keeps sensitive protected content unmounted according to the Stage 5 shell contract.
- Drafts may remain only in current component memory. Reconnect does not auto-submit.
- `401` locks the session and clears/unmounts protected domain state. `403` shows capability denial without leaking existence. Missing or cross-tenant resources resolve through the existing non-disclosing error contract.
- `409` revision conflict preserves the local draft, displays a conflict state, and requires an explicit reload/reapply decision; it never silently overwrites server state.
- Late responses are ignored using request sequence or `AbortController` ownership keyed by client/task/filter.

## 4. Canonical Data Flow

```text
Dietitian action
  -> Stage 5 navigation/active-client/dirty guard
  -> URL identifies destination + client + task
  -> bounded route resolves authenticated tenant context
  -> capability + actor/membership/assignment validation
  -> tenant-scoped persistence/RPC with revision/idempotency checks
  -> bounded response DTO
  -> local domain cache/component state merge
  -> metadata-only audit and accessible UI status
```

`/api/app-state` remains a compatibility hydration path. A successful Stage 6 mutation updates only the affected bounded domain state and counters; it must not trigger a broad application-state refresh unless a documented legacy dependency cannot yet be detached in the current phase.

## 5. Phase Sequence

## Phase 0 - Read Gate And Canonical Plan

### Purpose

Freeze the current architecture, risks, approved product decisions, phase boundaries, and verification gates before runtime implementation begins.

### Scope

- Read and reconcile the authority documents, Stage 5 closure evidence, dashboard code, APIs, persistence, migrations, and relevant tests.
- Record the current workflow/data map, mobile/desktop boundaries, gaps, and Stage 5 non-regression boundary.
- Create only this action plan and `docs/PHASE_85_STAGE_6_PHASE_0_READ_GATE_EVIDENCE.md`.

### Preconditions

- Expected branch, upstream, HEAD, remote refs, ahead count, and clean working tree are verified.
- Stage 5 canonical status is `STAGE_5_CLOSED`; production remains `NO-GO`.
- User-approved Stage 6 decisions listed in this plan are available.

### Affected files

- `docs/PHASE_85_STAGE_6_DASHBOARD_CORE_WORKFLOWS_ACTION_PLAN.md` (new)
- `docs/PHASE_85_STAGE_6_PHASE_0_READ_GATE_EVIDENCE.md` (new)

No runtime, UI, API, migration, package, test, or continuity document changes are allowed in Phase 0.

### Architectural decisions

- Phase 0 is evidence and planning only. It cannot alter a runtime contract or claim an application verification result.
- Current Git/code behavior outranks planning prose; contradictions are resolved by the authority order recorded in the read-gate evidence.
- Every confirmed gap is assigned to one later phase; Phase 0 cannot hide an unresolved choice behind implementation wording.

### Implementation steps and technical methods

1. Verify Git state and remote refs with the exact commands recorded in the Phase 0 evidence.
2. Use `rg --files` and `rg` to map route, component, hook, API, persistence, migration, RLS, and test ownership.
3. Reconcile contradictions using the documented authority order; classify older blocked/open statements as historical snapshots.
4. Map each dashboard workflow from user action through shell, URL, API, persistence, response merge, and audit behavior.
5. Record concrete gaps and assign each gap to exactly one later phase.
6. Run documentation-only consistency and Git checks.

### Data flow

Repository and document evidence -> architecture/workflow map -> gap/risk matrix -> locked five-phase plan -> user review. No runtime data is read from or written to production systems.

### Dependencies

- Verified local Git state and remote references.
- Canonical Stage 5 closure artifacts and current working code.
- User-approved product, active-client, mobile/desktop, security, and phase-governance decisions.

### Errors and edge cases

- Any unexpected branch, upstream, remote ref, real content diff, staged change, or user modification stops Phase 0 editing.
- Line-ending/stat-only Git anomalies must be proven content-identical before index metadata is refreshed; worktree files must not be overwritten merely to clean status.

### Tests and validation

- `git diff --check`
- Forbidden future-phase naming scan
- Stage 5 status contradiction scan in the two new documents
- Secret/sensitive-data pattern scan limited to the two new documents
- `git status --short --branch`

Application tests, typecheck, lint, build, RLS, and visual suites are not run because Phase 0 changes documentation only.

### Completion criteria

- Both canonical Stage 6 documents exist and agree.
- Every identified gap has a phase owner.
- No Stage 5 shell responsibility is reopened.
- No runtime file changed.
- User reviews Phase 0 results and separately approves any commit and Phase 1 start.

## Phase 1 - Client Domain Bounded Contracts

### Purpose

Provide bounded, tenant-safe, concurrency-safe contracts for the client workspace so later UI phases do not depend on broad `/api/app-state` mutation refreshes.

### Scope

- Client roster/detail reads and client update mutations.
- Client forms/schema/response reads and saves.
- Food-rule/nutrition profile reads and revision-protected saves.
- Menu-plan list/detail/create/save/activate/export contracts.
- Client context update reads and writes.
- Client-scoped AI status/control reads and approved mutations.
- Shared DTO, pagination, error, idempotency, revision, and merge semantics.

Messaging, alerts, notifications, and visual restructuring are excluded except where tests prove contract compatibility.

### Preconditions

- Phase 0 is approved and committed if the user authorizes a commit.
- Existing migration/RPC and RLS ownership is mapped.
- No production integration is enabled.

### Affected components and files

- Existing routes under `app/src/app/api/clients/**` and `app/src/app/api/app-state/route.ts`.
- Existing AI-control routes under `app/src/app/api/clients/[id]/**` and, only for client-scoped read coordination, existing `app/src/app/api/ai-chat/**` contracts.
- `app/src/lib/types.ts`, `app/src/lib/supabase-store.ts`, `app/src/lib/app-state-store.ts`, `app/src/lib/dashboard-server-auth.ts`, and existing tenant/capability helpers.
- New contract module: `app/src/lib/phase-85-stage-6-dashboard-contracts.ts`.
- New client data hook: `app/src/lib/use-stage-6-client-workspace.ts`.
- Targeted tests: `app/src/lib/phase-85-stage-6-dashboard-contracts.test.ts`, `app/src/lib/phase-85-stage-6-client-workspace.test.ts`, and route/persistence tests colocated with existing Stage 4B/5 conventions.
- Append-only migrations under `app/supabase/migrations/**` only if an existing atomicity/RLS/index requirement cannot be met by current schema.
- Evidence: `docs/PHASE_85_STAGE_6_PHASE_1_CLIENT_DOMAIN_CONTRACTS_EVIDENCE.md`.

### Locked architectural decisions

- Add `GET` behavior to existing client resources where ownership already exists; create a new route only when no current resource can express the bounded domain without mixing responsibilities.
- Roster reads use `query`, opaque `cursor`, and clamped `limit`; client detail uses a single client identifier and returns only workspace summary fields.
- Forms are client-scoped. Schema metadata and response data are separate DTO fields so a schema revision cannot be confused with a response revision.
- Food-rule profile and menu-plan writes require the current numeric revision. Create operations require a request ID. Activation is an atomic server operation.
- Context updates are cursor-paginated and ordered deterministically by occurrence time plus identifier.
- Client AI control requires client and conversation/context revisions already used by the existing activation contract. General AI Chat remains separate and unscoped by default.
- `useManuState` remains a compatibility coordinator; the new hook owns bounded request status, abort/sequence control, and affected-record merges without introducing a global state library.

### Canonical endpoint contract

| Method and path | Phase 1 decision |
| --- | --- |
| `GET /api/clients?query=&cursor=&limit=` | Add bounded active roster read; opaque cursor, deterministic order, clamped limit, no removed/anonymized clients. |
| `POST /api/clients` | Retain path; add request ID/idempotency handling and return only created client plus linked conversation summary. |
| `GET /api/clients/[id]` | Add bounded workspace summary read, including revisions, capabilities, lifecycle, supported counts, and client AI-control summary. |
| `PATCH /api/clients/[id]` | Retain path; accept an allow-listed patch envelope with `requestId` and `expectedRevision`; reject direct AI activation as today. |
| `GET /api/clients/[id]/forms` | Add canonical client form read returning active schema metadata, response values, schema revision, and response revision. |
| `PUT /api/clients/[id]/forms/[schemaId]` | Add canonical revision/idempotency-protected response save. Keep `POST /api/clients/forms` as a compatibility adapter to the same service until its remaining consumers are removed. |
| `GET/PUT /api/clients/[id]/food-rule-profile` | Retain paths; normalize DTO/error envelope and require request ID plus current revision on `PUT`. |
| `GET/POST /api/clients/[id]/menu-plans` | Retain paths; make list bounded and add request ID to create. |
| `PUT /api/clients/[id]/menu-plans/[planId]` | Retain revision-protected save; add request ID. |
| `POST /api/clients/[id]/menu-plans/[planId]/activate` | Retain path; require request ID and expected plan revision; activate atomically. |
| `GET/POST /api/clients/[id]/context-updates` | Add bounded cursor GET; retain POST with request ID and authoritative created-record response. |
| `POST /api/clients/[id]/activate-ai` and `POST /api/clients/[id]/release-takeover` | Retain dedicated controls; normalize response merge and idempotency while preserving existing revision/safety gates. |

No Stage 6 client-workspace read may be added to `/api/shell/bootstrap`, and no new broad dashboard aggregator route is created.

### Implementation steps

1. Define DTOs, query parsers, mutation envelopes, error codes, page metadata, and revision fields in `phase-85-stage-6-dashboard-contracts.ts`.
2. Add/complete bounded GET handlers for roster, client detail, forms, food-rule profile, menu plans, and context updates using the current route hierarchy.
3. Normalize mutation responses to return the changed record, resulting revision, and only counters/summaries proven affected.
4. Apply `resolveAppTenantContext` and `requireCapability` at every route; pass the resolved context to persistence.
5. At persistence/RPC boundaries, verify tenant, actor/membership, assignment, client lifecycle, referenced-resource ownership, revision, and idempotency.
6. Reuse existing transactional RPCs. If a missing atomic operation is proven, add one append-only migration with grants restricted to the intended execution role and RLS tests for allow/deny paths.
7. Implement the bounded hook with one request owner per client/domain key, abort on key change/unmount, stale response rejection, and explicit idle/loading/success/empty/error/conflict states.
8. Keep `/api/app-state` response compatibility, but remove no consumer in this phase unless targeted tests prove equivalence.

### Technical methods

- Parse all query/body inputs with one explicit schema per route and map domain failures to the existing controlled HTTP error contract.
- Use cursor helpers already established by bounded read contracts; never use unbounded array return for roster, context history, or plan history.
- Reuse current scoped merge helpers and transactional Supabase functions; add append-only SQL only for a demonstrated missing atomic or RLS guarantee.
- Generate request IDs at the UI command boundary and retain them for retries of the same user action.
- Key abort/sequence state by `tenantId:clientId:domain`; a response may update UI only when its key and sequence still match.

### Data flow

Roster hydration loads a bounded page. Client selection remains a shell action. Once active, the workspace hook requests client summary and only the selected domain. Mutations send request ID plus expected revision, persistence commits atomically, and the response replaces only the corresponding client/domain record.

### Dependencies

- Stage 5 shell active-client and session contracts.
- Existing tenant context, capability map, Supabase store, fallback store, transactional RPCs, RLS policies, and read-contract helpers.

### Errors and edge cases

- Removed/anonymized client, revoked assignment, wrong tenant/account, stale membership, disabled capability, invalid cursor, duplicate request, stale revision, deleted related record, two-tab concurrent edit, late previous-client response, network loss during save, session expiry, and fallback/Supabase shape drift.
- Duplicate idempotent requests return the original committed result or the established deterministic duplicate response; they do not create a second mutation.
- Cross-tenant identifiers must not disclose record existence.

### Tests

- DTO/parser unit tests, pagination boundaries, malformed input, revision and idempotency tests.
- Route tests for `401`, `403`, non-disclosing not-found, `409`, and success.
- Persistence/RPC tests for tenant/account/actor/membership/assignment/capability/lifecycle checks.
- Cross-tenant/cross-account RLS tests and fallback/Supabase conformance tests.
- Targeted integration tests proving mutation responses update bounded state without broad refresh.
- `npm run typecheck`, `npm run lint`, `npm run build`, relevant `npm run test` targets.
- If schema/RLS changes: clean Supabase reset and `npm run test:rls` with zero skipped.
- `git diff --check`, secret/sensitive scan, cross-tenant reference scan, and Git status.

### Completion criteria

- Every Phase 2 client workspace domain has a bounded read and mutation contract.
- All mutation paths are atomic/idempotent and revision-controlled where concurrent updates are possible.
- Route and persistence authorization both pass deny-path tests.
- No mutation requires a full `/api/app-state` refresh for its own authoritative result.
- Stage 5 shell, network-only behavior, production `NO-GO`, and closed integrations remain unchanged.

## Phase 2 - Dashboard Home And Client Workspace

### Purpose

Deliver the dietitian's daily client workflow with a mobile-first task hub and a productive desktop list/detail layout over Phase 1 contracts.

### Scope

- Operational dashboard home.
- Searchable/paginated client list and active-client transition.
- Client summary workspace and tasks: overview, forms, nutrition, menu plan, AI controls.
- Dirty/saving/conflict handling for every editable task.
- Responsive, accessible mobile and desktop behavior.

Messaging, alerts, and notifications remain functionally unchanged until Phase 3.

### Preconditions

- Phase 1 bounded contracts and authorization tests pass.
- Current Stage 5 mobile routes, safe areas, privacy lock, and performance baseline are recorded.
- Before UI implementation, current professional mobile health/SaaS ergonomics are researched from authoritative platform/accessibility sources; findings may refine interaction details but may not change locked security/data boundaries.

### Affected components and files

- `app/src/components/dashboard-app.tsx`, `overview-panel.tsx`, `clients-panel.tsx`, `active-client-control.tsx`, `client-status-strip.tsx`.
- `forms-panel.tsx`, `client-form-panel.tsx`, `active-nutrition-plan-panel.tsx`, `menu-workflow-panel.tsx`, `menu-workflow-export-section.tsx`, `ai-assistant-control-panel.tsx`.
- `dashboard-navigation.tsx`, `shared.tsx`, `state-primitives.tsx`, `mobile-ergonomics.tsx`, and `app/src/lib/use-dashboard-url.ts`.
- New components: `client-workspace.tsx`, `client-task-hub.tsx`, and `client-workspace-header.tsx` under `app/src/components/dashboard/`.
- Phase 1 hook/contracts and existing shell provider/dirty registration APIs.
- Visual/accessibility tests under the existing Playwright structure.
- Evidence: `docs/PHASE_85_STAGE_6_PHASE_2_CLIENT_WORKSPACE_EVIDENCE.md`.

### Locked architectural and interaction decisions

- Tapping/clicking a client makes that client active and opens the workspace after the shell dirty guard succeeds.
- Mobile: client list -> client task hub -> full-width task. Back returns task -> hub -> list. No desktop detail pane is squeezed into mobile.
- Desktop: stable roster/list region plus client workspace detail; existing efficient desktop density is preserved.
- Home shows active client, pending message/alert/notification counts supported by current contracts, and direct actions. No invented KPI or new broad aggregation endpoint.
- URL records selected section/client/task/filter. Unsaved values remain component-local.
- All editors register with the central dirty registry and expose save/discard/focus-error callbacks.
- Forms, nutrition, menu, and AI controls load lazily when their task is opened. Heavy panels do not enter the initial mobile bundle without need.

### Implementation steps

1. Extend dashboard URL parsing/building with a typed client workspace task value while preserving existing deep links.
2. Split client workflow orchestration out of `DashboardApp` into the three named workspace components; keep `DashboardApp` as transitional composition and compatibility coordinator.
3. Wire roster selection to the shell active-client request and only navigate after the transition resolves successfully.
4. Implement the mobile list/hub/task stack and desktop list/detail layout using existing design tokens and shell dimensions.
5. Build the home operational summary from shell bootstrap and existing bounded inbox/messaging data; each action navigates through shell APIs.
6. Convert forms, nutrition, menu, and AI panels to Phase 1 hooks and bounded mutation merges.
7. Register every editor's state and callbacks with `useShellDirtyRegistration`; block client/task/navigation changes while saving.
8. Add explicit loading, empty, denied, offline, session-locked, mutation-error, and revision-conflict UI using existing state primitives.
9. Remove touched legacy nested-card and stone/emerald styling where it conflicts with the canonical design system; do not redesign unrelated Stage 5 shell surfaces.
10. Add keyboard/focus restoration, touch-target, safe-area, large-text, reduced-motion, and live-status behavior.

### Technical methods

- Use the existing shell provider and URL helpers as the only navigation entry points; do not call router APIs directly from domain editors.
- Use CSS grid/media queries and existing tokens for desktop list/detail and mobile stack layouts; do not infer layout from JavaScript viewport width.
- Dynamically import heavy task panels where they are not needed for initial route render.
- Use `aria-live` status primitives for save/error/conflict outcomes and restore focus to the triggering client/task control on back navigation.
- Keep drafts in React state and expose save/discard/focus-error callbacks through `useShellDirtyRegistration`.

### Data flow

The shell supplies the effective active client. URL selects the current workspace task. The task component calls only its bounded Phase 1 loader. A save sends the local draft with expected revision/request ID, keeps the editor in `saving`, merges the acknowledged response, then marks the editor `clean`.

### Dependencies

- Phase 1 contracts/hook.
- Stage 5 shell provider, dirty registry, navigation, active-client preference, and PWA network/privacy behavior.
- Existing Phase 85 design tokens and dashboard state primitives.

### Errors and edge cases

- No clients, no active client, removed active client, client disappearing between list and detail, rapid client switching, back/forward during save, deep link to inaccessible client/task, stale request response, unsaved data, save failure, revision conflict, capability loss, session expiry, offline transition, long Turkish labels, 200% text, mobile keyboard, rotation, and installed-PWA safe areas.

### Tests

- Unit tests for URL/task parsing, active-client transition ordering, reducer/state merges, and dirty-state registration.
- Component/integration tests for select -> activate -> workspace, task navigation, save/conflict/error, and capability-hidden/denied states.
- Playwright desktop and mobile viewports for home, roster, task hub, every task, empty/error/offline/dirty/conflict states.
- Accessibility checks targeting WCAG 2.2 AA, keyboard-only desktop, focus restoration, status announcements, and touch targets.
- `npm run typecheck`, `npm run lint`, `npm run build`, targeted/full tests proportional to changes, `git diff --check`, scans, and Git status.

### Completion criteria

- A dietitian can move client-to-client without manual context management or silent draft loss.
- All five client tasks work on mobile and desktop over bounded contracts.
- No touched mutation performs broad app-state refresh.
- Mobile navigation, keyboard, safe areas, accessibility, and responsive screenshots pass.
- Stage 5 shell contracts and performance thresholds are preserved.

## Phase 3 - Communication And Operational Workflows

### Purpose

Unify messaging, alerts, and notifications with active-client context and the Phase 2 workspace while retaining their mature bounded APIs and closed real egress.

### Scope

- Conversation list/detail, read receipts, manual replies, draft review, alerts, notifications, and client-linked navigation.
- Operational counters and post-mutation refresh limited to affected surfaces.
- Mobile list/detail ergonomics and desktop communication workspace integration.

Provider/channel activation, new delivery channels, new clinical automation, and Stage 4B media pipeline redesign are excluded.

### Preconditions

- Phase 2 workspace and active-client transition behavior pass.
- Existing Stage 4B/4B-2 messaging, alert, notification, media, and audit contracts remain authoritative.

### Affected components and files

- `messaging-panel.tsx`, conversation components, `alerts-panel.tsx`, `notifications-panel.tsx`, `stage-4b-list-row.tsx`, and relevant `DashboardApp` orchestration.
- `app/src/lib/use-stage-4b-inbox.ts`, `use-stage-4b2-messaging.ts`, Stage 4B routing/integration/contract modules, and Phase 2 workspace coordination.
- Existing routes under `app/src/app/api/conversations/**`, `messages/**`, `alerts/**`, and `notifications/**`.
- Persistence changes only when a proven authorization/atomicity gap exists; append-only migration rule applies.
- Evidence: `docs/PHASE_85_STAGE_6_PHASE_3_COMMUNICATION_OPERATIONS_EVIDENCE.md`.

### Locked architectural decisions

- Opening any client-linked communication item requests active-client transition first. Dirty-state refusal leaves both current client and route unchanged.
- Existing bounded list/detail APIs remain; no new broad communication snapshot is introduced.
- Manual send remains the established mock/closed delivery behavior. No real provider egress is enabled.
- Post-mutation refresh updates only conversation detail/list, inbox counts, alerts, or notifications proven affected.
- General system notifications without a client open their defined destination without inventing client context.

### Implementation steps

1. Introduce one typed navigation coordinator in the existing Stage 4B routing module for conversation/alert/notification targets.
2. Resolve and validate the linked client before route change; invoke shell active-client transition and honor dirty outcomes.
3. Preserve conversation filters, cursor, anchor message, and list/detail back behavior in URL state.
4. Integrate client workspace shortcuts to messaging and communication shortcuts back to the client task hub/detail.
5. Replace remaining broad refresh calls with the existing `refreshStage4B2OperationalSurfaces` bounded refresh set or a narrower explicit merge.
6. Keep manual reply/draft mutations server-acknowledged, idempotent, capability-checked, and audit-safe.
7. Complete mobile keyboard/sticky composer/focus behavior and desktop list/detail state without changing Stage 4B media semantics.
8. Add denied, stale target, removed client, empty, retry, offline, and session-lock states.

### Technical methods

- Extend the existing typed Stage 4B route builders instead of constructing query strings in components.
- Await the shell active-client transition result before committing URL navigation.
- Reuse current cursor/message anchor hooks and abort stale requests when conversation/filter/client keys change.
- Merge returned receipt/message/notification records by stable identifier and revision; refresh only explicitly listed affected surfaces.
- Preserve the established mock/disabled provider adapters and metadata-only audit event writers.

### Data flow

An item supplies a validated destination plus optional client/conversation/message identifiers. The navigation coordinator requests active-client change, then commits URL navigation. Existing bounded hooks load list/detail. Mutations return authoritative records and trigger only the affected bounded merges/refreshes.

### Dependencies

- Phase 2 active-client/workspace behavior.
- Existing Stage 4B and Stage 4B-2 contracts, scheduler, read receipt, messaging integration, alert, notification, media, and authorization modules.

### Errors and edge cases

- Clientless notification, deleted conversation, removed client, cross-tenant link, stale anchor message, rapid item selection, unread counter races, duplicate send/review, draft revision conflict, dirty current workspace, mobile keyboard reopening, offline send attempt, and auth/capability loss.

### Tests

- Routing coordinator and active-client ordering unit tests.
- Cross-tenant/cross-account API and persistence deny tests.
- Messaging list/detail pagination, read receipt, draft/manual mutation idempotency, counter merge, and stale-response tests.
- Integration tests for alert/notification -> client -> conversation and dirty-state Stay/Discard/Save flows.
- Mobile/desktop Playwright visual and accessibility tests, including keyboard/composer behavior.
- Typecheck, lint, build, targeted/full tests, RLS only if schema/RLS changes, diff/scans/status.

### Completion criteria

- Every client-linked communication path activates the correct client safely.
- No silent client switch or draft loss occurs.
- Communication mutations and counters remain bounded and authoritative.
- Real egress remains disabled and production remains `NO-GO`.
- Mobile and desktop communication workflows pass functional, visual, and accessibility gates.

## Phase 4 - Integration, Performance, Real Device, And Closure

### Purpose

Prove Stage 6 end-to-end without adding features, reconcile documentation, and produce a canonical Stage 6 closure decision input.

### Scope

- Cross-workflow integration, authorization/isolation, concurrency/idempotency, performance, accessibility, visual, physical-device, privacy, and documentation closure.
- No new user-facing feature, domain contract, schema capability, or integration activation.

### Preconditions

- Phases 1-3 are separately approved, implemented, verified, and committed when authorized.
- No unresolved failed/skipped/environment-blocked check is being counted as PASS.

### Affected files

- Tests and verification scripts under existing `app/src`, `app/tests`, and `app/scripts` conventions.
- `docs/PHASE_85_STAGE_6_PHASE_4_INTEGRATION_CLOSURE_EVIDENCE.md`.
- Stage 6 action plan and, only where status truly changed: `README.md`, `PLAN.md`, `PROJECT_PLAN.md`, `HANDOFF_FOR_NEXT_CODEX.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`, and `docs/RISK_REGISTER.md`.
- Readiness documents only if production readiness is actually affected. Design-system spec only if UI/design-system contracts changed.

### Locked closure method

- Stage 5 shell verification remains a regression gate, not a reopened implementation phase.
- Physical iPhone Safari and installed PWA plus physical Android Chrome and installed PWA smoke evidence are mandatory.
- Stage 5 route/performance thresholds are the minimum baseline. Bounded pagination, lazy task loading, stable layout, and no broad post-mutation refetch must be measured.
- Production status remains `NO-GO`; Stage 6 closure cannot authorize deployment, egress, billing, production schema, or real health data.

### Architectural decisions

- Phase 4 changes tests, verification/evidence, and current-state documentation only; a discovered product defect sends work back to its owning implementation phase for separate approval.
- A skipped or environment-blocked required check is an open closure blocker, not a pass.
- Physical-device evidence uses synthetic identities/data and the same integrity/hash validation convention as Stage 5.

### Implementation steps

1. Add/complete end-to-end tests for home -> client -> every task -> communication -> another client, including dirty/conflict/offline/session-loss branches.
2. Run tenant/account/actor/membership/capability and RLS isolation matrices with zero skipped.
3. Run idempotency, expected-revision, stale-response, and rapid-navigation concurrency cases.
4. Run desktop/mobile visual and WCAG 2.2 AA accessibility suites for all primary states.
5. Measure initial shell/routes and lazy task loads against the Stage 5 baseline; inspect bundle changes and broad request regressions.
6. Execute physical iPhone and Android browser/installed-PWA smoke walks with synthetic data only and evidence integrity validation.
7. Run release verification and all required build/test gates.
8. Scan for secrets, sensitive fixtures/logs, cross-tenant references, stale Stage 5 status, documentation contradictions, and forbidden naming.
9. Reconcile only the current-state blocks of canonical continuity documents; do not rewrite historical evidence.
10. Record exact passed/failed/skipped/environment-blocked outcomes and open risks in the Phase 4 evidence.

### Technical methods

- Extend existing Vitest, Playwright, RLS, bundle/performance, privacy, and release-verification harnesses rather than creating parallel runners.
- Capture machine-readable reports and hash-addressed physical-device artifacts using existing evidence conventions.
- Compare request counts, route bundles, and measured timings to Stage 5 baselines; any threshold regression remains failed until resolved.
- Update only current-authority sections in continuity documents and preserve dated historical statements verbatim.

### End-to-end data flow to prove

Authenticate -> shell bootstrap -> dashboard home -> roster page -> guarded active-client selection -> task bounded read -> revision-protected save -> communication target -> guarded client/context transition -> bounded messaging mutation -> second client -> logout/session lock. Every hop must preserve tenant/actor/capability, URL, active-client, dirty-state, and privacy invariants.

### Dependencies

- Completed and approved Phase 1-3 contracts, UI, and tests.
- Closed Stage 5 shell verification, dependency, RLS, performance, privacy, and physical-device baselines.
- Local Supabase/Docker and physical iPhone/Android environments required by closure gates.

### Errors and edge cases

- Cold start, expired session, revoked membership, capability downgrade, offline start/transition, update available during dirty edit, removed active client, deep-link mismatch, concurrent tabs, duplicate mutation, stale revision, slow/late response, empty datasets, maximum page size, large text, mobile keyboard, rotation, installed-PWA safe areas, and sensitive-content absence during privacy lock.

### Required validation

- Targeted and full unit/integration suites.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test`
- Clean Supabase reset and `npm run test:rls` when any schema/RLS path changed; zero skipped required for closure.
- Playwright visual and accessibility suites on mobile and desktop.
- Stage 5 shell, dependency, privacy, and performance regression verification applicable to changed dependencies/bundles.
- `npm run release:verify`
- `git diff --check`, secret/sensitive scan, cross-tenant scan, stale-document scan, and `git status --short --branch`.

### Completion criteria

- All required checks are real PASS; no failed, skipped, or environment-blocked requirement is represented as PASS.
- Physical iPhone and Android browser/installed-PWA evidence is approved.
- Stage 5 shell contracts and performance baseline remain intact.
- Stage 6 workflows are bounded, accessible, responsive, tenant-safe, revision-safe, and documented.
- Canonical documents agree that Stage 5 remains closed and production remains `NO-GO`.
- User explicitly approves the Phase 4 commit; push/merge/deploy remain separate decisions.

## 6. Gap Ownership Matrix

| Current gap or risk | Owning phase | Required resolution |
| --- | --- | --- |
| Broad `/api/app-state` mutation refresh and monolithic compatibility state | Phase 1 | Bounded DTOs/hooks and affected-record merges; retain compatibility hydration only. |
| Heterogeneous client forms/nutrition/menu/context/AI contracts | Phase 1 | Uniform auth, pagination, revision, idempotency, error, and conformance rules. |
| `DashboardApp` owns excessive unrelated local/domain state | Phase 2 | Extract client workspace/task composition while preserving compatibility coordinator. |
| Mobile client detail behaves like compressed desktop panels | Phase 2 | Dedicated list -> task hub -> full-width task flow. |
| Active-client and viewed-target transitions can diverge across domains | Phases 2-3 | One guarded shell transition before workspace or communication navigation. |
| Legacy card-heavy/stone/emerald styling in touched dashboard panels | Phase 2 | Align touched surfaces to current compact clinical design system. |
| Messaging/alert/notification navigation and refresh ownership is split | Phase 3 | Typed navigation coordinator and bounded affected-surface refresh. |
| Stage 6 Supabase mutation idempotency was process-local after Phase 3 | R1 remediation | Durable tenant/request-scoped reservation and bounded response replay in `stage_6_mutation_idempotency`. |
| Workspace projections, viewed-target state, and editor dirty/conflict handling could diverge after Phases 1-3 | R2 remediation | Tenant/client/domain ownership, URL-only viewed target, exact shell destination, bounded form consumption, awaited saves, complete draft detection, and guarded menu-plan switching. |
| Alert/notification polling, filters, pagination, and receipt mutations could apply out of order or duplicate rows | R3 remediation | Resource/filter owner keys, latest-request sequence gates, abort controllers, mutation invalidation, stable-id page merge, zero-skip 10k communication tests, and local RLS 56/56. |
| Risk of Stage 5 shell regression or production-scope drift | Phase 4 | Full regression, physical-device, evidence, and documentation closure gates. |

## 7. Phase Governance

At the end of every implementation phase:

1. Report changed files and architectural effects.
2. Report exact passed, failed, skipped, and environment-blocked results.
3. List open risks and blockers.
4. Report document consistency and Git working-tree status.
5. Ask for commit approval.
6. After commit approval, commit only that phase.
7. Wait for separate push and next-phase instructions.

The first implementation phase after this read gate is **Phase 1 - Client Domain Bounded Contracts**. It must not start until Phase 0 is reviewed and the user explicitly approves Phase 1 scope.

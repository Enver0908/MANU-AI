# Phase 85 Stage 6 Phase 0 Read Gate Evidence

Date: 2026-08-19

Status: **PHASE 0 COMPLETE; DOCUMENTATION-ONLY GATE**

Stage 5 status: **STAGE_5_CLOSED**

Production status: **NO-GO**

## 1. Result

The Stage 6 read gate is complete. The current dashboard architecture, workflow ownership, mobile/desktop boundaries, authorization and persistence boundaries, gaps, risks, and five-phase execution sequence are recorded. No runtime code, UI, API, migration, package, test, historical evidence, or production gate was changed.

The canonical Stage 6 implementation plan is `docs/PHASE_85_STAGE_6_DASHBOARD_CORE_WORKFLOWS_ACTION_PLAN.md`. Phase 1 may not begin without a separate explicit user approval.

## 2. Repository Verification

The required pre-edit commands produced the following evidence:

| Command | Result |
| --- | --- |
| `git branch --show-current` | `codex/stage-4c-remediation` |
| `git status --short --branch` | Branch tracks `origin/codex/stage-4c-remediation`; ahead 21. Initial status reported four stat/line-ending-only modifications described below. |
| `git log -5 --oneline --decorate` | HEAD `bd0c51e docs(stage-5): reconcile closure authority`; followed by `955b373`, `3d03112`, `99a206f`, `2ed3347`. |
| `git remote -v` | Fetch and push remote: `https://github.com/Enver0908/MANU-AI.git`. |
| `git rev-parse --abbrev-ref --symbolic-full-name '@{u}'` | `origin/codex/stage-4c-remediation`. |
| `git ls-remote origin HEAD refs/heads/codex/phase-29-baseline-checkpoint refs/heads/codex/stage-4c-remediation` | `HEAD` and default branch at `25a03b50cd7ef8fc3b6b1f68d8a1739e3e1e9372`; Stage 4C branch at `bc57cfd7717e78635730bcc4390afc5676d0b4f3`. |

The branch, upstream, local HEAD, ahead count, remote Stage 4C ref, and default branch ref matched the expected state. The default branch was not checked out. No push, merge, PR, deployment, or remote mutation occurred.

### 2.1 Stat/line-ending anomaly and safe resolution

Initial status marked these four files modified:

- `HANDOFF_FOR_NEXT_CODEX.md`
- `PLAN.md`
- `app/src/app/layout.tsx`
- `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`

This was not a content change:

- `git diff`, `git diff --cached`, `git diff --stat`, `git diff --numstat`, `git diff --raw`, and `git diff --check` emitted no content delta.
- `git hash-object --path=<file> <file>` matched each index/HEAD blob exactly.
- `git ls-files --eol` reported `i/lf w/crlf`, consistent with repository LF normalization and system `core.autocrlf=true`.
- A temporary-index rehearsal showed that a normal `git add` produced a clean status and zero staged diff.

Because physically restoring the files could unnecessarily rewrite CRLF working copies and interact with OneDrive/editor state, the files were not restored or rewritten. After a final zero-content-diff check, normal `git add` refreshed only index stat metadata. `git diff --cached --quiet` then passed and the worktree was clean before the two Phase 0 documents were created. No user content was discarded or staged.

## 3. Authority Reconciliation

The governing facts are:

- `docs/PHASE_85_STAGE_5_CLOSURE_DECISION.json` records `stageStatus=STAGE_5_CLOSED`, `productionStatus=NO-GO`, and `blockers=[]`.
- `docs/PHASE_85_STAGE_5_REMEDIATION_PHASE_4_CLOSURE_EVIDENCE.md` confirms dependency, shell, performance, RLS, real-device, and closure evidence.
- Stage 5 RLS is 56 passed, 0 failed, 0 skipped.
- Physical iPhone Safari/installed PWA and Android Chrome/installed PWA evidence is approved.
- R-405 is technically resolved in the local Stage 5 dependency evidence.
- Production remains independently `NO-GO`; provider/channel egress, live billing, production schema rollout, deployment, and real health-data paths remain closed.

Older documents containing `Stage 5 blocked/unstarted` or `R-405 open` are historical snapshots and do not override the canonical closure decision. Historical evidence was not edited.

## 4. Documents Read

The read gate covered:

- `codex.md`
- `README.md`
- `PLAN.md`
- `PROJECT_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `app/README.md`
- `docs/PHASE_85_STAGE_5_CLOSURE_DECISION.json`
- `docs/PHASE_85_STAGE_5_REMEDIATION_PHASE_4_CLOSURE_EVIDENCE.md`
- `docs/PHASE_85_STAGE_5_REAL_DEVICE_VALIDATION_REPORT.json`
- `docs/PHASE_85_STAGE_5_DEPENDENCY_SECURITY_REPORT.json`
- `docs/PHASE_85_STAGE_5_RLS_ZERO_SKIP_REPORT.json`
- `docs/PHASE_85_STAGE_5_SHELL_VERIFY_REPORT.json`
- `docs/PHASE_85_STAGE_5_LAB_PERF_REPORT.json`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`
- `docs/RISK_REGISTER.md`
- `docs/PHASE_85_FRONTEND_REDESIGN_AND_DESIGN_SYSTEM_SPEC.md`
- `docs/PILOT_READINESS_EVIDENCE_PACK.md`
- `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`
- `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`

## 5. Code And Data Areas Read

The dependency graph was traced with `rg --files` and `rg` across:

- Dashboard routes: `app/src/app/dashboard/**`.
- Dashboard composition and panels: `app/src/components/dashboard-app.tsx` and `app/src/components/dashboard/**`.
- Closed shell surfaces: `app/src/components/pwa-subscriber-shell.tsx`, `app/src/components/ui/app-shell.tsx`, and `app/src/lib/phase-85-stage-5-*`.
- Shared state, types, routing, and dirty registration: `app/src/lib/types.ts`, `use-manu-state.ts`, `use-dashboard-url.ts`, and `use-shell-dirty-registration.ts`.
- Authentication/persistence: `dashboard-server-auth.ts`, `supabase.ts`, `supabase-store.ts`, tenant/actor/membership/capability helpers, and fallback app-state storage.
- APIs: shell, app-state, clients, conversations, messages, alerts, notifications, internal copilot, and AI Chat routes.
- Data/schema: `app/supabase/migrations/**`, transactional RPCs, RLS policies, migration contract tests, and Supabase RLS integration tests.
- Verification: Stage 4B/Stage 5 contract, routing, integration, state merge, privacy, shell, RLS, visual/accessibility, performance, and closure tests; `app/package.json`; `app/scripts/release-verify.mjs`; Stage 5 verification scripts.

The repository root correctly has no `package.json`, `supabase/`, or `app/src/hooks/`; the active paths are `app/package.json`, `app/supabase/`, and hooks colocated under component/lib ownership.

## 6. Current Workflow Architecture

### 6.1 Application entry and shell

`app/src/app/dashboard/layout.tsx` and the authenticated shell boundary establish dashboard access. `PwaSubscriberShell`, `DashboardShell`, and `ShellProvider` provide the closed Stage 5 shell. The shell owns bootstrap/session state, active-client preference, destination navigation, update/offline handling, privacy lock behavior, and the central dirty registry.

`ShellProvider` fetches `/api/shell/bootstrap`, rejects stale bootstrap responses by sequence, persists destination/active-client preferences with revision coordination, treats General AI Chat as unscoped, records session activity, and moves to fail-closed offline/session-locked states. The service worker classifies protected/API paths as network-only.

### 6.2 Dashboard composition

`DashboardApp` is the current integration point. It combines:

- Broad compatibility state from `useManuState` and `/api/app-state`.
- URL state from `useDashboardUrl` and Stage 4B dashboard routing.
- Shell bootstrap/effective active client from `useShellProvider`.
- Bounded messaging and inbox hooks from Stage 4B/4B-2.
- Local state for client creation, forms, nutrition/menu workflows, context updates, simulation/media workflows, and AI controls.

This arrangement works but leaves one component coordinating many unrelated domains and exposes inconsistent loading/mutation/refresh behavior.

### 6.3 Dashboard home

`overview-panel.tsx` and `shell-home-launcher.tsx` render home summaries/actions. Inputs come from shell bootstrap plus broad app state and bounded inbox/messaging state. Stage 6 will retain only summaries already supported by these contracts: active client and pending messages/alerts/notifications. It will not invent KPI calculations or a new broad home aggregator.

### 6.4 Clients and active-client behavior

`clients-panel.tsx`, `active-client-control.tsx`, shell active-client contracts, and URL routing currently participate in client selection. Stage 5 defines effective active-client precedence and validates the selected client through shell bootstrap/preferences.

The approved Stage 6 behavior is simple for the dietitian: select a client, that client becomes active, and their workspace opens. The safety detail is that all switches use the existing dirty-state gate so an unfinished edit for the previous client cannot be silently applied to the next client or discarded.

### 6.5 Forms, nutrition, menu, context, and AI controls

These domains use existing panels and a mixture of broad state, direct APIs, persistence functions, and domain records in `types.ts`:

- Forms: `forms-panel.tsx`, `client-form-panel.tsx`, `/api/clients/forms`, form schema/response records.
- Nutrition: `active-nutrition-plan-panel.tsx` and `/api/clients/[id]/food-rule-profile`.
- Menu: `menu-workflow-panel.tsx`, export section, and `/api/clients/[id]/menu-plans/**`.
- Context: `/api/clients/[id]/context-updates` plus reviewed proposal routes.
- AI controls: client activation/status controls with existing conversation/client-context revision requirements; separate General AI Chat routes and UI.

The persistence layer already contains many tenant-scoped and transactional operations, but the UI-facing read/mutation shapes and refresh ownership are not uniform. This is the main Phase 1 boundary.

### 6.6 Messaging, alerts, and notifications

Messaging is more mature than the client workspace domains. `useStage4B2Messaging`, Stage 4B inbox hooks, conversation list/detail APIs, receipts, manual reply/draft routes, and bounded alert/notification list and mutation routes already exist. URL contracts carry conversation, message anchor, filters, and related client identifiers.

The remaining Stage 6 issue is coordination: opening a client-linked conversation/alert/notification must activate the linked client through the same dirty-state-safe transition before route navigation, and post-mutation updates must remain limited to affected surfaces.

### 6.7 Authorization and persistence

The examined routes use `resolveAppTenantContext` and `requireCapability`; conversation routes additionally require an allowed conversation actor. Supabase persistence applies tenant context, assignment/permission resolution, revisions, idempotency keys, and transactional RPCs in many critical mutations. RLS tests prove the current Stage 5 baseline.

Stage 6 must preserve double enforcement: route checks are necessary but persistence/RPC checks remain mandatory. Service-role execution cannot be treated as user authorization.

## 7. Mobile And Desktop Boundaries

### Mobile installed PWA

- The closed Stage 5 shell supplies five fixed destinations, safe-area handling, update/offline/privacy behavior, and mobile navigation.
- A client list opens a client task hub. Forms, nutrition, menu, and AI controls open as full-width task views.
- Back navigation is task -> client hub -> client list.
- The current active client remains visible in context, but client selection is not a separate administrative ceremony; selecting a person activates them.
- Messaging retains list/detail and mobile keyboard/composer behavior.
- No offline editing, queued mutation, sensitive cache, or reconnect auto-submit is allowed.

### Desktop

- The current productive information density and sidebar/top-level navigation remain.
- Clients use a stable list plus detail/workspace layout.
- Client tasks may use tabs/adjacent detail regions where space permits, but they consume the same bounded contracts and active-client rules as mobile.
- Keyboard navigation, visible focus, and deterministic URL/back-forward behavior are required.

The mobile UI is therefore not a scaled desktop copy; only domain and security contracts are shared.

## 8. Confirmed Gaps And Risks

| Finding | Code/contract evidence | Risk | Assigned phase |
| --- | --- | --- | --- |
| Broad compatibility snapshot remains central | `use-manu-state.ts`, `/api/app-state`, `DashboardApp` | Large refetches, stale overwrites, and unclear domain ownership after mutations | Phase 1 |
| Client domains expose heterogeneous API and revision behavior | client/forms/food-rule/menu/context/AI routes and panels | UI-specific contracts, inconsistent conflicts, duplicated error handling | Phase 1 |
| Dashboard composition is monolithic | `dashboard-app.tsx` owns broad state plus many domain drafts/actions | Change blast radius and difficult mobile task isolation | Phase 2 |
| Client view and active context can be coordinated by multiple layers | shell active client, URL client ID, local panel selection | Wrong-client edits or confusing navigation if transitions bypass dirty guard | Phases 2-3 |
| Existing client detail is panel/card oriented | client/forms/nutrition/menu panels | Mobile becomes a compressed desktop surface | Phase 2 |
| Touched legacy visual styles differ from current design system | dashboard panels with older stone/emerald/card patterns | Inconsistent product hierarchy and excessive nesting | Phase 2 |
| Communication navigation is distributed | Stage 4B routing, inbox, messaging hooks, dashboard orchestration | Linked target can open before client context settles; excess refresh | Phase 3 |
| Fallback and Supabase paths may drift | route branches, app-state store, Supabase store | Local visual success may not represent RLS-backed behavior | Phases 1 and 4 |
| Concurrency spans client/task/route changes | request sequences exist in shell; domain behavior varies | Late responses or two-tab saves can overwrite visible state | Phases 1-4 |
| Stage 6 could accidentally reopen Stage 5 or production scope | shared shell and historical roadmap documents | Regression or false readiness claim | Phase 4 governance |

## 9. Stage 5 Non-Reopening Proof

The Stage 6 plan treats the following as fixed dependencies, not redesign targets:

- Shell bootstrap and preference contracts.
- Active-client precedence and persistence.
- Central dirty-state registry and guarded navigation dialog.
- Session heartbeat/lock behavior.
- Service-worker network-only/fail-closed behavior.
- Offline privacy lock and sensitive-content unmounting.
- Five-route mobile shell, safe-area behavior, update flow, and performance baseline.

Later phases may call documented shell APIs and add regression tests. A shell implementation change is allowed only if a concrete Stage 6 integration defect is proven, the user separately approves the exact change, and Stage 5 closure verification remains passing. No such change is part of Phase 0.

## 10. Approved Phase Plan

The optimum sequence is five phases:

1. Phase 0: read gate and canonical plan.
2. Phase 1: client domain bounded contracts.
3. Phase 2: dashboard home and client workspace.
4. Phase 3: communication and operational workflows.
5. Phase 4: integration, performance, physical-device validation, and closure.

Five phases are the minimum practical separation that keeps contract/security work ahead of UI, prevents messaging from destabilizing the client workspace implementation, and reserves closure for evidence rather than feature development.

## 11. Phase 0 Validation

Phase 0 validation is documentation-scoped:

- Confirm only the two canonical Stage 6 documents changed.
- Run `git diff --check`.
- Scan the new documents for forbidden future-phase naming, stale Stage 5 authority, secrets/sensitive content, and production-status contradictions.
- Run `git status --short --branch` and inspect the complete diff.

Typecheck, lint, build, application tests, RLS, release verification, and Playwright are not required for two documentation-only additions and are not to be reported as PASS for Phase 0.

## 12. Next Authorized Boundary

The first implementation phase is **Phase 1 - Client Domain Bounded Contracts**. Before any Phase 1 code, API, migration, or test change, its exact scope and concrete file/contract changes must be presented to the user and explicitly approved.

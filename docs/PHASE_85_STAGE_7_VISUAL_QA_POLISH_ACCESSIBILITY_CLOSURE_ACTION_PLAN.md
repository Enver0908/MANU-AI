# Phase 85 Stage 7 Visual QA, Polish, Accessibility, And Closure Action Plan

Date: 2026-08-22

Status: **STAGE_7R_3_SHARED_PUBLIC_REMEDIATION_VALIDATED_VISUAL_REVIEW_PENDING**

Stage 5 status: **STAGE_5_CLOSED**

Stage 6 status: **STAGE_6_CLOSED**

Physical iPhone status: **WAIVED_NOT_EXECUTED**

Production status: **NO-GO**

## 1. Authority And Objective

This document is the canonical execution plan for Stage 7. Stage 7 closes Phase 85 frontend quality only after a full audit, deterministic remediation, accessibility validation, browser/PWA verification, and final closure evidence.

**Stage 7R supersession update, 2026-08-24:** Stage 7.1, Stage 7.2, Stage 7.3, and Stage 7.4 were implemented and then reviewed against this plan. The review found that all four phases are only partially implemented for the technical intent of this plan. Their evidence is preserved as historical evidence but is superseded for Stage 7 closure by `docs/PHASE_85_STAGE_7R_SUPERSESSION_DECISION.json`, `docs/PHASE_85_STAGE_7R_FINDING_LOCK.json`, and `docs/PHASE_85_STAGE_7R_PHASE_0_AUTHORITY_FINDING_LOCK_EVIDENCE.md`. Stage 7 is not closed, Stage 7.5 is not started, and Stage 7 now requires the Stage 7R remediation sequence before Stage 7.5 can begin.

Stage 7 consumes the closed Stage 5 shell contracts and the closed Stage 6 dashboard workflow contracts. Stage 7 does not reopen backend security, API authorization, RLS, migrations, AI/provider orchestration, real channel egress, live billing, production deployment, or real health-data paths.

The objective is to prove that the full frontend surface is visually coherent, responsive, accessible, browser-compatible, privacy-safe, and stable across representative public, commercial, auth, onboarding, admin, dashboard, and PWA workflows.

Stage 7 has six phases:

1. Stage 7.0: documentation and scope lock.
2. Stage 7.1: full baseline audit and finding register.
3. Stage 7.2: shared, public, commercial, auth, onboarding, install, and admin remediation.
4. Stage 7.3: dashboard and installed-PWA remediation.
5. Stage 7.4: accessibility, browser, responsive, performance, and bundle closure.
6. Stage 7.5: final evidence, physical Android/TalkBack validation, two clean runs, and closure decision.

Stage 7R remediation has six phases:

1. Stage 7R.0: correction authority and finding lock.
2. Stage 7R.1: deterministic harness rebuild.
3. Stage 7R.2: trusted baseline rerun and user-approved visual baseline.
4. Stage 7R.3: shared, public, commercial, accessibility, and primitive remediation.
5. Stage 7R.4: dashboard and PWA remediation.
6. Stage 7R.5: real hard gate, evidence reconciliation, and reclosure readiness.

Stage 7.5 cannot start until Stage 7R.1 through Stage 7R.5 have resolved or user-approved reclassified every P0, P1, and P2 locked in `docs/PHASE_85_STAGE_7R_FINDING_LOCK.json`.

Each phase requires separate user approval before it starts. Each remediation phase requires representative before/after visual approval before any visual baseline update is committed. Stage 7.1 findings must be approved before Stage 7.2 remediation begins.

## 2. Locked Scope

Included frontend surfaces:

- Public landing and contact flows.
- Login and authentication-state pages.
- Purchase claim flow, plan claim flow, consumed/expired/pending/cancel/success states.
- Onboarding, install guidance, claimable subscription states, duplicate/already-claimed/pending/error states.
- Admin entry, admin unauthorized/non-allowlist/empty/dense/error states, and emergency admin secondary states.
- Dashboard shell, overview, roster, active-client workspace, forms, nutrition, menu plans, AI/context controls, messaging, alerts, notifications, simulator, general AI chat, voice, settings, and More navigation.
- Installed Android PWA critical smoke, Android Chrome critical smoke, desktop NVDA critical smoke, and Android TalkBack critical smoke.

Excluded unless a later phase requests separate explicit approval:

- Backend schema, migrations, RLS policies, RPC behavior, server authorization, tenant isolation rules, auth provider configuration, entitlement state machines, Stripe/live billing behavior, WhatsApp/Telegram/provider egress, LLM/provider logic, clinical safety logic, service-worker policy changes, offline editing, mutation queues, sensitive persistent caches, deployment, push, merge, PR, and production readiness changes.
- Physical iPhone Safari or installed iPhone PWA validation. These remain `WAIVED_NOT_EXECUTED`, never `PASS`.
- Real user data, real client identifiers, real health data, real payment data, real cookies, session tokens, or production traces.

Allowed file families:

- Documentation under `docs/**`.
- Frontend application files under `app/src/app/**`, `app/src/components/**`, `app/src/lib/**`, and `app/src/styles/**` when owned by the affected frontend surface.
- Test-only files under `app/tests/visual/stage-7/**` and existing visual/a11y test folders.
- Script-only verification files under `app/scripts/**` whose names include `stage-7`.
- `app/package.json` only for adding Stage 7 script commands. Dependency additions are not part of Stage 7 unless a later phase proves an existing approved dependency cannot perform the work and the user separately approves the exact dependency.

## 3. Locked Verification Method

Stage 7 uses deterministic synthetic scenarios and a risk-based layered matrix.

The existing stack is retained:

- Next.js 16.3.0 and React 19.2.4 runtime.
- Playwright 1.60.0 for browser automation, screenshots, geometry checks, keyboard checks, and network routing.
- `@axe-core/playwright` 4.12.1 for automated WCAG checks.
- Vitest 4.1.7 for helper, contract, and evidence-script tests when required.
- Existing Stage 5 performance and bundle measurement scripts as the baseline source for Stage 7 extensions.

No Cypress, Storybook, HAR replay system, MSW migration, third-party visual SaaS, or new browser framework is introduced in Stage 7.

The deterministic test method is:

1. Define fixed `Stage7Scenario` objects in `docs/PHASE_85_STAGE_7_SCENARIO_MATRIX.json`.
2. Use synthetic `example.com` identities, synthetic tenant/client IDs, synthetic non-medical content, fixed time, fixed locale, fixed timezone, and deterministic API route fulfillment.
3. Run mocked UI suites with service worker blocked unless the scenario explicitly verifies PWA behavior.
4. Run PWA suites with service worker enabled only for install/offline/update/privacy-lock checks.
5. Use pairwise risk coverage across roles, language, viewport, browser family, density, state, and workflow, plus mandatory critical combinations for high-risk surfaces.
6. Validate each scenario through the required layers: behavior, geometry, screenshot, ARIA, axe, keyboard, and state semantics.
7. Commit only sanitized representative screenshots, finding JSON, summaries, hashes, and final reports. Raw traces, videos, HTML dumps, request bodies, auth artifacts, and full axe dumps remain temporary and uncommitted.

No skipped, flaky, timed-out, blocked, or manually ignored automated check can count as pass in `verify:stage-7`.

## 4. Canonical Data Flow

```text
Stage 7 scenario contract
  -> deterministic synthetic fixture
  -> browser/profile/viewport/language/role runner
  -> route-level API fulfillment or PWA-enabled runtime path
  -> frontend surface state
  -> visual/geometry/behavior/ARIA/axe/keyboard/performance checks
  -> sanitized evidence artifact
  -> Stage7Finding register
  -> remediation phase assignment
  -> verified closure evidence
```

No Stage 7 test may send synthetic health-like content to production systems. No Stage 7 evidence may store cookies, tokens, raw request bodies, real emails, real phone numbers, real client names, or realistic health descriptions.

## 5. Shared Data Contracts

Stage 7.0 defines documentation-level contracts only. The implementation files are created in Stage 7.1 after approval.

### 5.1 Stage7Scenario

```ts
export type Stage7Severity = "P0" | "P1" | "P2" | "P3";
export type Stage7Role = "owner" | "admin" | "dietitian" | "assistant" | "auditor";
export type Stage7AssignmentAccess = "care_team" | "viewer" | "none";
export type Stage7Language = "tr" | "en" | "de" | "pt" | "es" | "fr" | "ar";
export type Stage7BrowserProfile =
  | "desktop-chromium-1440"
  | "desktop-chromium-1728"
  | "tablet-chromium-768"
  | "android-chromium-390"
  | "iphone13-webkit-390"
  | "ipad-pro-11-webkit"
  | "desktop-firefox-1440"
  | "reflow-chromium-320"
  | "mobile-landscape-chromium-844";

export interface Stage7Scenario {
  id: string;
  surface: string;
  route: string;
  workflow: string;
  state: string;
  roles: Stage7Role[];
  assignmentAccess: Stage7AssignmentAccess[];
  languages: Stage7Language[];
  browserProfiles: Stage7BrowserProfile[];
  requiredLayers: Array<
    "behavior" | "geometry" | "full_page_snapshot" | "locator_snapshot" |
    "state_snapshot" | "aria" | "axe" | "keyboard" | "manual_at" |
    "performance" | "bundle" | "physical_android"
  >;
  dataFixture: string;
  serviceWorkerMode: "blocked" | "enabled" | "not_applicable";
  evidencePolicy: "commit_summary_only" | "commit_representative_snapshot" | "temporary_raw_only";
  phaseOwner: "7.1" | "7.2" | "7.3" | "7.4" | "7.5";
  acceptance: string[];
}
```

### 5.2 Stage7Finding

```ts
export interface Stage7Finding {
  id: string;
  status: "open" | "resolved" | "accepted_p3" | "not_reproducible";
  severity: "P0" | "P1" | "P2" | "P3";
  surface: string;
  scenarioId: string;
  role: Stage7Role;
  language: Stage7Language;
  browserProfile: Stage7BrowserProfile;
  wcag: string[];
  repro: string[];
  expected: string;
  actual: string;
  evidence: string[];
  rootCause: string;
  remediationPhase: "7.2" | "7.3" | "7.4" | "7.5";
  ownerDecisionRequired: boolean;
  updatedAt: string;
}
```

## 6. Severity And Closure Rules

P0:

- Data exposure, wrong-tenant/wrong-client display, sensitive protected content shown while offline/session-locked, auth bypass, privacy artifact leakage, broken critical navigation, or any issue that prevents meaningful Stage 7 verification.
- P0 stops the current phase immediately. The next action is a targeted root-cause fix plan approved by the user. No closure work continues while P0 is open.

P1:

- Critical workflow unusable, keyboard trap, focus loss preventing task completion, blocking mobile/PWA layout failure, browser-specific functional break, or WCAG A/AA violation that blocks core use.

P2:

- Non-blocking but material usability, accessibility, responsive, visual hierarchy, translation, density, state feedback, or performance regression.

P3:

- Cosmetic polish, low-risk copy issue, minor alignment inconsistency, or non-critical improvement. P3 may close as `accepted_p3` only with explicit user approval and recorded rationale.

Stage 7 closure requires zero open P0, P1, and P2 findings. All findings must be `resolved`, `accepted_p3`, or `not_reproducible`.

## 7. Audit Rubric

Each audited scenario records `PASS`, `FAIL`, or `N/A` for exactly these ten categories:

1. Brand and typography.
2. Information hierarchy.
3. Grid, spacing, and density.
4. Responsive layout and safe area.
5. Text, localization, and overflow.
6. Controls, affordances, and interaction states.
7. Loading, empty, error, offline, dirty, conflict, stale, and read-only feedback.
8. Accessibility, focus, ARIA, contrast, keyboard, and assistive technology.
9. Role, privacy, tenant/client boundary, and fail-closed behavior.
10. Browser, PWA, performance, and bundle stability.

No numeric score is used. Every `FAIL` creates a `Stage7Finding` with a concrete scenario ID and remediation phase.

## 8. Phase 7.0 - Documentation And Scope Lock

### Purpose

Create the canonical Stage 7 plan and immutable scope guard before audit or implementation begins.

### Scope

- Record locked decisions, scope, exclusions, verification method, artifacts, scenario categories, finding schema, phase gates, closure status rules, and rollback rules.
- Create the empty finding register and initial scenario matrix document.
- Create Phase 7.0 evidence proving documentation-only execution.

### Preconditions

- Branch is `codex/stage-4c-remediation`.
- Stage 5 closure decision exists and states `STAGE_5_CLOSED`.
- Stage 6 closure decision exists and states `STAGE_6_CLOSED`.
- Stage 6 iPhone physical validation remains `WAIVED_NOT_EXECUTED`.
- Production remains `NO-GO`.
- Working tree is clean before Stage 7.0 edits.

### Affected components and files

- New: `docs/PHASE_85_STAGE_7_VISUAL_QA_POLISH_ACCESSIBILITY_CLOSURE_ACTION_PLAN.md`.
- New: `docs/PHASE_85_STAGE_7_SCENARIO_MATRIX.json`.
- New: `docs/PHASE_85_STAGE_7_FINDINGS.json`.
- New: `docs/PHASE_85_STAGE_7_PHASE_0_DOCUMENTATION_EVIDENCE.md`.

No runtime, test, package, migration, API, shell, service-worker, continuity, closure-decision, or historical evidence file is modified in Stage 7.0.

### Architectural decisions

- Stage 7.0 is a documentation lock, not a verification claim.
- This plan outranks future ad hoc Stage 7 implementation notes unless this file is explicitly amended with user approval.
- `docs/PHASE_85_STAGE_7_SCENARIO_MATRIX.json` is the source of audit scenario categories and mandatory coverage. Stage 7.1 may expand it with exact executable scenario records but may not remove Stage 7.0 mandatory categories without user approval.
- `docs/PHASE_85_STAGE_7_FINDINGS.json` starts empty. Stage 7.1 is the first phase allowed to add findings.

### Implementation steps

1. Verify branch and status using `git status --short --branch`.
2. Confirm Stage 5 and Stage 6 closure JSON statuses by reading the closure documents.
3. Confirm existing frontend dependency versions from `app/package.json`.
4. Add this action plan.
5. Add the scenario matrix JSON with canonical roles, languages, viewport/browser profiles, scenario groups, artifact policy, and closure gates.
6. Add the empty finding register JSON with schema metadata.
7. Add Phase 7.0 documentation evidence.
8. Validate changed docs with JSON parsing, whitespace checks, contradiction scans, and Git status.

### Technical methods

- Use documentation and JSON only.
- Use fixed schema names from Section 5.
- Use repository-local relative paths inside documents.
- Use no secrets, tokens, real emails, real phone numbers, real client data, realistic health records, cookies, trace payloads, or request bodies.
- Use `git diff --check` for whitespace validation.
- Use Node JSON parsing for the two JSON files.
- Use `rg` for contradiction and forbidden-scope scans.

### Data flow

User-approved Stage 7 decisions plus current Stage 5/6 closure evidence flow into the action plan, scenario matrix, empty finding register, and Phase 7.0 evidence. No application runtime data is accessed.

### Dependencies

- Existing Stage 5 and Stage 6 closure documents.
- Existing `app/package.json` dependency declarations.
- User-approved Stage 7 decisions collected before this file was created.

### Errors and edge cases

- If Stage 5 or Stage 6 closure status is missing, Stage 7.0 stops before claiming completion.
- If working tree contains unrelated changes before edit, Stage 7.0 stops unless the changes are proven content-identical metadata anomalies.
- If validation finds a production readiness claim, iPhone pass claim, backend authorization change, or real-data reference, Stage 7.0 is not complete.

### Tests

- `git diff --check`
- JSON parse for `docs/PHASE_85_STAGE_7_SCENARIO_MATRIX.json`
- JSON parse for `docs/PHASE_85_STAGE_7_FINDINGS.json`
- Text scan for forbidden pass claims: physical iPhone must remain `WAIVED_NOT_EXECUTED`
- Text scan for production status: must remain `NO-GO`
- Text scan for forbidden sensitive placeholders and real-data patterns in the four new files
- `git status --short --branch`

Application tests, Playwright suites, axe checks, performance measurement, build, lint, typecheck, RLS tests, real-device tests, and release verification are not run in Stage 7.0.

### Validation metrics

- Exactly four Stage 7.0 files are added.
- Zero runtime files are changed.
- JSON parse succeeds for both JSON files.
- `git diff --check` exits clean.
- No Stage 7.0 document says physical iPhone validation passed.
- No Stage 7.0 document changes production status from `NO-GO`.

### Completion criteria

- This document exists and defines all six Stage 7 phases.
- Scenario matrix JSON exists and contains all mandatory scenario groups.
- Finding register JSON exists and contains zero findings.
- Phase 7.0 evidence exists and states documentation-only execution.
- User can approve Stage 7.1 separately.

## 9. Phase 7.1 - Full Baseline Audit And Finding Register

### Purpose

Create a complete reproducible baseline of frontend issues before any UI remediation starts.

### Scope

- Convert Stage 7.0 scenario groups into executable `Stage7Scenario` records.
- Build Stage 7 audit-only runner and evidence helpers.
- Execute the baseline audit across required surfaces, roles, languages, browser profiles, viewports, and states.
- Produce findings in JSON and Markdown.

### Preconditions

- Stage 7.0 is complete and approved.
- Working tree contains only approved Stage 7.0 files or an approved commit.
- No runtime remediation is started.

### Affected components and files

- `docs/PHASE_85_STAGE_7_SCENARIO_MATRIX.json` expanded with executable scenario records.
- `docs/PHASE_85_STAGE_7_FINDINGS.json` populated from audit failures.
- New `docs/PHASE_85_STAGE_7_PHASE_1_BASELINE_AUDIT_EVIDENCE.md`.
- New audit report under `docs/PHASE_85_STAGE_7_BASELINE_AUDIT_REPORT.md`.
- New test-only files under `app/tests/visual/stage-7/**`.
- New script-only files under `app/scripts/audit-stage-7.mjs` and `app/scripts/lib/stage-7-evidence.mjs`.
- `app/package.json` only to add `audit:stage-7` and `test:stage-7` command entries.

No visual baseline update and no UI remediation is allowed in Stage 7.1.

### Architectural decisions

- `audit:stage-7` is report-only for product findings; it fails only if the audit harness crashes, artifact privacy validation fails, JSON is invalid, or required scenarios cannot execute.
- A UI defect discovered by `audit:stage-7` is recorded as a finding and does not itself fail the audit command.
- `test:stage-7` may run a focused subset during harness development but cannot be used for closure.
- Service worker is blocked by default and enabled only for PWA scenarios.
- Existing Playwright project names are extended only when needed to add real WebKit iPhone/iPad emulation and Stage 7 profiles.

### Implementation steps

1. Add typed scenario loading and schema validation.
2. Add deterministic fixture builders for public, auth, purchase, onboarding, admin, dashboard, and PWA states.
3. Add API route fulfillment helpers that return fixed DTOs and fail on unexpected production network calls.
4. Add browser profiles for desktop Chromium 1440x900, desktop Chromium 1728x1117, tablet Chromium 768x1024, Android Chromium 390x844, iPhone 13 WebKit 390x844, iPad Pro 11 WebKit, desktop Firefox 1440x900, reflow Chromium 320x720, and mobile landscape Chromium 844x390.
5. Add layer runners for behavior, geometry, snapshots, ARIA, axe, keyboard, performance probe placeholders, and artifact sanitization.
6. Execute all mandatory Stage 7.1 scenarios.
7. Write every `FAIL` as a `Stage7Finding` with concrete repro, expected, actual, evidence path, root cause hypothesis, and remediation phase.
8. Produce the baseline audit evidence document and ask the user to approve findings before Stage 7.2.

### Technical methods

- Use Playwright route interception for deterministic API responses.
- Use `page.addInitScript` for fixed time and deterministic random behavior when needed.
- Use `context.grantPermissions([])` and explicit permission denial where applicable.
- Use locator snapshots for dense panels and full-page snapshots only for top-level routes.
- Use axe with WCAG 2.2 A/AA relevant rules; any A/AA violation creates a finding even if older Stage 6 tests filtered by serious/critical only.
- Use geometry assertions for overflow, overlap, fixed navigation occlusion, safe-area spacing, and clipped button text.
- Use ARIA assertions for accessible names, roles, live regions, invalid states, expanded states, selected states, and dialog focus.

### Data flow

Scenario JSON -> fixture builder -> browser context -> deterministic route fulfillment -> UI state -> audit layers -> sanitized artifacts -> findings JSON -> baseline Markdown report -> user approval.

### Dependencies

- Existing Playwright, axe-core, Vitest, and Next scripts.
- Existing app routes and components.
- Stage 5/6 closed behavior as regression boundary.

### Errors and edge cases

- Any unexpected external network request fails the harness.
- Any generated evidence containing token, cookie, real-looking email, real-looking phone, raw body, or health-like free text fails the harness.
- Any missing mandatory scenario becomes a P0 harness finding.
- If a finding needs backend/API/security changes, it is recorded but not fixed in Stage 7 without a separate user-approved scope exception.

### Tests

- `npm run audit:stage-7`
- JSON parse of scenario and finding files
- Artifact privacy scan
- Harness helper Vitest tests where helpers are non-trivial

### Validation metrics

- Every mandatory scenario group has at least one executable scenario.
- Dietitian role has full dashboard coverage.
- Owner/admin/assistant/auditor roles have boundary-focused coverage.
- Turkish has full coverage.
- English, German, Portuguese, Spanish, French, and Arabic have critical smoke and overflow coverage.
- All required browser profiles are represented according to the matrix.

### Completion criteria

- Baseline audit evidence exists.
- Findings JSON contains all discovered issues or explicitly records zero findings.
- No UI remediation is present in the Stage 7.1 diff.
- User approves the findings before Stage 7.2 starts.

## 10. Phase 7.2 - Shared, Public, Commercial, Auth, Onboarding, Install, And Admin Remediation

### Purpose

Resolve approved P0/P1/P2 findings on shared frontend foundations and non-dashboard surfaces.

### Scope

- Shared design tokens, typography, layout primitives, form controls, buttons, focus styles, dialogs, toasts, empty/error/loading states, and localization text only where a Stage 7 finding requires the change.
- Public landing/contact, login, purchase, onboarding, install, admin, and emergency admin surfaces.
- Representative before/after snapshots and updated finding statuses for affected scenarios.

### Preconditions

- Stage 7.1 findings are approved.
- No open P0 remains without a user-approved targeted fix plan.
- Each remediation item maps to at least one finding ID.

### Affected components and files

- Public/auth/onboarding/admin routes under `app/src/app/**`.
- Shared UI and design system components under `app/src/components/**` and `app/src/lib/**`.
- Style files under `app/src/styles/**` or existing global CSS ownership.
- Stage 7 visual tests and snapshots under `app/tests/visual/stage-7/**`.
- `docs/PHASE_85_STAGE_7_FINDINGS.json`.
- New `docs/PHASE_85_STAGE_7_PHASE_2_PUBLIC_SHARED_REMEDIATION_EVIDENCE.md`.

### Architectural decisions

- Existing Phase 85 SiriusAI design system is the visual authority; Stage 7.2 is polish and correctness, not redesign.
- Shared fixes must reduce duplication and align affected surfaces without changing domain behavior.
- Public/commercial flows remain synthetic/local in tests. No live billing or production checkout is enabled.

### Implementation steps

1. Sort approved findings by severity and shared root cause.
2. Fix shared primitives before route-specific layout.
3. Fix public/commercial/auth/onboarding/admin route layouts in this order: P0, shared P1/P2, public/contact, login, purchase, onboarding/install, admin/emergency admin, P3 if approved.
4. Update tests for affected scenarios only after the user approves representative before/after visuals.
5. Update findings to `resolved`, `accepted_p3`, or `not_reproducible` with evidence paths.
6. Produce Phase 7.2 evidence.

### Technical methods

- Prefer existing components and tokens.
- Use CSS grid/flex constraints, min/max widths, safe-area insets, container-aware wrapping, and fixed dimensions for toolbars/buttons/counters.
- Use lucide icons where an existing icon button is appropriate.
- Use accessible names and visible focus styles from existing patterns.
- Do not introduce nested cards or marketing-only decorative structures.

### Data flow

Approved findings -> targeted shared/route changes -> local visual review -> user before/after approval -> test baseline update -> finding status update -> Phase 7.2 evidence.

### Dependencies

- Stage 7.1 approved finding register.
- Existing design system and shared components.

### Errors and edge cases

- A fix that affects dashboard shell behavior stops and moves to Stage 7.3.
- A fix requiring backend/API changes stops and requires separate approval.
- A visual update without user-approved before/after evidence cannot be committed as closure evidence.

### Tests

- Affected Stage 7 Playwright scenarios.
- Affected axe checks.
- Affected keyboard/ARIA checks.
- Targeted build/type/lint only if edited files require it.

### Validation metrics

- All Stage 7.2-owned P0/P1/P2 findings are resolved.
- No new P0/P1/P2 finding appears on public/commercial/auth/onboarding/admin scenarios.
- No iPhone physical pass claim is introduced.
- Production remains `NO-GO`.

### Completion criteria

- Stage 7.2 evidence exists.
- Findings JSON is reconciled for Stage 7.2-owned findings.
- User approves representative visual changes.
- Stage 7.3 is not started without separate approval.

## 11. Phase 7.3 - Dashboard And Installed-PWA Remediation

### Purpose

Resolve approved P0/P1/P2 findings on dashboard and installed-PWA user workflows while preserving Stage 5 and Stage 6 contracts.

### Scope

- Dashboard shell integration, overview, roster, workspace, forms, nutrition, menu, AI/context, messaging, alerts, notifications, simulator, general AI chat, voice, settings, and More.
- Mobile installed-PWA layout, navigation, safe-area, offline-lock presentation, update prompts, dirty/conflict/read-only state presentation, and dense data panels.
- Representative before/after snapshots and updated finding statuses for affected dashboard/PWA scenarios.

### Preconditions

- Stage 7.2 is complete or the user explicitly approves parallel handling of independent Stage 7.3 findings.
- Stage 5 and Stage 6 closure contracts remain authoritative.
- No backend/API/security change is included without separate approval.

### Affected components and files

- `app/src/app/dashboard/**`.
- `app/src/components/dashboard-app.tsx`.
- `app/src/components/dashboard/**`.
- Stage 5 shell consumer components only where a Stage 7 dashboard finding requires presentation-level changes.
- Existing dashboard hooks under `app/src/lib/**` only for presentation state, not domain contract changes.
- Stage 7 visual tests and snapshots.
- `docs/PHASE_85_STAGE_7_FINDINGS.json`.
- New `docs/PHASE_85_STAGE_7_PHASE_3_DASHBOARD_PWA_REMEDIATION_EVIDENCE.md`.

### Architectural decisions

- Stage 5 owns shell bootstrap, session, active client, navigation guard, offline/update behavior, and service-worker policy.
- Stage 6 owns bounded dashboard workflows and mutation semantics.
- Stage 7.3 may change rendering, layout, responsive behavior, copy, accessible labels, focus behavior, and frontend state feedback.
- Stage 7.3 may not change mutation semantics, data isolation, persistence, offline edit policy, or service-worker network policy.

### Implementation steps

1. Sort dashboard/PWA findings by P0, P1, P2, then P3.
2. Fix wrong-client, privacy-lock, or fail-closed presentation findings first.
3. Fix mobile navigation, safe-area, overflow, keyboard, focus, and dense-panel layout findings.
4. Fix empty/loading/error/dirty/conflict/read-only/stale/offline feedback inconsistencies.
5. Fix desktop density and dashboard hierarchy findings.
6. Validate with mocked UI scenarios and PWA-enabled scenarios separately.
7. Collect representative before/after evidence for user approval before updating snapshots.
8. Update finding statuses and write Phase 7.3 evidence.

### Technical methods

- Use existing Stage 5 shell APIs and Stage 6 hooks.
- Use stable dimensions for fixed-format elements.
- Use locator snapshots for dense dashboard panels.
- Use full-page snapshots for shell/top-level routes.
- Use state snapshots for dialogs, offline lock, dirty guard, conflict, and error states.
- Use Playwright keyboard flows for tab order, dialog focus trap, escape behavior, and back/forward determinism.

### Data flow

Approved dashboard findings -> targeted UI/state-feedback changes -> mocked UI verification -> PWA-enabled verification -> user visual approval -> snapshot update -> finding reconciliation -> Phase 7.3 evidence.

### Dependencies

- Stage 5 shell closure evidence.
- Stage 6 dashboard closure evidence.
- Stage 7.1 finding register.

### Errors and edge cases

- If a dashboard finding proves Stage 5 or Stage 6 behavior is wrong, the phase stops and records a separate scope exception request.
- If a PWA test requires service-worker policy changes, the phase stops because Stage 7 excluded SW policy changes.
- If offline content remains mounted where Stage 5 says protected content must unmount, the issue is P0.

### Tests

- Affected Stage 7 dashboard scenarios.
- PWA-enabled install/offline/update/privacy scenarios.
- Keyboard, ARIA, geometry, and axe layers for affected scenarios.
- Stage 5/6 targeted regression checks where touched surfaces overlap.

### Validation metrics

- All Stage 7.3-owned P0/P1/P2 findings are resolved.
- Dashboard mobile and desktop layouts have no overlap, clipping, unsafe safe-area collision, or hidden critical control in required profiles.
- Offline/session-locked protected content remains unmounted or hidden according to Stage 5.

### Completion criteria

- Stage 7.3 evidence exists.
- Findings JSON is reconciled for Stage 7.3-owned findings.
- User approves representative dashboard/PWA before/after visuals.
- Stage 7.4 is not started without separate approval.

## 12. Phase 7.4 - Accessibility, Browser, Responsive, Performance, And Bundle Closure

### Purpose

Close cross-cutting verification after remediation and prove no browser, accessibility, responsive, performance, or bundle regression remains.

### Scope

- Full Stage 7 verification runner.
- Accessibility, browser, responsive, visual, geometry, keyboard, ARIA, performance, and bundle gates.
- Desktop NVDA manual smoke and Android TalkBack preparation checklist.
- Stage 5/6 regression preservation.

### Preconditions

- Stage 7.2 and Stage 7.3 are complete or remaining findings are explicitly outside their scope.
- All open findings have an assigned remediation status or a documented reason for Stage 7.4 ownership.

### Affected components and files

- `app/scripts/verify-stage-7.mjs`.
- `app/scripts/measure-stage-7-lab-perf.mjs`.
- Stage 7 Playwright config/test files.
- Stage 7 evidence helper files.
- `app/package.json` commands `verify:stage-7` and `test:stage-7-lab-perf`.
- `docs/PHASE_85_STAGE_7_FINDINGS.json`.
- New `docs/PHASE_85_STAGE_7_PHASE_4_A11Y_BROWSER_PERF_EVIDENCE.md`.

### Architectural decisions

- `verify:stage-7` is a hard gate. It fails on any open P0/P1/P2 finding, required scenario failure, artifact privacy failure, skipped required check, flaky retry dependency, timeout, invalid JSON, or missing evidence.
- Pixel diffs are strict by default. Per-screenshot mask, maxDiff, or stylePath is allowed only with a technical justification recorded in evidence.
- Performance uses local lab budgets, not field Core Web Vitals claims.

### Implementation steps

1. Convert audit runner into hard verification runner.
2. Add closure validation against finding statuses.
3. Add Stage 7 lab performance route scope using existing Stage 5 targets: p75 LCP <= 2500 ms, p75 CLS <= 0.1, p75 TBT <= 200 ms, p75 interaction proxy <= 200 ms.
4. Add shell gzip bundle guard: shell gzip <= 110% of existing Stage 5 baseline.
5. Add privacy artifact scan to the hard gate.
6. Execute full automated Stage 7 verification.
7. Execute desktop NVDA critical manual smoke and record result.
8. Prepare Android TalkBack and physical Android validation steps for Stage 7.5.
9. Write Phase 7.4 evidence.

### Technical methods

- Reuse Stage 5 performance measurement structure.
- Use 10 local lab runs and p75 aggregation for performance.
- Use Playwright browser profiles for Chromium, WebKit, and Firefox coverage.
- Use axe automated checks plus manual keyboard and NVDA smoke for coverage that automation cannot prove.
- Use sanitized Markdown summaries and JSON reports.

### Data flow

Reconciled findings + scenario matrix + remediated frontend -> hard verification runner -> performance/bundle/a11y/browser reports -> Phase 7.4 evidence.

### Dependencies

- Completed remediation phases.
- Existing Stage 5 performance and bundle baselines.
- Playwright browser binaries and local Windows environment.

### Errors and edge cases

- Any required skipped check fails closure.
- Any performance/bundle failure creates or reopens a finding.
- Any browser-specific WebKit emulation issue creates a finding but does not become physical iPhone evidence.

### Tests

- `npm run verify:stage-7`
- `npm run test:stage-7-lab-perf`
- Stage 5/6 targeted regression commands required by touched surfaces.
- Desktop NVDA manual smoke checklist.

### Validation metrics

- Zero open P0/P1/P2 findings.
- All required automated scenarios pass without skip/flaky/timeout/blocked.
- WCAG 2.2 AA internal target passes for tested surfaces.
- Performance and bundle budgets pass.
- No secret/privacy artifact scan failure.

### Completion criteria

- Stage 7.4 evidence exists.
- `verify:stage-7` has at least one clean run.
- Stage 7.5 is not started without separate approval.

## 13. Phase 7.5 - Final Evidence And Closure Decision

### Purpose

Produce final Stage 7 and Phase 85 frontend closure evidence after repeated clean automation and physical Android/TalkBack validation.

### Scope

- Two consecutive clean automated Stage 7 verification runs.
- Physical Android Chrome and installed Android PWA critical smoke.
- Android TalkBack critical smoke.
- Final `release:verify`.
- Final closure decision JSON and evidence Markdown.

### Preconditions

- Stage 7.4 is complete.
- No open P0/P1/P2 findings exist.
- All P3 findings are resolved or explicitly accepted by user.

### Affected components and files

- `docs/PHASE_85_STAGE_7_REAL_DEVICE_VALIDATION_REPORT.json`.
- `docs/PHASE_85_STAGE_7_FINAL_CLOSURE_EVIDENCE.md`.
- `docs/PHASE_85_STAGE_7_CLOSURE_DECISION.json`.
- `docs/PHASE_85_STAGE_7_FINDINGS.json`.
- Continuity documents only after final closure is proven and only if the user separately approves the update.

### Architectural decisions

- Stage status may become `STAGE_7_CLOSED` only after all Stage 7.5 gates pass.
- Phase 85 frontend redesign may become `PHASE_85_FRONTEND_REDESIGN_CLOSED` only after Stage 7 closes.
- Physical iPhone fields remain `WAIVED_NOT_EXECUTED`.
- Production remains `NO-GO`.

### Implementation steps

1. Run `verify:stage-7` twice consecutively from a clean state.
2. Run physical Android Chrome critical smoke.
3. Run installed Android PWA critical smoke.
4. Run Android TalkBack critical smoke.
5. Run `release:verify`.
6. Run final privacy scan.
7. Write real-device report with Android `PASS` and iPhone `WAIVED_NOT_EXECUTED`.
8. Write final closure evidence.
9. Write closure decision JSON.
10. Ask the user for explicit approval before any commit, continuity update, push, merge, PR, deployment, or production-status change.

### Technical methods

- Use the Stage 7 real-device checklist and existing Android evidence style from Stage 5/6.
- Store only sanitized representative device screenshots and metadata.
- Preserve exact command output summaries and hashes in evidence.

### Data flow

Clean automation run 1 + clean automation run 2 + physical Android evidence + TalkBack evidence + release verification + privacy scan -> final evidence -> closure decision JSON.

### Dependencies

- Completed Stage 7.4.
- Available physical Android device for critical smoke.
- Available desktop NVDA environment.
- No physical iPhone requirement.

### Errors and edge cases

- Any failure in run 1 resets the two-run count to zero.
- Any failure in run 2 resets the two-run count to zero after remediation.
- Any physical Android or TalkBack failure opens a finding and blocks closure.
- Any iPhone physical evidence field set to `PASS` fails closure.
- Any production status other than `NO-GO` fails closure unless a separate production authorization exists.

### Tests

- Two consecutive `npm run verify:stage-7` runs.
- Physical Android Chrome smoke.
- Installed Android PWA smoke.
- Android TalkBack smoke.
- `npm run release:verify`.
- Final artifact privacy scan.

### Validation metrics

- Two consecutive clean automated Stage 7 runs.
- Physical Android Chrome `PASS`.
- Installed Android PWA `PASS`.
- Android TalkBack `PASS`.
- Physical iPhone Safari and PWA `WAIVED_NOT_EXECUTED`.
- `release:verify` pass.
- Zero open P0/P1/P2 findings.
- All artifacts pass privacy scan.

### Completion criteria

- `docs/PHASE_85_STAGE_7_CLOSURE_DECISION.json` states `STAGE_7_CLOSED`.
- `docs/PHASE_85_STAGE_7_FINAL_CLOSURE_EVIDENCE.md` exists.
- Phase 85 frontend redesign closure is stated only with Stage 7 closure evidence.
- Production remains `NO-GO`.

## 14. Mandatory Scenario Groups

The canonical scenario groups are defined in `docs/PHASE_85_STAGE_7_SCENARIO_MATRIX.json` and summarized here:

- `public-contact`: landing contact normal, invalid, rate-limit, and error.
- `auth-login`: normal, sent, invalid, rate-limit, and error.
- `purchase-claim`: valid, invalid, expired, consumed, pending, cancel, and success.
- `onboarding-install`: unauthenticated, claimable, incomplete, duplicate, already-claimed, pending, error, eligible install, ineligible install, installed, non-installable, and revoked.
- `admin`: login, non-allowlist, unauthorized, empty, dense, error, emergency secondary, invalid token, and secure error.
- `dashboard-shell`: shell, overview, roster, workspace, settings, More, offline, update, session lock, dirty navigation, and active-client state.
- `dashboard-client`: forms, nutrition, menu, context, AI controls, read-only, conflict, stale, loading, empty, error, dense, and offline states.
- `communications`: messaging list/detail, alerts, notifications, simulator, general AI chat, voice, filters, client-linked navigation, and stale/dirty/offline states.
- `accessibility`: keyboard, focus, dialogs, labels, live regions, reduced motion, contrast, reflow, NVDA, and TalkBack.
- `performance`: local lab route scope, p75 budgets, shell gzip guard, and interaction proxy.

## 15. Roles, Languages, And Browser Profiles

Roles:

- `dietitian`: full coverage for dashboard and commercial flows.
- `owner`: boundary-focused coverage for admin, entitlement, dashboard, and settings.
- `admin`: boundary-focused coverage for admin and dashboard operations.
- `assistant`: boundary-focused read/write denial and scoped access coverage.
- `auditor`: read-only and denial coverage.

Assignment access:

- `care_team`: full client workspace access for allowed workflows.
- `viewer`: read-only and mutation denial states.
- `none`: fail-closed non-disclosing denial.

Languages:

- `tr`: full coverage.
- `en`, `de`, `pt`, `es`, `fr`, `ar`: critical smoke, navigation, high-risk flows, and overflow coverage.
- German and Portuguese must include long-string stress checks.

Browser profiles:

- Desktop Chromium 1440x900.
- Desktop Chromium 1728x1117.
- Tablet Chromium 768x1024.
- Android Chromium 390x844.
- iPhone 13 WebKit 390x844 emulation.
- iPad Pro 11 WebKit emulation.
- Desktop Firefox 1440x900.
- Reflow Chromium 320x720.
- Mobile landscape Chromium 844x390.

Main snapshots are taken on core profiles. Edge profiles use behavior, geometry, axe, ARIA, keyboard, and targeted snapshots according to risk.

## 16. Artifact Privacy Policy

Allowed committed artifacts:

- Sanitized JSON summaries.
- Sanitized Markdown evidence.
- Selected representative screenshots.
- Hashes and command summaries.
- Finding records with synthetic IDs only.

Forbidden committed artifacts:

- Cookies.
- Auth/session tokens.
- Raw request or response bodies.
- Real emails, phone numbers, names, client identifiers, health details, payment details, or realistic clinical narratives.
- Trace zip files, videos, full HTML dumps, browser storage dumps, and full axe raw dumps.

The required synthetic identifiers use `example.com`, `tenant-stage7-*`, `client-stage7-*`, and non-medical placeholder text.

## 17. Rollback And Stop Rules

- P0 stops the active phase.
- Any backend/API/RLS/auth/billing/channel/provider/clinical/service-worker policy requirement stops the phase until the user approves a scope exception.
- Any secret or privacy artifact stops the phase and requires artifact deletion plus evidence regeneration.
- Any user-unapproved snapshot baseline update is invalid.
- Rollback is targeted to the Stage 7 change that caused the regression. Destructive reset, broad checkout, or unrelated revert is not allowed without explicit user instruction.

## 18. Final Closure Rules

Stage 7 closes only when all of the following are true:

- All six phases are complete and evidenced.
- P0/P1/P2 findings are zero.
- All findings are `resolved`, `accepted_p3`, or `not_reproducible`.
- User-approved representative visuals exist for remediation phases.
- Visual, geometry, behavior, ARIA, axe, keyboard, responsive, browser, PWA, performance, and bundle gates pass.
- Desktop NVDA, physical Android Chrome, installed Android PWA, and Android TalkBack critical smokes pass.
- Stage 5 and Stage 6 regressions are clean.
- `release:verify` passes.
- Two consecutive clean automated Stage 7 runs pass.
- No skip, flaky, timeout, or blocked required check is counted as pass.
- Privacy scans are clean.
- iPhone physical validation remains `WAIVED_NOT_EXECUTED`.
- Production remains `NO-GO`.

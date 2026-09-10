# AIya Performance Phase 1.2 Plan - Measurement Validity and Causal Diagnosis

## Purpose

Phase 1.2 verifies whether Phase 1 actually measured the owner-reported slow path: after login, the dashboard and every authenticated work area feel slow on desktop web, mobile web, and installed app/PWA.

Production remains `NO-GO`.

## Scope

Included files:

- `app/scripts/measure-aiya-performance-phase-1-2.mjs`
- `app/scripts/performance-phase-1-2.test.mjs`
- `app/package.json`
- `docs/AIYA_PERFORMANCE_PHASE_1_2_PLAN.md`
- `docs/AIYA_PERFORMANCE_PHASE_1_2_EVIDENCE.json`
- `docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json`
- `docs/AIYA_PERFORMANCE_PHASE_2_EXECUTION_SCOPE.md`
- `HANDOFF_FOR_NEXT_CODEX.md`

Excluded work:

- Runtime UI/API behavior changes
- Supabase schema or migration changes
- Dependency changes
- Deployment or production gate changes
- Live seed/reset
- Provider/channel egress
- Raw payload, cookie, prompt, token, or clinical-content capture

## Preconditions

1. Branch must remain `codex/production-readiness-stage-1`.
2. Worktree may contain only Phase 1.2 files while the phase is running.
3. Phase 1 local commit is the starting baseline.
4. Physical Android must be connected through ADB before physical-device readiness can be represented.
5. Live release-health endpoints may be read, but live authenticated journeys must not be mutated.

## Sequential Stages

### 1.2.1 Source And Environment Identity

Record branch, HEAD, upstream, `git diff --check`, package commands, and live release identity.

Completion criterion: evidence contains local HEAD, upstream state, diff-check result, and both live release-health responses.

### 1.2.2 Correct Post-Login Scenario Contract

Replace Phase 1's obsolete `workspace=` scenario shape with canonical dashboard routing:

- `/dashboard`
- `/dashboard?section=clients`
- `/dashboard?section=clients&clientId=client-mert&clientTask=forms`
- `/dashboard?section=clients&clientId=client-mert&clientTask=nutrition`
- `/dashboard?section=clients&clientId=client-mert&clientTask=menu`
- `/dashboard/ai-chat`
- `/dashboard?section=messages`
- `/dashboard?section=alerts`
- `/dashboard?section=notifications`

Completion criterion: unit test proves every workspace scenario includes `clientId` and `clientTask`, and no scenario uses `workspace=`.

### 1.2.3 Harness Validity Controls

The harness must:

- Perform real `click()` actions, not `trial: true`.
- Require feature-specific success selectors for forms, nutrition, menu, and AI Chat.
- Record response body-finished duration without recording bodies.
- Mark 401, 403, 500, timeout, wrong-panel, and missing-action cases as `FAIL`.
- Leave missing LCP as `null`; it must not substitute FCP or DOMContentLoaded as LCP.

Completion criterion: `test:performance-phase1.2` validates scenario contract, redaction contract, and merged-manifest behavior.

### 1.2.4 Desktop Warm-Session Diagnostic

Run local production build and `next start` with fallback store enabled. Use one persistent desktop browser context across all authenticated scenarios so accumulated runtime effects are visible.

Completion criterion: evidence records per-scenario samples, p75 values, failed request counts, slowest sanitized requests, long-task metrics, and bundle inventory.

### 1.2.5 Physical Android Readiness

Record ADB device list, model, Android version, Chrome version, and whether a DevTools debug target is visible.

Completion criterion: evidence status is either `READY_FOR_CDP_CAPTURE` or a non-PASS blocker explaining exactly why capture was not possible.

### 1.2.6 Browser/API/Body-Finish Correlation

For each scenario, correlate visible readiness with API count, failed API count, slowest body-finished requests, total blocking time, max long task, and click feedback.

Completion criterion: no scenario can be marked PASS when its authenticated API requests fail.

### 1.2.7 Single-Variable Local Comparison

Run desktop persistent context and Android-emulated persistent context with the same scenario list and same local server.

Completion criterion: evidence shows whether slow/failing behavior is desktop-only, emulation-only, or shared.

### 1.2.8 Phase 1 Finding Reclassification

Classify Phase 1 findings as still supported, measurement-gap, measured candidate, disproved, or unobserved.

Completion criterion: combined manifest preserves Phase 1 findings and adds Phase 1.2-only findings when corrected harness output proves them.

### 1.2.9 Merged Phase 1 + 1.2 Manifest

Write `docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json` and `docs/AIYA_PERFORMANCE_PHASE_2_EXECUTION_SCOPE.md`.

Completion criterion: Phase 2 scope references only confirmed measurement gaps, measured candidates, or Phase 1 findings still supported after Phase 1.2.

### 1.2.10 Final Checks And Handoff

Run:

- `npm run test:performance-phase1.2`
- `npm run audit:performance:phase1.2`
- `npm run test:performance-audit`
- `git diff --check`
- `git status --short --branch`

Completion criterion: every stage above is represented in evidence. Tests alone do not close this phase; skipped, stale, simulated, environment-blocked, or failed results are not PASS.

## Data Flow

The harness starts local `next start`, opens browser contexts, navigates to known authenticated/fallback surfaces, listens to request/response timing, waits for body finish, verifies DOM selectors, performs real clicks, and writes sanitized aggregate evidence. It does not store request headers, response headers, request bodies, response bodies, cookies, prompts, tokens, or raw clinical content.

## Tenant Isolation And Security Impact

No tenant authorization model changes are made. All runtime tenant, account, actor, membership, role, capability, RLS, service-role, expected-revision, and idempotency behavior remains unchanged. The diagnostic records only route-level timing metadata and sanitized paths.

## Phase Closure Rule

Phase 1.2 closes only if all planned stages are executed exactly as specified and represented in evidence. Passing tests are required but insufficient. Physical Android/PWA capture that is blocked may be recorded honestly, but it cannot be counted as PASS and cannot by itself authorize Phase 2 runtime optimization.

# Phase 85 Stage 7R.1 Deterministic Audit Harness Rebuild Evidence

Date: 2026-08-24

Status: **STAGE_7R_1_HARNESS_REBUILD_COMPLETE_REBASELINE_REQUIRED**

Stage 5: **STAGE_5_CLOSED**

Stage 6: **STAGE_6_CLOSED**

Physical iPhone: **WAIVED_NOT_EXECUTED**

Production: **NO-GO**

## Result

Stage 7R.1 rebuilds the deterministic audit harness contract before any trusted visual or accessibility rebaseline. This phase changes test harness and documentation only. It does not remediate product UI, API behavior, migrations, RLS, service-worker policy, deployment, production gates, provider/channel egress, billing, or real-data paths.

## Implemented Harness Changes

- `Stage7AssignmentAccess` now includes `none`, matching the canonical matrix and allowing explicit no-assignment/no-access scenarios.
- `requiredAssertions` are now typed through a closed `STAGE7_REQUIRED_ASSERTIONS` registry. Unknown assertion names fail schema parsing before a scenario can run.
- `accessibilityChecks` are now typed through a closed registry for `axe-wcag-a-aa`, `keyboard-tab`, and `aria-roles`.
- `stage-7-assertions.ts` dispatches every required scenario assertion. Assertion failures are recorded as Stage 7 findings instead of silently existing as metadata.
- The runner injects scenario role, assignment access, locale, scenario id, and deterministic clock into browser storage and HTTP headers before navigation.
- The runner no longer mutates app state with `page.request.post('/api/app-state')`; browser-visible route interception remains the only test data path.
- External network requests and uncataloged local `/api/**` requests are hard harness failures.
- The API fixture layer no longer returns a default `{ ok: true }` fallback for unknown API paths.
- `audit:stage-7` cleans `app/test-results/stage-7` before a run so stale findings cannot be merged into new evidence.
- Normal `npm run test:stage-7` no longer rewrites the tracked scenario matrix. Matrix rewriting is isolated behind explicit `npm run generate:stage-7-matrix`.
- `docs/PHASE_85_STAGE_7_SCENARIO_MATRIX.json` was regenerated once through `npm run generate:stage-7-matrix` after the schema/catalog contract changed.

## Resolved Locked Findings

- `S7R-F-001`: required scenario assertions are now typed and dispatched.
- `S7R-F-003`: role, locale, and assignment access now enter the browser context; assignment access `none` is supported by schema and catalog.
- `S7R-F-005`: deterministic network fixture behavior now fails closed for external and uncataloged local API requests.

## Still Open

- `S7R-F-002`: final Stage 7 hard gate remains Stage 7R.5.
- `S7R-F-004` and `S7R-F-010`: trusted visual baseline and user approval remain Stage 7R.2.
- `S7R-F-006`: full committed/generated artifact privacy scanning remains open.
- `S7R-F-007`, `S7R-F-008`, `S7R-F-011`, `S7R-F-012`, `S7R-F-013`, and `S7R-F-015`: final accessibility/manual AT, skip, performance, TalkBack, freshness, and isolated-build closure remain Stage 7R.5.
- `S7R-F-009`: runtime focus and ARIA remediation remains Stage 7R.3.

## Verification

Required for this documentation/test-harness phase:

- `npm run test:stage-7`
- `npm run generate:stage-7-matrix`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`
- Stage 7R JSON consistency check
- Stale Stage 7 closure wording scan
- `git status --short --branch`

Playwright visual rebaseline is intentionally deferred to Stage 7R.2. Product UI remediation is intentionally deferred to Stage 7R.3 and Stage 7R.4.

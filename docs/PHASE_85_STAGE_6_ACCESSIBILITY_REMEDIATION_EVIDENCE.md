# Phase 85 Stage 6 Accessibility Remediation Evidence

Date: 2026-08-20

Status: `ACCESSIBILITY_REMEDIATION_VERIFIED`

Stage 6 status: `NOT_CLOSED`

Remaining Stage 6 blocker: `S6-P4-DEVICE`

Production status: `NO-GO`

Current supersession note, 2026-08-21: this file is historical pre-closure evidence for the accessibility remediation checkpoint. Its `NOT_CLOSED` and `S6-P4-DEVICE` wording was true at this checkpoint and is superseded by `docs/PHASE_85_STAGE_6_CLOSURE_DECISION.json`, which closes Stage 6 locally with physical Android evidence and an explicit `WAIVED_NOT_EXECUTED` iPhone validation waiver. The iPhone waiver is not PASS and production remains `NO-GO`.

## Scope And Decision

This remediation closes the `S6-P4-A11Y` blocker recorded by `docs/PHASE_85_STAGE_6_PHASE_4_INTEGRATION_CLOSURE_EVIDENCE.md`. It changes no API, persistence, tenant, actor, capability, active-client, dirty-state, revision, service-worker, provider/channel, billing, production rollout, or offline-data contract.

At this historical checkpoint, Stage 6 remained open. Physical iPhone Safari, installed iPhone PWA, physical Android Chrome, and installed Android PWA evidence still had to execute the post-remediation Stage 6 workflow before closure.

## Implementation

- `app/src/components/dashboard/client-form-panel.tsx` gives every schema field a stable React-generated label id and binds text, number, date, textarea, select, and multiselect controls with `aria-labelledby`.
- `app/src/components/dashboard/shared.tsx` adds optional `ariaLabelledBy` support to the existing `SelectInput`; existing callers and value/change behavior remain unchanged.
- `app/src/components/food-rules-panel.tsx` gives catalog and free-text remove buttons item-specific accessible names, hides decorative `X` icons from the accessibility tree, and replaces failing small-text contrast uses with the existing `text-ink-muted` token.
- `app/src/components/dashboard/menu-workflow-export-section.tsx` raises the failing unavailable/export-preview text from `text-ink-subtle` to `text-ink-muted`.
- `app/src/components/dashboard/ai-assistant-control-panel.tsx` raises the three failing small explanatory labels from `text-ink-subtle` to `text-ink-muted`.
- `app/tests/visual/stage-6-workspace.visual.spec.ts` reads the canonical `data-workspace-stage` contract before using the mobile back control. This prevents a transient hidden task button from being misclassified as task stage and makes the bounded-resource test deterministic without changing product navigation.

## Verification Results

| Gate | Result |
| --- | --- |
| Targeted helper/domain Vitest | PASS: 5 files / 24 tests |
| Stage 6 axe, desktop + Android mobile | PASS: 12/12 |
| Forms, nutrition, menu, and AI control axe checks | PASS on both tested viewport classes; zero serious/critical blocking violations |
| Stage 6 functional workspace, desktop + Android mobile | PASS: 23 passed / 1 desktop-only assertion skipped on mobile |
| Initial pre-hardening functional observations | Two full runs each produced 22 passed / 1 expected skip / 1 mobile timeout at the hub assertion; the affected test passed 3/3 in isolation and 2/2 with its preceding save test. These runs are not represented as PASS. |
| Deterministic test correction | PASS: final full matrix passed after stage detection switched from target visibility to `data-workspace-stage` |
| Production typecheck | PASS |
| Lint | PASS with 0 errors / 70 pre-existing warnings |
| Full application Vitest | PASS: 261 files / 1558 passed / 9 optional environment/full-scale tests skipped |
| Production build | PASS |

The first Playwright attempt before rebuilding `.next` exercised the previous build and reproduced the historical failures. It was stopped and is not counted. The authoritative axe run used the new production build.

`npm run release:verify` was not rerun in this remediation unit. It passed in Phase 4 and was required to run again at final Stage 6 closure after the physical-device evidence decision; no Stage 6 closure was claimed in this checkpoint.

## Remaining Physical Gate

Each real-device capture group must use synthetic data and record `dashboard_home`, `first_client_workspace`, `forms_revision_save`, `nutrition_task`, `menu_task`, `ai_controls`, `client_scoped_messages`, `guarded_second_client_switch`, and `offline_privacy_lock`. Evidence must remain under `docs/stage-6-real-device/`, include SHA-256 hashes, state `realDevice=true`, state `emulator=false`, and pass `npm run test:stage-6-real-device`.

## Decision

`S6-P4-A11Y` is technically closed by the authoritative desktop/mobile axe PASS and retained workflow regression coverage. `S6-P4-DEVICE` remains open, so Stage 6 remains `NOT_CLOSED`. Stage 5 remains closed and production remains `NO-GO`.

# Phase 85 Stage 7R.5 Hard Gate and Evidence Reclosure

Date: 2026-08-24

Status: STAGE_7R_5_HARD_GATE_EVIDENCE_RECLOSED_VALIDATED_COMMITTED

Production: NO-GO

Physical iPhone: WAIVED_NOT_EXECUTED

Current supersession note, 2026-08-24: this file is historical Stage 7R.5 evidence. Its Stage 7-not-closed and Stage 7.5-not-started boundaries were true before the final Stage 7.5 run and are superseded by `docs/PHASE_85_STAGE_7_CLOSURE_DECISION.json`. Current Stage 7 status is locally `STAGE_7_CLOSED`; production remains `NO-GO`; physical iPhone remains `WAIVED_NOT_EXECUTED`, not PASS.

## Scope

Stage 7R.5 closes the remaining Stage 7R hard-gate and evidence-reclosure findings without changing production gates, provider/channel egress, RLS, migrations, service-worker policy, billing state, deployment state, or physical-device claims.

## Runtime Changes

- `app/src/components/purchase-flow.tsx` now focuses the checkout CTA after a successful invite eligibility result. This resolves the remaining WebKit iPad keyboard-tab finding where focus stayed on `BODY` after the purchase-valid state transition.
- `app/tests/visual/stage-7/stage-7-runner.ts` now clears Stage 7 route interceptors and closes the page after every scenario. This turns WebKit worker teardown hangs into hard failures if they return, instead of letting them be mistaken for successful audit evidence.

## Gate Changes

- `app/scripts/measure-stage-7-lab-perf.mjs` now measures an explicit fixed interaction on every route: focus the first enabled control and perform a Playwright trial click. `interactionProxyMs` includes this interaction duration instead of being only a long-task proxy.
- `app/scripts/verify-stage-7.mjs` now hard-gates Stage 7.4 on:
  - zero open P0/P1/P2 findings for `remediationPhase: "7.4"`;
  - zero findings in the current Stage 7 audit report;
  - all 10 Stage 7 projects represented with screenshots and zero project findings;
  - Stage 7.4 lab performance status `PASS`, all targets met, bundle budget within budget, and the fixed interaction protocol present;
  - NVDA smoke status `PASS` while preserving `certificationClaim: false` and production `NO-GO`;
  - privacy scanning for current Stage 7 text evidence and generated baseline artifacts.
- `npm run verify:stage-7:closure` is now the single hard-closure command for this layer. It runs production build, typecheck, lint, full deterministic Stage 7 audit, local lab performance, and the hardened Stage 7.4 gate in sequence.

## Evidence

- `docs/PHASE_85_STAGE_7_FINDINGS.json`: zero findings.
- `docs/PHASE_85_STAGE_7_BASELINE_AUDIT_REPORT.json`: zero findings across 10 Stage 7 projects.
- `docs/PHASE_85_STAGE_7_BASELINE_AUDIT_REPORT.md`: zero-finding baseline report.
- `docs/PHASE_85_STAGE_7_PHASE_4_LAB_PERF_REPORT.json`: `PASS`, `allTargetsMet: true`, fixed interaction protocol recorded.
- `app/.stage-7r-baseline-artifacts`: regenerated deterministic screenshots.

## Verification

- `npm run build`: PASS.
- `npm run typecheck`: PASS.
- `npx playwright test --project=stage-7-webkit-ipad tests/visual/stage-7/stage-7-audit.spec.ts -g "purchase.purchase-valid.dietitian.tr.webkit-ipad"`: PASS.
- `npm run audit:stage-7`: PASS, recorded 0 findings.
- `npm run test:stage-7-lab-perf`: PASS.
- `npm run verify:stage-7:7.4`: PASS.
- `npm run verify:stage-7:closure`: command added; constituent commands above were executed individually in this Stage 7R.5 run.

## Historical Non-Claims At This Checkpoint

- Stage 7 was not closed at this checkpoint; this is superseded by the final Stage 7.5 closure decision.
- Stage 7.5 had not started at this checkpoint; this is superseded by the final Stage 7.5 closure decision.
- Playwright WebKit iPhone/iPad evidence is not physical iPhone Safari/PWA evidence.
- Physical iPhone Safari/PWA remains `WAIVED_NOT_EXECUTED`, not PASS.
- NVDA smoke is not formal WCAG certification.
- Android TalkBack and physical Android Stage 7.5 validation are not executed in Stage 7R.5.
- Production remains `NO-GO`.

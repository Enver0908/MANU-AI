# Phase 77M: Master Rebaseline And Spec

Date: 2026-06-13
Status: Completed.
Production pilot: NO-GO.

## Goal

Create the canonical AI Quality Program PRD/tech spec, lock architectural decisions for Phase 77N-77Y, update continuity documents so WhatsApp production adapter work resumes only after Phase 77M-77Y, and close Phase 77M without runtime changes.

This phase does not approve production pilot launch, connect WhatsApp, connect Telegram, connect Gemini or any real external LLM provider, process real client health data, close any launch gate, accept R-405, or resolve R-405.

## PRD

The project needs a coherent AI quality track before channel work:

- Phase 77A-77L manual source authority and continuity closure are complete locally.
- Client reply quality must improve through answer planning, grounding, style fidelity, food understanding, and deterministic evaluation while preserving the existing green/yellow/red risk model.
- Unknown intent must not be treated as safe green clarification; fail-closed copilot, clarify, or handoff behavior is required in later phases.
- Style and persona may affect wording, tone, length, emoji policy, and response timing style only; they must never change clinical safety, source authority, or Food Decision V2.
- Narrow autopilot in later phases must remain deterministic and limited to explicitly supported, source-backed, low-risk green intent families.
- Production pilot must remain `NO-GO`.
- R-405 must remain open.
- Real provider, channel, WhatsApp, Telegram, Gemini, monitoring, secret-manager, and real-data paths must remain disconnected.

## Technical Scope

In scope:

- Add and maintain `docs/PHASE_77M_77Y_AI_QUALITY_MASTER_PLAN.md` as the canonical AI Quality Program PRD/tech spec for Phase 77M-77Y.
- Add this Phase 77M PRD/tech spec.
- Record that superseded alternate Phase 78A-M AI-quality numbering is not used because Phase 78-81 are already reserved for dependency/R-405, rehearsal, gate closure, and direct production GO.
- Record core-owned `responsePlan` produced after answerability and before provider/generation.
- Record `claimManifest` generated from `responsePlan`, deterministic templates, `sourceRefs`, and dietitian-authored/manual source authority, not extracted from free LLM output.
- Record shared text normalization extension through existing `dietitian-ai-assistant/src/normalize-safety-text.js` only; do not add another independent normalizer.
- Record that internal workflow states (`unknown_intent`, `needs_label`, `needs_review`, `clarify`, `handoff`, `block`) are operational states, not new client-visible warning classes.
- Update continuity docs:
  - `HANDOFF_FOR_NEXT_CODEX.md`
  - `PLAN.md`
  - `PROJECT_PLAN.md`
  - `README.md`
  - `app/README.md`
  - `docs/NEXT_PHASE_EXECUTION_PLAN.md`
  - `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`
  - `docs/PILOT_READINESS_EVIDENCE_PACK.md`
  - `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`
  - `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`
  - `docs/PHASE_77_MASTER_IMPLEMENTATION_PLAN.md`
  - `docs/RISK_REGISTER.md`
- Run required verification commands.

Out of scope:

- Runtime implementation for Phase 77N-77Y.
- WhatsApp production adapter.
- Real WhatsApp/Gemini/provider/channel connection.
- R-405 remediation or acceptance.
- External launch-gate approval or production GO.
- New datasets, templates, intent resolver, responsePlan contract, claim manifest generator, or evaluation harness code.

## Edge Cases

- If continuity docs still say WhatsApp adapter is the immediate next track, update the current guidance to Phase 77N while preserving historical phase notes where useful.
- If an older draft used Phase 78A-M for AI quality work, treat it as superseded by Phase 77M-77Y; do not renumber reserved Phase 78-81 production-readiness phases.
- If `docs/PHASE_77M_77Y_AI_QUALITY_MASTER_PLAN.md` already exists from an earlier commit, extend it rather than replacing the evidence trail.
- If verification finds only documented R-405 findings, keep R-405 open and treat the dependency gate as unchanged.

## Acceptance

- Phase numbering has no collision: AI quality work is Phase 77M-77Y; Phase 78-81 remain reserved for production-readiness closure.
- `docs/PHASE_77M_77Y_AI_QUALITY_MASTER_PLAN.md` exists and records the locked architecture decisions.
- Continuity and roadmap docs reference Phase 77N as the next implementation phase and defer WhatsApp adapter until Phase 77M-77Y is complete.
- Production pilot remains `NO-GO`.
- R-405 remains open.
- Every future Phase 77N-77Y implementation phase must start from its own PRD/tech spec or an explicit update to the master plan before runtime work.

## Verification

Completed on 2026-06-13:

```text
git diff --check: passed.
cd app; npm test: passed, 53 test files and 337 tests.
cd app; npm run release:verify: passed with core tests 173/173, app tests 337/337, lint with two pre-existing warnings, production build, and only documented R-405 findings.
```

R-405 remains open. Production pilot remains `NO-GO`. No real providers, channels, monitoring, secret manager, or real client health-data paths were connected.

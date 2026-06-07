# Phase 73: Health Regulation Calibration Spec

Date: 2026-06-07

## Goal

Convert the user-supplied Phase 73 health regulation decision matrix and golden-case labeling standard into a canonical local calibration layer that maps decision areas to green/yellow/red expectations, draft/handoff/quarantine actions, and acceptance metrics.

This phase does not activate production routing, approve any launch gate, connect Gemini/WhatsApp/monitoring/production Supabase, close R-405, or process real health data.

## User Input Source

External package: `faz_73_istenilenler` (project-external working file, 2026-06-07).

## Scope

- Add canonical Phase 73 official source references (`TR-001` … `TR-014`).
- Add the health regulation decision matrix with expected risk, auto-send eligibility, draft/handoff requirements, and source references.
- Add decision priority order for conflict resolution.
- Add Phase 73 golden-case records using the supplied labeling schema.
- Add deterministic calibration evaluation for copilot vs autopilot behavior.
- Add acceptance metric evaluation for unsafe green rate, yellow/red client-facing send, mixed-intent partial reply, covenant violations, and blocked provider paths.
- Keep calibration artifacts at `approvalStatus: draft` until external qualified clinical approval.
- Build on Phase 72 permission graph without activating production routing.

## Non-Goals

- No legal opinion or qualified dietitian sign-off replacement.
- No production pilot GO.
- No real provider/channel egress.
- No replacement of core clinical classifier runtime; Phase 73 records calibration artifacts and local evaluation helpers.

## Edge Cases

- Copilot mode never auto-sends; green decisions become draft-for-dietitian.
- Autopilot green auto-send requires active AI, completed safety checklist, permission ready, and source-backed answerability.
- Red decisions block LLM/provider attempts.
- Mixed-intent partial green replies are forbidden.
- Unknown identity, group messages, and opt-out block provider attempts.
- Covenant phrase violations are send-blocked.
- Production pilot remains `NO-GO` after Phase 73.

## Done Criteria

- Phase 73 decision matrix and golden cases are represented in code and test-covered.
- Calibration evaluator enforces copilot/autopilot and source-backed rules.
- Acceptance metric evaluation reports zero violations on the bundled golden suite.
- Continuity and evidence docs record Phase 73 status.
- `npm run release:verify` passes with only documented R-405 findings.

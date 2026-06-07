# Phase 75: Gemini Provider Gate Spec

Date: 2026-06-07

## Goal

Convert the user-supplied Phase 75 Gemini/provider decision pack into canonical local draft artifacts for provider surface selection, model routing, retention/logging/training-use policy, health-data eligibility, PromptContext allowlist enforcement, and launch-gate evidence requirements.

This phase does not enable real Gemini egress, approve provider/vendor launch gates, process real client health data through Google, close R-405, or change production pilot status.

## User Input Source

External package: `faz_75_istenilenler` (project-external working file, 2026-06-07).

## Scope

- Add forbidden and target provider surface definitions.
- Add green/yellow/red model routing matrix aligned with existing MANU-AI risk routing.
- Add training-use, logging, and retention policy artifacts.
- Add conditional health-data eligibility checklist.
- Add allowed/forbidden PromptContext provider input maps.
- Add required gate evidence catalog.
- Add deterministic provider routing and egress gate evaluators.
- Keep all artifacts at `approvalStatus: draft` until external legal/privacy and provider/vendor approval.

## Non-Goals

- No real Gemini API or Vertex AI connection.
- No client-side API keys or unpaid Gemini API path.
- No grounding, search, maps, tuning, file/image/audio input.
- No production pilot GO.

## Edge Cases

- Red risk never calls provider.
- Yellow provider use is internal draft/handoff only; no client-facing auto-send.
- Green without approved source support blocks before provider.
- Passive, manual, paused, opt-out, unknown identity, group, and removed clients block provider.
- Real egress requires env flag plus approved legal/privacy and provider/vendor gate evidence.
- Unpaid/consumer Gemini surfaces are always forbidden for health data.
- Production pilot remains `NO-GO` after Phase 75.

## Done Criteria

- Phase 75 provider pack artifacts are represented in code and test-covered.
- Routing evaluator enforces red no-provider and yellow no-client-send rules.
- Real Gemini egress remains blocked without approved evidence.
- Continuity and evidence docs record Phase 75 status.
- `npm run release:verify` passes with only documented R-405 findings.

# Phase 59 Architecture Review Remediation Spec

Date: 2026-06-03

## Goal

Implement validated findings from the external architecture review (`manu_ai_architecture_review.md`) as local/mock safety and maintainability hardening without changing production launch gates or connecting real providers/channels.

## Implemented Scope

1. **Fail-closed `decideModeAction`**: explicit `autopilot` branch; unknown modes return `ignore` with `unknown_ai_mode_blocked`.
2. **Core provider error boundary**: `handleInboundMessage` wraps `adapters.generateReply` in try/catch and returns safe `no_ai` with `providerStatus: failed` on unexpected errors.
3. **Clinical taxonomy hardening**: numeric glucose extraction for `şekerim` / `blood sugar` phrases; expanded multilingual `symptom_question` patterns; new golden cases.
4. **Yellow hold maintainability**: extract helpers from `appendCoreSimulationResult` without behavior changes.
5. **Multilingual voice profile**: minimal formal/informal term lists for supported languages.
6. **Provider token counting**: document provider-native counting as a future integration requirement (no runtime change).

## Non-Goals

- No real WhatsApp, Telegram, Gemini/external LLM, monitoring, secret manager, backup provider, or real health data.
- No production pilot launch gate approval.
- No R-405 dependency changes.
- No qualified dietitian taxonomy sign-off (local hardening only).
- No Gemini `countTokens` implementation in this phase.

## Verification

- `npm test` from `dietitian-ai-assistant`
- `npm test` and `npm run lint` from `app`
- `npm run release:verify` from `app`

## Production Pilot Status

Production pilot remains `NO-GO`. Clinical taxonomy gate remains open until qualified dietitian approval.

## Documentation Sync

This phase also required updating continuity docs: `HANDOFF_FOR_NEXT_CODEX.md`, `PLAN.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, and `docs/PHASE_24_DIETITIAN_VOICE_SAMPLE_INFRASTRUCTURE_SPEC.md`.

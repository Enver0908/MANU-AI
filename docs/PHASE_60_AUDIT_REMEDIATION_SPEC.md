# Phase 60 Audit Remediation Spec

Date: 2026-06-03

## Goal

Close validated findings from the Phase 59 post-implementation audit without changing production launch gates, connecting real providers/channels, or resolving R-405.

## Implemented Scope

1. **Glucose classifier hardening**: anchor-only numeric extraction near explicit glucose phrases; inclusive `<= 70` / `>= 250` mg/dL thresholds; deduplicated red reasons; classifier version `dietetic-risk-v0.3.1`.
2. **Provider failure metadata**: core `handleInboundMessage` returns `providerOutputSafety` on provider failures; app simulator relies on core boundary (removed redundant `MockProviderError` catch).
3. **Type contract alignment**: `dietitian-ai-assistant-architecture.d.ts` nullable fields and `compilePromptContext` object signature aligned with runtime.
4. **Expanded tests**: glucose false-positive/boundary cases, multilingual symptom golden cases, voice-profile samples, simulator unknown-mode and provider-output-safety coverage.
5. **Documentation continuity**: handoff, plan, execution plan, pilot evidence/gate docs, README, PROJECT_PLAN, risk register.

## Non-Goals

- No real WhatsApp, Telegram, Gemini/external LLM, monitoring, secret manager, backup provider, or real health data.
- No production pilot launch gate approval.
- No R-405 dependency changes.
- No schema/RLS/RPC changes in this phase.

## Verification

- `npm test` from `dietitian-ai-assistant` (104 tests after Phase 60)
- `npm test` and `npm run lint` from `app` (138 tests)
- `npm run release:verify` from `app`

## Production Pilot Status

Production pilot remains `NO-GO`. Clinical taxonomy gate remains open until qualified dietitian approval.

## Documentation Sync

Updated: `HANDOFF_FOR_NEXT_CODEX.md`, `PLAN.md`, `PROJECT_PLAN.md`, `README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`, `docs/RISK_REGISTER.md`, `codex.md`.

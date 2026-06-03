# Phase 62 — Architecture Review Remediation Wave 2

Date: 2026-06-04

## Purpose

Remediate actionable findings from the post–Phase 61 architecture review without changing the user's accepted product decisions (Bulgu 1: red/passive/manual routing) or connecting real providers, channels, or launch gates.

## User decisions (locked)

- **Bulgu 1:** No change. Passive/manual clients do not receive automatic red handoff when AI is off; dietitian tracks manually.
- **Bulgu 2:** On provider failure (Gemini/API down), the client must not receive an AI reply. The dietitian receives a handoff + in-app notification (same path as quality-guard handoff, without client-facing send).
- **Bulgu 3 / 9 / 10:** Document as constraint-accepted (no code): real LLM/embedding modal diversity, independent safety axis without Bulgu 1 refactor, approved regulation corpus for active scope guard.

## Scope

| Finding | Action |
| --- | --- |
| Bulgu 2 | Core orchestrator catch → `handoff` + `onHandoff`; tests updated |
| Bulgu 5 | Shared `normalize-safety-text.js`; remove dead `modelForRisk` |
| Bulgu 6 | Glucose numeric window: skip non-glucose units; require mg/dL or mmol/L for unit-qualified escalation |
| Bulgu 7 | Comment: `riskDecisionOverride` is canonical in app path |
| Bulgu 8 | Retrieval overlap coefficient; retune `DEFAULT_MATCH_THRESHOLD` |
| Bulgu 3/9/10 | RISK_REGISTER + this spec only |

## Non-goals

- Bulgu 1 axis split, real Gemini/embedding, approved production corpus, WhatsApp/Telegram, monitoring, R-405 changes, launch gate closure.

## Done criteria

- Core and app tests pass; `npm run release:verify` passes with only documented R-405.
- Provider failure simulator/core tests expect `handoff` and handoff records.
- Continuity docs updated in the same change set.

# Phase 76L — Phase 72 Permission Graph Runtime Bridge Spec

**Status:** Implemented (2026-06-08)  
**Depends on:** Phase 72 regulation permission graph, Phase 76E food rule engine, Phase 76F answerability  
**Feeds:** Phase 76M calibration and metrics expansion

## Goal

Wire the draft Phase 72 permission graph into the simulator risk path as audit-first evidence, with gated local runtime enforcement only when external launch-gate evidence and `MANU_ALLOW_PHASE_72_ACTIVE_ROUTING=true` are both satisfied.

## Scope

### In scope

- Food-rule routing map and structured food-rule field allowlist extensions in `phase-72-permission-graph.ts`
- `phase-76l-permission-graph-runtime.ts` shadow/enforce bridge on simulator risk classification
- Permission graph evaluation records and `contextManifest.permissionGraph` decision metadata
- Conflict order: forbidden action > clinical risk > privacy gate > active red/yellow locks > answerability > green maximization
- Mixed-intent fail-closed tests for food-rule + clinical combinations

### Out of scope

- Core orchestrator hot-path wiring
- Production pilot GO or launch-gate closure
- Real Gemini/WhatsApp/channel connections

## Activation modes

1. **Shadow (default):** evaluate, audit, persist metadata; do not change risk routing.
2. **Enforce (gated):** escalate risk only when `isPhase72ActiveProductionRoutingAllowed` is true.

## Done criteria

- Food-rule permission decisions are audited on simulator inbound path.
- Production routing cannot activate without gate evidence and env flag.
- Mixed intent fail-closed behavior is test-covered.
- Verification passes with only documented R-405 findings.

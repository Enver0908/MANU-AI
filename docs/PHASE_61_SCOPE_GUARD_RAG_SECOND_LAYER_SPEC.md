# Phase 61 Scope Guard (RAG + LLM) Second Layer Spec

Date: 2026-06-04

## Goal

Add a mock-first scope guard second layer that uses retrieval (RAG-shaped) plus a scope evaluator (LLM-shaped) to detect dietitian-only / out-of-AI-scope work defined by a system-level rule corpus. The layer is escalate-only, independent from the existing clinical safety classifier, and does not connect real Gemini or embedding providers in this phase.

## Contract

- Scope guard may only raise risk (`green` -> `yellow`/`red`), never lower it.
- Empty or unapproved corpus -> no-op (existing classifier remains authoritative).
- Evaluator/retrieval failure -> fail-safe yellow escalation (`scope_guard_unavailable`).
- Audit records store rule ids and scores only, never raw client message bodies.
- Real provider/embedding activation requires `clinical_taxonomy_approval` launch gate plus explicit env flag; default is disconnected.

## Architecture

1. **Axis A (unchanged):** `classifyClinicalSafetyRisk` — emergency, medication, cumulative patterns.
2. **Axis B (new):** scope guard — approved corpus retrieval + deterministic mock evaluator + core `mergeScopeDecision`.
3. **Axis C (unchanged):** activation, mode, provider generation.

Core package stays pure (`scope-guard.js`). App owns I/O (`scope-retrieval.ts`, `scope-evaluator.ts`, `scope-guard-runtime.ts`, `scope-corpus.ts`).

## Components

| Component | Path | Role |
| --- | --- | --- |
| Core merge | `dietitian-ai-assistant/src/scope-guard.js` | Monotonic merge, rule application |
| Corpus governance | `app/src/lib/scope-corpus.ts` | Rules, chunks, approval helpers |
| Retrieval | `app/src/lib/scope-retrieval.ts` | Mock lexical retriever + disconnected real seam |
| Evaluator | `app/src/lib/scope-evaluator.ts` | Mock deterministic evaluator + disconnected real seam |
| Runtime | `app/src/lib/scope-guard-runtime.ts` | Wire retrieval + evaluator + merge |
| Schema | `app/supabase/migrations/20260604000000_phase_61_scope_corpus.sql` | System rules, chunks, evaluations |

## Fail-Safe Matrix

| Condition | Behavior |
| --- | --- |
| No approved rules | No-op |
| Score below threshold | No escalation |
| Rule match yellow/red | Escalate to rule level (max with base) |
| Retrieval/evaluator error | Yellow + `scope_guard_unavailable` |
| Base already red | Stays red |

## Non-Goals

- Real Gemini/embedding integration
- Loading production mevzuat corpus (placeholder draft only)
- Changing passive/manual red handoff product decision
- Production pilot gate approval or R-405 changes

## Verification

- `dietitian-ai-assistant`: `npm test`
- `app`: `npm test`, `npm run lint`, `npm run release:verify` (known R-405 only)
- Optional: `npm run test:rls` when local Supabase available

## Production Pilot Status

Remains `NO-GO`. Scope guard is local/mock evidence only until qualified dietitian approves corpus and external gates remain open.

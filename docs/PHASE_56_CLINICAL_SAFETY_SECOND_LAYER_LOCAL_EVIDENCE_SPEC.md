# Phase 56 Clinical Safety Second-Layer Local Evidence Spec

Date: 2026-06-03

## Goal

Add local evidence for a deterministic clinical safety second layer above the existing regex classifier. This phase keeps MANU-AI in local/mock mode and does not approve production pilot launch.

The second layer is a context-aware, fail-closed policy evaluator. It can escalate otherwise green messages to yellow review, but it does not downgrade yellow/red decisions and does not broaden red taxonomy without qualified dietitian approval.

## Implemented Scope

- Added a local deterministic second-layer evaluator for context-sensitive uncertainty.
- Kept the existing regex classifier as Layer 1 and preserved its public behavior.
- Added combined clinical safety classification that records both Layer 1 and Layer 2 evidence.
- Escalated green messages to yellow when local context shows allergy/restriction mentions, ambiguous clinical references, missing-history references, minor weight/restriction context, or eating-disorder-sensitive ambiguous restriction language.
- Routed escalated yellow messages to dietitian approval drafts instead of green autopilot send.
- Recorded second-layer reason codes in risk assessments and AI decision reasons.

## Non-Goals

- No real LLM-based safety evaluator was connected.
- No real Gemini, external LLM, WhatsApp, Telegram, monitoring, secret manager, backup provider, or real client health data was connected.
- No schema, migration, RLS policy, RPC, dependency, or production launch-gate approval changed.
- No qualified dietitian approval artifact was supplied or accepted.

## Verification

- `npm test` from `dietitian-ai-assistant`: 75/75 passed.
- `npm test` from `app`: 18 files and 134/134 tests passed.
- `npm run lint` from `app`: passed.
- `npm run release:verify` from `app`: core tests 75/75, app tests 134/134, lint, production build, and only documented R-405 production dependency audit findings.

`npm run test:rls` is not required for this phase because no schema, RLS policy, Supabase migration, or RPC contract changed.

## Production Pilot Status

Production pilot remains `NO-GO`.

R-310 is locally reduced by deterministic second-layer evidence, but the clinical taxonomy gate remains open until a qualified dietitian approves the taxonomy, golden tests, and production second-layer or equivalent fail-closed safety evaluation approach.

# Phase 77N: Canonical Intent Understanding V2

Date: 2026-06-13
Status: Implemented locally; production pilot remains NO-GO.

## Goal

Reduce fragmented intent handling by introducing one canonical intent resolver in core that feeds green taxonomy, answerability, Food Decision V2 alignment, and orchestration evidence. Unknown intent must fail closed to clarify/handoff instead of defaulting to permissive green clarification.

## Canonical Resolver

Module: `dietitian-ai-assistant/src/canonical-intent-resolver-v2.js`

Version: `canonical-intent-resolver-v2-v0.1.0`

Precedence:

1. sensitive/medical/escalation signals
2. ambiguous negation and portion ambiguity
3. Food Decision V2 intent family
4. legacy food-rule intent family
5. clear negation substitution
6. explicit green intent family
7. `unknown_intent` (fail-closed)

Shared food intent mappings live in `intent-family-mappings.js`.

## Wiring

- `orchestrator.js` computes `contextManifest.canonicalIntent` before green taxonomy and answerability.
- `green-intent-taxonomy.js` v0.3.0 delegates to the canonical resolver and exposes `blocked_unknown_intent`.
- `intent-specific-answerability.js` v0.2.0 consumes canonical intent for `resolveEffectiveIntentFamily` and blocks `unknown_intent` before provider generation.
- Unknown intent autopilot path returns `blockedReason: canonical_unknown_intent`.

## Golden Dataset

JSONL: `dietitian-ai-assistant/tests/canonical-intent-golden-cases.jsonl`

Categories:

- unknown intent
- portion ambiguity
- negation substitution
- negation ambiguous
- sensitive precedence
- explicit green
- food decision v2 / food rule alignment

## Acceptance

- Unknown intent golden cases route to handoff/clarify workflow, not autopilot send.
- Canonical, green taxonomy, and answerability intent families align for the same input.
- Sensitive intent overrides green-looking text.
- Negation and portion fixtures are covered in golden tests.

## Verification

```text
cd dietitian-ai-assistant
node --test tests/canonical-intent-resolver-v2.test.mjs
cd ../app
npx vitest run src/lib/phase-77n-canonical-intent-v2.test.ts
npm run release:verify
```

## Out of scope

- `responsePlan` contract (Phase 77O).
- Deterministic templates (Phase 77P).
- Real provider/channel connections.
- R-405 remediation.

# Phase 77O: Response Plan Contract V1

Date: 2026-06-13
Status: Implemented locally; production pilot remains NO-GO.

## Goal

Make every provider-eligible client-facing draft pass through a structured core-owned `responsePlan` produced after answerability and before provider generation.

## Response Plan Contract

Module: `dietitian-ai-assistant/src/response-plan-v1.js`

Version: `response-plan-v1-v0.1.0`

Required fields:

- `version`
- `intentFamily`
- `replyMode`: `send`, `draft`, `clarify`, `ask_label`, `handoff`, `block`
- `templateId`
- `sourceRefs`
- `foodDecision`
- `riskClass`
- `clientMessagePlan`
- `internalReason`
- `claimManifest` placeholder (`claim-manifest-v0.1.0-placeholder`)
- `styleDna` placeholder (`style-dna-v0.1.0-placeholder`)

Provider-eligible reply modes: `send`, `draft`.

## Provider Boundary

- Added bounded prompt segments: `response_plan`, `claim_manifest`, `style_dna`
- Mock provider and Phase 75 allowlists accept the new segments
- Provider calls require all three segments and a provider-eligible `replyMode`
- The 480-char bounded-segment guard applies only to `response_plan`, `claim_manifest`, and `style_dna`; other prompt segments keep the existing 3000-char provider limit
- Raw internal metadata markers (`internal_reason=`, `raw_label`, channel identifiers) are rejected from segment text

## Wiring

- `orchestrator.js` builds `contextManifest.responsePlan` after answerability and blocks provider generation when the plan is not provider-eligible
- `appendResponsePlanPromptSegments()` adds bounded segments to provider `promptContext`
- `simulator.ts` rejects `generateReply` without provider-eligible `responsePlan`

## Verification

```text
cd dietitian-ai-assistant
node --test tests/response-plan-v1.test.mjs
cd ../app
npx vitest run src/lib/phase-77o-response-plan-v1.test.ts
npm run release:verify
```

## Out of scope

- Deterministic template library runtime (Phase 77P)
- Claim manifest generation and output grounding enforcement (Phase 77Q)
- Real provider/channel connections
- R-405 remediation

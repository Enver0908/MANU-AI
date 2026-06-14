# Phase 77Q: Claim Manifest and Output Grounding V1

Date: 2026-06-13
Status: Implemented locally; production pilot remains NO-GO.

## Goal

Generate `claimManifest` from `responsePlan`, deterministic `templateId`, `sourceRefs`, and food-decision authority — never from free LLM output — and block rendered client text that introduces claims outside the manifest.

## Module

`dietitian-ai-assistant/src/claim-manifest-v1.js`

Version: `claim-manifest-v1-v0.1.0`

Claim records:

- `id`
- `type`
- `authority` (`template_library_v1`, `food_decision_v2`, `food_rule`, `source_ref`)
- `sourceIds`

## Wiring

- `buildResponsePlanV1` calls `buildClaimManifestV1` instead of the Phase 77O placeholder.
- `guardProviderOutput` accepts `claimManifest` and runs `detectClaimManifestOutputViolations`.
- Provider-eligible drafts require a complete manifest (`claims.length > 0`, version `claim-manifest-v1-v0.1.0`).
- Hard-zero metric signal: `claim_outside_manifest`.

## Acceptance

- Every provider-eligible client-facing draft carries a complete manifest.
- Manifest-outside-claim golden cases block deterministically.
- Claim authority is never derived from LLM/provider output text.

## Verification

```text
cd dietitian-ai-assistant
node --test tests/claim-manifest-v1.test.mjs
cd ../app
npx vitest run src/lib/phase-77q-claim-manifest-v1.test.ts
npm run release:verify
```

## Out of scope

- Dietitian Voice Engine V2 runtime (`styleDna` beyond placeholder)
- Real provider/channel connections
- R-405 remediation

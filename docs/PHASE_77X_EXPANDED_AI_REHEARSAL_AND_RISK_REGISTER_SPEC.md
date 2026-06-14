# Phase 77X: Expanded 100x50 AI Rehearsal And Risk Register

Status: Implemented locally; production pilot remains NO-GO. Verified 2026-06-14.

## Goal

Rehearse the AI quality path at 100 synthetic clients x 50 messages (5,000 orchestrator cases) before WhatsApp adapter work. Add operational-health AI quality fields and expand the risk register for responsePlan-output contradiction, template drift, styleDna poisoning, alias false-match blast radius, and R-419 reporting.

## Modules

- Core: `dietitian-ai-assistant/src/ai-quality-expanded-rehearsal-v1.js`
- App: `app/src/lib/phase-77x-expanded-ai-rehearsal.ts`
- Script: `dietitian-ai-assistant/scripts/rehearse-ai-expanded.mjs`

Version: `ai-quality-expanded-rehearsal-v1-v0.1.0`

## Scale

| Constant | Value |
| --- | --- |
| `EXPANDED_REHEARSAL_CLIENT_COUNT` | 100 |
| `EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT` | 50 |
| `EXPANDED_REHEARSAL_TARGET_COUNT` | 5000 |
| `EXPANDED_REHEARSAL_SAMPLE_TARGET_COUNT` | 100 (10x10 release/test subset) |

## Operational health fields

- `aiQualityStatus`
- `responsePlanVersion`
- `claimGroundingVersion`
- `styleDnaVersion`
- `narrowAutopilotReadinessStatus`
- `unsafeSendCount`
- `responsePlanPassRate`
- `claimGroundingPassRate`
- `narrowAutopilotEligibleCount`
- Expanded rehearsal aggregate counters (unsafe/source/forbidden/yellow-red/claim/style mismatch)

## Hard-zero gates

- `unsafe_client_send_count = 0`
- `source_unsupported_green_count = 0`
- `forbidden_food_approval_count = 0`
- `yellow_red_client_send_count = 0`
- `claim_outside_manifest_count = 0`

## Measured threshold

- `style_soft_mismatch_rate <= STYLE_DNA_SOFT_MISMATCH_THRESHOLD` (0.35)

## Risk register

- R-419 expanded with Phase 77X version/reporting and 100x50 AI quality rehearsal evidence
- R-420 responsePlan-output contradiction hard-zero closure on bundled rehearsal
- R-421 styleDna poisoning measured soft mismatch on rehearsal corpus
- R-417 alias false-match blast radius cross-referenced to expanded rehearsal safety counters
- R-423 template drift tracking added for deterministic template library drift without recurring calibration

## Verification

```text
cd dietitian-ai-assistant
node --test tests/ai-quality-expanded-rehearsal-v1.test.mjs
npm run rehearse:ai:expanded
cd ../app
npx vitest run src/lib/phase-77x-expanded-ai-rehearsal.test.ts
npm test
npm run release:verify
```

## Next phase

Phase 77Y Continuity, Evidence, And Launch Gate Update.

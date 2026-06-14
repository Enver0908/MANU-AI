# Phase 77P: Deterministic Template Library V1

Date: 2026-06-13
Status: Implemented locally; production pilot remains NO-GO.

## Goal

Provide safe, predictable client-message structures from `responsePlan.templateId` before claim grounding (Phase 77Q) and before mock-provider styling. Remove generic diet-plan echo from provider drafts.

## Module

`dietitian-ai-assistant/src/deterministic-template-library-v1.js`

Version: `deterministic-template-library-v1-v0.1.0`

## Template families

| templateId | Use |
| --- | --- |
| `allowed_food_answer_v1` | Source-backed allowed food confirmation |
| `allowed_substitution_v1` | Plan-aligned substitution |
| `plan_lookup_v1` | Plan lookup reply |
| `forbidden_food_response_v1` | Forbidden food reminder |
| `discouraged_food_response_v1` | Discouraged food response |
| `ingredient_label_request_v1` | `ask_label` / `needs_label` ingredient request |
| `low_risk_clarification_v1` | Portion / low-risk clarification |
| `unknown_intent_clarify_v1` | `clarify` / unknown intent |
| `source_unsupported_answer_v1` | Missing approved source |
| `yellow_red_handoff_v1` | Yellow review / internal routing |
| `logistics_reply_v1`, `meal_reminder_v1`, `context_recap_v1` | Logistics and recap |
| `provider_styled_send_v1`, `provider_styled_draft_v1` | Provider-eligible fallbacks without diet-plan echo |

## Wiring

- `renderDeterministicTemplate({ templateId, language, replyMode, riskClass })` returns localized client text.
- `assertClientFacingTemplateId(templateId)` fails closed when `templateId` is missing for provider drafts.
- Mock provider (`app/src/lib/ai-provider.ts`) renders from `templateId` parsed in the `response_plan` segment; rejects missing/`none` template ids.
- Orchestrator attaches `contextManifest.deterministicClientMessage` for non-provider-eligible `responsePlan` modes (`ask_label`, `clarify`) when `templateId` is present.

## Acceptance

- `needs_label` / `ask_label` asks for ingredients; does not repeat the diet plan summary.
- `clarify` / `unknown_intent_clarify_v1` contains no clinical claims or internal metadata markers.
- Provider cannot emit a client-facing draft without a known `templateId`.
- Golden JSONL cases cover label request, clarify, forbidden food, and template-id requirement.

## Verification

```text
cd dietitian-ai-assistant
node --test tests/deterministic-template-library-v1.test.mjs
cd ../app
npx vitest run src/lib/phase-77p-deterministic-template-library-v1.test.ts
npm run release:verify
```

## Out of scope

- Claim manifest generation and output grounding enforcement (Phase 77Q) is implemented locally through `claim-manifest-v1-v0.1.0`.
- Real provider/channel connections
- R-405 remediation

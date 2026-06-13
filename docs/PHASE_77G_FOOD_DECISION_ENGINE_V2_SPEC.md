# Phase 77G: Food Decision Engine V2 And Phase 68 Recalibration

Date: 2026-06-10
Status: Implemented locally; production pilot remains NO-GO.

## Goal

Deterministically classify common client food and menu questions using personal form v2, Client Food Rule Profile V2, active Menu Plan V1, master food catalog matching, and Phase 76H product-ingredient verification. Recalibrate Phase 68 so safe off-menu food requests can reach Food Decision V2 instead of being blocked as active-plan conflicts.

## Decision Contract

| Decision | Meaning | Provider eligible |
| --- | --- | --- |
| `allow` | Food/menu request fits rules and flexibility. | Yes |
| `discourage` | Not forbidden, but off-menu or low flexibility. | Yes, no strong approval |
| `forbid` | Forbidden food/group/ingredient or diet-type conflict. | Yes, rejection only |
| `needs_label` | Product question without trusted written ingredients. | Yes, ask for text only |
| `needs_review` | Uncertain catalog match, mixed intent, or clinical escalation. | No |
| `not_applicable` | Not a food/menu question or non-green risk path. | Existing flow |

Source precedence:

1. Red/yellow clinical safety remains monotonic.
2. Forbidden catalog food/category/group/ingredient beats allowed/menu.
3. Active menu beats derived legacy `dietPlan.summary`.
4. Flexibility resolves with most restrictive wins: `restricted > moderate > flexible`.

## Technical Scope

- `phase-77g-food-decision-engine-v2.ts` with input/output contract, evidence manifest, and legacy Phase 76E mapping wrapper.
- State builder from `ManuAppState` using profile V2, active menu, personal form answers, and catalog candidates.
- `food-rule-runtime.ts` prefers V2 when profile data exists; falls back to Phase 76E structured rules.
- Phase 68 recalibration in `green-intent-taxonomy.js` removes broad `plan disi` blocking for safe food flexibility requests.
- Orchestrator attaches `foodDecisionV2` to context manifest and handoffs on `needs_review` before provider generation.
- Simulator and simulator-risk pass V2 decisions through the runtime wrapper.

## Edge Cases

- No profile and no structured 76D rules → `not_applicable` / legacy fallback.
- Ambiguous catalog name with multiple exact matches → `needs_review`.
- No catalog match → `needs_review` (no LLM classification).
- Product query without ingredient text → `needs_label`.
- Mixed clinical + food intent → `needs_review`.
- Non-green risk → V2 returns `not_applicable`; clinical routing unchanged.

## Verification

```text
cd app
npx vitest run src/lib/phase-77g-food-decision-engine-v2.test.ts
cd ../dietitian-ai-assistant
node --test tests/green-intent-taxonomy.test.mjs
cd ../app
npm run release:verify
```

Phase 77G verified on 2026-06-10: `npm run release:verify` passed with core tests 167/167, app tests 310/310, lint with two pre-existing warnings, production build, and only documented R-405 findings. Production pilot remains `NO-GO`.

## Out Of Scope

- PromptContext/output guard V2 adaptation (Phase 77H).
- Permission graph remapping (Phase 77H).
- DOCX/PDF export (Phase 77J).
- Real provider/channel connections.
- R-405 remediation.

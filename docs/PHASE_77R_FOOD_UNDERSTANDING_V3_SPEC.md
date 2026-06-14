# Phase 77R: Food Understanding V3

Status: Implemented locally; production pilot remains NO-GO.

## Goal

Expand safe deterministic food understanding with versioned alias dictionaries, brand fail-closed routing, and recipe-gated mixed-dish handling without ingredient guessing.

## Module

`dietitian-ai-assistant/src/food-understanding-v3.js`

Version: `food-understanding-v3-v0.1.0`

Alias dataset: `app/src/lib/food-alias-dictionary-v3.json` (checksum-backed; JSONL mirror in `food-alias-dictionary-v3.jsonl`)

## Rules

- Alias dictionaries are tenant-safe, versioned, and checksum-backed.
- Autopilot may use only exact catalog matches or dietitian-approved / QA-gated global aliases.
- Global alias changes without `qaApproved` do not become autopilot-eligible.
- Brand/packaged products route to `needs_label`; no ingredient inference without trusted label evidence.
- Mixed dishes decompose only when Menu Plan V1 has dietitian-authored recipe ingredients.
- Recipe-less mixed dishes route to `needs_review`.

## Wiring

- `app/src/lib/phase-77r-food-understanding-v3.ts` loads the JSONL alias dictionary.
- `phase-77g-food-decision-engine-v2.ts` uses alias resolution, brand routing, and mixed-dish guards.

## Acceptance

- Alias false-match golden tests pass.
- Brand product cases route to `needs_label`.
- Recipe-less mixed dish routes to `needs_review`.
- Alias dataset is JSONL.

## Verification

```text
cd dietitian-ai-assistant
node --test tests/food-understanding-v3.test.mjs
cd ../app
npx vitest run src/lib/phase-77r-food-understanding-v3.test.ts
npm run release:verify
```

## Out of scope

- Real provider/channel connections
- LLM food classification
- R-405 remediation

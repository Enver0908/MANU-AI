# Phase 77U: Clinical Red-Team And RD Review Packet

Status: Implemented locally; production pilot remains NO-GO.

## Goal

Prepare dietitian-reviewable AI quality evidence and automated clinical red-team coverage without closing production gates.

## Module

`dietitian-ai-assistant/src/clinical-red-team-v1.js`

Version: `clinical-red-team-v1-v0.1.0`

## Datasets

- Red-team and RD packet cases: `dietitian-ai-assistant/tests/clinical-red-team-cases.jsonl`
- RD review packet (evidence only): `docs/PRODUCTION_PILOT_RD_AI_QUALITY_REVIEW_PACKET.md`

## RD packet sections

- Safe green examples
- Unknown intent examples
- Forbidden food examples
- Brand/label examples
- Mixed dish examples
- Yellow/red risk examples
- Style/persona examples

## Clinical red-team categories

- Eating disorder red flags
- Pregnancy, diabetes, renal, and cardiac hints
- Supplement and medication interactions
- Aggressive client pressure
- Dietitian-permission manipulation

## Safety counters

- `unsafe_client_send_count` must be 0
- `yellow_red_client_send_count` must be 0

A client send is `action === "sent"`. Yellow/red client sends are blocked. Cases with `forbidClientSend` must never reach client send.

## Wiring

- Core tests: `dietitian-ai-assistant/tests/clinical-red-team-v1.test.mjs`
- App tests: `app/src/lib/phase-77u-clinical-red-team-rd-review.test.ts`
- Reuses Phase 77T harness orchestrator path with mock provider only

## Acceptance

- Red-team suite passes with zero unsafe and zero yellow/red client sends
- RD review packet is linked from continuity and pilot evidence docs
- RD review result does not close `clinical_taxonomy_approval` or production pilot gates

## Verification

```text
cd dietitian-ai-assistant
node --test tests/clinical-red-team-v1.test.mjs
cd ../app
npx vitest run src/lib/phase-77u-clinical-red-team-rd-review.test.ts
npm run release:verify
```

## Out of scope

- Real provider/channel connections
- Production pilot GO approval
- Qualified dietitian sign-off artifact intake
- R-405 remediation

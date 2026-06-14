# Phase 77S: Dietitian Voice Engine V2

Status: Implemented locally; production pilot remains NO-GO.

## Goal

Improve personalized dietitian voice through scoped `styleDna` without letting style affect clinical, source, risk, or food decisions.

## Module

`dietitian-ai-assistant/src/style-dna-v2.js`

Version: `style-dna-v2-v0.1.0`

## Rules

- `styleDna` is tenant/dietitian scoped.
- Style cannot alter risk class, source authority, food decision, reply mode, or template selection.
- Style scope: sentence length, greeting style, formality, emoji policy, warmth/assertiveness tone, boundary phrasing, response timing style.
- Edit-history learning stores AI draft hash, dietitian final hash, and diff metadata only; no client-identifying text is learned.
- Candidate style phrases pass product communication covenant checks before inclusion.
- Hard style guard violations block output; soft style mismatch is measured only.

## Wiring

- `buildResponsePlanV1` builds real `styleDna` from voice profile and edit-history signals.
- Orchestrator passes tenant/dietitian scope, voice profile, and edit-history signals.
- `guardProviderOutput` enforces hard style guard violations when `styleDna` is present.
- `app/src/lib/phase-77s-style-edit-history.ts` records draft/final edit lifecycle in fallback store state.

## Acceptance

- Style poisoning tests prove clinical decisions are unchanged across style variants.
- Hard guard violations for forbidden phrase/emoji/length remain zero in golden cases.
- Soft style mismatch is measured with threshold, not used as a hard safety gate.

## Verification

```text
cd dietitian-ai-assistant
node --test tests/style-dna-v2.test.mjs
cd ../app
npx vitest run src/lib/phase-77s-dietitian-voice-engine-v2.test.ts
npm run release:verify
```

## Out of scope

- Real provider/channel connections
- LLM-based style inference
- R-405 remediation

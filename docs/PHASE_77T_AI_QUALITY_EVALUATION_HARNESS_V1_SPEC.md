# Phase 77T: AI Quality Evaluation Harness V1

Status: Implemented locally; production pilot remains NO-GO.

## Goal

Make AI quality measurable before channel work through deterministic structured evaluation rather than fuzzy rendered-text comparison.

## Module

`dietitian-ai-assistant/src/ai-quality-evaluation-harness-v1.js`

Version: `ai-quality-evaluation-harness-v1-v0.1.0`

## Datasets

- Seed cases: `dietitian-ai-assistant/tests/ai-quality-harness-seed-cases.jsonl`
- Release subset: deterministic expansion to 100 cases, included in `npm run release:verify` via core/app tests
- Full rehearsal: deterministic expansion to at least 1000 synthetic cases via `npm run rehearse:ai` (mock provider only)

## Asserted fields

The harness asserts structured runtime fields, not fuzzy client wording:

- `responsePlan.version`
- `intentFamily`
- `replyMode`
- `templateId`
- `claimManifest` completeness/version
- `sourceRefs` count
- `blockedReason` / handoff reason
- `foodDecision`
- `workflowState` for clarification and label flows

## Coverage

- Green send, yellow draft, and red handoff paths
- Multi-turn `pendingClarification` and `awaitingLabel` flows
- Label follow-up re-evaluates food decision authority
- Adversarial prompt-injection routing
- Provider metadata-leak guard checks
- `<client_message_data>` prompt-boundary preservation

## Wiring

- Core tests: `dietitian-ai-assistant/tests/ai-quality-evaluation-harness-v1.test.mjs`
- App tests: `app/src/lib/phase-77t-ai-quality-evaluation-harness.test.ts`
- Rehearsal command: `npm run rehearse:ai` from `app`

## Acceptance

- Release subset is fast and deterministic
- Full rehearsal runs separately with mock provider only
- Internal metadata never appears in deterministic client text

## Verification

```text
cd dietitian-ai-assistant
node --test tests/ai-quality-evaluation-harness-v1.test.mjs
cd ../app
npx vitest run src/lib/phase-77t-ai-quality-evaluation-harness.test.ts
npm run release:verify
npm run rehearse:ai
```

## Out of scope

- Real provider/channel connections
- Production pilot GO approval
- R-405 remediation

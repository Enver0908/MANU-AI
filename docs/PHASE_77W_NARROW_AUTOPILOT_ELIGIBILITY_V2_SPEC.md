# Phase 77W: Narrow Autopilot Eligibility V2

Status: Implemented locally; production pilot remains NO-GO. Verified 2026-06-14.

## Goal

Allow automatic client sends only on deterministic, source-backed green golden paths. Ambiguous cases downgrade to draft, clarify, or handoff. No confidence-score gating.

## Module

`dietitian-ai-assistant/src/narrow-autopilot-eligibility-v2.js`

Version: `narrow-autopilot-eligibility-v2-v0.1.0`

## Applies when

- `clientAiMode === "autopilot"`
- `riskDecision.level === "green"`
- `modeDecision.action === "auto_send"`
- `responsePlan.replyMode === "send"`

## Eligible requirements (all must pass)

- Explicit supported green intent family
- `canonicalIntent.allowed !== false`
- Workflow state not `needs_label`, `clarify`, `needs_review`, `handoff`, or `block`
- `answerability.allowed` with `decision === "source_backed_green"`
- No sensitive-hint markers (`blocked_sensitive_intent`, `mixed_or_sensitive_answerability_marker`)
- Known `templateId` and complete claim manifest
- Food-grounded intents require `foodDecisionV2.providerEligible !== false` plus exact approved alias, menu-on-plan match, or explicit forbid grounding
- Substitution intents require exact approved alias or menu-on-plan grounding (no legacy-only fallback)
- No source-conflict markers (ambiguous catalog match, diet-type conflict)
- Post-provider phase: `providerOutputSafety.allowed !== false`

## Ineligible reason codes

- `unknown_intent`
- `sensitive_hint`
- `pending_label`
- `pending_clarification`
- `source_not_backed`
- `food_decision_ineligible`
- `brand_without_label`
- `mixed_dish_without_recipe`
- `alias_not_exact_or_approved`
- `template_missing`
- `claim_manifest_incomplete`
- `source_conflict`
- `output_guard_violation`

## Fallback behavior

When narrow autopilot applies but is ineligible:

- Default: downgrade `auto_send` to `draft_for_approval` (`narrow_autopilot_ineligible`)
- Post-provider ineligible after successful generation: `draft_for_approval` with `narrow_autopilot_post_provider_ineligible`
- Existing handoff/clarify/label paths remain unchanged

## Wiring

- Orchestrator: pre-provider downgrade + post-provider send gate
- `contextManifest.narrowAutopilotEligibility` records decision, reason codes, and phase
- Core tests: `dietitian-ai-assistant/tests/narrow-autopilot-eligibility-v2.test.mjs`
- Golden cases: `dietitian-ai-assistant/tests/narrow-autopilot-golden-cases.jsonl`
- App tests: `app/src/lib/phase-77w-narrow-autopilot-eligibility-v2.test.ts`

## Acceptance

- Golden harness send paths remain `sent` on autopilot
- Vague substitution without exact approved alias downgrades to draft
- Unknown intent, label-pending, and mixed-dish cases stay on handoff/clarify paths
- `narrowAutopilotEligibility` appears on internal decision manifests only

## Verification

```text
cd dietitian-ai-assistant
node --test tests/narrow-autopilot-eligibility-v2.test.mjs
cd ../app
npx vitest run src/lib/phase-77w-narrow-autopilot-eligibility-v2.test.ts
npm test
npm run release:verify
```

## Out of scope

- Real provider/channel connections
- Production pilot GO approval
- R-405 remediation
- Operational health rehearsal counters (Phase 77X)

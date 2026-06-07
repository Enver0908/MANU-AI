# Phase 72: Regulation Permission Graph Spec

Date: 2026-06-07

## Goal

Convert the user-supplied Phase 72 legal/privacy, clinical interpretation, and permission graph pack into canonical local draft artifacts that map intents, fields, privacy gates, and covenant phrases to green, draft-only, handoff/no-send, quarantine, and internal-only routing decisions.

This phase does not activate production routing, approve any launch gate, connect Gemini/WhatsApp/monitoring/production Supabase, close R-405, or process real health data.

## User Input Source

External package: `faz_72_istenilenler` (project-external working file, 2026-06-07).

## Scope

- Add canonical Phase 72 permission graph artifacts:
  - `forbiddenActionMap`
  - `draftOnlyActionMap`
  - `allowedPlanAnswerabilityMap`
  - `allowedGeneralEducationMap`
  - `sensitiveNeverPromptFieldMap`
  - `promptAllowedFieldMap`
  - `productCovenantForbiddenPhraseMap`
  - `legalPrivacyRoutingMap`
  - `clinicalEscalationRoutingMap`
  - `mixedIntentFailClosedPolicy`
- Add deterministic fail-closed routing evaluation with conflict order:
  forbidden > clinical risk > privacy gate > answerability > green maximization
- Keep every artifact at `approvalStatus: draft` until external legal/privacy and qualified clinical approval.
- Block active production routing unless explicit approved launch-gate evidence is supplied.
- Reference Phase 71 Turkiye official source families for traceability.

## Non-Goals

- No active scope/routing rule activation.
- No legal opinion or clinical sign-off replacement.
- No production pilot GO.
- No real provider/channel egress.
- No duplicate replacement of Phase 66 covenant detector or Phase 68 green intent taxonomy in core runtime; Phase 72 records the interpretation pack as draft routing artifacts.

## Edge Cases

- Mixed intent with any yellow/red segment fails closed; partial green answers are forbidden.
- Privacy gate blocks override green plan lookup and general education intents.
- Medication, insulin, lab, symptom, eating disorder, and self-harm intents route to handoff/no-send.
- Supplement dose, plan change, calorie/macro, pregnancy, minor, and diabetes intents route draft-only or handoff depending on acute risk flags.
- General nutrition education requires approved official corpus and stays non-personalized.
- Sensitive never-prompt fields remain forbidden even if present in client forms.
- Metadata-only Phase 71 corpus does not unlock green general education routing.
- Production pilot remains `NO-GO` after Phase 72.

## Done Criteria

- Phase 72 permission graph artifacts are represented in code and test-covered.
- Routing evaluator enforces fail-closed mixed intent and privacy gate precedence.
- Active production routing remains blocked without approved evidence.
- Continuity and evidence docs record Phase 72 status.
- `npm run release:verify` passes with only documented R-405 findings.

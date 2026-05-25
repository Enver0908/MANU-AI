# MANU-AI Phase 6 Clinical Governance And Evaluation Spec

## Goal

Move clinical safety from prototype rules toward pilot-grade governance by making safety taxonomy changes testable, reviewable, and blocked by golden cases.

## Scope

- Expand dietetic safety taxonomy for minors/body-image, eating-disorder escalation, medication dosing, critical glucose, lab interpretation, supplement dosing, diagnosed condition management, and pregnancy/lactation contexts.
- Add JSONL golden cases with expected risk, action, and model behavior.
- Add tests that prove red cases never call a provider.
- Add persona invariant tests so communication style cannot alter risk/action/model decisions.
- Document the clinical taxonomy review workflow and keep qualified dietitian approval as a launch gate.

## Non-Goals

- No real LLM provider calls.
- No clinical diagnosis engine.
- No client-facing legal or medical copy.
- No final medical-device classification decision.
- No production incident workflow beyond documentation.

## Done Criteria

- Red golden cases never call `generateReply`.
- Yellow golden cases route to review draft with `gemini-3`.
- Green golden cases can auto-send with `gemini-1.5-flash`.
- Persona changes do not alter safety risk, action, or model.
- Golden JSONL failures block taxonomy changes.
- Qualified dietitian approval remains documented as a launch gate.

## Edge Cases

- A high-risk client context must raise otherwise routine messages to yellow.
- Minor/body-image and extreme restriction language must not be treated as routine dieting.
- Medication, insulin, glucose crisis, allergy, pregnancy complication, self-harm, and eating-disorder crisis language must stay red or yellow according to the golden cases.

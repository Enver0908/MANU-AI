# Phase 68: Green Maximization Intent Taxonomy Spec

Date: 2026-06-05

## Goal

Add a deterministic local intent taxonomy for green-risk messages so safe green coverage can be measured and traced without weakening clinical safety, Phase 66 product communication covenant, or Phase 67 approved-source answerability.

This phase does not downgrade yellow or red clinical decisions. It adds green intent evidence for messages that remain green after all safety layers, and it blocks provider generation if a supposedly green message still contains an explicit yellow/red intent-family marker.

## Scope

- Add a core green intent taxonomy evaluator.
- Run it after approved-source answerability and before provider generation.
- Record intent evidence in `contextManifest.greenIntent`.
- Add green families:
  - `green_plan_lookup`
  - `green_meal_reminder`
  - `green_allowed_substitution`
  - `green_logistics`
  - `green_behavior_support`
  - `green_progress_logging`
  - `green_low_risk_clarification`
  - `green_general_education`
  - `green_context_recap`
- Add yellow/red family detection for defense in depth:
  - plan change
  - calorie/macro/portion redefinition
  - medication, insulin, or supplement dose decision
  - lab result interpretation
  - symptom interpretation
  - pregnancy/minor/diabetes/eating-disorder/self-harm/emergency contexts
  - active-plan conflict language

## Non-Goals

- Do not connect Gemini, WhatsApp, Telegram, monitoring, secret manager, or real client health data.
- Do not close launch gates or approve production pilot.
- Do not implement Phase 69 scale/load evidence.
- Do not use real LLM intent classification.
- Do not downgrade any yellow/red safety decision to green.

## Edge Cases

- Green plan lookup with approved source support records `green_plan_lookup`.
- Green allowed substitution with approved source support records `green_allowed_substitution`.
- Green logistics/progress/support messages record their green family.
- If clinical safety already escalated to yellow/red, taxonomy is metadata only and cannot downgrade.
- If a green-risk message includes medication/lab/symptom/plan-change markers, taxonomy blocks provider generation.
- Unknown low-risk green wording records `green_low_risk_clarification` only after Phase 67 answerability has already passed.

## Done Criteria

- Tests prove source-backed green messages carry intent evidence.
- Tests prove yellow/red safety decisions are not downgraded.
- Tests prove green-risk messages with sensitive intent markers do not call the provider.
- Tests prove covenant and approved-source gates remain intact.
- `npm run release:verify` passes with production pilot still `NO-GO` and R-405 still open.

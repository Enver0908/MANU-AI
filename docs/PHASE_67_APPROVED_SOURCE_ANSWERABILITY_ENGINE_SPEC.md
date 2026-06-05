# Phase 67: Approved Source Answerability Engine Spec

Date: 2026-06-05

## Goal

Add a local decision layer that determines whether a green-risk inbound client message can be answered from approved sources before provider output is requested or sent.

This phase keeps clinical risk classification unchanged. It adds a separate answerability gate for green messages so green maximization depends on approved source support instead of free-form generation.

## Scope

- Add a deterministic core answerability evaluator.
- Evaluate answerability after PromptContext compilation and before provider generation.
- Treat these PromptContext authorities as approved answer sources:
  - active diet plan
  - prompt-allowed form response
  - dietitian context update
  - dietitian manual message in the same conversation context
  - pinned note
  - allergies and restricted foods
- Treat AI-generated messages as non-authoritative.
- Require source-backed answerability before green autopilot provider calls and sends.
- Fail closed when a green message lacks approved source support.
- Record answerability evidence in the decision context manifest for audit.

## Non-Goals

- Do not connect Gemini, WhatsApp, Telegram, monitoring, secret manager, or real client health data.
- Do not approve production pilot launch or close launch gates.
- Do not implement Phase 68 green-max intent taxonomy or Phase 69 scale/load rehearsal.
- Do not activate official regulation PDF routing or user-supplied form production hardening.
- Do not use AI-generated messages as clinical ground truth.

## Answerability Decisions

- `source_backed_green`: green message has approved source support and may proceed to provider generation.
- `draft_required`: reserved for future source-backed-but-review-required green workflows; this phase does not call the provider for unsupported messages.
- `handoff_required`: green message lacks approved source support or has mixed/sensitive answerability markers.
- `blocked`: PromptContext cannot be evaluated safely.

## Edge Cases

- Green plan lookup with active diet plan, pinned note, form summary, context update, or dietitian manual source: allowed.
- Green plan lookup with no approved source: no provider call and no client-facing AI response.
- Approved substitution with only AI-generated prior messages: no provider call and no client-facing AI response.
- Dietitian manual messages from the same conversation may support answerability; AI messages may not.
- Mixed/sensitive wording around medication, insulin, supplements, labs, symptoms, pregnancy, minors, eating-disorder context, or emergencies remains blocked/handoff even if base risk is green.

## Done Criteria

- Core tests prove source-backed green can proceed.
- Core tests prove missing-source green does not call the provider.
- Core tests prove AI-generated recent messages do not satisfy answerability.
- App simulator tests prove unsupported green messages create no generated client-facing AI send.
- Continuity docs and risk/evidence docs are updated.
- `npm run release:verify` passes with production pilot still `NO-GO` and R-405 still open.

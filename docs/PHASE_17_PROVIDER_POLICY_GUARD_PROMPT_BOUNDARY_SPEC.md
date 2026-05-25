# MANU-AI Phase 17 Provider Policy Guard And Prompt Boundary Spec

## Goal

Add a local provider payload boundary so mock provider calls stay allowlist-based before any real LLM provider is connected.

## Scope

- Guard the mock provider input at runtime.
- Allow only `risk` and `client.dietPlan.summary` into the mock provider input.
- Reject direct provider calls that include prompt text, full capsules, channel identifiers, health profiles, clinical notes, memory, raw message collections, or secrets.
- Reject red-risk provider calls at the provider boundary as defense in depth.
- Preserve existing simulator behavior for valid green and yellow flows.

## Non-Goals

- No real Gemini or external LLM SDK.
- No real prompt construction rewrite in the core architecture package.
- No provider logging service.
- No prompt storage, analytics, or monitoring integration.
- No new model routing policy beyond existing green/yellow/red routing.

## Done Criteria

- Valid green and yellow mock provider inputs still generate deterministic replies.
- Runtime guard rejects top-level `prompt`, `capsule`, `message`, `recentMessages`, and `memory`.
- Runtime guard rejects client-level `healthProfile`, `channelUserId`, `clinicalRiskNotes`, `pinnedNotes`, `allergies`, and `restrictedFoods`.
- Runtime guard rejects red-risk provider calls.
- Provider policy violations become controlled safe no-send simulator decisions.
- No real provider, real channel, monitoring, analytics, secret manager, or real health data is connected.

## Edge Cases

- Unknown extra top-level keys fail closed.
- Unknown extra client keys fail closed.
- Unknown extra diet-plan keys fail closed.
- `dietPlan.summary` must be a string.
- Missing or invalid risk fails closed.
- Existing forced timeout/error tests continue to behave as provider failures.

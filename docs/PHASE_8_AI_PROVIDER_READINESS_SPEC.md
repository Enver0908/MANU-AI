# MANU-AI Phase 8 AI Provider Readiness Spec

## Goal

Prepare an AI provider abstraction without sending real health data to Gemini or any external LLM provider.

## Scope

- Add a deterministic mock provider for green/yellow generation.
- Add prompt version metadata to AI decisions.
- Add provider id, provider status, and provider error code metadata to AI decisions.
- Add a small provider error taxonomy for timeout and provider failures.
- Make provider failure produce safe no-send behavior.
- Document no-storage/no-retention provider requirements before any real health-data use.

## Non-Goals

- No real Gemini call.
- No network provider SDK.
- No real prompt logging service.
- No fine-tuning or raw health-message dataset export.
- No final vendor-risk approval.

## Done Criteria

- Mock provider works for green and yellow flows.
- Red flows never call the provider.
- Provider failure produces safe `no_ai` behavior without outbound message creation.
- AI decisions include prompt version and provider metadata.
- Real Gemini health-data use remains blocked until vendor/legal review.

## Edge Cases

- Timeout and provider errors must be captured as controlled `providerStatus = failed` decisions.
- Red and preflight-blocked flows must keep `providerStatus = not_called`.
- Provider metadata must not include raw prompt text or raw client health message body.

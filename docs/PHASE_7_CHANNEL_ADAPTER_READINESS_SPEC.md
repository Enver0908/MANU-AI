# MANU-AI Phase 7 Channel Adapter Readiness Spec

## Goal

Define WhatsApp/Telegram-ready adapter contracts without connecting real production channels.

## Scope

- Add a normalized inbound event contract for mock WhatsApp/Telegram events.
- Resolve known channel identities to existing clients.
- Quarantine unknown and ambiguous identities before the orchestrator path.
- Reuse the existing simulator/orchestrator path for known clients.
- Preserve idempotency for duplicate provider events.
- Keep permission-blocked and opted-out clients blocked by the existing preflight safety gate.
- Define provider metadata redaction rules so raw health text, prompts, and profile data are not sent as provider metadata.

## Non-Goals

- No real WhatsApp Business Cloud API connection.
- No real Telegram Bot API connection.
- No webhook signature verification yet.
- No outbound delivery state machine.
- No provider credentials, templates, or production channel secrets.

## Done Criteria

- Mock WhatsApp/Telegram events use the same simulator/orchestrator path.
- Unknown identities are quarantined before generation.
- Ambiguous identities are quarantined before generation.
- Duplicate provider events do not duplicate-send.
- Permission-blocked and opted-out clients do not generate replies.
- Provider metadata redaction excludes raw message, prompt, profile, diet plan, allergy, and clinical note fields.
- Real channel credentials remain absent.

## Edge Cases

- Empty or missing channel identity is treated as unknown identity.
- The same provider event id is processed once.
- Two clients with the same channel/channelUserId are treated as ambiguous and quarantined.
- Quarantined events create audit evidence but do not create client messages or AI decisions.

# MANU-AI Phase 16 Channel Policy Simulation Hardening Spec

## Goal

Harden the local WhatsApp/Telegram mock channel path before any real channel connection.

## Scope

- Reject mock channel events without a provider event id before client lookup or AI processing.
- Reject empty inbound channel bodies before client lookup or AI processing.
- Detect explicit opt-out keywords in the mock channel path.
- Convert matched-client opt-out events to `channelPermission = opted_out`.
- Keep opt-out events out of the AI/provider path.
- Record only minimized audit metadata for channel policy blocks.

## Non-Goals

- No real WhatsApp Business Cloud API connection.
- No real Telegram Bot API connection.
- No webhook signature verification.
- No outbound template registry implementation.
- No production 24-hour service-window enforcement.
- No external notification, monitoring, or analytics integration.

## Done Criteria

- Missing provider event id creates no messages, AI decisions, or risk assessments.
- Empty inbound body creates no messages, AI decisions, or risk assessments.
- `STOP`, `DUR`, `IPTAL`, `IPTAL ET`, and `CANCEL` opt-out commands do not call the simulator/orchestrator AI path.
- Matched-client opt-out commands update channel permission to `opted_out`.
- Duplicate opt-out provider events are ignored by idempotency.
- Channel policy audit metadata excludes raw message body, prompt, channel identifier, health profile, diet plan, allergies, clinical notes, and secrets.

## Edge Cases

- Whitespace-only provider event ids are treated as missing.
- Whitespace-only bodies are treated as empty channel payloads.
- Unknown-client opt-out messages are quarantined as unknown identities because there is no safe client permission record to update.
- Ambiguous-client opt-out messages are quarantined as ambiguous identities because updating multiple client records would be unsafe.
- Opt-out matching is exact after trimming and uppercasing; free-text messages that merely mention opt-out are not treated as commands.

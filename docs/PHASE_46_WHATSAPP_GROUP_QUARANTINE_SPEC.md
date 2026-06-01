# Phase 46 WhatsApp Group Quarantine Spec

Date: 2026-06-01

## Goal

Treat WhatsApp group messages as an unsupported high-risk context. Group messages must not be mapped to a client, sent to the classifier or LLM, added to client memory, or automatically answered.

This phase does not approve production pilot launch, real WhatsApp/Telegram messaging, real provider use, R-405 acceptance, R-406 mitigation, or real client health-data processing.

## Behavior

- Add a quarantine record for unsupported inbound contexts.
- If an inbound simulator request declares `sourceConversationType="group"`:
  - reject AI processing before client lookup, classifier, context build, or provider call;
  - do not create `MessageRecord`;
  - do not create `RiskAssessmentRecord`;
  - do not create `AiDecisionRecord`;
  - do not create `HandoffCaseRecord`;
  - do not store the raw group message body;
  - record `InboundQuarantineRecord` with minimized metadata;
  - record `inbound_group_message_quarantined` audit event;
  - return `lastSimulation.action="no_ai"` and `blockedReason="whatsapp_group_unsupported"`.
- Duplicate group events are still idempotent through `processedSimulationKeys`.

## Data Model

`InboundQuarantineRecord`:

- `id`
- `tenantId`
- `channel`
- `sourceConversationType`
- `sourceConversationId`
- `sourceMessageId`
- `senderChannelUserId`
- `reason`
- `createdAt`

Supabase table:

- `inbound_quarantines`

## Privacy Rule

The quarantine record must not contain raw group message text or client health details.

## Tests

- Group messages create quarantine + audit only.
- Group messages do not create messages, risk assessments, AI decisions, handoffs, or provider calls.
- Duplicate group events do not create duplicate quarantine records.
- Normal direct simulator behavior remains unchanged.

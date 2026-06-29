# Phase 77AB: WhatsApp Cloud Payload Normalization

Date: 2026-06-22
Status: Implemented locally.
Production pilot: NO-GO.
R-405: Open.

## Goal

Add a pure parser that converts synthetic WhatsApp Cloud API-shaped webhook fixtures into `NormalizedInboundChannelEvent` and inbound `SimulationRequest` fields without network calls, credential storage, or raw webhook persistence.

## PRD

Phase 77AA locked the mock/gated adapter track. The existing `processMockChannelInbound` path accepts already-normalized events but has no WhatsApp Cloud payload contract. Phase 77AB introduces that contract as testable pure functions so Phase 77AC can wire a disabled webhook boundary without redesign.

## Scope

In scope:

- Extend `NormalizedInboundChannelEvent` with conversation and message metadata required by Phase 46 group quarantine and future webhook wiring.
- Add `whatsapp-cloud-payload-normalizer.ts` with `normalizeWhatsAppCloudPayload`.
- Add `toInboundSimulationRequestFromNormalizedEvent`.
- Add JSONL golden fixtures and Phase 77AB tests.
- Add this spec and continuity updates.

Out of scope:

- API routes / webhook handlers (Phase 77AC).
- Identity quarantine wiring beyond parser output shape (Phase 77AC).
- Real WhatsApp Cloud API connections, secrets, tokens, or production phone data.
- Schema/migration changes.
- Launch-gate closure or R-405 remediation.

## Parser contract

Input: unknown webhook-shaped JSON (synthetic fixtures only in repo).

Output: discriminated result:

- `ok: true` with `event` and `simulationRequest`
- `ok: false` with stable `code` and human-readable `reason`

Supported normalization cases:

| Case | Result |
| --- | --- |
| Direct text message | `ok: true`, `messageType: "text"`, `sourceConversationType: "direct"` |
| Missing provider event id | `ok: false`, `code: "missing_provider_event_id"` |
| Empty text body | `ok: false`, `code: "empty_body"` |
| Unsupported media (`image`, `audio`, `video`, `document`, `sticker`, etc.) | `ok: false`, `code: "unsupported_media"` |
| Group context (`context.group_id` present) | `ok: true`, `sourceConversationType: "group"`, body stripped to empty string for minimization |
| Malformed payload (wrong object, missing messages, invalid structure) | `ok: false`, `code: "malformed_payload"` |

Privacy:

- Parser output must not echo webhook secrets, tokens, or full raw payload.
- Group-context normalization strips message body before returning.
- Golden tests assert serialized results exclude fixture secret/token markers.

## Extended event fields

`NormalizedInboundChannelEvent` gains optional:

- `sourceConversationType`: `"direct" | "group"`
- `sourceConversationId`
- `sourceMessageId`
- `messageType`: `"text" | "unsupported_media" | "unknown"`

`receivedAt` remains optional ISO timestamp derived from WhatsApp `timestamp` when present.

Remediation update, 2026-06-28: numeric but out-of-range timestamps now return `receivedAt: undefined` instead of throwing, preserving fail-closed parser behavior without raw payload persistence.

## Verification

```text
git diff --check
cd app && npm test
cd app && npm run release:verify
```

## Done criteria

- Parser golden cases pass for direct text, missing id, empty body, unsupported media, group context, and malformed payload.
- Fail-closed codes are stable.
- No raw webhook persistence in parser output.
- Continuity docs record Phase 77AB completion and name Phase 77AC as next.
- Production pilot remains `NO-GO`; R-405 remains open.

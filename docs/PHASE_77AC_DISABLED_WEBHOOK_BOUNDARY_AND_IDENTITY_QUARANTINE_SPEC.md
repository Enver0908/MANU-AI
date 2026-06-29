# Phase 77AC: Disabled Webhook Boundary And Identity Quarantine

Date: 2026-06-22
Status: Implemented locally.
Production pilot: NO-GO.
R-405: Open.

## Goal

Add a disabled-by-default mock WhatsApp webhook boundary and wire normalized Cloud payloads through existing identity quarantine, group quarantine, idempotency, rate-limit, and simulator/orchestrator invariants.

## PRD

Phase 77AB added pure payload normalization. Phase 77AC connects that parser to a mock webhook route that remains off unless an explicit env flag is set. Unknown, ambiguous, reused-phone-format, and group contexts must not reach AI generation.

## Scope

In scope:

- `POST /api/whatsapp/webhook` disabled by default (`403` + `{ error: "disabled" }`).
- `MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK=true` enables mock processing only.
- `whatsapp-mock-webhook.ts` orchestrates normalize → `processMockChannelInbound`.
- WhatsApp channel identity normalization for exact tenant/client/channel matching (`905551110001` ↔ `+905551110001`).
- Group context routes to Phase 46 quarantine before empty-body blocking.
- Fallback-store and Supabase demo-tenant commit paths reuse `commit_inbound_simulation` / `processed_inbound_events`.
- Phase 77AC tests for disabled boundary, duplicate, unknown, ambiguous, group, and direct-text success.
- Continuity doc updates.

Out of scope:

- Real Meta webhook verification, signatures, credentials, or outbound sends.
- Opt-out/service-window/template policy (Phase 77AD).
- Launch-gate closure or R-405 remediation.

## Boundary contract

| State | HTTP | Body |
| --- | --- | --- |
| Mock flag off | `403` | `{ error: "disabled" }` |
| Invalid JSON | `400` | `{ error: "invalid_json" }` |
| Parser fail-closed | `422` | `{ status: "rejected", normalizationCode, blockedReason }` |
| Processed/blocked/duplicate | `200` | `{ status, action, blockedReason }` |

Responses never include raw webhook payload, secrets, or tokens.

## Verification

```text
git diff --check
cd app && npm test
cd app && npm run release:verify
```

## Done criteria

- Default webhook boundary returns `403/disabled`.
- Mock flag enables normalize + identity quarantine path only.
- Duplicate inbound does not duplicate-send.
- Unknown/ambiguous identities create quarantine evidence without messages or AI decisions.
- Group context quarantines with minimized metadata.
- Production pilot remains `NO-GO`; R-405 remains open.

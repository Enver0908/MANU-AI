# Phase 77AE: Outbound Delivery Ledger And Mock Send Failures

Date: 2026-06-22
Status: Implemented locally.
Production pilot: NO-GO.
R-405: Open.

## Goal

Add an internal mock outbound delivery ledger for WhatsApp/Telegram channel sends without real provider HTTP. Record sent/delivered/failed mock statuses with minimized metadata only.

## PRD

Phase 77AD blocked outbound AI sends when mock service-window/template policy failed. Phase 77AE records mock delivery outcomes when a client-facing AI `sent` message is allowed on a channel adapter path.

## Scope

In scope:

- `ChannelDeliveryRecord` type and `channelDeliveries` on `ManuAppState`.
- `channel-mock-delivery-ledger.ts` for mock provider message ids and delivery status resolution.
- Simulator wiring after successful outbound AI `sent` on `whatsapp` / `telegram`.
- Supabase `channel_deliveries` table, RLS, RPC delta commit, fallback store load/save.
- Phase 74 export (`channel_deliveries.jsonl`), retention entry, transactional redaction/DSAR removal.
- Tests: sent/delivered/failed mock statuses, tenant isolation, no raw prompt/body in delivery metadata, yellow/red no delivery records.
- Continuity updates.

Out of scope:

- Real WhatsApp/Telegram HTTP send.
- Operational health aggregates (Phase 77AF) — implemented in Phase 77AF.
- Launch-gate closure or R-405 remediation.

## Delivery contract

| Case | Ledger |
| --- | --- |
| Green AI `sent` on WhatsApp/Telegram (policy allowed) | `delivered` by default |
| `channelPolicyMock.mockDeliveryStatus=sent` | `sent` |
| `channelPolicyMock.mockDeliveryStatus=failed` | `failed` with `mockDeliveryFailureCode` |
| Yellow draft / red handoff / policy-blocked outbound | No delivery record |
| Audit metadata | Channel, status, failure code, mock provider message id only; no message body |

## Verification

```text
git diff --check
cd app && npm test
cd app && npm run release:verify
```

## Done criteria

- Mock delivery ledger records on allowed channel AI sends only.
- Delivery metadata contains no raw prompt/body text.
- Phase 74 export/redaction/DSAR include channel deliveries.
- Production pilot remains `NO-GO`; R-405 remains open.

## Remediation Update - 2026-06-28

- `NormalizedInboundChannelEvent.channelPolicyMock` is type-aligned with `SimulationRequest["channelPolicyMock"]`, including mock delivery status/failure fields.
- Supabase client anonymization/removal deletes `channel_deliveries` for the client, matching the Phase 74 in-memory invariant.

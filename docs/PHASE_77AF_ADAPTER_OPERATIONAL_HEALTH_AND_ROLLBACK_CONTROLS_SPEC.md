# Phase 77AF: Adapter Operational Health And Rollback Controls

Date: 2026-06-22
Status: Implemented locally.
Production pilot: NO-GO.
R-405: Open.

## Goal

Expose aggregate WhatsApp/Telegram mock adapter health signals in operational health and add internal manual rollback controls that disable channel automation at global, tenant, dietitian, or client scope.

## PRD

Phase 77AE added mock outbound delivery ledger records. Phase 77AF adds adapter health counters and rollback toggles without real provider connections or new client-visible risk classes.

## Scope

In scope:

- `channel-adapter-health.ts` aggregate counters: mock delivery failures, quarantines, duplicate ignored, opt-out, channel gate blocked.
- `channel-adapter-rollback.ts` with global/tenant/dietitian/client disable controls and audit evidence.
- Operational health snapshot fields for adapter metrics and active rollback scopes.
- Simulator and channel adapter wiring to block inbound AI automation and outbound channel sends when rollback is active.
- Phase 77AF tests and continuity updates.

Out of scope:

- Real monitoring integrations or secret managers.
- New client-visible warning classes or risk taxonomy changes.
- 100x50 channel replay rehearsal (Phase 77AG) — implemented in Phase 77AG.
- Launch-gate closure or R-405 remediation.

## Health contract

| Signal | Source |
| --- | --- |
| `channelMockDeliveryFailureCount` | `channelDeliveries` with `deliveryStatus=failed` |
| `channelQuarantineCount` | `inboundQuarantines` length |
| `channelDuplicateIgnoredCount` | audit `channel_duplicate_ignored` |
| `channelOptOutCount` | audit `channel_permission_opted_out` |
| `channelGateBlockedCount` | audit `channel_policy_blocked` + `channel_policy_outbound_blocked` |

Snapshot is aggregate-only; no raw message, phone, prompt, or secret fields.

## Rollback contract

| Scope | Blocks |
| --- | --- |
| `global` | All channel automation |
| `tenant` | All clients in tenant |
| `dietitian` | Clients assigned to dietitian |
| `client` | Single client |

Blocked paths return internal reasons (`channel_automation_rollback_*`) with audit only; no client-facing AI send.

Remediation update, 2026-06-28: rollback controls are persisted in Supabase through `channel_adapter_rollback_controls`, loaded into webhook/simulation state, committed through a rollback RPC wrapper, and covered by tenant-scoped RLS fixtures.

## Verification

```text
git diff --check
cd app && npm test
cd app && npm run release:verify
```

## Done criteria

- Operational health exposes adapter aggregate counters.
- Rollback controls block channel automation at each scope.
- Health snapshot contains no raw health text or secrets.
- Production pilot remains `NO-GO`; R-405 remains open.

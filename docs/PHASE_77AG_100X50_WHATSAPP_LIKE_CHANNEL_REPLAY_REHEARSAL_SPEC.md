# Phase 77AG: 100x50 WhatsApp-Like Channel Replay Rehearsal

Date: 2026-06-22
Status: Implemented locally.
Production pilot: NO-GO.
R-405: Open.

## Goal

Add a mock-only channel replay harness for the 100 dietitian x 50 client direct-pilot fixture. Exercise duplicate, opt-out, group, unknown identity, yellow/red, provider failure, and stale draft scenarios through `processMockChannelInbound` without real WhatsApp or provider connections.

## PRD

Phase 77AF added adapter operational health and rollback controls. Phase 77AG validates those mock channel paths at direct-pilot scale with hard-zero safety gates and AI-quality-compatible aggregate reporting.

## Scope

In scope:

- `channel-replay-scenarios.jsonl` with twelve deterministic rehearsal scenarios.
- `phase-77ag-channel-replay-rehearsal.ts` sample and full scale runners plus integration checks.
- Hard-zero gates: duplicate client send 0, unknown identity provider call 0, yellow/red client AI send 0, unsafe green 0.
- Operational health aggregate fields and evidence-pack metrics without raw message content.
- Deterministic sample tests in `release:verify`; full mock-only rehearsal via `npm run rehearse:channel:replay`.
- Phase 77AG tests and continuity updates.

Out of scope:

- Real WhatsApp/Telegram/Gemini connections.
- Launch-gate closure or R-405 remediation.
- Adapter evidence closure (Phase 77AH) — implemented in Phase 77AH.

## Hard-zero contract

| Gate | Source |
| --- | --- |
| `duplicateClientSendCount` | Duplicate provider events must not create new client-facing sends |
| `unknownIdentityProviderCallCount` | Unknown/ambiguous identities must not reach provider decisions |
| `yellowRedClientSendCount` | Yellow/red held or classified clients must not receive AI sends |
| `unsafeGreenCount` | Green sends must not bypass food-rule handoff boundaries |

## Verification

```text
git diff --check
cd app && npm test
cd app && npm run release:verify
cd app && npm run rehearse:channel:replay
```

## Done criteria

- Sample channel replay evidence passes hard-zero gates in unit tests.
- Full 100x50 scale rehearsal command exists and remains mock-only.
- Operational health exposes aggregate channel replay metrics only.
- Production pilot remains `NO-GO`; R-405 remains open.

## Remediation Update - 2026-06-28

Full 100x50 replay tests are skipped in normal unit runs unless `PHASE_77AG_FULL_REPLAY=1`. The dedicated `npm run rehearse:channel:replay` script sets that flag and remains the full-scale acceptance command.

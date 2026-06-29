# Phase 77AD: Opt-Out, Service Window, And Template Policy Mock

Date: 2026-06-22
Status: Implemented locally.
Production pilot: NO-GO.
R-405: Open.

## Goal

Model WhatsApp opt-out, 24-hour service-window, and template-required outbound behavior as mock policy gates on the existing channel/webhook path without real template sends or production-approved templates.

## PRD

Phase 77AC wired inbound webhook processing with identity quarantine. Phase 77AD adds channel policy mocks for opt-out confirmation, service-window closure, and template-required outbound blocking before any client-facing AI send on WhatsApp.

## Scope

In scope:

- Confirm and harden inbound opt-out handling on the webhook path (`STOP`, `DUR`, `IPTAL`, `IPTAL ET`, `CANCEL`).
- Idempotent opt-out for already opted-out clients.
- `whatsapp-channel-policy-mock.ts` with mock service-window and draft template registry (not production-approved).
- Block WhatsApp client-facing AI `sent` results when mock service window is closed / template-required.
- Internal audit evidence only for blocked outbound policy cases; no raw body in audit metadata.
- Optional `channelPolicyMock` on `SimulationRequest` for deterministic tests.
- Phase 77AD tests and continuity updates.

Out of scope:

- Real template send, Meta template approval, or production 24-hour enforcement.
- Outbound delivery ledger (Phase 77AE) — implemented in Phase 77AE.
- Launch-gate closure or R-405 remediation.

## Policy contract

| Case | Result |
| --- | --- |
| Matched-client opt-out command | `channelPermission=opted_out`, no AI path |
| Duplicate opt-out provider event | Idempotent `duplicate_ignored` |
| Already opted-out client repeats opt-out | `channel_policy_opt_out_already_applied`, no AI |
| Opted-out client normal inbound | Preflight block, no automation |
| WhatsApp service window open (default inbound reply) | Client-facing AI send allowed when orchestrator returns `sent` |
| WhatsApp service window closed (mock) | No client-facing AI send; audit `channel_policy_outbound_blocked` |
| Template registry | Mock eligibility/failure reasons only; `mockApproved=false` always |

## Verification

```text
git diff --check
cd app && npm test
cd app && npm run release:verify
```

## Done criteria

- Opt-out idempotency and opted-out no-automation tests pass.
- Template-required / service-window-closed mock blocks client-facing AI send with internal audit only.
- Production pilot remains `NO-GO`; R-405 remains open.

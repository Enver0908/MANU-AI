# Phase 44 Red Risk Reactivation Lock Spec

Date: 2026-06-01

## Goal

After a red-risk message, AI must not become active again until the dietitian explicitly resolves the red handoff and manually reactivates AI with an audit reason.

This phase does not approve production pilot launch, real WhatsApp/Telegram messaging, real provider use, R-405 acceptance, R-406 mitigation, or real client health-data processing.

## Behavior

- A red-risk handoff creates a client-level `redRiskLock`.
- The lock snapshots the prior `aiStatus` and `aiMode`, stores the handoff id, red reasons, and lock timestamp.
- While locked:
  - inbound flows are blocked before provider/LLM generation;
  - direct AI status/mode reactivation is rejected;
  - human takeover release is rejected;
  - manual dietitian replies and notification read/ack do not reactivate AI.
- Normal handoff resolve and handoff dismissal are rejected while the handoff is the active red lock handoff.
- Reactivation is a single explicit action:
  - resolve the handoff;
  - provide a non-empty reactivation reason;
  - choose `copilot` or `autopilot`;
  - set `aiStatus=active`, selected `aiMode`, and `humanTakeoverLocked=false`;
  - write a minimized audit event.
- `autopilot` reactivation is accepted only when the client safety checklist is complete.

## Data Model

- `ClientRecord.redRiskLock`
- Supabase `clients.red_risk_lock jsonb not null default '{"status":"none"}'`

`redRiskLock.status` values:

- `none`
- `locked`
- `reactivated`

## API

- Existing handoff resolve endpoint rejects the active red-risk handoff.
- Existing handoff dismiss endpoint rejects the active red-risk handoff.
- Existing release takeover endpoint rejects locked clients.
- New endpoint: `POST /api/handoffs/[id]/resolve-and-reactivate`
  - body: `{ "reactivationReason": string, "aiMode": "copilot" | "autopilot" }`
  - default UI should submit `copilot`.

## Tests

- Red risk creates lock, takeover, passive/manual state, and audit.
- Manual reply does not clear the lock.
- Normal resolve does not clear the lock.
- Dismiss and release takeover are rejected while locked.
- Direct `aiStatus=active` or `aiMode=autopilot/copilot` patch is rejected while locked.
- Resolve-and-reactivate clears the operational lock, resolves the handoff, restores active AI, and audits the reason.
- Autopilot reactivation fails when safety checklist is incomplete.

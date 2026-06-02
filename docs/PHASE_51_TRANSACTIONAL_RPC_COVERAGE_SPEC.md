# Phase 51 Transactional RPC Coverage Spec

Date: 2026-06-02

## Goal

Extend the Phase 50 Supabase commit RPC foundation so existing draft, handoff, form response, and client context mutation paths can persist inserts and updates through one transactional RPC call.

This phase does not connect real WhatsApp, Telegram, Gemini/external LLM, monitoring, secret manager, backup provider, production infrastructure, or real client health data.

## In Scope

- Add explicit RPC payload lists for existing-row updates:
  - `messageUpdates`
  - `aiDecisionUpdates`
  - `handoffUpdates`
- Keep wrapper RPC names stable.
- Move the following Supabase-backed app paths to the transactional RPC path:
  - draft approve/dismiss
  - handoff resolve/dismiss
  - form response save and draft invalidation persistence
  - client context update and draft invalidation persistence
  - red-risk resolve-and-reactivate
- Preserve optimistic client revision checks through `expectedClientRevisions`.
- Preserve local RLS evidence by rerunning `npm run test:rls` after applying the migration locally.

## Out Of Scope

- Client removal/anonymization lifecycle migration to RPC. That path still performs broad legal/audit minimization updates and should move only after a dedicated payload contract covers bulk redaction updates safely.
- Dashboard load/export/admin pagination contracts.
- R-405 dependency remediation.
- Any external launch-gate approval.

## Acceptance Criteria

- Existing message status/body/approval updates can be applied inside `manu_commit_state_delta`.
- Existing AI decision send-status/blocking updates can be applied inside `manu_commit_state_delta`.
- Existing handoff status/resolution updates can be applied inside `manu_commit_state_delta`.
- App tests pass.
- `npm run test:rls` passes against local Supabase.
- `npm run release:verify` passes with only known R-405 findings.
- Production pilot remains `NO-GO`.

## Completion Evidence

Completed locally on 2026-06-02.

- `npm run lint` passed from `app`.
- `npm test` passed from `app`: 17 files, 126 tests.
- `npx supabase db reset --local` applied migrations through `20260602030000_phase_50_production_hardening_foundation.sql`.
- `npm run test:rls` passed against local Supabase: 1 file, 14/14 tests.
- `npm run release:verify` passed from `app`: core tests 57/57, app tests 126/126, lint, production build, and only documented R-405 findings.
- No real provider, channel, monitoring, secret manager, backup provider, production infrastructure, or real health data was connected.
- Production pilot remains `NO-GO`; R-405 and all external launch gates remain open.

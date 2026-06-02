# Phase 52 Integration Test Coverage Spec

Date: 2026-06-02

## Goal

Add local Supabase-backed integration evidence for the Phase 50/51 rate-limit and transactional RPC paths before moving on to scale/read contract work.

This phase does not connect real WhatsApp, Telegram, Gemini/external LLM, monitoring, secret manager, backup provider, production infrastructure, or real client health data.

## Implemented Scope

- Added real local Supabase integration coverage for `consume_rate_limit` tenant, scope, and key isolation.
- Added real app-layer Supabase rate-limit denial coverage that maps RPC denial to controlled `429 rate_limit_exceeded`.
- Added stale client revision coverage for transactional RPC commits returning `concurrent_state_update` before writes are applied.
- Added manual reply transaction atomicity coverage: message inserts roll back when a later `messageUpdates` operation fails.
- Added inbound simulation transaction atomicity coverage: inbound message and processed-event inserts roll back when a later `aiDecisionUpdates` operation fails.
- Preserved existing Phase 51 draft approve/dismiss and form/context draft invalidation persistence coverage.

## Completion Evidence

Completed locally on 2026-06-02.

- `npm run test:rls` first reported 19 guarded tests skipped when the shell env was not mapped to local Supabase.
- Docker Desktop Linux engine was available, and local Supabase status was read without printing secrets.
- `npm run test:rls` then passed against local Supabase with mapped local env values: 1 file, 19/19 tests.
- `npm run lint` passed from `app`.
- `npm test` passed from `app`: 17 files, 126 tests.
- `npm run release:verify` passed from `app`: core tests 57/57, app tests 126/126, lint, production build, and only documented R-405 findings.

## Remaining Boundaries

- Client removal/anonymization bulk redaction still needs a dedicated transactional contract before moving fully to RPC commits.
- Broad dashboard, export, admin, schema, voice, and internal copilot reads still need separate scale/read contracts.
- R-405 remains open and must only be handled through `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Production pilot remains `NO-GO`; all external launch gates remain open.

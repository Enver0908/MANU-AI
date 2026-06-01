# Phase 50 Production Supabase Hardening Evidence Spec

Date: 2026-06-02

## Purpose

Record the Phase 50 production-hardening work, local verification evidence, and remaining launch blockers without approving production pilot launch.

Phase 50 does not connect real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, backup provider, production infrastructure, or real client health data.

## Implemented Scope

- Added Supabase migration `app/supabase/migrations/20260602030000_phase_50_production_hardening_foundation.sql`.
- Added database-backed rate-limit foundation with `rate_limit_buckets` and `consume_rate_limit`.
- Added transactional commit RPC foundation and wrappers for inbound simulation, manual reply, draft review, client context update, form response, red-risk reactivation, and client removal lifecycle.
- Wired app rate-limit calls through an async interface with Supabase RPC support and local fallback behavior.
- Wired manual reply and client-scoped inbound simulation to commit RPC calls.
- Narrowed pre-mutation Supabase reads for:
  - manual reply
  - client-scoped inbound simulation
  - draft approval and dismissal
  - human takeover release
  - handoff status update
  - red-risk reactivation
  - client form response save
  - client context update
- Preserved existing validation behavior by explicitly including required target messages, AI decisions, handoffs, form schemas, draft messages, and draft decision rows in scoped operation loaders.
- Persisted draft invalidations after Supabase-backed form response changes.

## Local Verification

Commands run from `app` on 2026-06-02:

```text
npm run release:verify
npm run test:rls
```

Results:

- `npm run release:verify` passed.
- Core package tests: 57/57 passed.
- App tests: 126/126 passed.
- App lint: passed.
- Production build: passed.
- Production dependency audit gate passed with only documented R-405 findings.
- `npm run test:rls` skipped 1 file and 11 guarded tests.

## Evidence Limits

- The Phase 50 migration was not applied to a local Supabase database in this run.
- The new SQL/RPC functions have not been proven by local database execution evidence.
- `npm run test:rls` did not produce passing RLS evidence; it skipped because the local Supabase evidence environment remains unavailable.
- `psql` was unavailable in the current environment, so SQL parser/runtime validation was not performed through `psql`.
- Existing message and AI-decision update cases are not yet fully covered by the generic RPC commit payload. Do not switch draft review, context update, form response, red-risk reactivation, or removal lifecycle paths fully to RPC commits until that transactional surface is completed and tested.

## Launch Gate Impact

No launch gate is approved or closed by Phase 50.

Phase 50 improves local production-readiness evidence for R-114, R-115, and R-208, but:

- R-114 remains only partially mitigated until all multi-table mutation side effects are transactionally covered and DB-tested.
- R-115 remains partially mitigated because global dashboard/load/export/removal/admin workflows still need separate scale contracts.
- R-208 remains partially mitigated until the distributed limiter migration/RPC is applied and verified against local Supabase.
- R-406 remains blocked because passing local Supabase RLS evidence has not been produced.

Production pilot remains `NO-GO`.


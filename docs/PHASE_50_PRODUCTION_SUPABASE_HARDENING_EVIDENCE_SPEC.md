# Phase 50 Production Supabase Hardening Evidence Spec

Date: 2026-06-02

## Purpose

Record the Phase 50 production-hardening work, local verification evidence, and remaining launch blockers without approving production pilot launch.

Phase 50 does not connect real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, backup provider, production infrastructure, or real client health data.

## Implemented Scope

- Added Supabase migration `app/supabase/migrations/20260602030000_phase_50_production_hardening_foundation.sql`.
- Added database-backed rate-limit foundation with `rate_limit_buckets` and `consume_rate_limit`.
- Added transactional commit RPC foundation and wrappers for inbound simulation, manual reply, draft review, client context update, form response, red-risk reactivation, plus a reserved client removal lifecycle wrapper.
- Phase 51 extended the generic commit payload with `messageUpdates`, `aiDecisionUpdates`, `handoffUpdates`, `clientContextUpdates`, and `formResponses`, and added `commit_handoff_status`.
- Wired app rate-limit calls through an async interface with Supabase RPC support and local fallback behavior.
- Wired manual reply, client-scoped inbound simulation, draft approval/dismissal, handoff status updates, red-risk reactivation, form response save, and client context update to commit RPC calls.
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
- Persisted draft invalidations after Supabase-backed form response and client context changes through transactional RPC commits.

## Local Verification

Commands run from `app` on 2026-06-02:

```text
npm run release:verify
npm run test:rls
npx supabase db reset --local
```

Results:

- `npm run release:verify` passed.
- Core package tests: 57/57 passed.
- App tests: 126/126 passed.
- App lint: passed.
- Production build: passed.
- Production dependency audit gate passed with only documented R-405 findings.
- Local Supabase was started with Docker Desktop's Linux engine.
- `npx supabase db reset --local` applied all migrations through `20260602030000_phase_50_production_hardening_foundation.sql`.
- Direct DB checks confirmed `rate_limit_buckets`, `consume_rate_limit`, and `commit_inbound_simulation` exist locally.
- Direct DB checks confirmed `messages_generated_by_ai_decision_fk` is deferrable and initially deferred for same-transaction message/AI-decision payloads.
- `npm run test:rls` passed against local Supabase after Phase 51 coverage: 1 file, 14/14 tests passed.

## Evidence Limits

- The Phase 50 migration was applied to local Supabase and the expanded RLS suite produced passing evidence.
- The local DB reset exposed and fixed two migration/seed compatibility issues before the passing run: the demo form schema seed now uses a deterministic UUID, and the `messages_generated_by_ai_decision_fk` constraint is deferrable for commit RPC payloads that insert messages and AI decisions in one transaction.
- Existing message and AI-decision update cases used by draft review, form response invalidation, client context invalidation, red-risk reactivation, and handoff status updates are now covered by the generic RPC commit payload and local RLS tests. Client removal/anonymization bulk redaction remains out of scope until a dedicated transactional redaction contract is designed and tested.

## Launch Gate Impact

No launch gate is approved or closed by Phase 50.

Phase 50 improves local production-readiness evidence for R-114, R-115, and R-208, but:

- R-114 remains partially mitigated: the targeted local multi-table mutation paths are transactionally covered and DB-tested, while client removal/anonymization bulk redaction and broader production write contracts still need dedicated coverage.
- R-115 remains partially mitigated because global dashboard/load/export/removal/admin workflows still need separate scale contracts.
- R-208 is improved by local DB evidence for the distributed limiter foundation, but production deployment, monitoring, and abuse tuning remain future work.
- R-406 is mitigated in the local prototype by the passing 14-test local Supabase RLS run.

Production pilot remains `NO-GO`.

# Phase 47 RLS Quarantine Evidence Spec

Date: 2026-06-01

## Goal

Close the newest RLS evidence gap introduced after Phase 46 by adding explicit `inbound_quarantines` coverage to the expanded local Supabase RLS suite, then rerun the suite against local Supabase when Docker Desktop is available.

This phase does not approve production pilot launch, real WhatsApp/Telegram messaging, real provider use, R-405 acceptance, R-406 mitigation without passing local evidence, or real client health-data processing.

## Behavior

- The RLS suite must seed `inbound_quarantines` rows for the test tenant and another tenant.
- Owner/admin/dietitian tenant members can read only their tenant quarantine rows.
- Users without membership cannot read quarantine rows.
- Assistant and auditor roles cannot read quarantine rows in v1.
- Cross-tenant quarantine writes through the anon client are rejected.
- Supabase-backed group simulation writes an inbound quarantine and processed idempotency event without creating messages, risk assessments, AI decisions, or handoffs.

## R-406 Rule

R-406 remains blocked unless `npm run test:rls` runs against local Supabase and passes without skipping the expanded suite.

If local Supabase is unavailable, record the skipped run as environment-blocked evidence only; do not mark R-406 mitigated.

## Tests

- Existing RLS suite still covers tenant-member, outsider, cross-tenant write, assistant, viewer/care-team, auditor, copilot, tenant-aware uniqueness, simulator idempotency, and AI-control audit behavior.
- New quarantine coverage must be included in those same role and write checks.
- A new Supabase-backed group quarantine test must prove Phase 46 persistence is RLS-compatible.

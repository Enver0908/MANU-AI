# AIya Live Parity Runtime Smoke Action Plan

Date: 2026-09-01
Branch: `codex/production-readiness-stage-1`
Local HEAD: `609f31089d10d6e51aee59fad013efa2fa3144e9`
Status: `PHASE_1_RUNTIME_FINDING_COMPLETE`

## Purpose

Close the initial discovery gap for the live AIya cutover findings without changing code, deploy state, database state, or external system settings.

## In Scope

- Confirm local Git and worktree state.
- Compare the local AIya HEAD with the live VPS release identity.
- Smoke public live routes, admin routes, release identity, legacy domain shutdown, DNS, and TLS.
- Classify live `500` responses by evidence category.
- Separate deploy/release-parity work from owner-controlled external system evidence.

## Out of Scope

- Code changes.
- Remote migration.
- Deploy, rollback, PM2 restart, nginx edit, or server process changes.
- Supabase Auth, Resend, Stripe, WhatsApp, Z.ai, or DNS setting changes.
- Production `GO`, live provider/channel egress, live billing, production workers, or real health-data processing.

## Findings To Close Next

1. Live release parity gap:
   - Live `/api/health/release` still reports `d1e0b5f40e3a6e3b535e2a889ebf68025c5e548a`.
   - Local AIya HEAD is `609f31089d10d6e51aee59fad013efa2fa3144e9`.
   - Live public/admin pages and live PWA manifest still expose `SiriusAI`.
2. Live runtime/API `500` gap:
   - `/app-install`, `/api/app-state`, and `/api/clients` return `500`.
   - `/dashboard` redirects unauthenticated users to `/login?next=%2Fdashboard`, so not every authenticated shell path is hard-failing.
   - The error class is currently `runtime_env_or_supabase_schema_bundle_mismatch_unproven`; VPS logs are required for root cause.
3. External sender evidence gap:
   - Public DNS proves the Resend DKIM selector exists.
   - Supabase Auth sender display name cannot be verified from public read-only checks.
   - Last recorded sender evidence remains `SiriusAI <no-reply@auth.aiyaworkspace.com>`.

## Next Phase Candidate

`Phase 2 - AIya Local Release Parity Verification`

Run local production-like verification for `609f310` before any deploy request:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- targeted app-install/PWA/brand tests
- local production server smoke for `/`, `/login`, `/purchase`, `/app-install`, `/manifest.webmanifest`
- active-surface legacy brand scan
- `git diff --check`
- secret/sensitive-data scan

This phase still must not deploy or change external systems without a separate explicit command.

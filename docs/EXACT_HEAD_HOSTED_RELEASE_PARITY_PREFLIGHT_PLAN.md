# Exact HEAD Hosted Release Parity Preflight Plan

Status: `ACTIVE`
Date: 2026-09-09
Branch: `codex/production-readiness-stage-1`
Candidate HEAD: `db32fe91488a40122cc44a96ac2efcdebff96bd0`
Candidate release ID: `hs-db32fe91488a-b55ed4ff550f`
Production decision: `NO-GO`

## Purpose

Prove whether the current pushed HEAD can be treated as the exact hosted release candidate before any separately approved deploy. This phase prepares local release parity evidence only; it does not deploy or change production state.

## In Scope

- Verify local and remote branch identity for `codex/production-readiness-stage-1`.
- Re-check live customer and admin release-health endpoints read-only.
- Derive the exact release identity for current HEAD.
- Confirm the candidate migration fingerprint against the live migration fingerprint.
- Run local release candidate checks: typecheck, lint, release artifact unit test, production build, and release artifact generation.
- Verify the generated release manifest and archive checksum.
- Record deploy smoke expectations for a later separately approved deploy.
- Update handoff, risk register, next-phase plan, this plan, and evidence.

## Out Of Scope

- Deploy, rollback, PR, merge, branch switch, or production gate change.
- Remote migration, production schema rollout, seed, backup, restore, or cleanup apply.
- Secret/env, DNS, TLS, SMTP, Stripe, WhatsApp, Z.ai, monitoring, live billing, production worker, or PM2 change.
- Real provider/channel traffic or real health-data processing.
- Bulk rename of compatibility identifiers such as `MANU_*`, `x-siriusai-*`, service-worker cache names, migration names, persisted IDs, server paths, PM2 process names, or historical evidence.

## Files

- `docs/EXACT_HEAD_HOSTED_RELEASE_PARITY_PREFLIGHT_PLAN.md`
- `docs/EXACT_HEAD_HOSTED_RELEASE_PARITY_PREFLIGHT_EVIDENCE.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/RISK_REGISTER.md`

Generated ignored local artifacts:

- `app/.next/`
- `app/.manu-runtime/release-artifacts/hs-db32fe91488a-b55ed4ff550f/`
- `app/.manu-runtime/release-artifacts/hs-db32fe91488a-b55ed4ff550f.tar.gz`
- `app/.manu-runtime/release-artifacts/hs-db32fe91488a-b55ed4ff550f.tar.gz.sha256`

## External Systems

Read-only HTTP probes only:

- `https://aiyaworkspace.com/api/health/release`
- `https://admin.aiyaworkspace.com/api/health/release`

No external mutation is authorized.

## Data Flow, Tenant Isolation, And Security Impact

This phase does not change runtime code. Tenant isolation, auth/capability checks, service-role boundaries, RPC/RLS contracts, PWA network-only behavior, and AI/channel fail-closed gates are unchanged.

The generated release manifest still records `productionPilotGo: false` and six worker commands that remain blocked until production `GO`, approved incident/rollback ownership, production Supabase configuration, and disabled demo/mock flags are separately proven.

## Migration, Dependency, Secret, And Deploy Impact

- Migration impact: none; no remote migration was run.
- Dependency impact: none; no package files changed.
- Secret impact: none; no secret/env file changed.
- Deploy impact: none; a local artifact was generated but not applied.

## Deploy Smoke Expectations For A Later Approved Phase

If the owner later approves deploy execution, the deploy phase must verify at minimum:

- Customer release health returns `hs-db32fe91488a-b55ed4ff550f`.
- Admin release health returns `hs-db32fe91488a-b55ed4ff550f`.
- `/`, `/login`, `/purchase`, `/app-install`, `/manifest.webmanifest`, and `/admin` remain AIya-branded and non-500.
- Protected APIs such as `/api/app-state` and `/api/clients` fail closed when unauthenticated.
- Legacy `siriusai.store` public/admin/www routes remain `410 Gone`.
- Production `NO-GO` remains unchanged unless a separate explicit owner `GO` decision is supplied.

## Verification

- Git branch/status/HEAD/remote checks.
- Read-only live release-health probes.
- Release identity derivation for exact HEAD.
- `npm run typecheck`
- `npm run lint`
- `npm run test:release-artifact`
- `npm run build`
- `npm run release:artifact`
- Release manifest inspection.
- `git diff --check`
- `git status --short --branch`

## Rollback

Before commit, revert only this phase's documentation changes. Generated ignored local artifacts may be left ignored or removed manually; no external rollback is required because no external mutation is performed.

## Completion Criteria

- Candidate release identity is recorded and bound to current HEAD.
- Candidate migration fingerprint is recorded and reconciled with live.
- Typecheck, lint, release artifact test, build, artifact generation, manifest inspection, and `git diff --check` pass.
- Production `NO-GO` and owner-controlled blockers remain unchanged.
- No external mutation is performed.

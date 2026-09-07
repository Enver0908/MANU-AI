# AIya Hosted Deploy Repeatability Action Plan

Date: 2026-09-02
Branch: `codex/production-readiness-stage-1`
Target HEAD: `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9`
Status: `PHASE_4_HOSTED_DEPLOY_REPEATABILITY_COMPLETE`

## Purpose

Close the Phase 3 hosted deploy repeatability findings so the AIya hosted VPS can be updated through the official wrapper without manual remote helper installation or manual Linux `sharp` runtime repair.

## In Scope

- Ship the remote deploy helper runtime from `apply-hosted-release.mjs` during each official apply.
- Transfer the helper runtime as one archive to avoid fragile many-file SCP behavior.
- Normalize Windows artifact paths before remote Linux extraction.
- Ensure Linux `sharp` optional runtime packages are installed and verified inside the extracted hosted release app when needed.
- Align PM2 to the single hosted process contract `manu-ai`.
- Delete stale legacy PM2 process `manu-ai-hosted-sandbox` during release switch.
- Bind release identity into PM2 restarts and rollback restarts.
- Expand official smoke to public AIya surfaces, manifest, unauthenticated fail-closed API routes, and release identity checks.
- Rebuild, dry-run, apply to VPS, and smoke the exact hosted release.

## Out of Scope

- Production `GO` or launch gate changes.
- Remote Supabase migrations or production schema rollout.
- Supabase Auth sender edits, Resend edits, DNS edits, Stripe edits, WhatsApp edits, Z.ai edits.
- Live provider/channel egress, live billing, production worker start, or real client health-data processing.
- iPhone Safari/PWA PASS. It remains `WAIVED_NOT_EXECUTED`.

## Files Changed

- `tools/hosted-sandbox/deploy/apply-hosted-release.mjs`
- `tools/hosted-sandbox/deploy/build-release-artifact.mjs`
- `tools/hosted-sandbox/deploy/deploy-hosted-release.mjs`
- `tools/hosted-sandbox/deploy/pm2.ecosystem.config.cjs`
- `tools/hosted-sandbox/deploy/run-smoke-check.mjs`
- `tools/hosted-sandbox/deploy/hosted-sandbox-deploy.test.mjs`

## Data, Tenant, And Security Impact

No application route, tenant data model, RLS policy, clinical AI behavior, billing behavior, or provider/channel behavior changed. The phase changes release tooling only. The deploy path remains fail-closed on forbidden production flags, SSH host-key pin validation, artifact SHA mismatch, migration fingerprint mismatch, failed smoke, and missing release identity.

## Migration, Dependency, Secret, Deploy Impact

- Migration: none.
- Dependency file change: none.
- Secret change: none.
- Deploy: hosted VPS release switched to `hs-4c7bbea8ba21-2c32cf194421` after explicit owner approval.
- External systems: no DNS, Supabase Auth, Resend, Stripe, WhatsApp, or Z.ai settings changed.

## Rollback Method

The remote helper keeps the previous release pointer, switches `/opt/manu-ai/current` atomically, runs smoke, and reactivates the previous release plus PM2 identity if smoke fails. A manual rollback remains possible by repointing `/opt/manu-ai/current` to the previous release under `/opt/manu-ai/releases/` and restarting PM2 with the previous release identity.

## Completion Criteria

- Official `apply-hosted-release.mjs` returns `PASS`.
- Live `/api/health/release` reports commit `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9`.
- Live public/admin routes return non-500 responses.
- `/api/app-state` and `/api/clients` return controlled unauthenticated `401`.
- Active checked surfaces contain `AIya` and no visible `SiriusAI`, `MANU-AI`, or `AI-ya`.
- Old `siriusai.store`, `www.siriusai.store`, and `admin.siriusai.store` return `410 Gone`.
- PM2 has one online process named `manu-ai`.
- Linux `sharp` runtime packages are present and `require("sharp")` succeeds in `/opt/manu-ai/current/app`.
- Production remains `NO-GO`.

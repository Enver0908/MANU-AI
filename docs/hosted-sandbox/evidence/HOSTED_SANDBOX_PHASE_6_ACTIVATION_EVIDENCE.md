# Hosted Sandbox Phase 6 - Activation and E2E Acceptance Evidence

**Phase:** HS-FAZ-6
**Date:** 2026-08-28
**Independent review:** NOT_REQUESTED
**Production:** NO-GO

## Scope

- HS-ACCEPT-001: Controlled activation orchestrator with maintenance flag, backup manifest freshness/hash check, release manifest/fingerprint binding, deploy switch, and exact release smoke.
- HS-ACCEPT-002: Demo cleanup dry-run/apply wiring with backup manifest requirement; apply also removes demo auth users and storage objects only when bound to the fixed demo tenant/email.
- HS-ACCEPT-003: Physical iPhone Safari/PWA remains WAIVED_NOT_EXECUTED and is not PASS.

## Executor checks

| Command | Result |
| --- | --- |
| `node --test tools/hosted-sandbox/activation/hosted-activation.test.mjs` | PASS 3/3 |
| `node --test tools/hosted-sandbox/deploy/hosted-sandbox-deploy.test.mjs` | PASS 8/8 |
| `node --test tools/hosted-sandbox/hosted-sandbox-backup.test.mjs app/scripts/hosted-sandbox-backup-restore.test.mjs` | PASS 12/12 |
| `cd app && npx vitest run src/lib/hosted-sandbox-tenant-isolation.test.ts src/lib/hosted-sandbox-security.test.ts src/lib/hosted-sandbox-release-identity.test.ts --no-file-parallelism --maxWorkers=1` | PASS 20/20 |
| `cd app && npm run release:verify` | PASS |
| `cd app && npx supabase db reset` | PASS |
| `cd app && npm run test:rls` with local Supabase env and local demo fixture flag | PASS 56/56, 0 skipped |
| `node tools/hosted-sandbox/deploy/build-release-artifact.mjs` | PASS: archive manifest for commit `67892db854e12ca4d71f0dc6d8f3ca12cb4e8b99`, release `hs-67892db854e1-b66efff838fe`, archive SHA-256 `c68d985ed64dc5987209b85caabf3afab6c3350d7522f9fbe88a90561898059f` |
| `node tools/hosted-sandbox/deploy/apply-hosted-release.mjs` | PARTIAL: artifact copied to VPS staging and hash verified; remote helper script missing from existing `/opt/manu-ai` layout |
| Manual VPS standalone deploy from staged artifact | PASS: current release switched to `67892db854e12ca4d71f0dc6d8f3ca12cb4e8b99`; PM2 runs `server.js` |
| `curl https://siriusai.store/api/health/release` | PASS: exact release ID, commit SHA, migration fingerprint, and compatibility version returned |
| Controlled rollback rehearsal | PASS: switched to previous release, verified `/`, restored current release, and re-verified exact release health |
| Hosted cleanup dry-run | BLOCKED_BY_DATA_GUARD: `unexpected_auth_users`; fixed demo tenant has 2 memberships, 1 expected demo user, 1 unexpected auth user |

## Activation sequence

Dry-run remains local and no remote side effect is performed without explicit apply approvals.

Apply mode now requires:

1. `MANU_HOSTED_ACTIVATION_APPROVED=true`
2. `MANU_HOSTED_ACTIVATION_BACKUP_APPROVED=true`
3. `MANU_HOSTED_ACTIVATION_MIGRATION_APPROVED=true`
4. `MANU_HOSTED_ACTIVATION_CLEANUP_APPLY_APPROVED=true`
5. `MANU_HOSTED_DEPLOY_APPROVED=true`
6. `MANU_HOSTED_SANDBOX_BACKUP_MANIFEST` pointing to a schema `2.0.0` manifest with matching `sourceProjectRef`, <=24h `createdAt`, and matching SHA-256 for the encrypted backup file.
7. Release artifact manifest with matching commit SHA, release ID, and migration fingerprint.
8. Exact release smoke against `/api/health/release`.

## Remote Execution

- Docker reset and zero-skip RLS were run locally and passed.
- Hosted migration apply was run against the linked MANU-AI Supabase project and passed.
- Real hosted backup was produced from linked Supabase schema/data dumps, encrypted with `age`, and verified by SHA-256 manifest.
- Isolated restore drill passed in a local Supabase database after Supabase role/extension preconditions were created.
- VPS deploy and rollback rehearsal passed using the staged release artifact and exact release health smoke.
- Hosted cleanup apply was not run because the cleanup guard found one unexpected non-demo auth user in the fixed demo tenant.
- Physical iPhone Safari/PWA remains WAIVED_NOT_EXECUTED, not PASS.

## Boundary

This evidence closes the activation/deploy preparation debt and records the real hosted migration, backup, restore, deploy, smoke, and rollback results. It does not claim cleanup apply PASS because the data guard blocked deletion outside the fixed demo user contract. It does not claim production readiness. Production remains NO-GO.

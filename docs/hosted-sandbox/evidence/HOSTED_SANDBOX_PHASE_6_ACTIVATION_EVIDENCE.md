# Hosted Sandbox Phase 6 - Activation and E2E Acceptance Evidence

**Phase:** HS-FAZ-6
**Date:** 2026-08-27
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

## Remote waivers and blockers

- Docker reset and zero-skip RLS were run locally and passed.
- Hosted migration apply, real backup/restore, cleanup apply, VPS deploy, and rollback rehearsal were not run because required CLIs/secrets/remote approvals are not present in this local session.
- Physical iPhone Safari/PWA remains WAIVED_NOT_EXECUTED, not PASS.

## Boundary

This evidence closes the local implementation and verification debt for activation/deploy preparation. It does not claim hosted runtime execution or production readiness. Production remains NO-GO.

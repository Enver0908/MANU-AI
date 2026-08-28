# Hosted Sandbox Phase 5 - CI, Deploy, and Network Evidence

**Phase:** HS-FAZ-5
**Date:** 2026-08-27
**Independent review:** NOT_REQUESTED
**Production:** NO-GO

## Scope

- HS-DEPLOY-001: Product CI workflow templates, install script, and hardening verifier.
- HS-DEPLOY-002: Migration workflow now has a GitHub environment-gated linked Supabase migration apply path.
- HS-DEPLOY-003: Nginx template preserves hosted security headers and adds a fail-closed maintenance flag while keeping `/api/health/release` available.
- HS-DEPLOY-004: Deploy preparation is bound to a real `.tar.gz` release archive manifest and recomputes archive SHA-256 before activation.
- HS-DEPLOY-005: Deploy apply extracts the archive to `releases/<commitSha>/app`, verifies the inner release manifest file hashes, switches the current pointer, runs exact release smoke, and rolls back to the previous pointer on smoke failure.
- HS-DEPLOY-006: A local SSH operator wrapper exists for remote apply and requires explicit approval, strict known_hosts, and the pinned host key fingerprint.

## Executor checks

| Command | Result |
| --- | --- |
| `node --test tools/hosted-sandbox/deploy/hosted-sandbox-deploy.test.mjs` | PASS 8/8 as part of hosted Node run |
| `node tools/hosted-sandbox/deploy/verify-workflow-hardening.mjs` | PASS |
| `node tools/hosted-sandbox/deploy/verify-nginx-template.mjs` | PASS |
| `node --test tools/hosted-sandbox/activation/hosted-activation.test.mjs` | PASS 3/3 |
| `node --test tools/hosted-sandbox/hosted-sandbox-backup.test.mjs app/scripts/hosted-sandbox-backup-restore.test.mjs` | PASS 12/12 combined |
| `cd app && npx vitest run src/lib/hosted-sandbox-tenant-isolation.test.ts src/lib/hosted-sandbox-security.test.ts src/lib/hosted-sandbox-release-identity.test.ts --no-file-parallelism --maxWorkers=1` | PASS 20/20 |
| `cd app && npm run typecheck` | PASS |
| `cd app && npm run lint` | PASS, 77 existing warnings, 0 errors |
| `cd app && npm run build` | PASS |
| `cd app && npm run release:verify` | PASS |

## Remote/runtime checks

| Check | Result |
| --- | --- |
| `docker info --format '{{.ServerVersion}}'` | PASS: Docker daemon available, version 29.1.2 |
| `cd app && npx supabase --version` | PASS: Supabase CLI 2.101.0 via app dev dependency |
| `where.exe pg_dump` | BLOCKED: PostgreSQL client tooling not found on PATH |
| `where.exe pg_restore` | BLOCKED: PostgreSQL client tooling not found on PATH |
| `where.exe age` | BLOCKED: age encryption CLI not found on PATH |
| `cd app && npx supabase db reset` | PASS: clean local Supabase reset |
| `cd app && npm run test:rls` with local Supabase env and local demo fixture flag | PASS 56/56, 0 skipped |
| Hosted migration apply | NOT_RUN: requires Supabase CLI, linked project secrets, and separate user approval |
| Real hosted backup/restore drill | NOT_RUN: requires `pg_dump`, `age`, hosted DB URL, age keys, isolated restore target, and separate user approval |
| Hosted cleanup apply | NOT_RUN: requires verified backup manifest and separate user approval |
| Remote VPS deploy/rollback rehearsal | NOT_RUN: requires SSH known_hosts pin, host/user env, built artifact, and separate user approval |

## Notes

- Deploy smoke now requires HTTP 200 and exact `/api/health/release` identity match for release ID, commit SHA, migration fingerprint, and compatibility version.
- PM2 is configured to run the Next standalone `server.js` from the active release app directory.
- The deploy workflow remains a dry-run artifact gate. Real remote apply is intentionally local-operator gated.
- Remote apply, hosted cleanup apply, and hosted migration apply are not claimed as PASS in this local evidence.

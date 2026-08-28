# Hosted Sandbox Phase 5 - CI, Deploy, and Network Evidence

**Phase:** HS-FAZ-5
**Date:** 2026-08-28
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
| `winget install --id FiloSottile.age --exact --accept-package-agreements --accept-source-agreements --disable-interactivity` | PASS: `age` 1.3.1 installed; current shell used full executable path |
| Docker Postgres client check | PASS: `public.ecr.aws/supabase/postgres:17.6.1.143` provides `pg_dump`, `pg_restore`, and `psql` 17.6 |
| `cd app && npx supabase db reset` | PASS: clean local Supabase reset |
| `cd app && npm run test:rls` with local Supabase env and local demo fixture flag | PASS 56/56, 0 skipped |
| Hosted migration apply | PASS: `npx supabase db push --linked --include-all --yes` applied `20260825120000`, `20260826120000`, and `20260826130000`; follow-up migration list matched local/remote |
| Real hosted backup/restore drill | PASS: linked Supabase schema/data dump encrypted with `age`; isolated local Supabase restore passed with public table count 104 |
| Hosted cleanup apply | PASS: fixed demo tenant cleanup applied after temporary operator allow; guard-restored dry-run reports totalRows 0, demoAuthUserCount 0, demoStorageObjectCount 0 |
| Remote VPS deploy/rollback rehearsal | PASS: staged artifact hash verified, current switched to commit `67892db854e12ca4d71f0dc6d8f3ca12cb4e8b99`, public exact release smoke passed, controlled rollback rehearsal passed and restored the current release |

## Notes

- Deploy smoke now requires HTTP 200 and exact `/api/health/release` identity match for release ID, commit SHA, migration fingerprint, and compatibility version.
- PM2 is configured to run the Next standalone `server.js` from the active release app directory.
- The first remote wrapper attempt staged the artifact and verified its hash, then failed because the existing VPS layout does not contain `/opt/manu-ai/tools/hosted-sandbox/deploy/deploy-hosted-release.mjs`.
- The remote release was applied manually from the staged artifact using the same archive SHA-256, release-manifest identity, current pointer, PM2 standalone `server.js`, exact `/api/health/release` smoke, and rollback checks.
- Hosted cleanup apply initially blocked when a non-demo auth user was found in the fixed demo tenant. The operator temporarily allowed fixed-demo-tenant row cleanup while preserving auth deletion only for `demo@manu.local`; the guard was restored after cleanup.

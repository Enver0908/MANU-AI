# Hosted Sandbox Technical Debt Closure Evidence

**Date:** 2026-08-28
**Status:** TECHNICAL_DEBT_CLOSED
**Production:** NO-GO
**Independent review:** NOT_REQUESTED

## Summary

The Hosted Sandbox technical-debt implementation plan is complete for code, contracts, tests, build, artifact, deploy preparation, activation preparation, clean Supabase reset, zero-skip RLS, hosted migration apply, real encrypted backup, isolated restore drill, remote deploy, exact public release smoke, and rollback rehearsal. The old Hosted Sandbox Remediation v1.1 governance plan is superseded and is not required for continued project work.

Hosted cleanup apply initially stopped because the cleanup guard found one unexpected auth user in the fixed demo tenant. The operator then temporarily allowed cleanup of the fixed demo tenant rows while preserving auth deletion only for `demo@manu.local`, applied cleanup, and restored the guard. The fixed demo tenant now has zero cleanup rows, zero demo auth users, and zero demo storage objects.

## Closed local findings

- Activation/deploy backup checks now require a concrete schema `2.0.0` backup manifest, matching `sourceProjectRef`, <=24h freshness, and encrypted backup SHA-256 validation.
- Release health now has an unauthenticated `GET /api/health/release` endpoint with `Cache-Control: no-store` and only release identity fields.
- Deploy smoke now requires HTTP 200 and exact release identity match.
- Release artifact validation recomputes archive SHA-256 and deploy apply verifies the inner release manifest file hashes after extraction.
- Deploy apply extracts to `releases/<commitSha>/app`, switches the active pointer, runs PM2 against standalone `server.js`, and rolls back to the previous pointer on smoke failure.
- Nginx maintenance uses `/opt/manu-ai/maintenance.flag` and keeps `/api/health/release` available for smoke.
- Migration workflow now has a GitHub environment-gated linked Supabase apply path.
- Cleanup apply requires a verified backup manifest and removes only fixed demo tenant rows, fixed demo email auth users, and storage objects whose path contains the fixed demo tenant UUID.
- A local SSH operator wrapper requires explicit deploy approval, strict known_hosts, and a pinned host key fingerprint before remote apply.

## Verification

| Command | Result |
| --- | --- |
| `node --test tools/hosted-sandbox/hosted-sandbox-backup.test.mjs tools/hosted-sandbox/deploy/hosted-sandbox-deploy.test.mjs tools/hosted-sandbox/activation/hosted-activation.test.mjs app/scripts/hosted-sandbox-backup-restore.test.mjs` | PASS 23/23 |
| `cd app && npx vitest run src/lib/hosted-sandbox-tenant-isolation.test.ts src/lib/hosted-sandbox-security.test.ts src/lib/hosted-sandbox-release-identity.test.ts --no-file-parallelism --maxWorkers=1` | PASS 20/20 |
| `cd app && npm run typecheck` | PASS |
| `node tools/hosted-sandbox/deploy/verify-workflow-hardening.mjs` | PASS |
| `node tools/hosted-sandbox/deploy/verify-nginx-template.mjs` | PASS |
| `cd app && npm run lint` | PASS, 77 existing warnings, 0 errors |
| `cd app && npm run build` | PASS |
| `cd app && npm run release:artifact` | PASS |
| `cd app && npm run test:release-artifact` | PASS 1/1 |
| `cd app && npm run release:verify` | PASS |
| `cd app && npx supabase db reset` | PASS; clean local Supabase reset completed |
| `cd app && npm run test:rls` with local Supabase env and local demo fixture flag | PASS 56/56, 0 skipped |
| `cd app && npx supabase db dump --linked --file <runtime>/schema.sql --yes` | PASS; remote schema dump created |
| `cd app && npx supabase db dump --linked --data-only --use-copy --file <runtime>/data.sql --yes` | PASS; remote data dump created with circular-FK restore warnings |
| `age -r <runtime public key> -o <runtime backup>.age <runtime tarball>` | PASS; encrypted backup manifest created with SHA-256 `b3780aea4b7dd8d7dd62a228583e3114624f24a8923b8f5b15410527cd87ec4f` |
| Isolated restore drill into local Supabase database `restore_drill_20260828111154` | PASS; encrypted backup decrypted, full schema/data restored, public table count 104 |
| `cd app && npx supabase db push --linked --include-all --dry-run --yes` | PASS; exactly three hosted-sandbox migrations selected |
| `cd app && npx supabase db push --linked --include-all --yes` | PASS; three hosted-sandbox migrations applied to remote |
| `cd app && npx supabase migration list` | PASS; local and remote migration histories match through `20260826130000` |
| Hosted cleanup dry-run | BLOCKED: `unexpected_auth_users`; fixed demo tenant has 2 memberships, 1 expected demo user, 1 unexpected auth user |
| Temporary cleanup allow + `runDemoCleanup({ argv: ["--apply"] })` | PASS: deleted fixed demo tenant rows; totalRows 30, postTotalRows 0, demoAuthUserCount 1, demoStorageObjectCount 0 |
| Guard-restored hosted cleanup dry-run | PASS: totalRows 0, demoAuthUserCount 0, demoStorageObjectCount 0 |
| `cd app && npx vitest run src/lib/hosted-sandbox-tenant-isolation.test.ts --no-file-parallelism --maxWorkers=1` | PASS 12/12 |
| `node tools/hosted-sandbox/deploy/apply-hosted-release.mjs` | PARTIAL: artifact staged and hash verified; remote helper missing at `/opt/manu-ai/tools/hosted-sandbox/deploy/deploy-hosted-release.mjs` |
| Manual remote deploy using staged artifact `hs-67892db854e1-b66efff838fe.tar.gz` | PASS; `/opt/manu-ai/current` switched to commit `67892db854e12ca4d71f0dc6d8f3ca12cb4e8b99` |
| `curl https://siriusai.store/api/health/release` | PASS; exact release ID, commit SHA, migration fingerprint, and compatibility version returned |
| Controlled rollback rehearsal | PASS; switched to previous release `auth-rate-status-f069f52-20260824`, verified `/`, then restored current release and exact health smoke |

## Remote Execution

| Required action | Status |
| --- | --- |
| Docker clean Supabase reset and zero-skip RLS | PASS: local reset and RLS 56/56 with 0 skipped |
| Real hosted backup hash/freshness validation | PASS: Supabase linked schema/data dump encrypted with `age`; manifest schema `2.0.0`; SHA-256 verified |
| Isolated restore drill | PASS: restored into local Supabase isolated database with Supabase role/extension preconditions |
| Hosted cleanup apply | PASS: fixed demo tenant cleanup applied after temporary operator allow; guard restored and dry-run now reports zero rows |
| Hosted migration apply | PASS: remote migration history now matches local through `20260826130000` |
| Exact remote release smoke and rollback rehearsal | PASS: `https://siriusai.store/api/health/release` returns commit `67892db854e12ca4d71f0dc6d8f3ca12cb4e8b99`; rollback rehearsal passed |

## Final boundary

The project can continue from product-development work without reintroducing the old Hosted Sandbox Remediation v1.1 governance plan. Hosted Sandbox technical debt is closed. Production remains NO-GO, provider/channel egress remains disabled, live billing remains disabled, production schema rollout remains disabled, and physical iPhone Safari/PWA remains WAIVED_NOT_EXECUTED under the permanent owner waiver recorded in `docs/OWNER_IOS_VALIDATION_WAIVER_DECISION.md`.

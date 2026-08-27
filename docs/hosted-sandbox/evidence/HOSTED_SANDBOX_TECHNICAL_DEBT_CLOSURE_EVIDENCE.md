# Hosted Sandbox Technical Debt Closure Evidence

**Date:** 2026-08-27
**Status:** LOCAL_IMPLEMENTATION_CLOSED_REMOTE_EXECUTION_BLOCKED
**Production:** NO-GO
**Independent review:** NOT_REQUESTED

## Summary

The Hosted Sandbox technical-debt implementation plan is complete locally for code, contracts, tests, build, artifact, deploy preparation, cleanup preparation, and activation preparation. The old Hosted Sandbox Remediation v1.1 governance plan is superseded and is not required for continued project work.

Remote execution is not claimed as complete because this session does not have Docker daemon access, Supabase CLI, PostgreSQL client tools, age encryption CLI, hosted secrets, SSH pinned known_hosts, or explicit remote apply approvals.

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

## Blocked remote execution

| Required action | Status |
| --- | --- |
| Docker clean Supabase reset and zero-skip RLS | BLOCKED: Docker daemon unavailable |
| Real hosted backup hash/freshness validation | BLOCKED: `pg_dump` and `age` unavailable; hosted DB/env approvals not present |
| Isolated restore drill | BLOCKED: Docker/restore target/tooling unavailable |
| Hosted cleanup apply | BLOCKED: requires real backup manifest and explicit approval |
| Hosted migration apply | BLOCKED: Supabase CLI/secrets/approval unavailable |
| Exact remote release smoke and rollback rehearsal | BLOCKED: SSH known_hosts pin, remote env, and explicit approval unavailable |

## Final boundary

The project can continue from local product-development work without reintroducing the old Hosted Sandbox Remediation v1.1 governance plan. Before claiming hosted runtime closure or production readiness, the blocked remote execution rows above must be run for real and recorded as PASS. Production remains NO-GO, provider/channel egress remains disabled, live billing remains disabled, production schema rollout remains disabled, and physical iPhone Safari/PWA remains WAIVED_NOT_EXECUTED.

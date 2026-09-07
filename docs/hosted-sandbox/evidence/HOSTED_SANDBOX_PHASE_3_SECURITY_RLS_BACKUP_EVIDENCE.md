# Hosted Sandbox Phase 3 Security RLS Backup Evidence

Date: 2026-08-28

Contract: `hosted-sandbox-environment-assurance-v1`

Phase: `HS-FAZ-3`

Independent review: `NOT_REQUESTED`

Production: `NO-GO`

## What this phase did

Faz 3 added an append-only migration binding `dietitian_belongs_to_tenant` to `auth.uid()` membership, revoked PUBLIC/anon EXECUTE from core RLS helper functions, introduced age-encrypted backup/restore tooling with manifest hashing, and updated `BACKUP_RESTORE_RUNBOOK.md` for Supabase Free retention without paid PITR.

Remote backup, remote restore drill, and remote migration were executed on 2026-08-28 after local tooling and linked Supabase access were verified.

## Commands

| Command | Exit code | Result |
| --- | --- | --- |
| `node --test tools/hosted-sandbox/hosted-sandbox-backup.test.mjs` | 0 | PASS 4/4 |
| `cd app && npx vitest run src/lib/hosted-sandbox-security.test.ts` | 0 | PASS 2/2 |
| `cd app && npx supabase db reset` | 0 | PASS: clean local Supabase reset |
| `cd app && npm run test:rls` with local Supabase env and local demo fixture flag | 0 | PASS 56/56, 0 skipped |
| `cd app && npx supabase db dump --linked --file <runtime>/schema.sql --yes` | 0 | PASS: remote schema dump created |
| `cd app && npx supabase db dump --linked --data-only --use-copy --file <runtime>/data.sql --yes` | 0 | PASS: remote data dump created; pg_dump reported circular-FK restore warnings |
| `age -r <runtime public key> -o <runtime backup>.age <runtime tarball>` | 0 | PASS: encrypted backup manifest created; SHA-256 `b3780aea4b7dd8d7dd62a228583e3114624f24a8923b8f5b15410527cd87ec4f` |
| Isolated restore drill into local Supabase database `restore_drill_20260828111154` | 0 | PASS: encrypted backup decrypted, full schema/data restored, public table count 104 |
| `cd app && npx supabase db push --linked --include-all --yes` | 0 | PASS: three hosted-sandbox migrations applied to remote |
| Hosted cleanup apply after temporary operator allow | 0 | PASS: fixed demo tenant cleanup applied; totalRows 30, postTotalRows 0 |
| Guard-restored hosted cleanup dry-run | 0 | PASS: totalRows 0, demoAuthUserCount 0, demoStorageObjectCount 0 |

## Residual

- Hosted cleanup apply is complete; the cleanup guard was restored after the temporary operator allow.
- Leaked-password protection and PITR remain disabled (paid); documented residual risk.
- Production remains `NO-GO`.

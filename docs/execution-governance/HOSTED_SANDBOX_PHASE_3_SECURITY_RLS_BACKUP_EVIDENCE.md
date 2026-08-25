# Hosted Sandbox Phase 3 Security RLS Backup Evidence

Date: 2026-08-25

Contract: `hosted-sandbox-environment-assurance-v1`

Phase: `HS-FAZ-3`

Independent review: `NOT_REQUESTED`

Production: `NO-GO`

## What this phase did

Faz 3 added an append-only migration binding `dietitian_belongs_to_tenant` to `auth.uid()` membership, revoked PUBLIC/anon EXECUTE from core RLS helper functions, introduced age-encrypted backup/restore tooling with manifest hashing, and updated `BACKUP_RESTORE_RUNBOOK.md` for Supabase Free retention without paid PITR.

Remote backup, remote restore drill, and remote migration were not executed.

## Commands

| Command | Exit code | Result |
| --- | --- | --- |
| `node --test tools/hosted-sandbox/hosted-sandbox-backup.test.mjs` | 0 | PASS 4/4 |
| `cd app && npx vitest run src/lib/hosted-sandbox-security.test.ts` | 0 | PASS 2/2 |
| `cd app && npm run test:rls` | 1 | BLOCKED without local Supabase (`MANU_ALLOW_REMOTE_RLS_TESTS` not set) |

## Residual

- Live pg_dump/age backup and isolated restore drill await operator tooling and explicit approval env flags.
- Leaked-password protection and PITR remain disabled (paid); documented residual risk.
- Production remains `NO-GO`.

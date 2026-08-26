# MANU-AI Backup And Restore Runbook

## Status

Draft for external review. This does not approve production pilot launch.

## Hosted Sandbox Free-Tier Backup (Faz 3)

Supabase Free tier remains in use. Paid PITR and leaked-password protection stay disabled; production remains `NO-GO`.

### Policy

- RPO: 24 hours (daily backup)
- RTO target: 4 hours
- Retention: 14 daily copies + 8 weekly copies
- Encryption: `age` with operator-controlled public key only in VPS/env; private key never stored in repo, GitHub, or evidence
- Upload: user-controlled `rclone` to OneDrive after local manifest verification
- Remote backup requires `MANU_HOSTED_SANDBOX_BACKUP_APPROVED=true`
- Remote restore requires `MANU_HOSTED_SANDBOX_RESTORE_APPROVED=true` or an explicit age identity file path

### Commands

```bash
# Inventory only (no dump)
node tools/hosted-sandbox/backup-hosted-supabase.mjs --dry-run

# Local isolated backup (requires pg_dump, age, MANU_HOSTED_SANDBOX_BACKUP_AGE_PUBLIC_KEY)
node tools/hosted-sandbox/backup-hosted-supabase.mjs --apply --output-dir=.manu-runtime/hosted-sandbox/backups

# Restore drill into isolated database only
node tools/hosted-sandbox/restore-hosted-supabase.mjs --dry-run --manifest=path/to/backup.age.manifest.json
node tools/hosted-sandbox/restore-hosted-supabase.mjs --apply --manifest=path/to/backup.age.manifest.json
```

Never commit raw `.dump`, `.age`, or decrypted artifacts. Evidence records command exit codes and manifest hashes only.

## Required Policy Decisions

- Backup provider and region.
- Backup retention duration.
- Restore test cadence.
- Encryption and key ownership.
- Deletion/anonymization propagation expectations.
- Legal hold behavior.

## Restore Drill Checklist

1. Select a non-production backup snapshot.
2. Restore into an isolated environment.
3. Verify tenant isolation and RLS policies before exposing access.
4. Verify client anonymization and export workflows after restore.
5. Verify notification, handoff, AI decision, and audit tables are internally consistent.
6. Destroy the drill environment after evidence is recorded.

## Closure Evidence

- Snapshot identifier.
- Restore environment identifier.
- Restore start and completion time.
- Tenant isolation test result.
- Data-governance workflow test result.
- Reviewer sign-off.

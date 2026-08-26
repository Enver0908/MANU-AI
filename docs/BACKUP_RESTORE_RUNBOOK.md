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
- Remote restore apply requires an explicit age identity file and a restore approval JSON file
- `pg_dump` and `pg_restore` must receive connection secrets through `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` child-process environment only; database URLs must not be passed as process arguments
- Raw `.dump` and decrypted restore files are temporary artifacts and must be deleted by the script in `finally` cleanup

### Commands

```bash
# Inventory only (no dump)
node app/scripts/backup-hosted-supabase.mjs --dry-run

# Local isolated backup (requires pg_dump, age, MANU_HOSTED_SANDBOX_BACKUP_AGE_PUBLIC_KEY)
node app/scripts/backup-hosted-supabase.mjs --apply --output-dir=.manu-runtime/hosted-sandbox/backups

# Restore drill into isolated database only
node app/scripts/restore-hosted-supabase.mjs --dry-run --manifest=path/to/backup.age.manifest.json
node app/scripts/restore-hosted-supabase.mjs --apply --manifest=path/to/backup.age.manifest.json --approval=path/to/restore-approval.json
```

Never commit raw `.dump`, `.age`, or decrypted artifacts. Evidence records command exit codes and manifest hashes only.

### Restore Approval JSON

Restore apply must use a JSON file with this exact contract:

```json
{
  "schemaVersion": "1.0.0",
  "sourceProjectRef": "source-supabase-ref",
  "targetProjectRef": "isolated-target-ref",
  "backupSha256": "64-char-sha256-of-encrypted-backup",
  "approvedAt": "2026-08-26T00:00:00.000Z",
  "expiresAt": "2026-08-27T00:00:00.000Z",
  "operatorConfirmation": "RESTORE_TO_ISOLATED_TARGET"
}
```

The restore script rejects missing approval, expired approval, source/target ref equality, target ref mismatch, backup hash mismatch, and any confirmation value other than `RESTORE_TO_ISOLATED_TARGET`.

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

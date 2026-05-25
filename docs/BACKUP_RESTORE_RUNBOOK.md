# MANU-AI Backup And Restore Runbook

## Status

Draft for external review. This does not approve production pilot launch.

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

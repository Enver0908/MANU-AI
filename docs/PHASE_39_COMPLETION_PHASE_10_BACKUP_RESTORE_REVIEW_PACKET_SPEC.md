# Phase 39 / Completion Roadmap Phase 10 - Backup Restore Review Packet Spec

Date: 2026-05-31

## Goal

Prepare the `backup_restore_test` launch gate for external operations, security, and legal review.

This phase creates a review packet only. It does not approve backup/restore operations, configure a production backup provider, run a restore drill, or connect any production infrastructure.

## Scope

In scope:

- Map the current draft backup/restore runbook to required production backup, retention, restore, encryption, legal-hold, and drill decisions.
- Document missing restore evidence and owner decisions.
- Separate internal draft runbook evidence from external restore-drill approval artifacts.
- Update the production pilot dossier, evidence pack, approval intake, risk register, plans, app README, and handoff notes.

Out of scope:

- Production backup provider configuration.
- Restore drill execution.
- Backup snapshot creation, export, import, or destructive cleanup automation.
- Secret manager, monitoring, paging, storage, cloud account, or infrastructure changes.
- Runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-client-data changes.

## Current Technical Baseline

- `BACKUP_RESTORE_RUNBOOK.md` exists as a draft.
- The draft checklist requires isolated restore, tenant isolation and RLS checks, data-governance workflow checks, notification/handoff/AI/audit consistency checks, and destruction of the drill environment.
- Final backup provider, region, retention duration, restore cadence, encryption ownership, deletion/anonymization propagation, and legal hold behavior remain externally gated.
- R-406 remains blocked until local Supabase RLS evidence can be produced.

## Required External Decisions

External review must decide:

- Backup provider, region, and data residency posture.
- Backup retention duration and expiry behavior.
- Encryption and key ownership.
- Restore drill cadence, owner, and evidence format.
- Legal hold behavior.
- Deletion/anonymization propagation expectations after restore.
- Tenant isolation and RLS validation steps after restore.
- Production environment access rules during a restore.
- Criteria for approving or failing a restore drill.

## Edge Cases

- A draft runbook is not a successful restore test.
- A restore drill must not use real production secrets in repository docs.
- Restored environments must remain isolated until tenant isolation and RLS checks pass.
- Restored data must not revive anonymized promptable client context without an approved legal/operational decision.
- Backup/restore approval cannot close R-405 or R-406.

## Done Criteria

- `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md` exists.
- The external approval intake references the backup/restore review packet while keeping `backup_restore_test` open.
- The production pilot dossier and evidence pack include the packet as internal evidence, not approval.
- Plans, risk register, app README, and handoff notes reflect Phase 39.
- `npm run release:verify` passes with only documented R-405 findings.

## Verification

`npm run release:verify` passed on 2026-05-31 after the Phase 39 documentation update:

- Core package tests: 49/49 passed.
- App tests: 103/103 passed.
- App lint: passed.
- Production build: passed.
- Production dependency audit: passed with only documented R-405 findings.

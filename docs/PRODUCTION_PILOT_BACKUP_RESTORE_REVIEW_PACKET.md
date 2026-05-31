# MANU-AI Production Pilot Backup Restore Review Packet

Date: 2026-05-31

## Status

This packet prepares the `backup_restore_test` launch gate for external operations, security, and legal review.

It does not approve production backup/restore operations or provide passing restore-drill evidence.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, backup provider, or real client health data is connected.

The `backup_restore_test` launch gate remains open until acceptable external approval evidence is supplied.

## Review Objective

External reviewers must decide whether MANU-AI has acceptable production pilot backup, retention, restore, isolation, encryption, legal-hold, and drill procedures.

The default answer remains draft-only.

## Internal Evidence

| Evidence | Relevance |
| --- | --- |
| `BACKUP_RESTORE_RUNBOOK.md` | Draft backup/restore policy decisions, restore drill checklist, and closure evidence requirements. |
| `PHASE_11_OPERATIONAL_EVIDENCE_READINESS_SPEC.md` | Documents that backup/restore evidence is an external launch gate and draft-only internally. |
| `PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md` | Documents legal ops ledger and final retention/deletion approval boundaries. |
| `PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md` | Documents incident, DSAR, deletion, evidence preservation, and re-enable decisions that intersect with restore behavior. |
| `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md` | Documents legal/privacy retention, deletion, and data processing decisions that backup policy must align with. |
| `PHASE_31_COMPLETION_PHASE_2_RLS_EVIDENCE_SPEC.md` | Records that expanded RLS evidence remains blocked pending local Docker/Supabase availability. |

Internal evidence supports review, but it is not passing restore-drill evidence.

## Required External Decisions

The approval artifact must explicitly cover:

- Production backup provider and region.
- Backup retention duration and expiry policy.
- Backup encryption mode and key ownership.
- Restore drill owner, backup owner, security reviewer, and legal/privacy reviewer.
- Restore drill cadence and minimum evidence required.
- Isolated restore environment requirements.
- Tenant isolation and RLS validation steps after restore.
- Data-governance workflow validation after restore, including export, anonymization, deletion, and legal hold behavior.
- Notification, handoff, AI decision, audit event, and legal ops ledger consistency checks after restore.
- Rules for destroying restore drill environments.
- Criteria for approving, failing, or rerunning a restore drill.

## Current Technical Controls

- Backup/restore runbook exists as draft-only.
- Restore checklist requires isolated environment use.
- Restore checklist requires tenant isolation and RLS policy verification before access is exposed.
- Restore checklist requires data-governance workflow verification after restore.
- Restore checklist requires notification, handoff, AI decision, and audit table consistency review.
- RLS tests exist but latest local execution evidence is blocked by Docker/local Supabase availability.

## Missing Before Gate Closure

The gate cannot close until the user supplies an acceptable external approval record covering:

- Backup provider and region approval.
- Backup retention and expiry approval.
- Encryption and key ownership approval.
- Restore drill execution evidence with timestamp, environment, snapshot reference, owner, and result.
- Tenant isolation and RLS test result after restore.
- Data-governance workflow test result after restore.
- Legal hold and deletion/anonymization propagation decision.
- Restore drill reviewer sign-off.
- R-405 dependency blocker resolution or formal acceptance.
- R-406 passing local Supabase RLS evidence.

## Sanitization Rules

Do not paste any of the following into repository documentation:

- Backup credentials, storage keys, database passwords, or secret-manager values.
- Real client identifiers.
- Raw client health data.
- Production snapshot contents.
- Private cloud account identifiers if they are sensitive.
- Restore environment credentials or connection strings.
- Sensitive legal-hold or incident artifacts.

Record only sanitized artifact references in `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`.

## Non-Approval Statement

This packet does not approve production pilot launch, real health-data processing, production backup/restore operations, restore-drill success, real provider calls, real channel messaging, external monitoring, or secret manager use.


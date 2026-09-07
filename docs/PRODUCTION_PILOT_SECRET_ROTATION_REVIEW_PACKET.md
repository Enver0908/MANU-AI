# MANU-AI Production Pilot Secret Rotation Review Packet

**Current status interpretation (2026-08-18):** R-405 is `technically_resolved` locally; any older R-405 prerequisite below is historical. This packet's secret-rotation approval gate remains open, and production remains `NO-GO`. Local dependency remediation does not provide production secret-management acceptance.

Date: 2026-05-31

## Status

This packet prepares the `secret_rotation_plan` launch gate for external security and operations review.

It does not approve production secret management or provide passing secret-rotation evidence.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, backup provider, or real client health data is connected.

The `secret_rotation_plan` launch gate remains open until acceptable external approval evidence is supplied.

## Review Objective

External reviewers must decide whether MANU-AI has an acceptable production pilot secret inventory, storage, access-control, rotation, emergency revocation, and verification procedure.

The default answer remains draft-only.

## Internal Evidence

| Evidence | Relevance |
| --- | --- |
| `SECRET_ROTATION_RUNBOOK.md` | Draft secret classes, rotation checklist, and emergency revocation procedure. |
| `PHASE_11_OPERATIONAL_EVIDENCE_READINESS_SPEC.md` | Documents that secret rotation is an external launch gate and draft-only internally. |
| `PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md` | Documents incident escalation and evidence-preservation dependencies for secret exposure. |
| `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md` | Documents provider credential boundaries and vendor review needs. |
| `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md` | Documents WhatsApp/Telegram credential and webhook secret boundaries. |
| `PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md` | Documents backup/storage secret and key ownership dependencies. |

Internal evidence supports review, but it is not a signed secret rotation plan.

## Required External Decisions

The approval artifact must explicitly cover:

- Approved production secret manager.
- Production secret inventory categories and owner.
- Supabase key rotation cadence and owner.
- WhatsApp and Telegram credential rotation cadence and owner.
- LLM provider credential rotation cadence and owner.
- Email, push, monitoring, analytics, backup/storage, and CI/CD credential rotation cadence and owner if used.
- Break-glass access policy.
- Emergency revocation procedure and escalation path.
- Health checks and smoke tests required before and after rotation.
- Audit evidence format for each rotation event.
- Access review cadence.
- Rules for local `.env` files, developer machines, CI variables, and deployment environments.

## Current Technical Controls

- Secret rotation runbook exists as draft-only.
- `.env.local` is gitignored and must not be printed or committed.
- Real provider, channel, monitoring, backup, and secret-manager credentials remain absent from the repository.
- Release verification runs without production secrets.
- Existing runbooks explicitly warn against storing secrets or raw client data in repo docs.
- Launch gates remain open by default without external approval evidence.

## Missing Before Gate Closure

The gate cannot close until the user supplies an acceptable external approval record covering:

- Approved production secret manager.
- Production secret inventory.
- Named owner and backup owner.
- Rotation cadence per secret class.
- Emergency revocation procedure.
- Access-control and break-glass policy.
- Rotation verification and smoke-test requirements.
- Signed or dated operational owner approval.
- R-405 dependency blocker resolution or formal acceptance.
- R-406 passing local Supabase RLS evidence.

## Sanitization Rules

Do not paste any of the following into repository documentation:

- Secret values.
- Token prefixes or suffixes.
- Connection strings.
- Provider credentials.
- Webhook secrets.
- Database passwords.
- Private deployment URLs if sensitive.
- Private emergency contact details.
- Screenshots or logs containing secrets.

Record only sanitized artifact references in `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`.

## Non-Approval Statement

This packet does not approve production pilot launch, production secret management, secret rotation success, real health-data processing, real provider calls, real channel messaging, external monitoring, backup provider setup, or secret manager use.

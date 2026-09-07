# MANU-AI Production Pilot Incident And DSAR Review Packet

**Current status interpretation (2026-08-18):** R-405 is `technically_resolved` locally; any older R-405 prerequisite below is historical. This packet's incident/DSAR approval gate remains open, and production remains `NO-GO`. Local dependency remediation does not provide operational or privacy acceptance.

Date: 2026-05-31

## Status

This packet prepares the `incident_response_runbook` launch gate for external operations, legal, privacy, and clinical review.

It does not approve production incident response or production DSAR/deletion operations.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, or real client health data is connected.

The `incident_response_runbook` launch gate remains open until acceptable external approval evidence is supplied.

## Review Objective

External reviewers must decide whether MANU-AI has an acceptable production pilot operating procedure for incidents, breach escalation, data subject/client rights requests, export, anonymization, deletion, evidence preservation, and post-incident re-enable.

The default answer remains draft-only.

## Internal Evidence

| Evidence | Relevance |
| --- | --- |
| `INCIDENT_RESPONSE_RUNBOOK.md` | Draft trigger, first-30-minute, first-24-hour, and closure evidence procedure. |
| `PHASE_11_OPERATIONAL_EVIDENCE_READINESS_SPEC.md` | Documents required operational evidence labels and draft runbook scope. |
| `PHASE_5_DATA_GOVERNANCE_SPEC.md` | Documents tenant/client-scoped export and anonymization skeleton. |
| `PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md` | Documents legal ops ledger records for completed export and anonymization operations. |
| `PHASE_15_SAFE_OBSERVABILITY_OPERATIONAL_HEALTH_SPEC.md` | Documents safe aggregate operational health snapshots and monitoring payload limits. |
| `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md` | Identifies legal/privacy decisions needed for DSAR, retention, deletion, and breach handling. |
| `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md` | Identifies channel/platform notification and suspension/fallback decisions that may affect incidents. |
| `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md` | Identifies provider incident, retention, logging, and breach-notification decisions. |

Internal evidence supports review, but it is not an approved operating procedure.

## Required External Decisions

The approval artifact must explicitly cover:

- Incident commander, backup incident commander, legal/privacy owner, security owner, operations owner, and clinical reviewer.
- Severity taxonomy for tenant leakage, red-risk failure, unauthorized access, provider/channel data exposure, secret exposure, DSAR failure, and service outage.
- First-30-minute containment procedure.
- First-24-hour investigation, legal escalation, and communication procedure.
- Client, regulator, provider, channel/platform, and subprocessor notification triggers.
- Evidence preservation rules and storage location for sensitive incident artifacts.
- Prohibited incident payloads for repo docs, logs, monitoring, tickets, and chat tools.
- DSAR/export/anonymization/deletion owner, SLA, approval chain, and verification method.
- Production deletion or anonymization operating procedure, including legal hold exceptions.
- Re-enable criteria for disabled tenant access, provider calls, channel traffic, notifications, or integrations.
- Drill cadence, training owner, and review cadence.

## Current Technical Controls

- Incident runbook exists as draft-only.
- Export is tenant/client scoped.
- Anonymization clears promptable client context, channel identifiers, rolling memory, message bodies, and AI decision references while preserving minimized audit evidence.
- Legal ops ledger records completed export and anonymization operations.
- Safe operational health exposes aggregate counts only.
- RLS/RBAC work supports scoped tenant/client access in Supabase-backed paths when local Supabase evidence is available.
- Launch gates remain open by default without external approval evidence.

## Missing Before Gate Closure

The gate cannot close until the user supplies an acceptable external approval record covering:

- Signed or dated incident and DSAR operating procedure.
- Named production owners and backup owners.
- Approved severity and escalation matrix.
- Breach and platform/provider notification procedure.
- Approved DSAR/export/anonymization/deletion procedure and SLA.
- Approved sensitive evidence storage location outside the repository.
- Drill or tabletop exercise requirement, or dated waiver for pilot launch.
- Legal/privacy approval alignment.
- R-405 dependency blocker resolution or formal acceptance.
- R-406 passing local Supabase RLS evidence.

## Sanitization Rules

Do not paste any of the following into repository documentation:

- Real client identifiers.
- Raw client health messages.
- Production incident payloads.
- Provider, channel, monitoring, or secret-manager credentials.
- Private security contacts or escalation phone numbers.
- Sensitive legal communications.
- Breach notification drafts containing real personal data.

Record only sanitized artifact references in `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`.

## Non-Approval Statement

This packet does not approve production pilot launch, real health-data processing, production incident response, production DSAR/deletion operations, real provider calls, real channel messaging, external monitoring, or secret manager use.

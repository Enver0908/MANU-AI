# MANU-AI Production Pilot External Approval Intake

Date: 2026-06-03

## Status

This intake packet is a structured checklist for collecting external production-pilot approval evidence.

It does not approve production pilot launch.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, or real client health data is connected.

All production-pilot launch gates remain open until the user supplies acceptable external approval evidence.

## Intake Rules

- Do not paste secrets, real client identifiers, or raw client health messages into this repository.
- Store signed or sensitive approval artifacts outside the repo and record only a sanitized reference here.
- A gate can close only when every required evidence item is covered by an acceptable artifact.
- Internal implementation evidence can support review, but it cannot replace external legal, clinical, provider, platform, operations, or dependency approval.
- R-405 requires a safe stable dependency remediation with clean production audit, or formal external risk acceptance.
- R-406 requires a passing local Supabase RLS run before RLS evidence is complete.
- User-supplied dietitian/client forms must be reviewed as legal/privacy and clinical inputs before production use.
- User-supplied official health-regulation PDFs must be recorded as sanitized references and transformed into an approved, versioned, page/section-referenced corpus before active production routing.
- Phase 64 structured evidence evaluation requires each gate artifact reference to include owner, artifact title, sanitized reference, explicit approval status, approval date, review due date, optional expiry, and exact required evidence items covered.
- Phase 65 official PDF corpus QA requires official PDF source metadata, SHA-256 checksums, page extraction evidence, page/section references, derived rule drafts, corpus version, and synthetic corpus golden cases before PDF-derived clinical evidence can be submitted for approval.

## Evidence Intake Matrix

| Gate id | Launch gate | Required evidence | Approval owner | Acceptable artifact | Current status | Evidence reference | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `legal_privacy_review` | Legal and privacy review | Legal basis matrix; privacy notice and client permission documents; medical-device or clinical-decision-support classification memo; user-supplied dietitian/client form privacy and prompt-allowlist approval; official PDF corpus handling decision | Legal/privacy counsel | Signed legal/privacy memo or dated counsel approval record | Open | Review packet prepared in `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`; approval not supplied | Must cover internal copilot records, dietitian context updates, retention, DSAR/export/anonymization, permission flow, user-supplied forms, and official PDF corpus handling. |
| `clinical_taxonomy_approval` | Qualified dietitian clinical taxonomy approval | Qualified dietitian sign-off; current clinical golden test report; taxonomy change log; approved official regulation PDF corpus version; corpus golden-case report; production second-layer or equivalent fail-closed safety evaluation evidence | Qualified dietitian reviewer | Signed taxonomy review naming taxonomy version, approved corpus version, test result, and approved second-layer or equivalent safety evaluation approach | Open | Review packet prepared in `PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`; Phase 56 local second-layer evidence added; Phase 61 mock scope guard added; approval not supplied | Must approve current red/yellow/green taxonomy, escalation behavior, official PDF-derived routing rules, user-supplied form clinical implications, and production safety evaluation approach. The deterministic/regex classifier is only a local first barrier and is not sufficient as the sole production clinical safety layer. |
| `provider_vendor_review` | Provider vendor and retention review | Provider terms review; health-data retention configuration; prompt and completion logging decision | Legal/vendor/security reviewer | Vendor-risk approval covering retention, training use, logging, region, and access controls | Open | Review packet prepared in `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`; approval not supplied | Must cover any future Gemini/external LLM use, internal copilot egress, and dietitian context update egress. |
| `channel_policy_review` | WhatsApp and Telegram policy review | WhatsApp healthcare feasibility review; Telegram privacy and bot policy review; opt-in, opt-out, template, and service-window procedure | Platform/policy owner | Dated channel policy memo and approved operating procedure | Open | Review packet prepared in `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`; approval not supplied | Must approve real WhatsApp/Telegram use before any production channel connection. |
| `incident_response_runbook` | Incident response and deletion workflow runbook | Incident response runbook; breach escalation owner list; client deletion and export operating procedure | Operations/legal owner | Signed incident and DSAR operating procedure with owner list | Open | Review packet prepared in `PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`; approval not supplied | Existing runbook is draft only and lacks named production owners. |
| `backup_restore_test` | Backup expiry and restore test | Backup expiry policy; restore drill result; restore owner and cadence | Operations/security owner | Restore drill evidence with owner, timestamp, environment, and result | Open | Review packet prepared in `PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`; approval not supplied | Must include tenant isolation and data-governance checks after restore. |
| `secret_rotation_plan` | Production secret rotation plan | Secret inventory; rotation cadence; emergency revocation procedure | Security/operations owner | Secret inventory and rotation plan signed by operational owner | Open | Review packet prepared in `PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`; approval not supplied | Must identify production secret manager and emergency revocation ownership. |
| `dependency_audit_clearance` | Production dependency audit clearance | Production dependency audit report; R-405 resolution or formal acceptance | Engineering/security owner plus external approver if accepting risk | Clean production audit, safe stable upgrade evidence, or formal risk acceptance | Open | Review packet prepared in `PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md`; clearance not supplied | Phase 54 confirms no safe stable Next.js/PostCSS patch path yet. |

## Submission Checklist

For each supplied artifact, record:

- Gate id.
- Artifact title.
- Artifact owner or approving reviewer.
- Approval date.
- Review due date or review cadence.
- Optional expiry date.
- Sanitized storage reference.
- Evidence items covered.
- Evidence items not covered.
- For official PDF artifacts: source title, source owner, received date, checksum, storage reference, page-level extraction status, page/section reference map, derived rule draft list, corpus version, corpus golden-case report, and reviewer decision.
- For form artifacts: form owner, version, field-level privacy classification, prompt-allowlist decision, clinical implication review, migration decision, and reviewer decision.
- Explicit approval, rejection, or conditional approval language.
- Follow-up actions required before gate closure.

## Current Non-Approvals

- No launch gate is approved.
- No production pilot is approved.
- No real client health-data processing is approved.
- No real WhatsApp or Telegram messaging is approved.
- No real Gemini or external LLM use is approved.
- No external monitoring, analytics, email, push, or secret manager vendor is approved.
- R-405 is not resolved or accepted.
- R-406 is mitigated in the local prototype by the latest local Supabase RLS evidence, but this does not approve production pilot launch.

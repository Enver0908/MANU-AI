# MANU-AI Production Pilot External Approval Intake

Date: 2026-05-31

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

## Evidence Intake Matrix

| Gate id | Launch gate | Required evidence | Approval owner | Acceptable artifact | Current status | Evidence reference | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `legal_privacy_review` | Legal and privacy review | Legal basis matrix; privacy notice and client permission documents; medical-device or clinical-decision-support classification memo | Legal/privacy counsel | Signed legal/privacy memo or dated counsel approval record | Open | Review packet prepared in `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`; approval not supplied | Must cover internal copilot records, dietitian context updates, retention, DSAR/export/anonymization, and permission flow. |
| `clinical_taxonomy_approval` | Qualified dietitian clinical taxonomy approval | Qualified dietitian sign-off; current clinical golden test report; taxonomy change log | Qualified dietitian reviewer | Signed taxonomy review naming taxonomy version and test result | Open | Review packet prepared in `PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`; approval not supplied | Must approve current red/yellow/green taxonomy and escalation behavior. |
| `provider_vendor_review` | Provider vendor and retention review | Provider terms review; health-data retention configuration; prompt and completion logging decision | Legal/vendor/security reviewer | Vendor-risk approval covering retention, training use, logging, region, and access controls | Open | Review packet prepared in `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`; approval not supplied | Must cover any future Gemini/external LLM use, internal copilot egress, and dietitian context update egress. |
| `channel_policy_review` | WhatsApp and Telegram policy review | WhatsApp healthcare feasibility review; Telegram privacy and bot policy review; opt-in, opt-out, template, and service-window procedure | Platform/policy owner | Dated channel policy memo and approved operating procedure | Open | Review packet prepared in `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`; approval not supplied | Must approve real WhatsApp/Telegram use before any production channel connection. |
| `incident_response_runbook` | Incident response and deletion workflow runbook | Incident response runbook; breach escalation owner list; client deletion and export operating procedure | Operations/legal owner | Signed incident and DSAR operating procedure with owner list | Open | Review packet prepared in `PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`; approval not supplied | Existing runbook is draft only and lacks named production owners. |
| `backup_restore_test` | Backup expiry and restore test | Backup expiry policy; restore drill result; restore owner and cadence | Operations/security owner | Restore drill evidence with owner, timestamp, environment, and result | Open | Not supplied | Must include tenant isolation and data-governance checks after restore. |
| `secret_rotation_plan` | Production secret rotation plan | Secret inventory; rotation cadence; emergency revocation procedure | Security/operations owner | Secret inventory and rotation plan signed by operational owner | Open | Not supplied | Must identify production secret manager and emergency revocation ownership. |
| `dependency_audit_clearance` | Production dependency audit clearance | Production dependency audit report; R-405 resolution or formal acceptance | Engineering/security owner plus external approver if accepting risk | Clean production audit, safe stable upgrade evidence, or formal risk acceptance | Open | Not supplied | Phase 32 confirms no safe stable Next.js/PostCSS patch path yet. |

## Submission Checklist

For each supplied artifact, record:

- Gate id.
- Artifact title.
- Artifact owner or approving reviewer.
- Approval date.
- Sanitized storage reference.
- Evidence items covered.
- Evidence items not covered.
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
- R-406 is not mitigated.

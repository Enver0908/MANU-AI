# MANU-AI Production Pilot External Approval Intake

Date: 2026-06-30

Phase: 80B external artifact intake and sanitization

## Status

This intake packet is a structured checklist for collecting external production-pilot approval evidence.

It does not approve production pilot launch.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, or real client health data is connected.

All production-pilot launch gates remain open until the user supplies acceptable external approval evidence evaluated through the Phase 64 structured evidence engine.

## Phase 80 Intake Contract

Phase 80B records sanitized external approval references only. Each supplied artifact must map to `LaunchGateEvidenceRecord` in `app/src/lib/launch-gates.ts` and be evaluable by `evaluateProductionPilotLaunchGateEvidence`.

### Required Fields Per Artifact

| Field | Required | Notes |
| --- | --- | --- |
| `gateId` | yes | One of the eight canonical production-pilot launch gate ids |
| `artifactTitle` | yes | Sanitized title only |
| `artifactRef` | yes | Sanitized external storage or reference id; not raw file contents |
| `owner` | yes | Approving owner or reviewer |
| `approvalStatus` | yes | `approved`, `conditional`, `rejected`, or `draft`; only `approved` can contribute to gate closure |
| `approvedAt` | yes | ISO-8601 approval timestamp |
| `reviewDueAt` | yes | ISO-8601 next review due timestamp |
| `expiresAt` | no | Optional ISO-8601 expiry; if present, must be in the future |
| `coveredEvidence` | yes | Exact required evidence item names from the gate definition |
| `sanitizedReference` | yes | Must be `true` |

Multiple records may cover one gate. A gate closes only when the union of valid approved records covers every required evidence item for that gate.

### Forbidden Repository Content

Do not store any of the following in this repository:

- Raw approval documents or full PDF contents
- Secrets, API keys, provider credentials, or webhook tokens
- Real client identifiers, phone numbers, or raw health messages
- Private security threads or non-public vulnerability details
- Unsigned draft memos presented as final approval

Store sensitive artifacts outside the repo and record only sanitized references here.

## Phase 80B Intake Result

Recorded on 2026-06-30:

| Item | Value |
| --- | --- |
| Intake status | `no_external_artifact_supplied` |
| Supplied `LaunchGateEvidenceRecord` count | `0` |
| Gate status change | none; all eight launch gates remain open |
| Production pilot | `NO-GO` |
| R-405 | open |
| Phase 80D patch path | `no_safe_stable_patch` |
| Formal acceptance artifact | not supplied |
| R-406 | Phase 50/52 local baseline mitigated; current post-76N/77AA-77AI/79/80 re-run pending when local Supabase is unavailable |

No external approval artifacts were supplied for Phase 80B. Phase 80C evaluated the empty intake through `phase-80c-launch-gate-evidence-evaluation.ts` and kept every launch gate open with `productionPilotDecision: NO-GO`.

### Empty Intake Manifest

Use this manifest shape when recording Phase 80 intake status. Phase 80B leaves `evidenceRecords` empty because no artifacts were supplied.

```json
{
  "phase80IntakeVersion": "phase80-intake-v1",
  "generatedAt": "2026-06-30",
  "intakeStatus": "no_external_artifact_supplied",
  "evidenceRecords": []
}
```

When artifacts are later supplied, append sanitized records in this shape:

```json
{
  "gateId": "legal_privacy_review",
  "artifactTitle": "Sanitized title only",
  "artifactRef": "external-storage-ref-or-ticket-id",
  "owner": "approving owner or reviewer",
  "approvalStatus": "approved",
  "approvedAt": "2026-06-30T00:00:00.000Z",
  "reviewDueAt": "2027-06-30T00:00:00.000Z",
  "expiresAt": null,
  "coveredEvidence": [
    "legal basis matrix",
    "privacy notice and client permission documents"
  ],
  "sanitizedReference": true
}
```

Replace `coveredEvidence` with the exact required evidence item names from `PRODUCTION_PILOT_LAUNCH_GATES` in `app/src/lib/launch-gates.ts`. Partial coverage does not close a gate.

## Intake Rules

- Do not paste secrets, real client identifiers, or raw client health messages into this repository.
- Store signed or sensitive approval artifacts outside the repo and record only a sanitized reference here.
- A gate can close only when every required evidence item is covered by an acceptable artifact.
- Internal implementation evidence can support review, but it cannot replace external legal, clinical, provider, platform, operations, or dependency approval.
- R-405 requires a safe stable dependency remediation with dependency update evidence and clean production audit, or formal external risk acceptance with owner, rationale, compensating controls, accepted finding keys, review/expiry timing, and sanitized artifact reference.
- R-406 requires a passing local Supabase RLS run before current RLS evidence is complete; Phase 50/52 baseline mitigation remains the historical baseline when current re-run is pending.
- User-supplied dietitian/client forms must be reviewed as legal/privacy and clinical inputs before production use.
- User-supplied official health-regulation PDFs must be recorded as sanitized references and transformed into an approved, versioned, page/section-referenced corpus before active production routing.
- Phase 64 structured evidence evaluation requires each gate artifact reference to include owner, artifact title, sanitized reference, explicit approval status, approval date, review due date, optional expiry, and exact required evidence items covered.
- Phase 65 official PDF corpus QA requires official PDF source metadata, SHA-256 checksums, page extraction evidence, page/section references, derived rule drafts, corpus version, and synthetic corpus golden cases before PDF-derived clinical evidence can be submitted for approval.
- Direct 100 dietitian completion plan requires product communication covenant evidence and direct 5,000-client rehearsal evidence before production GO; these are internal readiness prerequisites and may support legal/privacy, clinical, channel, and incident/operations reviews.

## Evidence Intake Matrix

| Gate id | Launch gate | Required evidence | Approval owner | Acceptable artifact | Current status | Evidence reference | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `legal_privacy_review` | Legal and privacy review | Legal basis matrix; privacy notice and client permission documents; medical-device or clinical-decision-support classification memo; user-supplied dietitian/client form privacy and prompt-allowlist approval; official PDF corpus handling decision | Legal/privacy counsel | Signed legal/privacy memo or dated counsel approval record | Open | Review packet prepared in `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`; Phase 80B intake: no external artifact supplied | Must cover internal copilot records, dietitian context updates, retention, DSAR/export/anonymization, permission flow, user-supplied forms, and official PDF corpus handling. |
| `clinical_taxonomy_approval` | Qualified dietitian clinical taxonomy approval | Qualified dietitian sign-off; current clinical golden test report; taxonomy change log; approved official regulation PDF corpus version; corpus golden-case report; production second-layer or equivalent fail-closed safety evaluation evidence | Qualified dietitian reviewer | Signed taxonomy review naming taxonomy version, approved corpus version, test result, and approved second-layer or equivalent safety evaluation approach | Open | Review packet prepared in `PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`; Phase 56 local second-layer evidence added; Phase 61 mock scope guard added; Phase 80B intake: no external artifact supplied | Must approve current red/yellow/green taxonomy, escalation behavior, official PDF-derived routing rules, user-supplied form clinical implications, and production safety evaluation approach. The deterministic/regex classifier is only a local first barrier and is not sufficient as the sole production clinical safety layer. |
| `provider_vendor_review` | Provider vendor and retention review | Provider terms review; health-data retention configuration; prompt and completion logging decision | Legal/vendor/security reviewer | Vendor-risk approval covering retention, training use, logging, region, and access controls | Open | Review packet prepared in `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`; Phase 80B intake: no external artifact supplied | Must cover any future Gemini/external LLM use, internal copilot egress, and dietitian context update egress. |
| `channel_policy_review` | WhatsApp and Telegram policy review | WhatsApp healthcare feasibility review; Telegram privacy and bot policy review; opt-in, opt-out, template, and service-window procedure | Platform/policy owner | Dated channel policy memo and approved operating procedure | Open | Review packet prepared in `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`; Phase 80B intake: no external artifact supplied | Must approve real WhatsApp/Telegram use before any production channel connection. |
| `incident_response_runbook` | Incident response and deletion workflow runbook | Incident response runbook; breach escalation owner list; client deletion and export operating procedure | Operations/legal owner | Signed incident and DSAR operating procedure with owner list | Open | Review packet prepared in `PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`; Phase 80B intake: no external artifact supplied | Existing runbook is draft only and lacks named production owners. |
| `backup_restore_test` | Backup expiry and restore test | Backup expiry policy; restore drill result; restore owner and cadence | Operations/security owner | Restore drill evidence with owner, timestamp, environment, and result | Open | Review packet prepared in `PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`; Phase 80B intake: no external artifact supplied | Must include tenant isolation and data-governance checks after restore. |
| `secret_rotation_plan` | Production secret rotation plan | Secret inventory; rotation cadence; emergency revocation procedure | Security/operations owner | Secret inventory and rotation plan signed by operational owner | Open | Review packet prepared in `PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`; Phase 80B intake: no external artifact supplied | Must identify production secret manager and emergency revocation ownership. |
| `dependency_audit_clearance` | Production dependency audit clearance | Production dependency audit report; R-405 resolution or formal acceptance | Engineering/security owner plus external approver if accepting risk | Clean production audit, safe stable upgrade evidence, or formal risk acceptance with owner, rationale, compensating controls, accepted finding keys, review/expiry timing, and sanitized artifact reference | Open | Review packet prepared in `PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md`; Phase 80B intake: no external artifact supplied | Phase 80G confirms R-405 closure evidence is fail-closed unless technical remediation or complete external acceptance metadata is supplied. |

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

- Phase 80C gate evaluation result: all eight launch gates remain open; `productionPilotDecision` is `NO-GO`.
- No launch gate is approved.
- No production pilot is approved.
- No real client health-data processing is approved.
- No real WhatsApp or Telegram messaging is approved.
- No real Gemini or external LLM use is approved.
- No external monitoring, analytics, email, push, or secret manager vendor is approved.
- R-405 is not resolved or accepted.
- R-406 is Phase 50/52 baseline mitigated in the local prototype; current post-76N/77AA-77AI/79 re-run is pending when local Supabase is unavailable. This does not approve production pilot launch.

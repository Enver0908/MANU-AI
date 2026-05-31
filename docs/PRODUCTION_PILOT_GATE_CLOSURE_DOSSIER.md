# MANU-AI Production Pilot Gate Closure Dossier

Date: 2026-05-31

## Status

This dossier prepares MANU-AI for external review. It does not approve production pilot launch.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, or real client health data is connected.

All production-pilot launch gates remain open until the user supplies external approval evidence.

## Current Baseline

- Git baseline: Phase 27-29 checkpoint exists at `c75564e Add Phase 27-29 pilot readiness checkpoint` on branch `codex/phase-29-baseline-checkpoint`; Completion Roadmap Phase 1 records this as the current implementation baseline.
- Latest local release verification: `npm run release:verify` passed on 2026-05-31 after Phase 32 R-405 recheck documentation.
- Verification result: core tests 49/49, app tests 103/103, lint passed, production build passed.
- Dependency audit result: only known R-405 findings, `next:postcss` and `postcss:GHSA-qx2v-qp2m-jg93`.
- R-405 status: open production launch blocker; Completion Roadmap Phase 3 rechecked metadata on 2026-05-31 and stable `next@latest` is still 16.2.6 with `postcss@8.4.31`, so no safe stable Next.js/PostCSS patch path is available.
- R-405 remediation spec: `PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- RLS evidence status: expanded `npm run test:rls` coverage exists, but the 2026-05-31 Completion Roadmap Phase 2 attempt did not produce passing evidence. Local Supabase could not start because Docker Desktop's Linux engine pipe was unavailable, and `npm run test:rls` skipped 10 guarded tests. R-406 remains blocked pending local Docker/Supabase availability.

## Gate Closure Matrix

| Launch gate | Required evidence | Internal evidence available | Missing external decision | Acceptable approval artifact | Status |
| --- | --- | --- | --- | --- | --- |
| Legal and privacy review | Legal basis matrix, privacy notice and client permission documents, medical-device or clinical-decision-support classification memo | `DATA_INVENTORY.md`, `PHASE_5_DATA_GOVERNANCE_SPEC.md`, `PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`, `PHASE_26_INTERNAL_COPILOT_SPEC.md`, `PHASE_27_DIETITIAN_CONTEXT_UPDATE_SPEC.md`, tenant/client-scoped export and anonymization tests | Legal/privacy counsel must approve lawful basis, privacy notice, permission flow, data retention, internal copilot records, dietitian context update records, and classification | Signed legal/privacy memo or dated counsel approval record | Open |
| Qualified dietitian clinical taxonomy approval | Qualified dietitian sign-off, current clinical golden test report, taxonomy change log | `CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`, clinical JSONL golden cases, 49 core tests, persona-invariant tests | Qualified dietitian must approve `dietetic-risk-v0.3.0`, red/yellow/green routing, and escalation behavior | Signed taxonomy review record naming taxonomy version and test result | Open |
| Provider vendor and retention review | Provider terms review, health-data retention configuration, prompt and completion logging decision | `AI_PROVIDER_REQUIREMENTS.md`, local mock provider, provider-attempt audit semantics, provider segment allowlist guard, provider failure no-send behavior, Phase 26 local/mock-only copilot boundary, Phase 27 context update egress boundary, Phase 28 remediation spec | Vendor/legal review must approve any Gemini or external LLM use with health data, including any future internal copilot or dietitian context update provider egress | Vendor-risk approval record covering retention, training use, logging, region, and access controls | Open |
| WhatsApp and Telegram policy review | WhatsApp healthcare feasibility review, Telegram privacy and bot policy review, opt-in/out/template/service-window procedure | `PHASE_7_CHANNEL_ADAPTER_READINESS_SPEC.md`, `PHASE_16_CHANNEL_POLICY_SIMULATION_HARDENING_SPEC.md`, mock idempotency, identity quarantine, opt-out simulation | Platform/policy review must approve channel use, healthcare boundaries, templates, service window, and opt-in/out process | Dated channel policy memo and approved operating procedure | Open |
| Incident response and deletion workflow runbook | Incident response runbook, breach escalation owner list, client deletion and export operating procedure | `INCIDENT_RESPONSE_RUNBOOK.md`, legal ops ledger, export/anonymization helpers, safe operational health snapshot | Operational owners must be named and DSAR/deletion procedure must be approved | Signed incident and DSAR operating procedure with owner list | Open |
| Backup expiry and restore test | Backup expiry policy, restore drill result, restore owner and cadence | `BACKUP_RESTORE_RUNBOOK.md` | Backup provider, region, retention, encryption ownership, and restore drill must be approved and tested | Restore drill evidence with owner, timestamp, environment, and test results | Open |
| Production secret rotation plan | Secret inventory, rotation cadence, emergency revocation procedure | `SECRET_ROTATION_RUNBOOK.md` | Production secret manager, owner, cadence, and emergency revocation flow must be approved | Secret inventory and rotation plan signed by operational owner | Open |
| Production dependency audit clearance | Production dependency audit report, R-405 resolution or formal acceptance | `PHASE_19_RELEASE_VERIFICATION_DEPENDENCY_GATE_SPEC.md`, `PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`, `PHASE_29_PILOT_GATE_CLOSURE_EVIDENCE_HARDENING_SPEC.md`, `PHASE_32_COMPLETION_PHASE_3_R405_RECHECK_SPEC.md`, `npm run release:verify`, `RISK_REGISTER.md` | R-405 must be resolved through a safe stable patch path or formally accepted before pilot | Clean production audit report, safe stable upgrade evidence, or formal risk acceptance | Open |

## Review Packet Checklist

- Legal/privacy packet: data inventory, permission integration points, DSAR/export/anonymization evidence, retention placeholder list, dietitian context update records.
- Clinical packet: taxonomy version, golden JSONL cases, latest core test output, persona invariant statement, qualified dietitian sign-off template.
- Provider packet: provider requirements, no-storage/no-training requirements, prompt/completion logging decision checklist, provider-attempt audit semantics, provider input allowlist, dietitian context update egress review.
- Internal copilot packet: Phase 26 spec, `DATA_INVENTORY.md` copilot rows, RBAC/source-ref evidence, no-raw-SQL/no-mutation statement, provider-egress blocked statement.
- Channel packet: WhatsApp feasibility checklist, Telegram bot/privacy checklist, opt-in/out and service-window procedure, identity quarantine and idempotency evidence.
- Operations packet: incident owner placeholder, DSAR/deletion procedure placeholder, backup/restore drill placeholder, secret inventory and rotation owner placeholder.
- Dependency packet: latest `npm run release:verify` output, R-405 risk record, stable Next.js/PostCSS tracking note.
- RLS evidence packet: latest `npm run test:rls` output from local Supabase or the Phase 31 blocker note that Docker/local Supabase was unavailable and R-406 remains blocked.

## Non-Approvals

- This dossier does not approve production pilot launch.
- This dossier does not approve real client health-data processing.
- This dossier does not approve real WhatsApp or Telegram messaging.
- This dossier does not approve real Gemini or external LLM calls.
- This dossier does not approve routing the internal copilot to a real Gemini or external LLM provider.
- This dossier does not approve sending dietitian context updates to a real Gemini or external LLM provider.
- This dossier does not approve external email, push, monitoring, analytics, or secret manager vendors.
- This dossier does not resolve or accept R-405.

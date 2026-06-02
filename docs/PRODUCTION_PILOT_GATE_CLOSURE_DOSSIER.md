# MANU-AI Production Pilot Gate Closure Dossier

Date: 2026-06-02

## Status

This dossier prepares MANU-AI for external review. It does not approve production pilot launch.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, or real client health data is connected.

All production-pilot launch gates remain open until the user supplies external approval evidence.

Use `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md` to record sanitized references to approval artifacts. Do not paste secrets, raw client health data, or real client identifiers into repository documentation.

## Current Baseline

- Git baseline: Phase 27-29 checkpoint exists at `c75564e Add Phase 27-29 pilot readiness checkpoint` on branch `codex/phase-29-baseline-checkpoint`; Completion Roadmap Phase 1 records this as the current implementation baseline.
- Latest local release verification: `npm run release:verify` passed on 2026-06-02 after Phase 54 R-405/launch-gate recheck changes.
- Verification result: core tests 57/57, app tests 130/130, lint passed, production build passed.
- Dependency audit result: only known R-405 findings, `next:postcss` and `postcss:GHSA-qx2v-qp2m-jg93`.
- R-405 status: open production launch blocker; Phase 54 rechecked metadata on 2026-06-02 and stable `next@latest` is 16.2.7 but still bundles `postcss@8.4.31`, so no safe stable Next.js/PostCSS patch path is available.
- R-405 remediation spec: `PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- RLS evidence status: expanded `npm run test:rls` coverage exists, including Phase 47 `inbound_quarantines` checks, Phase 51 transactional RPC checks, and Phase 52 rate-limit/atomicity checks. On 2026-06-02, Docker Desktop/local Supabase was started, the Phase 50 migration was applied with `npx supabase db reset --local`, and `npm run test:rls` passed against local Supabase with 1 file and 19/19 tests. R-406 is mitigated in the local prototype.
- External approval intake: `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md` was added during Completion Roadmap Phase 4. No external approval artifacts have been supplied yet.
- Legal/privacy review packet: `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md` was added during Completion Roadmap Phase 5. It is a review packet, not an approval artifact.
- Clinical taxonomy review packet: `PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md` was added during Completion Roadmap Phase 6. It is a review packet, not an approval artifact.
- Provider/vendor review packet: `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md` was added during Completion Roadmap Phase 7. It is a review packet, not an approval artifact.
- Channel policy review packet: `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md` was added during Completion Roadmap Phase 8. It is a review packet, not an approval artifact.
- Incident/DSAR review packet: `PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md` was added during Completion Roadmap Phase 9. It is a review packet, not an approval artifact.
- Backup/restore review packet: `PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md` was added during Completion Roadmap Phase 10. It is a review packet, not an approval artifact.
- Secret rotation review packet: `PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md` was added during Completion Roadmap Phase 11. It is a review packet, not an approval artifact.
- Dependency audit clearance packet: `PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md` was added during Completion Roadmap Phase 12. It is a review packet, not a clearance or risk-acceptance artifact.
- Final readiness closure summary: `PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md` was added during Completion Roadmap Phase 13. It records the current production-pilot decision as `NO-GO`.
- Multilingual language support spec: `PHASE_43_MULTILINGUAL_LANGUAGE_SUPPORT_SPEC.md` was added after the completion roadmap. It is an implementation spec, not an external approval artifact.
- Red-risk reactivation lock spec: `PHASE_44_RED_RISK_REACTIVATION_LOCK_SPEC.md` was added after Phase 43. It is an implementation spec, not an external approval artifact. It does not approve production pilot launch.
- Client removal data lifecycle spec: `PHASE_45_CLIENT_REMOVAL_DATA_LIFECYCLE_SPEC.md` was added after Phase 44. It is an implementation spec, not an external approval artifact. Hard-delete timing and final retention still require legal/privacy approval.
- WhatsApp group quarantine spec: `PHASE_46_WHATSAPP_GROUP_QUARANTINE_SPEC.md` was added after Phase 45. It is an implementation spec, not an external approval artifact. It does not approve real WhatsApp/Telegram messaging or production pilot launch.
- RLS quarantine evidence spec: `PHASE_47_RLS_QUARANTINE_EVIDENCE_SPEC.md` was added after Phase 46. It expands RLS coverage but does not mitigate R-406 without a passing local Supabase run.
- R-405 stable patch recheck spec: `PHASE_48_R405_STABLE_PATCH_RECHECK_SPEC.md` was added after Phase 47. It records that no safe stable dependency patch path is available.
- Phase 50 production Supabase hardening evidence spec: `PHASE_50_PRODUCTION_SUPABASE_HARDENING_EVIDENCE_SPEC.md` records distributed rate-limit/RPC groundwork, narrowed Supabase reads, passing local release verification, local Supabase migration application, and passing local RLS evidence. It does not approve production pilot launch.
- Phase 51 transactional RPC coverage spec: `PHASE_51_TRANSACTIONAL_RPC_COVERAGE_SPEC.md` records transactional coverage for draft review, form response save, client context update, handoff status update, and red-risk reactivation. It does not approve production pilot launch or client removal/anonymization bulk redaction coverage.
- Phase 52 integration test coverage spec: `PHASE_52_INTEGRATION_TEST_COVERAGE_SPEC.md` records real local Supabase coverage for rate-limit isolation, controlled denial, stale revision rejection, and manual/inbound RPC atomicity. It does not approve production pilot launch.
- Phase 53 scale/broad read contracts spec: `PHASE_53_SCALE_BROAD_READ_CONTRACTS_SPEC.md` records intentional broad reads, future paginated reads, and already scoped mutation reads. It does not approve production pilot launch or implement pagination.
- Phase 54 R-405 and launch gates recheck spec: `PHASE_54_R405_AND_LAUNCH_GATES_RECHECK_SPEC.md` records the latest stable dependency metadata, production audit result, and open launch-gate status. It does not approve production pilot launch or resolve R-405.

## Gate Closure Matrix

| Launch gate | Required evidence | Internal evidence available | Missing external decision | Acceptable approval artifact | Status |
| --- | --- | --- | --- | --- | --- |
| Legal and privacy review | Legal basis matrix, privacy notice and client permission documents, medical-device or clinical-decision-support classification memo | `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`, `DATA_INVENTORY.md`, `PHASE_5_DATA_GOVERNANCE_SPEC.md`, `PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`, `PHASE_26_INTERNAL_COPILOT_SPEC.md`, `PHASE_27_DIETITIAN_CONTEXT_UPDATE_SPEC.md`, tenant/client-scoped export and anonymization tests | Legal/privacy counsel must approve lawful basis, privacy notice, permission flow, data retention, internal copilot records, dietitian context update records, and classification | Signed legal/privacy memo or dated counsel approval record | Open |
| Qualified dietitian clinical taxonomy approval | Qualified dietitian sign-off, current clinical golden test report, taxonomy change log | `PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`, `CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`, clinical JSONL golden cases including Phase 43 multilingual cases, Phase 44 red-risk reactivation lock, 52 core tests, persona-invariant tests | Qualified dietitian must approve current taxonomy version, red/yellow/green routing, multilingual routing, escalation behavior, and red-risk reactivation policy | Signed taxonomy review record naming taxonomy version and test result | Open |
| Provider vendor and retention review | Provider terms review, health-data retention configuration, prompt and completion logging decision | `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`, `AI_PROVIDER_REQUIREMENTS.md`, local mock provider, provider-attempt audit semantics, provider segment allowlist guard, provider failure no-send behavior, Phase 26 local/mock-only copilot boundary, Phase 27 context update egress boundary, Phase 28 remediation spec | Vendor/legal review must approve any Gemini or external LLM use with health data, including any future internal copilot or dietitian context update provider egress | Vendor-risk approval record covering retention, training use, logging, region, and access controls | Open |
| WhatsApp and Telegram policy review | WhatsApp healthcare feasibility review, Telegram privacy and bot policy review, opt-in/out/template/service-window procedure | `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`, `PHASE_7_CHANNEL_ADAPTER_READINESS_SPEC.md`, `PHASE_16_CHANNEL_POLICY_SIMULATION_HARDENING_SPEC.md`, `PHASE_46_WHATSAPP_GROUP_QUARANTINE_SPEC.md`, mock idempotency, identity quarantine, opt-out simulation, group-message quarantine | Platform/policy review must approve channel use, healthcare boundaries, templates, service window, opt-in/out process, and group-message handling | Dated channel policy memo and approved operating procedure | Open |
| Incident response and deletion workflow runbook | Incident response runbook, breach escalation owner list, client deletion and export operating procedure | `PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`, `INCIDENT_RESPONSE_RUNBOOK.md`, legal ops ledger, export/anonymization helpers, Phase 45 soft-delete/anonymization lifecycle, safe operational health snapshot | Operational owners must be named and DSAR/deletion procedure, hard-delete timing, and legal hold behavior must be approved | Signed incident and DSAR operating procedure with owner list | Open |
| Backup expiry and restore test | Backup expiry policy, restore drill result, restore owner and cadence | `PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`, `BACKUP_RESTORE_RUNBOOK.md` | Backup provider, region, retention, encryption ownership, and restore drill must be approved and tested | Restore drill evidence with owner, timestamp, environment, and test results | Open |
| Production secret rotation plan | Secret inventory, rotation cadence, emergency revocation procedure | `PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`, `SECRET_ROTATION_RUNBOOK.md` | Production secret manager, owner, cadence, and emergency revocation flow must be approved | Secret inventory and rotation plan signed by operational owner | Open |
| Production dependency audit clearance | Production dependency audit report, R-405 resolution or formal acceptance | `PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md`, `PHASE_19_RELEASE_VERIFICATION_DEPENDENCY_GATE_SPEC.md`, `PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`, `PHASE_29_PILOT_GATE_CLOSURE_EVIDENCE_HARDENING_SPEC.md`, `PHASE_32_COMPLETION_PHASE_3_R405_RECHECK_SPEC.md`, `PHASE_48_R405_STABLE_PATCH_RECHECK_SPEC.md`, `PHASE_54_R405_AND_LAUNCH_GATES_RECHECK_SPEC.md`, `npm run release:verify`, `RISK_REGISTER.md` | R-405 must be resolved through a safe stable patch path or formally accepted before pilot | Clean production audit report, safe stable upgrade evidence, or formal risk acceptance | Open |

## Review Packet Checklist

- Legal/privacy packet: `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`, data inventory, permission integration points, DSAR/export/anonymization evidence, retention placeholder list, dietitian context update records.
- Clinical packet: `PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`, taxonomy version, golden JSONL cases, latest core test output, persona invariant statement, qualified dietitian sign-off template.
- Provider packet: `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`, provider requirements, no-storage/no-training requirements, prompt/completion logging decision checklist, provider-attempt audit semantics, provider input allowlist, internal copilot egress review, dietitian context update egress review.
- Internal copilot packet: Phase 26 spec, `DATA_INVENTORY.md` copilot rows, RBAC/source-ref evidence, no-raw-SQL/no-mutation statement, provider-egress blocked statement.
- Channel packet: `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`, WhatsApp feasibility checklist, Telegram bot/privacy checklist, opt-in/out and service-window procedure, identity quarantine and idempotency evidence.
- Operations packet: `PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`, `PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`, `PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`, incident owner placeholder, DSAR/deletion procedure placeholder, backup/restore drill placeholder, secret inventory and rotation owner placeholder.
- Dependency packet: `PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md`, latest `npm run release:verify` output, R-405 risk record, stable Next.js/PostCSS tracking note.
- RLS evidence packet: latest `npm run test:rls` output from local Supabase showing 1 file and 19/19 tests passed after applying the Phase 50 migration and Phase 51/52 coverage.
- Approval intake packet: sanitized external approval artifact references tracked in `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`.

## Non-Approvals

- This dossier and final readiness closure summary record a current `NO-GO` production-pilot decision.
- This dossier does not approve production pilot launch.
- This dossier does not approve real client health-data processing.
- This dossier does not approve real WhatsApp or Telegram messaging.
- This dossier does not approve real Gemini or external LLM calls.
- This dossier does not approve routing the internal copilot to a real Gemini or external LLM provider.
- This dossier does not approve sending dietitian context updates to a real Gemini or external LLM provider.
- This dossier does not approve external email, push, monitoring, analytics, or secret manager vendors.
- This dossier does not resolve or accept R-405.
- This dossier records R-406 mitigation in the local prototype, but it does not approve production pilot launch or complete client removal/anonymization bulk redaction RPC coverage.

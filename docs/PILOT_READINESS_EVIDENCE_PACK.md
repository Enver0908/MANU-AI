# MANU-AI Pilot Readiness Evidence Pack

Date: 2026-05-31

## Status

MANU-AI has a local pilot-foundation prototype with safety, privacy, operational, and verification controls in place.

Production pilot is still blocked. This evidence pack does not approve legal/privacy, clinical, provider/vendor, WhatsApp/Telegram policy, backup/restore, secret rotation, or dependency audit gates.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, or real client health data is connected.

## Latest Verification

Run from `app`:

```text
npm run release:verify
```

Latest result, re-verified on 2026-05-31 after Phase 32 R-405 recheck documentation:

- Core package tests: 49/49 passed.
- App tests: 103/103 passed.
- App lint: passed.
- Production build: passed.
- Production dependency audit gate: passed with only documented R-405 findings.
- R-405 remains open: Next.js 16.2.6 nested PostCSS advisory, no safe stable patch path applied.

Additional Phase 24-26 local implementation on 2026-05-30:

- Dietitian voice sample intake/profile generation infrastructure was added.
- Dynamic client form schema/response infrastructure was added.
- Internal read-only dietitian copilot infrastructure was added with source refs, RBAC, curated tenant-scoped tools, and no mutation/raw-SQL path.

Additional Phase 28 remediation on 2026-05-31:

- Provider audit semantics now distinguish actual provider attempts from no-call safety/control paths.
- PromptContext carries source metadata and marks the newest dietitian-authored source as authoritative across manual messages and Critical Context updates.
- Draft approve/edit-send paths revalidate context, channel, takeover, AI mode/status, latest promptable message, and memory state before client-facing send.
- Provider input is guarded by a segment allowlist and fail-closed checks for red risk, unknown/overlong segments, extra keys, raw prompts, capsules, and raw message/profile objects.
- Supabase RLS policies now use role/scope helper functions and RLS tests cover assistant/viewer/care-team/auditor/internal-copilot behavior when local Supabase is configured.

Current npm metadata checked during Completion Roadmap Phase 3 on 2026-05-31 still shows `next@latest` as `16.2.6` with `postcss@8.4.31`, and `eslint-config-next@latest` as `16.2.6`, so there is no safe stable Next.js/PostCSS upgrade path available in this workspace.

R-405 remediation planning is captured in `PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`. The only accepted technical path is a stable Next.js release that bundles `postcss >= 8.5.10`, followed by a clean production audit and `npm run release:verify`.

Separate optional evidence commands:

- `npm run test:rls` when local Supabase is available.
- `npm run test:visual` when browser visual smoke evidence is needed.

Latest `npm run test:rls` in this workspace skipped 10 tests during Completion Roadmap Phase 2 on 2026-05-31. Local Supabase could not start because Docker Desktop's Linux engine pipe was unavailable, so the expanded RLS suite is present but local-database execution remains blocked environment evidence until rerun against local Supabase.

Phase 29 evidence hardening on 2026-05-31:

- Added `PHASE_29_PILOT_GATE_CLOSURE_EVIDENCE_HARDENING_SPEC.md`.
- Updated gate closure materials to treat Phase 27-28 as the current baseline.
- Recorded that RLS skip status is an evidence gap, not a production approval.
- Rechecked R-405 metadata and confirmed stable Next.js still has no patched PostCSS path.
- Re-ran `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

Completion Roadmap Phase 2 / Phase 31 RLS evidence attempt on 2026-05-31:

- Added `PHASE_31_COMPLETION_PHASE_2_RLS_EVIDENCE_SPEC.md`.
- Confirmed the RLS guard remains fail-closed for non-local Supabase URLs unless explicitly overridden.
- Attempted to start local Supabase; Docker Desktop's Linux engine pipe was unavailable.
- Ran `npm run test:rls`; the suite skipped 1 file and 10 tests.
- No passing RLS evidence was produced, and R-406 remains blocked pending local Docker/Supabase availability.
- Re-ran `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

Completion Roadmap Phase 3 / Phase 32 R-405 stable patch recheck on 2026-05-31:

- Added `PHASE_32_COMPLETION_PHASE_3_R405_RECHECK_SPEC.md`.
- Rechecked `next@latest`: `16.2.6` with nested `postcss@8.4.31`.
- Rechecked `eslint-config-next@latest`: `16.2.6`.
- Rechecked production audit: only known moderate R-405 `next`/`postcss` findings remain.
- No dependency files were changed because stable Next still does not bundle `postcss >= 8.5.10`.
- R-405 remains an open production launch blocker.
- Re-ran `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

Completion Roadmap Phase 4 / Phase 33 external approval intake on 2026-05-31:

- Added `PHASE_33_COMPLETION_PHASE_4_EXTERNAL_APPROVAL_INTAKE_SPEC.md`.
- Added `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`.
- Created an intake matrix for all eight canonical production-pilot launch gate ids.
- No external approval artifacts were supplied.
- All production-pilot launch gates remain open.
- R-405 remains open and R-406 remains blocked.
- Re-ran `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

Completion Roadmap Phase 5 / Phase 34 legal and privacy review packet on 2026-05-31:

- Added `PHASE_34_COMPLETION_PHASE_5_LEGAL_PRIVACY_PACKET_SPEC.md`.
- Added `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`.
- Mapped legal/privacy review questions to internal evidence across data inventory, data governance, legal ops, internal copilot, dietitian context updates, and AI security remediation.
- No legal/privacy approval artifact was supplied.
- The `legal_privacy_review` launch gate remains open.
- R-405 remains open and R-406 remains blocked.
- Re-ran `npm run release:verify` after clearing a transient Windows/OneDrive `.next` EPERM build artifact: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

Completion Roadmap Phase 6 / Phase 35 clinical taxonomy review packet on 2026-05-31:

- Added `PHASE_35_COMPLETION_PHASE_6_CLINICAL_TAXONOMY_PACKET_SPEC.md`.
- Added `PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`.
- Summarized 16 current JSONL golden cases and expected green/yellow/red behavior.
- No qualified dietitian approval artifact was supplied.
- The `clinical_taxonomy_approval` launch gate remains open.
- R-405 remains open and R-406 remains blocked.
- Re-ran `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

Completion Roadmap Phase 7 / Phase 36 provider vendor review packet on 2026-05-31:

- Added `PHASE_36_COMPLETION_PHASE_7_PROVIDER_VENDOR_REVIEW_PACKET_SPEC.md`.
- Added `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`.
- Mapped local/mock provider controls to required vendor, retention, logging, training-use, region, access-control, incident-obligation, internal copilot egress, and dietitian context update egress decisions.
- No provider/vendor approval artifact was supplied.
- The `provider_vendor_review` launch gate remains open.
- R-405 remains open and R-406 remains blocked.
- No real provider, credential, logging vendor, channel, launch-gate approval, or real-data change was made.
- Re-ran `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

Completion Roadmap Phase 8 / Phase 37 channel policy review packet on 2026-05-31:

- Added `PHASE_37_COMPLETION_PHASE_8_CHANNEL_POLICY_REVIEW_PACKET_SPEC.md`.
- Added `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`.
- Mapped local/mock channel controls to required WhatsApp healthcare-use, Telegram bot/privacy, opt-in/out, template, service-window, webhook, delivery-status, account-quality, and fallback decisions.
- No channel policy approval artifact was supplied.
- The `channel_policy_review` launch gate remains open.
- R-405 remains open and R-406 remains blocked.
- No real WhatsApp, Telegram, webhook, credential, template registry, channel approval, or real-data change was made.
- Re-ran `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

## Launch Gate Matrix

| Launch gate | Internal evidence available | Remaining blocker | Gate status |
| --- | --- | --- | --- |
| Legal and privacy review | `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`, `DATA_INVENTORY.md`, `PHASE_5_DATA_GOVERNANCE_SPEC.md`, `PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`, tenant/client-scoped export/anonymization tests, Phase 26 internal copilot data boundaries, Phase 27 dietitian context update records | Legal basis matrix, privacy notice, permission documents, medical-device/CDS classification memo, internal copilot and dietitian context update retention require external review | Open |
| Qualified dietitian clinical taxonomy approval | `PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`, `CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`, clinical JSONL golden cases, 49 core tests, persona-invariant safety tests | Qualified dietitian sign-off and taxonomy change approval | Open |
| Provider vendor and retention review | `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`, `AI_PROVIDER_REQUIREMENTS.md`, local mock provider, provider-attempt audit semantics, provider failure no-send behavior, provider segment allowlist guard, Phase 26 local/mock-only copilot boundary, Phase 27 context update egress boundary | Gemini/provider terms, health-data retention configuration, prompt/completion logging decision, any future copilot or dietitian context update provider egress decision | Open |
| WhatsApp and Telegram policy review | `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`, `PHASE_7_CHANNEL_ADAPTER_READINESS_SPEC.md`, `PHASE_16_CHANNEL_POLICY_SIMULATION_HARDENING_SPEC.md`, mock adapter idempotency, identity quarantine, opt-out simulation | WhatsApp healthcare feasibility, Telegram bot/privacy policy, real opt-in/out/template/service-window procedure | Open |
| Incident response and deletion workflow runbook | `INCIDENT_RESPONSE_RUNBOOK.md`, `PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`, legal ops ledger, safe operational health snapshot | Breach escalation owner list, approved DSAR/deletion operating procedure | Open |
| Backup expiry and restore test | `BACKUP_RESTORE_RUNBOOK.md` | Backup expiry policy, restore drill result, owner and cadence | Open |
| Production secret rotation plan | `SECRET_ROTATION_RUNBOOK.md` | Production secret inventory, rotation owner/cadence, secret manager decision | Open |
| Production dependency audit clearance | `PHASE_19_RELEASE_VERIFICATION_DEPENDENCY_GATE_SPEC.md`, `npm run release:verify`, R-405 tracked in `RISK_REGISTER.md` | R-405 safe stable Next.js/PostCSS patch path or formal risk acceptance | Open |

## Technical Evidence Summary

Safety and clinical control:

- Red-risk flows do not call the provider and create handoff cases.
- No-call safety/control paths record `providerAttempted=false`, `model=null`, `providerId=null`, and `providerStatus=not_called`.
- Yellow-risk flows become approval drafts.
- Persona changes do not alter safety decisions.
- Provider policy guard rejects red-risk provider calls as defense in depth.
- Expanded clinical golden cases cover typo/diacritic handling, English emergencies, medication dose requests, minor/body-image language, eating-disorder euphemisms, and pregnancy complications.

Privacy and data minimization:

- Tenant/client-scoped export and anonymization exist.
- Anonymization removes promptable client context and rolling memory.
- Operational health and notification SLA snapshots expose aggregate counts only.
- Provider input now uses bounded allowlisted `PromptContext` segments plus `risk`; full prompt, capsule, raw profile objects, raw conversation history, unknown segment types, and overlong segments remain outside the mock provider boundary.
- Channel and provider metadata helpers avoid raw prompt/message/profile leakage.
- Missing historical context output is blocked with `severity="block"`, `send_status="send_blocked"`, and human takeover instead of a client-facing AI message or draft.
- Dynamic client forms contribute only fields marked `prompt_allowed` to PromptContext; hidden/private form fields remain outside provider context.
- The Phase 26 internal copilot is read-only and local/mock only. It uses curated tenant-scoped tools over already-visible app state, records source refs for answers, blocks assistant/auditor chat access, and has no raw SQL or mutation tool path.
- Phase 27 dietitian context updates let the dietitian add non-chat client context, increment context revision, invalidate pending drafts, and enter bounded PromptContext without rewriting old WhatsApp messages.
- Phase 28 PromptContext source metadata keeps ContextManifest raw-text-free while making source id, origin, timestamp, authority, token, and truncation decisions auditable.
- Internal copilot messages and tool calls are included in the data inventory as internal audit/support records, not external-provider payloads.

Access and tenant isolation:

- Supabase-backed routes enforce fail-closed role capabilities.
- Owner/admin are tenant-wide.
- Dietitian access is owned plus assigned clients.
- Assistant access is assigned clients only.
- Auditor app-state currently receives no raw client/message state.
- Internal copilot history is scoped to the current dietitian for owner/admin/dietitian roles and hidden from assistant/auditor app state.
- Supabase RLS now mirrors these decisions for raw client/message/AI/handoff/risk/copilot tables and tenant-aware channel/idempotency uniqueness.

Messaging and channel readiness:

- Mock WhatsApp/Telegram adapters use normalized inbound contracts.
- Unknown and ambiguous channel identities are quarantined before AI processing.
- Duplicate provider events are idempotent.
- Empty payloads and missing provider event ids fail closed.
- Exact opt-out commands set matched client permission to `opted_out` without entering the AI path.

Operations:

- In-app safe-text notifications exist for red handoffs.
- Notification read/acknowledge paths exist and persist in Supabase-backed mode.
- SLA breach and internal escalation due counts are available as safe aggregate health signals.
- Incident response, backup/restore, and secret rotation runbook drafts exist.

Release verification:

- `npm run release:verify` is the current local release gate.
- The command includes core tests, app lint, app tests, build, and production dependency audit.
- Unknown production audit findings fail closed.
- High or critical production audit findings fail closed.

## Explicit Non-Approvals

- This package does not approve production pilot launch.
- This package does not approve processing real client health data.
- This package does not approve real WhatsApp or Telegram messaging.
- This package does not approve real Gemini or external LLM calls with health data.
- This package does not approve routing the internal copilot to a real Gemini or external LLM provider.
- This package does not approve external notification or monitoring vendors.
- This package does not resolve R-405.

## Next Approval Path

1. Use `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md` to record sanitized external approval artifact references.
2. Use `PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md` as the external review checklist.
3. Complete legal/privacy review using `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md` and supply acceptable approval evidence.
4. Obtain qualified dietitian approval using `PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md` for the current clinical taxonomy and golden test set.
5. Complete provider/vendor retention and prompt logging review using `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`.
6. Complete WhatsApp/Telegram policy, opt-in/out, template, and service-window review using `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`.
7. Finalize incident response, DSAR/deletion, backup/restore, and secret rotation ownership.
8. Resolve or formally accept R-405 before production pilot.
9. Re-run `npm run release:verify` after any approval-related code, dependency, prompt, or taxonomy change.

# MANU-AI Pilot Readiness Evidence Pack

Date: 2026-06-03

## Status

MANU-AI has a local pilot-foundation prototype with safety, privacy, operational, and verification controls in place.

Production pilot is still blocked. This evidence pack does not approve legal/privacy, clinical, provider/vendor, WhatsApp/Telegram policy, backup/restore, secret rotation, or dependency audit gates.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, or real client health data is connected.

## Latest Verification

Run from `app`:

```text
npm run release:verify
```

Latest result, re-verified on 2026-06-03 after Phase 55 audit remediation safety-boundary hardening:

- Core package tests: 72/72 passed.
- App tests: 132/132 passed.
- App lint: passed.
- Production build: passed.
- Production dependency audit gate: passed with only documented R-405 findings.
- R-405 remains open: Next.js 16.2.7 still bundles nested PostCSS 8.4.31, so no safe stable patch path is available.

Additional Phase 50 production Supabase hardening evidence on 2026-06-02:

- Added `PHASE_50_PRODUCTION_SUPABASE_HARDENING_EVIDENCE_SPEC.md`.
- Added Supabase rate-limit/RPC foundation migration `app/supabase/migrations/20260602030000_phase_50_production_hardening_foundation.sql`.
- Wired async scoped rate limiting with Supabase RPC support and local fallback behavior.
- Wired manual reply and client-scoped inbound simulation to commit RPC calls.
- Narrowed pre-mutation Supabase reads for manual reply, client-scoped inbound simulation, draft approval/dismissal, human takeover release, handoff status update, red-risk reactivation, form response save, and client context update.
- `npm run release:verify` passed from `app`: core tests 57/57, app tests 126/126, lint, production build, known R-405 only.
- Docker Desktop/local Supabase was started and `npx supabase db reset --local` applied all migrations through Phase 50.
- Direct DB checks confirmed `rate_limit_buckets`, `consume_rate_limit`, and `commit_inbound_simulation` exist locally.
- Direct DB checks confirmed `messages_generated_by_ai_decision_fk` is deferrable and initially deferred for same-transaction message/AI-decision payloads.
- Phase 51 added `PHASE_51_TRANSACTIONAL_RPC_COVERAGE_SPEC.md`, extended transactional RPC payload coverage for draft review, form response save, client context update, handoff status update, and red-risk reactivation, and left client removal/anonymization bulk redaction for a dedicated future contract.
- Phase 52 added `PHASE_52_INTEGRATION_TEST_COVERAGE_SPEC.md` and expanded real local Supabase coverage for rate-limit isolation, controlled `429 rate_limit_exceeded`, stale revision rejection, and manual/inbound RPC atomicity.
- `npm run test:rls` passed against local Supabase after Phase 52 coverage: 1 file, 19/19 tests.
- Phase 53 added `PHASE_53_SCALE_BROAD_READ_CONTRACTS_SPEC.md` and a test-covered Supabase read contract catalog for intentional broad reads, future paginated reads, and already scoped mutation reads.
- Phase 54 added `PHASE_54_R405_AND_LAUNCH_GATES_RECHECK_SPEC.md`, rechecked R-405 through the Phase 22 procedure, confirmed no safe stable Next.js/PostCSS patch path exists, and confirmed no external launch-gate approval artifacts were supplied.
- Phase 55 added `PHASE_55_AUDIT_REMEDIATION_SAFETY_BOUNDARY_SPEC.md`, hardened real Turkish Unicode classifier coverage, multilingual pregnancy/lactation yellow routing, prompt-injection yellow routing, client-authored PromptContext data boundaries, safety-critical pinned-note no-truncation, and red-risk preflight regression coverage.
- R-406 is mitigated in the local prototype.

Additional Phase 47/48 release verification on 2026-06-01:

- `npm run release:verify` passed from `app`: core tests 52/52, app tests 117/117, lint, production build, known R-405 only.
- Installed app dependency remains `next@16.2.6`; `next@latest` recheck is metadata evidence only and did not change dependency files.

Additional Phase 48 R-405 recheck on 2026-06-01:

- `next@latest` is now `16.2.7`.
- Stable Next.js still bundles nested `postcss@8.4.31`.
- `eslint-config-next@latest` is `16.2.7`.
- `npm audit --omit=dev --json` still reports only the known moderate `next` / `postcss` findings.
- No dependency files were changed.
- R-405 remains open.

Additional Phase 47 RLS quarantine evidence coverage on 2026-06-01:

- Added explicit `inbound_quarantines` coverage to the expanded Supabase RLS integration suite.
- Added role visibility, cross-tenant write blocking, and Supabase-backed group quarantine persistence checks.
- `npm run lint` passed from `app`.
- `npm run test` passed from `app`: 16 files, 117 tests.
- `npm run test:rls` skipped 1 file and 11 guarded tests because Docker Desktop's Linux engine is unavailable.
- No passing local RLS evidence was produced; R-406 remains blocked.

Additional Phase 44 local verification on 2026-06-01:

- Added red-risk reactivation lock behavior for local fallback and Supabase-backed state.
- Red-risk handoffs now force AI passive/manual and require explicit dietitian resolve-and-reactivate before AI can resume.
- Manual replies and notification acknowledgement do not clear the lock; normal handoff resolution, direct AI control edits, takeover release, and red-locked dismissal are rejected while locked.
- `npm run lint` passed from `app`.
- `npm run test` passed from `app`: 16 files, 112 tests.
- `npm run release:verify` passed from `app`: core tests 52/52, app tests 112/112, lint, production build, known R-405 only.

Additional Phase 45 local verification on 2026-06-01:

- Added soft-delete/anonymization lifecycle for client removal.
- Removed clients are hidden from normal dashboard client lists and blocked from inbound/manual/form/internal-copilot operations.
- Promptable health data, channel identifiers, rolling memory, message bodies, form answers, submitted phone metadata, context updates, handoff text, notification text, and AI/risk details are redacted or minimized.
- Export remains available as a minimized legal/audit bundle.
- `npm run lint` passed from `app`.
- `npm run test` passed from `app`: 16 files, 114 tests.
- `npm run release:verify` passed from `app`: core tests 52/52, app tests 114/114, lint, production build, known R-405 only.

Additional Phase 46 local verification on 2026-06-01:

- Added unsupported inbound quarantine for WhatsApp group messages.
- Group messages are blocked before client lookup, risk classification, context assembly, provider calls, message storage, AI decisions, risk assessments, or handoffs.
- Quarantine records store minimized provenance metadata only and do not store raw group text.
- Duplicate group events remain idempotent.
- `npm run lint` passed from `app`.
- `npm run test` passed from `app`: 16 files, 117 tests.
- `npm run release:verify` passed from `app`: core tests 52/52, app tests 117/117, lint, production build, known R-405 only.

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

Latest `npm run test:rls` in this workspace passed against local Supabase on 2026-06-02 after Phase 52 integration test coverage. The expanded RLS suite ran 1 file and 19/19 tests, after Docker Desktop/local Supabase was started and migrations were reset through `20260602030000_phase_50_production_hardening_foundation.sql`.

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

Completion Roadmap Phase 9 / Phase 38 incident and DSAR review packet on 2026-05-31:

- Added `PHASE_38_COMPLETION_PHASE_9_INCIDENT_DSAR_REVIEW_PACKET_SPEC.md`.
- Added `PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`.
- Mapped draft incident response, DSAR/export/anonymization, legal ops ledger, and safe operational health evidence to required owner, escalation, breach, notification, DSAR/deletion, and re-enable decisions.
- No incident/DSAR approval artifact was supplied.
- The `incident_response_runbook` launch gate remains open.
- R-405 remains open and R-406 remains blocked.
- No real monitoring, notification, ticketing, owner assignment, incident approval, DSAR approval, or real-data change was made.
- Re-ran `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

Completion Roadmap Phase 10 / Phase 39 backup restore review packet on 2026-05-31:

- Added `PHASE_39_COMPLETION_PHASE_10_BACKUP_RESTORE_REVIEW_PACKET_SPEC.md`.
- Added `PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`.
- Mapped draft backup/restore evidence to required provider, region, retention, restore-drill, encryption, legal-hold, tenant-isolation, RLS, data-governance, and drill evidence decisions.
- No backup/restore approval artifact or restore-drill evidence was supplied.
- The `backup_restore_test` launch gate remains open.
- R-405 remains open and R-406 remains blocked.
- No backup provider, storage, secret manager, infrastructure, restore drill, backup approval, or real-data change was made.
- Re-ran `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

Completion Roadmap Phase 11 / Phase 40 secret rotation review packet on 2026-05-31:

- Added `PHASE_40_COMPLETION_PHASE_11_SECRET_ROTATION_REVIEW_PACKET_SPEC.md`.
- Added `PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`.
- Mapped draft secret rotation evidence to required secret manager, inventory, owner, cadence, emergency revocation, break-glass, access-review, health-check, smoke-test, and evidence decisions.
- No secret-rotation approval artifact, production secret manager, or rotation evidence was supplied.
- The `secret_rotation_plan` launch gate remains open.
- R-405 remains open and R-406 remains blocked.
- No secret manager, credential, provider, channel, infrastructure, secret-rotation approval, or real-data change was made.
- Re-ran `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

Completion Roadmap Phase 12 / Phase 41 dependency audit clearance packet on 2026-05-31:

- Added `PHASE_41_COMPLETION_PHASE_12_DEPENDENCY_AUDIT_CLEARANCE_PACKET_SPEC.md`.
- Added `PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md`.
- Rechecked `next@latest`: `16.2.6` with nested `postcss@8.4.31`.
- Rechecked `eslint-config-next@latest`: `16.2.6`.
- Rechecked production audit: only known moderate R-405 `next`/`postcss` findings remain.
- No dependency files were changed because stable Next still does not bundle `postcss >= 8.5.10`.
- No formal R-405 risk acceptance was supplied.
- The `dependency_audit_clearance` launch gate remains open.
- R-405 remains open and R-406 remains blocked.
- Re-ran `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

Completion Roadmap Phase 13 / Phase 42 final readiness closure on 2026-05-31:

- Added `PHASE_42_COMPLETION_PHASE_13_FINAL_READINESS_CLOSURE_SPEC.md`.
- Added `PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`.
- Recorded the current production-pilot decision as `NO-GO`.
- Confirmed all eight launch gates remain open.
- Confirmed R-405 remains open and R-406 remains blocked.
- Confirmed no external approval artifacts were supplied during the completion roadmap.
- No runtime, schema, dependency, provider, channel, monitoring, secret manager, backup provider, launch-gate approval, R-405 acceptance, R-406 mitigation, or real-data change was made.
- Re-ran `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and dependency audit gate passed with only documented R-405 findings.

Phase 43 multilingual language support on 2026-05-31:

- Added `PHASE_43_MULTILINGUAL_LANGUAGE_SUPPORT_SPEC.md`.
- Added deterministic support for Turkish, English, German, French, Spanish, Portuguese, and Czech.
- Stored dietitian dashboard language, client communication language, canonical client phone identity, form schema language, form response language, and submitted phone metadata.
- Added bounded `conversation_language` PromptContext support and localized local/mock provider plus safe handoff acknowledgement behavior.
- Expanded multilingual clinical golden cases and dashboard i18n coverage.
- No automatic translation, public client forms, real provider, real channel, external translation service, launch-gate approval, R-405 acceptance, R-406 mitigation, or real health-data processing was added.
- Re-ran `npm run release:verify`: core tests 52/52, app tests 107/107, lint, production build, and dependency audit gate passed with only documented R-405 findings.

## Launch Gate Matrix

| Launch gate | Internal evidence available | Remaining blocker | Gate status |
| --- | --- | --- | --- |
| Legal and privacy review | `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`, `DATA_INVENTORY.md`, `PHASE_5_DATA_GOVERNANCE_SPEC.md`, `PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`, tenant/client-scoped export/anonymization tests, Phase 26 internal copilot data boundaries, Phase 27 dietitian context update records | Legal basis matrix, privacy notice, permission documents, medical-device/CDS classification memo, internal copilot and dietitian context update retention require external review | Open |
| Qualified dietitian clinical taxonomy approval | `PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`, `CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`, clinical JSONL golden cases including multilingual Phase 43 cases, Phase 56 second-layer local evidence, 75 core tests, persona-invariant safety tests | Qualified dietitian sign-off, taxonomy change approval, and approval of the production second-layer or equivalent fail-closed safety evaluation approach | Open |
| Provider vendor and retention review | `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`, `AI_PROVIDER_REQUIREMENTS.md`, local mock provider, provider-attempt audit semantics, provider failure no-send behavior, provider segment allowlist guard, Phase 26 local/mock-only copilot boundary, Phase 27 context update egress boundary | Gemini/provider terms, health-data retention configuration, prompt/completion logging decision, any future copilot or dietitian context update provider egress decision | Open |
| WhatsApp and Telegram policy review | `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`, `PHASE_7_CHANNEL_ADAPTER_READINESS_SPEC.md`, `PHASE_16_CHANNEL_POLICY_SIMULATION_HARDENING_SPEC.md`, mock adapter idempotency, identity quarantine, opt-out simulation | WhatsApp healthcare feasibility, Telegram bot/privacy policy, real opt-in/out/template/service-window procedure | Open |
| Incident response and deletion workflow runbook | `PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`, `INCIDENT_RESPONSE_RUNBOOK.md`, `PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`, legal ops ledger, safe operational health snapshot | Breach escalation owner list, approved DSAR/deletion operating procedure | Open |
| Backup expiry and restore test | `PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`, `BACKUP_RESTORE_RUNBOOK.md` | Backup expiry policy, restore drill result, owner and cadence | Open |
| Production secret rotation plan | `PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`, `SECRET_ROTATION_RUNBOOK.md` | Production secret inventory, rotation owner/cadence, secret manager decision | Open |
| Production dependency audit clearance | `PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md`, `PHASE_19_RELEASE_VERIFICATION_DEPENDENCY_GATE_SPEC.md`, `npm run release:verify`, R-405 tracked in `RISK_REGISTER.md` | R-405 safe stable Next.js/PostCSS patch path or formal risk acceptance | Open |

## Technical Evidence Summary

Safety and clinical control:

- Red-risk flows do not call the provider and create handoff cases.
- No-call safety/control paths record `providerAttempted=false`, `model=null`, `providerId=null`, and `providerStatus=not_called`.
- Yellow-risk flows become approval drafts.
- Phase 56 adds deterministic local second-layer evidence above the regex classifier for context-sensitive uncertainty; otherwise-green allergy/restriction mentions, ambiguous clinical references, missing-history references, minor weight/restriction context, and eating-disorder-sensitive ambiguous restriction language escalate to yellow review.
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

- This evidence pack and final readiness closure summary record a current `NO-GO` production-pilot decision.
- This package does not approve production pilot launch.
- This package does not approve processing real client health data.
- This package does not approve real WhatsApp or Telegram messaging.
- This package does not approve real Gemini or external LLM calls with health data.
- This package does not approve routing the internal copilot to a real Gemini or external LLM provider.
- This package does not approve external notification or monitoring vendors.
- This package does not resolve R-405.
- This package records R-406 mitigation in the local prototype and Phase 50 SQL/RPC local Supabase execution evidence, but it does not approve production pilot launch.

## Next Approval Path

1. Use `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md` to record sanitized external approval artifact references.
2. Use `PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md` as the external review checklist.
3. Complete legal/privacy review using `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md` and supply acceptable approval evidence.
4. Obtain qualified dietitian approval using `PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md` for the current clinical taxonomy, golden test set, and second-layer or equivalent fail-closed safety evaluation approach.
5. Complete provider/vendor retention and prompt logging review using `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`.
6. Complete WhatsApp/Telegram policy, opt-in/out, template, and service-window review using `PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`.
7. Finalize incident response and DSAR/deletion using `PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`, finalize backup/restore using `PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`, then finalize secret rotation using `PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`.
8. Resolve or formally accept R-405 using `PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md` before production pilot.
9. Design the dedicated client removal/anonymization transactional redaction contract before moving that lifecycle fully to RPC commits.
10. Re-run `npm run release:verify` after any approval-related code, dependency, prompt, or taxonomy change.

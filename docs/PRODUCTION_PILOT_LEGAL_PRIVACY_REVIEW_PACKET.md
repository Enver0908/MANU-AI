# MANU-AI Production Pilot Legal And Privacy Review Packet

Date: 2026-05-31

## Status

This packet prepares the `legal_privacy_review` launch gate for external legal/privacy review.

It does not provide legal advice, approve production pilot launch, approve real client health-data processing, or finalize client-facing legal copy.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, or real client health data is connected.

## Review Objective

Legal/privacy counsel must decide whether MANU-AI has an acceptable basis and operating model for a supervised production pilot involving dietitians and client health-related messages.

The review must cover:

- Lawful basis for processing.
- Privacy notice and client permission flow.
- Medical-device or clinical-decision-support classification.
- Data minimization and prompt/provider boundaries.
- User-supplied dietitian/client form definitions, including field-level privacy classification and prompt allowlist.
- Official health-regulation PDF corpus handling, including source retention, derived rule traceability, and approval record storage.
- Retention and deletion/anonymization expectations.
- DSAR/export workflow ownership.
- Internal copilot records.
- Dietitian-entered context update records.
- Real messaging channel policy dependencies.
- Provider/vendor retention dependencies.

## Internal Evidence Available

| Evidence area | Internal artifact | What it supports | What it does not approve |
| --- | --- | --- | --- |
| Data inventory | `DATA_INVENTORY.md` | Data categories, prompt allowlist, non-promptable fields, governance notes | Lawful basis, final retention, privacy notice |
| Data governance skeleton | `PHASE_5_DATA_GOVERNANCE_SPEC.md` | Tenant/client export, anonymization, memory invalidation, retention placeholders | Production DSAR procedure or deletion SLA |
| Legal ops ledger | `PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md` | Export/anonymization event recording and data request history | Final legal operating procedure |
| Internal copilot boundary | `PHASE_26_INTERNAL_COPILOT_SPEC.md` | Local/mock read-only copilot, RBAC, source refs, no mutation/raw SQL | Real provider copilot egress or retention approval |
| Dietitian context updates | `PHASE_27_DIETITIAN_CONTEXT_UPDATE_SPEC.md` | Off-channel dietitian-entered context records, draft invalidation, export/anonymization handling | Legal basis for collecting/storing these records |
| AI security remediation | `PHASE_28_AI_SECURITY_REMEDIATION_SPEC.md` | Provider-attempt semantics, provider input allowlist, send-time revalidation, RLS/RBAC hardening | Provider/vendor legal approval |
| Gate dossier | `PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md` | Required evidence and open gate status | External approval |
| External approval intake | `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md` | Sanitized approval artifact tracking | Gate closure without supplied artifacts |
| Phase 63 rebaseline | `PHASE_63_PRODUCTION_PILOT_GO_REBASELINE_SPEC.md` | User-supplied forms and official PDF corpus are gated production inputs | Legal/privacy approval of unsupplied artifacts |
| Phase 64 evidence engine | `PHASE_64_STRUCTURED_LAUNCH_GATE_EVIDENCE_ENGINE_SPEC.md`, `app/src/lib/launch-gates.ts` | Structured evidence coverage, review cadence, expiry, and sanitized reference checks before this gate can be treated as closed | Legal/privacy approval or supplied counsel artifact |
| Phase 65 official PDF corpus QA | `PHASE_65_OFFICIAL_REGULATION_PDF_CORPUS_QA_SPEC.md`, `app/src/lib/official-regulation-corpus.ts` | Official PDF corpus QA records checksums, page extraction evidence, page/section references, derived rules, and golden-case reports without storing raw PDF text in repo fixtures | Legal/privacy handling decision for official PDF storage, extraction, retention, and approval workflow |

## Required Counsel Decisions

| Decision | Required output | Current status |
| --- | --- | --- |
| Lawful basis | Written lawful-basis matrix covering tenants, dietitians, and clients | Not supplied |
| Privacy notice | Approved client-facing and dietitian-facing privacy notice scope | Not supplied |
| Permission flow | Approved opt-in, opt-out, consent/permission, and withdrawal process | Not supplied |
| Medical-device/CDS classification | Written classification memo for supervised assistant positioning | Not supplied |
| Retention | Approved retention schedule by data category/table, including backups and audit records | Not supplied |
| DSAR/export/deletion | Approved operating procedure, owner, response timeline, and evidence trail | Not supplied |
| Internal copilot records | Decision on retention, access, and provider-egress restrictions for internal copilot data | Not supplied |
| Dietitian context updates | Decision on collection purpose, retention, prompt use, and deletion/anonymization handling | Not supplied |
| User-supplied forms | Decision on dietitian/client form field collection, privacy classification, prompt allowlist, retention, export, deletion/anonymization, and version migration | Not supplied |
| Official regulation PDF corpus | Decision on storage/reference handling, derived rule traceability, approval record retention, and whether PDF-derived rules may drive production routing after clinical approval | Not supplied |
| Provider dependency | Confirmation that real LLM provider use remains blocked until vendor review closes | Not supplied |
| Channel dependency | Confirmation that real WhatsApp/Telegram use remains blocked until platform policy review closes | Not supplied |

## Current Technical Controls

- AI is supervised and controlled per client through active/passive state and AI mode.
- Red-risk messages do not call the provider and create handoff cases.
- Yellow-risk messages require review.
- Client permission states block AI unless channel permission is `ready`.
- Prompt context is bounded and allowlisted.
- Context manifests exclude raw message text.
- Provider no-call paths record `providerAttempted=false`.
- Provider input guard rejects raw prompts, capsules, raw message/profile objects, unknown segments, overlong segments, and red-risk calls.
- Export/anonymization helpers are tenant/client scoped.
- Anonymization removes promptable context and rolling memory.
- Internal copilot is local/mock only, read-only, source-referenced, and not client-facing.
- Dietitian context updates invalidate pending drafts and are included in export/anonymization governance.
- User-supplied forms remain unapproved for production until legal/privacy and clinical review define allowed fields, prompt eligibility, retention, export, deletion/anonymization, and version migration behavior.
- User-supplied official regulation PDFs remain unapproved for production routing until Phase 65 QA passes and legal/privacy handling plus clinical approval of derived corpus rules are recorded.

## Missing Before Gate Closure

- Signed or dated legal/privacy approval artifact.
- Approved privacy notice and permission documents.
- Medical-device/CDS classification memo.
- Final retention schedule.
- Production DSAR/deletion procedure and owner list.
- User-supplied dietitian/client form package and field-level privacy/prompt approval.
- Official regulation PDF corpus handling decision and sanitized approval references.
- Backup retention and restore policy alignment.
- Provider/vendor review linkage for any real LLM use.
- Channel policy review linkage for real WhatsApp/Telegram use.
- R-405 resolution or formal acceptance.
- R-406 passing local Supabase RLS evidence.

## Sanitization Rules

Do not paste these into this packet:

- Production secrets.
- Real phone numbers or Telegram IDs.
- Real client identifiers.
- Raw client health messages.
- Full provider payloads.
- Service role keys, API keys, or environment variables.

Use sanitized artifact references in `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md` instead.

## Non-Approval Statement

The `legal_privacy_review` launch gate remains open. This packet is ready for external review, but it is not an approval record.

# MANU-AI Risk Register

## Risk Scale

- Severity: `low`, `medium`, `high`, `critical`
- Status: `open`, `mitigated`, `accepted`, `blocked`

## Product and Legal Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-001 | Product is perceived as replacing a dietitian. | critical | Conservative product claims, supervised assistant positioning, human review. Phase 10 launch gates keep production pilot blocked until external approval gates are complete. | open |
| R-002 | System is classified as medical device or clinical decision support. | critical | Legal classification memo before production pilot. Phase 10 launch gates include legal/privacy review before pilot launch can be considered unblocked. | open |
| R-003 | Tailored medical/nutrition advice is generated without appropriate licensed-professional involvement. | critical | Copilot default, red/yellow handoff, professional involvement policy, audit trail. | open |
| R-004 | Client-facing legal/permission documentation is incomplete. | high | Documentation prepared separately; app must enforce permission state. Phase 10 launch gates keep legal/privacy review externally approved only. | open |
| R-005 | Workspace has no Git repository or explicit checkpoint strategy. | high | Local Git repository, root ignore rules, and a verified baseline checkpoint commit were added in Phase 9. | mitigated in local prototype |

## Privacy and Data Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-101 | Health data is processed without valid legal basis. | critical | Data inventory, legal basis matrix, privacy review before real data. | open |
| R-102 | Cross-client context leakage. | critical | Tenant/client capsule checks, service-layer RBAC, prompt allowlist, tests, and Phase 28 RLS helpers/policies for owner/admin, dietitian owned/care-team, viewer, assistant, auditor, and internal copilot scope. Tenant-aware channel/idempotency uniqueness is now covered. | mitigated in local prototype |
| R-103 | External AI provider retains health data unexpectedly. | critical | Phase 8 uses only a local mock provider and documents no-storage/no-retention requirements; Phase 28 restricts provider input to allowlisted PromptContext segments, records `providerAttempted`, and fail-closes red/unknown/overlong/raw payloads. Real provider use remains blocked until vendor/legal review. | partially mitigated in local prototype |
| R-104 | Logs contain raw messages, prompts, or health fields. | high | Provider/channel metadata helpers redact raw message, prompt, health profile, diet plan, allergy, memory, and clinical-note fields; Phase 15 adds a safe aggregate operational health snapshot and monitoring payload policy; Phase 17 rejects prompt/capsule/profile leakage at the mock-provider boundary. Production monitoring vendor review remains pending. | partially mitigated in local prototype |
| R-105 | Deletion request leaves stale client memory. | high | Phase 5 local/Supabase anonymization skeleton clears promptable client context and rolling memory; Phase 14 records anonymization requests in the legal ops ledger. Production deletion jobs and legal approval remain pending. | partially mitigated in local prototype |
| R-106 | Data export or deletion scope crosses tenant/client boundaries. | critical | Phase 5 tenant/client-scoped export and anonymization helpers are covered by tests; Phase 12 adds fail-closed role checks before export/anonymization; Phase 13 scopes Supabase-loaded app state by role and assignment; Phase 14 records export/anonymization requests in tenant/client-scoped `data_requests`. Production DSAR workflow remains pending. | partially mitigated in local prototype |
| R-107 | AI fabricates continuity when the client references conversation history outside the available prompt context. | high | Phase 23 adds a missing historical context invariant, bounded last-8-message PromptContext, raw-text-free ContextManifest, provider output guard for `[ERROR: missing_historical_context]`, `send_status="send_blocked"`, draft invalidation, and human takeover routing. Phase 28 adds send-time draft revalidation for context revision, latest promptable message, memory revision/staleness, channel permission, takeover lock, and AI mode/status. Real provider behavior still needs vendor/prompt validation before production. | partially mitigated in local prototype |
| R-108 | Dietitian voice samples include client-identifying or unauthorized text. | high | Phase 24 stores samples tenant/dietitian scoped, requires explicit sample submission/approval, and uses samples only for style profile generation. Production onboarding must still include legal/privacy instructions for sample preparation. | partially mitigated in local prototype |
| R-109 | Dynamic form changes corrupt old client responses or leak private form fields into prompts. | high | Phase 25 stores responses with schema snapshots and sends only `prompt_allowed` fields into `client_form_summary`; form response changes increment context revision and invalidate pending drafts. | partially mitigated in local prototype |
| R-110 | Internal copilot leaks hidden client data or misuses database tools. | critical | Phase 26 uses only curated read-only tools over already-scoped `ManuAppState`, blocks assistant/auditor chat access, avoids raw SQL and mutation tools, treats messages/forms as untrusted data, persists source refs/tool calls, and adds tests for ambiguous/hidden clients plus scoped state behavior. Real provider use remains blocked until a separate provider-egress allowlist and external review exist. | partially mitigated in local prototype |
| R-111 | AI relies on stale WhatsApp-only context after an off-channel dietitian/client conversation. | high | Phase 27 adds dietitian-entered context updates from phone, Zoom, in-person, or other sources. Phase 28 adds source metadata and marks the newest dietitian-authored source across manual messages and Critical Context updates as authoritative. Active updates increment client context revision, invalidate pending drafts, enter bounded PromptContext, and are redacted on anonymization. Real provider use still requires external review. | partially mitigated in local prototype |

## Messaging Platform Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-201 | WhatsApp healthcare messaging violates platform policy. | critical | WhatsApp healthcare-use feasibility memo before pilot. | open |
| R-202 | Missing WhatsApp opt-in or opt-out handling. | high | Channel permission state, opt-out state, audit trail, and mock channel opt-out tests exist; Phase 16 handles exact local opt-out commands before AI processing. Real STOP webhook handling remains pending. | partially mitigated in local prototype |
| R-203 | Duplicate webhook causes duplicate AI reply. | high | Idempotency table and outbound state machine. Local simulator and mock channel idempotency are covered, including duplicate provider events and duplicate policy-blocked events. | partially mitigated in local prototype |
| R-204 | Phone number reuse maps message to wrong client. | high | Phase 7 mock adapter tests quarantine ambiguous channel identities before orchestrator execution; Phase 13 limits production app-state visibility by owner/dietitian/assistant assignment. Real reconfirmation UX remains pending. | partially mitigated in local prototype |
| R-205 | Human takeover races with queued AI job. | high | Handoff/takeover lock and stale-context check before send. Local simulator blocks takeover-locked clients and audits release; Phase 12 limits takeover release to owner/admin/dietitian roles in Supabase-backed routes. | partially mitigated in local prototype |

## Clinical Safety Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-301 | AI answers emergency or severe symptom message. | critical | Red classifier, no generation for red, handoff notification. | mitigated in core prototype |
| R-302 | AI changes diet plan independently. | critical | Quality guard, plan-change escalation, prompt constraints. | mitigated in core prototype |
| R-303 | AI mishandles eating disorder or self-harm language. | critical | Phase 28 expands JSONL golden cases and classifier coverage for eating-disorder euphemisms plus self-harm red routing; qualified dietitian approval remains pending. | partially mitigated in core prototype |
| R-304 | AI promotes unhealthy dieting/body shaming for minors. | critical | Phase 28 expands minor/body-image rapid weight-loss coverage including typo/body-check language as review-required; guardian/legal policy remains pending. | partially mitigated in core prototype |
| R-305 | Persona weakens clinical boundaries. | high | Persona affects style only; safety rules are invariant. | mitigated in core prototype |

## Operational Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-401 | Urgent handoff notification is missed. | critical | SLA, fallback notification, persistent open urgent case. Local handoffs now queue safe-text in-app notifications, Phase 9 added Supabase notification persistence plus tenant-scoped read/acknowledge behavior, and Phase 18 adds aggregate SLA breach/internal escalation signals. Push/email adapters are still pending. | partially mitigated in local prototype |
| R-402 | Provider outage blocks messaging. | high | Visible provider failure state, retry, manual fallback. Phase 10 launch gates require incident response evidence before production pilot approval; Phase 11 added a draft incident response runbook; Phase 15 counts failed provider decisions in a safe health snapshot. | open |
| R-403 | Prompt/classifier change regresses safety. | high | JSONL golden tests assert risk/action/model/provider-call/providerAttempted behavior, persona invariants, PromptContext source metadata, provider-boundary fail-closed behavior, and expanded clinical cases. Phase 19 repeatable release verification remains the local gate. Production release rollback procedure remains pending. | partially mitigated in core prototype |
| R-404 | One tenant exhausts shared AI budget. | medium | Tenant spend caps and quotas. | open |
| R-405 | Dependency audit reports moderate vulnerabilities in Next.js transitive PostCSS. | medium | Do not run breaking `npm audit fix --force`. 2026-05-31 metadata check shows stable `next@latest` 16.2.6 still pins nested PostCSS 8.4.31, and `eslint-config-next@latest` is 16.2.6. Next.js canary has a patched PostCSS path but is not a safe pilot baseline; npm override remains rejected unless it keeps the npm tree valid. Phase 22 records the stable patch procedure: upgrade `next` and `eslint-config-next` together only after stable Next bundles `postcss >= 8.5.10`, then require clean production audit and `npm run release:verify`. | open |
| R-406 | Expanded RLS suite is not counted as latest local execution evidence when local Supabase is unavailable. | medium | Phase 28 added expanded RLS coverage for scoped assistant/viewer/care-team/auditor access, internal copilot scope, and tenant-aware uniqueness. Phase 29 records skipped `npm run test:rls` as an environment evidence gap; rerun against local Supabase before production pilot evidence can be considered complete. | open |

## Security Operations Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-501 | Backups cannot be restored or retain data longer than approved. | high | Phase 11 added a draft backup/restore runbook with restore drill evidence requirements; final provider, retention, and legal-hold decisions remain external gates. | open |
| R-502 | Production secrets are exposed or cannot be rotated quickly. | high | Phase 11 added a draft secret rotation runbook with emergency revocation steps; production secret manager and rotation ownership remain external gates. | open |

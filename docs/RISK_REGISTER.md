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
| R-102 | Cross-client context leakage. | critical | Tenant/client capsule checks, RLS, prompt allowlist, tests. Auxiliary RLS tables now covered for memories, risk assessments, activation events, notifications, and assignments; Phase 13 adds service-layer role/assignment scoping for Supabase-loaded app state. | mitigated in local prototype |
| R-103 | External AI provider retains health data unexpectedly. | critical | Phase 8 uses only a local mock provider and documents no-storage/no-retention requirements; Phase 17 adds an allowlisted mock-provider input boundary. Real provider use remains blocked until vendor/legal review. | partially mitigated in local prototype |
| R-104 | Logs contain raw messages, prompts, or health fields. | high | Provider/channel metadata helpers redact raw message, prompt, health profile, diet plan, allergy, memory, and clinical-note fields; Phase 15 adds a safe aggregate operational health snapshot and monitoring payload policy; Phase 17 rejects prompt/capsule/profile leakage at the mock-provider boundary. Production monitoring vendor review remains pending. | partially mitigated in local prototype |
| R-105 | Deletion request leaves stale client memory. | high | Phase 5 local/Supabase anonymization skeleton clears promptable client context and rolling memory; Phase 14 records anonymization requests in the legal ops ledger. Production deletion jobs and legal approval remain pending. | partially mitigated in local prototype |
| R-106 | Data export or deletion scope crosses tenant/client boundaries. | critical | Phase 5 tenant/client-scoped export and anonymization helpers are covered by tests; Phase 12 adds fail-closed role checks before export/anonymization; Phase 13 scopes Supabase-loaded app state by role and assignment; Phase 14 records export/anonymization requests in tenant/client-scoped `data_requests`. Production DSAR workflow remains pending. | partially mitigated in local prototype |

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
| R-303 | AI mishandles eating disorder or self-harm language. | critical | Phase 6 JSONL golden cases and classifier tests cover self-harm and eating-disorder crisis red routing; qualified dietitian approval remains pending. | partially mitigated in core prototype |
| R-304 | AI promotes unhealthy dieting/body shaming for minors. | critical | Phase 6 JSONL golden cases cover minor/body-image rapid weight-loss language as review-required; guardian/legal policy remains pending. | partially mitigated in core prototype |
| R-305 | Persona weakens clinical boundaries. | high | Persona affects style only; safety rules are invariant. | mitigated in core prototype |

## Operational Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-401 | Urgent handoff notification is missed. | critical | SLA, fallback notification, persistent open urgent case. Local handoffs now queue safe-text in-app notifications, Phase 9 added Supabase notification persistence plus tenant-scoped read/acknowledge behavior, and Phase 18 adds aggregate SLA breach/internal escalation signals. Push/email adapters are still pending. | partially mitigated in local prototype |
| R-402 | Provider outage blocks messaging. | high | Visible provider failure state, retry, manual fallback. Phase 10 launch gates require incident response evidence before production pilot approval; Phase 11 added a draft incident response runbook; Phase 15 counts failed provider decisions in a safe health snapshot. | open |
| R-403 | Prompt/classifier change regresses safety. | high | Phase 6 JSONL golden tests assert risk/action/model/provider-call behavior and persona invariants; Phase 9 added a local Git checkpoint. Production release rollback procedure remains pending. | partially mitigated in core prototype |
| R-404 | One tenant exhausts shared AI budget. | medium | Tenant spend caps and quotas. | open |
| R-405 | Dependency audit reports moderate vulnerabilities in Next.js transitive PostCSS. | medium | Do not run breaking `npm audit fix --force`. Stable Next.js 16.2.6 still pins nested PostCSS 8.4.31; Next.js 16.3.0-canary.28 uses a patched PostCSS but is not a safe pilot baseline; npm override invalidates the tree. Track a stable Next.js patch/upgrade path before production. | open |

## Security Operations Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-501 | Backups cannot be restored or retain data longer than approved. | high | Phase 11 added a draft backup/restore runbook with restore drill evidence requirements; final provider, retention, and legal-hold decisions remain external gates. | open |
| R-502 | Production secrets are exposed or cannot be rotated quickly. | high | Phase 11 added a draft secret rotation runbook with emergency revocation steps; production secret manager and rotation ownership remain external gates. | open |

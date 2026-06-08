# MANU-AI Data Inventory

## Purpose

This inventory defines which data MANU-AI expects to process, why it is needed, whether it may enter an LLM prompt, and which controls are required.

This is a planning artifact and must be reviewed before real client health data is processed.

## Data Categories

| Category | Examples | Purpose | LLM Allowed | Controls |
| --- | --- | --- | --- | --- |
| Tenant data | Clinic name, tenant ID, plan limits | Workspace isolation and billing | No | Tenant-scoped rows, RBAC |
| Dietitian profile | Name, timezone, role, credential status | Attribution, handoff routing, voice setup | Limited name only | RBAC, audit access |
| Dietitian voice samples | Approved sample replies | Voice profile generation | Yes, after approval | Use only submitted samples, no client secrets |
| Client identity | Full name, client ID | Dashboard and conversation routing | First name/full name only when needed | Encryption where appropriate, RBAC |
| Channel identity | WhatsApp phone, Telegram ID | Message routing | No | Separate mapping table, confirmation, opt-out state |
| Health profile | Goal, diet type, conditions flags, pregnancy flag | Personalization and safety gating | Only allowlisted summary fields | Special-category controls, minimization |
| Diet plan | Approved meal plan summary, swaps, restrictions | Grounded routine replies | Yes | Dietitian approval, versioning |
| Allergies/restricted foods | Peanut allergy, lactose restriction | Avoid unsafe suggestions | Yes | High-safety prompt priority |
| Medication/supplement flag | Uses medication, asks about supplement | Escalation | Flag only | No dose advice, handoff |
| Clinical risk notes | Eating disorder risk, diabetes concern | Safety routing | Usually no; use high-risk flag | Dietitian-only by default |
| AI activation state | Active/passive, active window, changed by dietitian | Decide whether AI may respond | No | Per-client control, audit history |
| Conversation messages | Client/dietitian/assistant messages with origin labels | Inbox, memory, audit, dataset views | Recent bounded window only | Retention, redaction, tenant isolation |
| Conversation memory | Rolling summary, durable facts | Context efficiency | Yes after safety filtering | Client-scoped, editable, deletable |
| Dietitian context updates | Phone/Zoom/in-person summaries, critical client changes | Keep AI current on non-chat dietitian-confirmed context | Yes, bounded active records only | Tenant/client scoped, audit, draft invalidation, anonymization |
| Client update proposals | Dietitian chat text, proposed form/context patches, safety flags, approval status | Let dietitians turn chat-entered client changes into reviewed form/context updates | No direct prompt use; only applied proposals create form/context sources | Tenant/client scoped, additive allowlist, explicit dietitian approval, stale-revision rejection, audit, anonymization |
| Handoff cases | Risk reason, urgency, status | Human review | No direct prompt use | Audit and notification controls |
| AI decisions | Mode, risk, action, provider-attempt state, model, provider id/status, prompt version, send status, ContextManifest metadata | Auditability | No | Immutable audit metadata; no-call paths keep provider fields null/not-called |
| Internal copilot messages | Dietitian question, local/mock assistant answer, source refs | Internal decision support and auditability | No external LLM in current build | Tenant/dietitian scoped, RBAC, source-required answers, no client-facing send action |
| Internal copilot tool calls | Curated tool name, arguments, result summary, source refs | Explainability and misuse review for internal copilot answers | No external LLM in current build | Read-only tools only, no raw SQL, no mutation tools, minimized summaries |
| Provider metadata | Message IDs, delivery state, errors | Reliability and support | No | Idempotency and operational logs |
| Audit events | Actor, action, entity, timestamp | Traceability | No | Append-only, minimized metadata |
| Dietetic regulation corpus | Approved scope rules, chunked rule text, escalation level | Scope guard: detect dietitian-only/regulated tasks | Rule text may enter mock lexical retrieval locally; real embedding is provider egress and remains gated | System-level read for tenants; write by system/owner only; qualified dietitian approval required |
| Scope guard evaluations | Matched rule ids, scores, decision level, scope guard version | Safety audit without storing client message bodies | No | Tenant-scoped read; no raw inbound message text; append-only audit |

## Prompt Allowlist v1

The LLM may receive only:

- Client name when needed for natural reply.
- Selected persona behavior.
- Dietitian voice profile.
- Approved diet plan summary.
- Allergies and restricted foods.
- Pinned notes approved for AI use.
- Rolling memory summary after safety filtering.
- Active dietitian-entered context updates from non-chat conversations.
- Recent bounded conversation window.
- Source metadata (`sourceId`, `origin`, `createdAt`, `authority`) for prompt segments.
- The newest dietitian-authored source across manual messages and dietitian context updates is authoritative when sources conflict.
- Current inbound message.
- Same-dietitian approved style examples, only after de-identification and filtering.
- Internal copilot source summaries only in the local/mock copilot path; future external provider use requires a separate allowlist and review.

The LLM must not receive by default:

- Full channel identifiers.
- Raw phone numbers.
- Legal identity documents.
- Full medical history.
- Medication dose details.
- Dietitian-only risk notes.
- Unbounded chat history.
- Other clients' data.
- Raw audit logs.
- Imported messages with unknown author.
- AI-generated replies unless approved or edited by a dietitian.
- Internal copilot raw tool payloads, audit logs, or unrestricted database records.
- Pending or rejected client update proposal source text.

## Retention Defaults

Final retention periods require legal review. Until then:

- Production pilot should keep data no longer than necessary for service delivery and auditability.
- Deleted clients must be removed from active promptable context.
- Audit logs should retain minimized metadata, not raw health message content unless legally required.
- Backups must have a defined expiry and restore test.

## Next Governance Work

Before pilot data is processed, MANU-AI needs production policy approval for:

- Final retention durations.
- Legal basis matrix and DSAR operating procedure.
- Backup expiry and restore-test policy.
- Production deletion job ownership and approval workflow.

Completion Roadmap Phase 5 added `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md` to package this inventory and related data-governance evidence for external counsel review. That packet does not approve lawful basis, retention, DSAR operations, or real health-data processing.

Phase 11 draft runbooks were added for incident response, backup/restore, and secret rotation. They are operating evidence drafts only and do not approve real pilot data processing.

Phase 14 added `data_requests` as a legal operations ledger for completed client export and anonymization actions. This ledger is tenant/client-scoped and does not set final retention durations or enable automatic deletion.

Phase 5 technical skeleton completed on 2026-05-25:

- Retention-policy placeholders exist in `app/src/lib/data-governance.ts`; all final durations remain `legal_review_required`.
- `/api/clients/[id]/export` returns a tenant/client-scoped export bundle.
- `/api/clients/[id]/anonymize` clears promptable client profile, channel identifier, rolling memory, message bodies, and AI decision references.
- Tests verify export scoping, memory invalidation, legal ops ledger records, and legal-review retention placeholders.

These workflows must continue to preserve tenant isolation and must not export provider secrets, raw audit internals, or unrelated tenant data.

Phase 61 added system-level `scope_rules` / `scope_rule_chunks` and tenant-scoped `scope_guard_evaluations` audit records. Scope guard audit stores matched rule ids and scores only, not raw client message text. Real embedding of client messages for scope retrieval remains a provider/vendor-gated egress path and is disconnected in the local prototype.

Phase 76A added tenant/client-scoped `client_update_proposals` records. Proposal source text is never a direct prompt source; only an explicitly applied, allowlisted proposal can create a client form answer update and Critical Context record. Phase 76B expands those records to include nutrition, clinical-safety, and sensitive-detail patch categories; sensitive-detail patches are stored in form responses but are not direct prompt sources. Phase 74 anonymization redacts proposal text, clears proposed patches, and closes pending proposal records.

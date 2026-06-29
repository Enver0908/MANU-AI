# Phase 77AA: WhatsApp Mock/Gated Adapter PRD And Scope Lock

Date: 2026-06-22
Status: Completed locally.
Production pilot: NO-GO.
R-405: Open.

## Goal

Create the canonical PRD and technical scope lock for the post-77Z WhatsApp production adapter track before any runtime adapter implementation begins. This phase records adapter boundaries, gate conditions, data minimization rules, and an edge-case matrix so Phases 77AB–77AH can implement mock/gated behavior without real provider or channel connections.

## PRD

### Problem

MANU-AI must eventually support WhatsApp-first client messaging for dietitians, but production pilot remains `NO-GO` with all eight launch gates open and R-405 open. The local prototype already has mock channel ingress (`app/src/lib/channel-adapters.ts`), Phase 7 adapter contracts, and Phase 46 WhatsApp group quarantine, but there is no canonical post-77Y adapter track that locks scope, gate conditions, and non-live operation before incremental implementation.

### Product intent

- Dietitians should eventually send and receive client messages through WhatsApp as if the messages come from the dietitian, not from an AI system.
- Client-facing output must continue to expose only `green`, `yellow`, and `red` risk classes. Internal workflow states such as `unknown_intent`, `needs_label`, `needs_review`, `clarify`, and `handoff` remain internal-only and must not become new client-visible warning classes.
- Inbound WhatsApp traffic must resolve to exactly one known client identity or be quarantined before orchestrator/provider work.
- Outbound WhatsApp traffic must respect channel permission, opt-out, service-window, and template policy gates before any future live send path is enabled.
- Unsupported contexts such as WhatsApp groups must remain quarantined with minimized metadata only.

### Canonical decision

The WhatsApp production adapter track does **not** run live in Phases 77AA–77AH.

- All adapter work is mock/gated only.
- Runtime changes are limited to pure functions, disabled webhook boundaries, mock routes, ledgers, rehearsal harnesses, and evidence docs.
- No real WhatsApp Business Cloud API credentials, webhook verification against Meta, outbound provider calls, or production channel traffic are introduced in this track until external launch gates close and explicit future approval phases authorize live operation.
- Production pilot remains `NO-GO`.
- R-405 remains open and is not remediated except through the Phase 22 procedure.

## Technical Scope

### In scope for Phase 77AA

- This spec document.
- Locked adapter track map for Phases 77AB–77AH.
- Gate-condition matrix for when live adapter operation may be considered in a future gated phase outside this track.
- Data-minimization rules for inbound quarantine, outbound ledger, and provider metadata.
- Edge-case matrix for identity, duplicate, opt-out, permission, group, and policy failures.
- Continuity doc updates recording scope lock only.

### Out of scope for Phase 77AA

- Runtime code changes.
- Schema/migration changes.
- Real WhatsApp/Telegram/Gemini/provider/monitoring/secret-manager connections.
- Webhook signature verification against Meta.
- Production credentials, templates, or phone-number provisioning.
- Launch-gate closure.
- R-405 remediation.
- Production pilot GO.

### Existing foundations this track extends

| Artifact | Role |
| --- | --- |
| `docs/PHASE_7_CHANNEL_ADAPTER_READINESS_SPEC.md` | Normalized inbound event contract, identity quarantine, idempotency, provider metadata redaction |
| `app/src/lib/channel-adapters.ts` | `processMockChannelInbound`, `buildProviderMetadata`, opt-out handling, duplicate suppression |
| `docs/PHASE_46_WHATSAPP_GROUP_QUARANTINE_SPEC.md` | Unsupported group context quarantine with no raw body retention |
| `dietitian-ai-assistant/` orchestrator + `responsePlan` | Core-owned reply planning after channel preflight |
| Phase 77M–77Y AI Quality Program | Green/yellow/red client-visible classes; internal workflow states remain internal |

### Post-77AA implementation track (locked order)

| Phase | Title | Runtime intent |
| --- | --- | --- |
| 77AB | WhatsApp Cloud payload normalization | Pure normalization from Cloud API-shaped fixtures to `NormalizedInboundChannelEvent`; no network |
| 77AC | Disabled webhook boundary + identity quarantine | Disabled route/handler boundary, signature stub fail-closed, identity quarantine wiring |
| 77AD | Opt-out, service window, template policy mock | Policy gates for outbound mock path; no real template send |
| 77AE | Outbound delivery ledger | Mock outbound state machine and audit evidence only |
| 77AF | Operational health + rollback | Adapter health signals and rollback toggles in operational-health surface |
| 77AG | 100×50 channel replay rehearsal | Deterministic channel replay harness over mock ingress/egress |
| 77AH | Adapter evidence closure | Full-track continuity/pilot/gate evidence sync and commit closure |

Phases 77AB–77AH must each add their own phase spec before runtime work, per `codex.md`.

## Adapter boundary

### Ingress boundary

1. Receive provider-shaped payload (fixture or disabled webhook stub only in this track).
2. Normalize to `NormalizedInboundChannelEvent`:
   - `channel`: `whatsapp`
   - `providerEventId`: stable provider message id
   - `channelUserId`: sender WhatsApp identity
   - `body`: direct-message text only after group/status/system filtering
   - `receivedAt`: optional ISO timestamp
3. Reject or quarantine before orchestrator when any preflight gate fails.
4. For exactly one matched client with `channelPermission=ready`, delegate to existing simulator/orchestrator path via `processMockChannelInbound` semantics.
5. Never pass quarantined raw health text to provider metadata builders.

### Egress boundary (future mock phases only)

1. Accept only orchestrator-approved outbound intents that already passed green/yellow/red and covenant gates.
2. Apply channel permission, opt-out, service-window, and template-policy mocks before recording a mock delivery ledger entry.
3. Do not perform real HTTP send in Phases 77AB–77AH.
4. Record audit evidence with minimized metadata and no raw clinical payload duplication.

### Orchestrator handoff rule

Channel adapter preflight ends before `responsePlan` construction. Adapter failures produce audit/quarantine evidence and `lastSimulation` blocked actions; they do not create client messages, AI decisions, risk assessments, or provider calls.

## No real connection rule

The following remain disconnected throughout Phases 77AA–77AH:

- WhatsApp Business Cloud API live webhooks and outbound sends
- Telegram Bot API
- Gemini or any external LLM provider beyond existing mock-provider paths
- Email, push, monitoring, analytics, secret manager, backup provider
- Real client health data ingestion from production channels

Any environment variable names reserved for future live operation must default to disabled/mock mode and fail closed when unset.

## Gate conditions for future live operation

Live adapter operation is blocked until **all** conditions below are met in addition to production pilot gate closure:

| Gate / control | Requirement before live adapter |
| --- | --- |
| Production pilot decision | Explicit GO recorded in gate dossier |
| Channel policy launch gate | External channel-policy approval packet complete |
| Legal/privacy launch gate | External legal/privacy approval complete |
| Provider/vendor launch gate | Gemini/provider approval complete where applicable |
| Clinical taxonomy launch gate | Qualified dietitian approval for production routing |
| Operations launch gate | Monitoring, incident, DSAR, backup/restore evidence complete |
| Secret rotation launch gate | Production secret rotation procedure approved |
| Dependency gate / R-405 | Closed or explicitly accepted per Phase 22 only |
| Identity reconciliation | Unknown/ambiguous identity quarantine proven in rehearsal |
| Rollback | Adapter disable/rollback procedure tested in mock rehearsal |

Until then, adapter code paths must remain mock/gated and test-covered.

## Data minimization

### Must not persist in adapter/quarantine/ledger metadata

- Raw group message bodies
- Full health profiles, diet plans, allergies, restricted foods, clinical notes, pinned notes, or prompts
- Provider credentials, access tokens, or webhook secrets
- Full outbound AI draft text when blocked; store block reason and correlation ids only

### May persist (minimized)

- Tenant id
- Channel (`whatsapp`)
- Provider event id / mock delivery id
- Channel user id (hashed or pseudonymous storage may be introduced in later phases; plain id acceptable in local mock store)
- Quarantine/delivery reason codes
- Timestamps
- Correlation ids linking to existing audit events
- Redacted provider metadata from `buildProviderMetadata`

### Provider metadata rule

Reuse `buildProviderMetadata` allowlisting from `channel-adapters.ts`. Sensitive keys (`body`, `message`, `healthProfile`, `dietPlan`, `allergies`, `restrictedFoods`, `clinicalRiskNotes`, `pinnedNotes`, `memory`, etc.) must never be forwarded as provider metadata.

## Edge-case matrix

| Case | Expected handling | Orchestrator reached? | Client message created? |
| --- | --- | --- | --- |
| Missing `providerEventId` | `channel_policy_missing_provider_event_id` block | No | No |
| Duplicate `providerEventId` | `duplicate_ignored` / idempotent no-op | No | No |
| Empty body | `channel_policy_empty_body` block | No | No |
| Missing/blank `channelUserId` | Identity quarantine (`unknown`) | No | No |
| Unknown identity (0 clients) | Identity quarantine (`unknown`) | No | No |
| Ambiguous identity (2+ clients) | Identity quarantine (`ambiguous`) | No | No |
| Opt-out command (`STOP`, `DUR`, `IPTAL`, etc.) | Set `channelPermission=opted_out`, block with audit | No | No |
| `channelPermission=blocked` | Existing simulator preflight block | No | No |
| `channelPermission=opted_out` | Existing simulator preflight block | No | No |
| `channelPermission=pending` | Existing simulator preflight block | No | No |
| WhatsApp group message | Phase 46 quarantine (`whatsapp_group_unsupported`) | No | No |
| Rate limit exceeded | Channel rate-limit block | No | No |
| Known ready client, valid direct message | Delegate to simulator/orchestrator | Yes | Per existing risk routing |
| Disabled webhook in 77AC | Route returns disabled/fail-closed without provider call | No | No |
| Service window closed (77AD mock) | Outbound mock block before ledger send | No | No |
| Template required but mock policy denies (77AD) | Outbound mock block with policy reason | No | No |

## Client-visible risk class lock

- Client-visible classes remain `green`, `yellow`, and `red` only.
- Internal states (`unknown_intent`, `needs_label`, `needs_review`, `clarify`, `handoff`, quarantine reasons, adapter block reasons) are operational evidence only.
- Adapter work must not introduce new client-facing warning taxonomies.

## Verification (Phase 77AA)

Phase 77AA is documentation-only. Verification confirms the repository remains green without runtime changes:

- `git diff --check`
- `cd app && npm test`
- `cd app && npm run release:verify` with only documented R-405 findings

## Done criteria

- This spec exists and locks the 77AB–77AH track order.
- Canonical no-live decision is recorded.
- Gate-condition, data-minimization, and edge-case matrices are recorded.
- Continuity docs state Phase 77AA completion and name Phase 77AB as next implementation phase.
- Phase 77AH closed the full 77AA–77AG implementation track locally; see `PHASE_77AH_WHATSAPP_ADAPTER_EVIDENCE_CLOSURE_SPEC.md`.
- `git diff --check`, app tests, and `release:verify` pass.
- Production pilot remains `NO-GO`.
- R-405 remains open.

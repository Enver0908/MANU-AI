# Direct 100 Dietitian Completion Plan
Date: 2026-06-05

## Purpose
This document is the canonical strategic completion plan after Phase 65. It supersedes the earlier "small ring first" interpretation. The production pilot target is direct launch readiness for 100 dietitians with 50 clients each, for a minimum of 5,000 clients. This document does not approve production launch, close any launch gate, connect WhatsApp, connect Gemini, process real client health data, accept R-405, or activate an official regulation corpus.

## Fixed Product Laws
These rules are non-negotiable and apply to every future phase:
- The client must experience WhatsApp messages as coming from the dietitian, not from an AI system.
- Client-facing output must never disclose AI identity or say phrases equivalent to "I am AI", "as an AI", "ask your dietitian", "ask your doctor", "consult a professional", or "I cannot provide medical advice".
- Yellow and red situations must not produce client-facing AI boundary replies.
- Yellow and red situations use internal procedures only: draft, handoff, yellow hold, red lock, manual takeover, notification, and audit.
- Green maximization must come from widening the approved, source-backed answer space, not from answering risky messages.
- AI-generated messages are not clinical ground truth and must not be used as source authority for future clinical answers.
- Dietitian-authored messages, active forms, active diet plans, prompt-allowed form fields, pinned notes, and dietitian context updates are the primary approved sources.
- Mixed-intent messages fail closed: if any part requires yellow or red, the system must not send a partial client-facing green reply.
- Autopilot is not globally enabled for all 5,000 clients by default. It is enabled only for selected qualified clients after all gates, monitoring, and rollback controls are ready.

## Current Baseline
- Latest completed phase: Phase 76F intent-specific answerability.
- Latest completed implementation phase before 76C: Phase 76B expanded chat form safety updates.
- Latest verification: core tests 139/139, app tests 240/240, `npm run release:verify` passed with only documented R-405 findings.
- Production pilot status: `NO-GO`.
- Real WhatsApp, Gemini, monitoring, secret manager, and real client health data remain disconnected.
- Existing usable foundations:
  - Client forms with prompt visibility.
  - Diet plan and health profile fields.
  - Dietitian context updates.
  - Message provenance distinguishing client, AI, dietitian manual, and system messages.
  - Yellow hold and red lock.
  - Structured launch-gate evidence engine.
  - Official PDF corpus QA foundation.

## Phase 66: Product Communication Covenant Lock
Goal: encode the fixed product laws into provider output safety, prompt contracts, tests, and continuity docs.

Implementation intent:
- Add a forbidden client-facing phrase detector covering Turkish and supported response languages.
- Block AI self-disclosure, AI limitation statements, and doctor/dietitian/professional referral language in client-facing output.
- Ensure provider output, mock output, future Gemini output, draft output, and send-time output pass the same covenant check.
- Ensure yellow/red paths cannot emit client-facing safe-boundary replies.
- Ensure covenant violations result in send block, draft/handoff/internal handling, or no client send according to current orchestration rules.
- Keep product copy and prompts aligned with the dietitian-authored messaging experience.
No user documents are required in this phase.

Done criteria:
- Tests prove forbidden phrases are never sent.
- Tests prove yellow/red do not create client-facing AI replies.
- Tests prove green output is still blocked if it violates the covenant.
- Production pilot remains `NO-GO`.

## Phase 67: Approved Source Answerability Engine
Goal: add a decision layer that answers "can this green-risk message be answered from approved sources?"

Implementation intent:
- Add an answerability decision separate from clinical risk:
  - `source_backed_green`
  - `draft_required`
  - `handoff_required`
  - `blocked`
- Add source authority categories:
  - active diet plan
  - prompt-allowed form response
  - dietitian context update
  - dietitian manual message
  - pinned note
  - allergies/restricted foods
  - official regulation permission map
  - general safe education corpus
- Treat AI-generated messages as non-authoritative.
- Restrict dietitian manual messages to the same client/conversation context and latest-authoritative-source rules.
- Require source-backed answerability for green autopilot send.
- If source support is missing, route to draft/no-ai/handoff instead of inventing a client-facing answer.
No user documents are required in this phase.

Done criteria:
- Plan lookup can be green only when plan source exists.
- Approved substitution can be green only when source-backed.
- Plan changes, medication/insulin/lab/symptom requests do not become green through answerability.
- Mixed-intent messages do not receive partial client-facing replies.

## Phase 68: Green Maximization Intent Taxonomy
Goal: reduce false yellow decisions while preserving zero unsafe green.

Green intent families:
- `green_plan_lookup`
- `green_meal_reminder`
- `green_allowed_substitution`
- `green_logistics`
- `green_behavior_support`
- `green_progress_logging`
- `green_low_risk_clarification`
- `green_general_education`
- `green_context_recap`

Yellow/red intent families:
- Plan change.
- Calorie/macro/portion redefinition.
- Medication, insulin, or supplement dose decision.
- Lab result interpretation.
- Symptom interpretation.
- Pregnancy, minor, diabetes, eating-disorder, self-harm, emergency, or similar sensitive clinical contexts.
- Client requests that conflict with the active plan.

Implementation intent:
- Add false-yellow reduction only for clearly green, source-backed, non-clinical intents.
- Preserve monotonic escalation: once a clinical layer escalates to yellow/red, do not downgrade to green.
- Add intent audit reasons and green coverage metrics.

Optional user input:
- 30-50 synthetic or anonymized example messages with expected green/yellow/red labels.

Done criteria:
- Unsafe green remains zero in tests.
- False-yellow cases are measured.
- Green decisions are traceable to intent and source authority.

## Phase 69: Direct 5,000 Client Scale Foundation
Goal: make 100 dietitians and 5,000 clients a production prerequisite, not an afterthought.

Implementation intent:
- Add or finalize pagination for:
  - client lists
  - timelines
  - handoff queues
  - notifications
  - audit/event views
  - internal copilot source reads
- Replace production-relevant tenant-wide reloads with scoped reloads.
- Add synthetic 100-dietitian / 5,000-client fixtures.
- Add load/backpressure/idempotency evidence for webhook bursts, handoff bursts, provider failures, draft invalidations, and duplicate inbound events.
- Record operational health for large tenant state.

Optional user input:
- Expected daily messages per client.
- Expected peak-hour volume.
- Expected active-client percentage per day.

Done criteria:
- 100-dietitian / 5,000-client synthetic tests pass.
- Broad reads are paginated, scoped, or explicitly documented as non-production administrative reads.
- UI remains usable on desktop and mobile dense views.

## Phase 70: User-Supplied Form Hardening
Goal: convert user-supplied dietitian and client forms into production-grade schema and source authority.

User documents required at the start of this phase:
- Dietitian form.
- Client form.
- For each field when available:
  - field name
  - description
  - who fills it
  - required status
  - allowed options
  - whether AI may see it
  - clinical sensitivity
  - privacy sensitivity
  - whether it can support answerability

Implementation intent:
- Build a field registry with classifications:
  - `prompt_allowed`
  - `dietitian_only`
  - `sensitive_never_prompt`
  - `answerability_source`
  - `clinical_risk_modifier`
  - `logistics_only`
- Preserve immutable schema snapshots.
- Keep prompt visibility conservative.
- Invalidate pending drafts on prompt-affecting changes.
- Connect form fields to answerability only when approved.

Done criteria:
- User forms are represented as versioned production schemas.
- Prompt-hidden fields never enter PromptContext.
- Form changes invalidate stale drafts.
- Legal/privacy and clinical form approvals remain external gates.

## Phase 71: Official Regulation PDF Ingestion
Goal: process user-supplied official health-regulation PDFs through the Phase 65 QA foundation.

User documents required at the start of this phase:
- Official health-regulation PDFs.
- Source metadata for each PDF:
  - official authority
  - title
  - jurisdiction
  - publication date
  - version
  - source link
  - file name
  - user notes on critical green/yellow/red sections, if available

Implementation intent:
- Compute checksums.
- Extract text with page evidence.
- Use OCR fallback only if needed.
- Build page/section maps.
- Create draft derived rules with source references.
- Create draft corpus golden cases.
- Keep all rules draft and inactive until approval.

Done criteria:
- PDF corpus is traceable and QA-evaluable.
- Extraction failures and missing references block QA.
- No active routing changes occur without approval.

## Phase 72: Regulation Permission Graph
Goal: turn official regulation corpus and user clinical/legal interpretation into an allowed-action and forbidden-action graph.

User documents required at the start of this phase:
- Legal/privacy interpretation.
- Clinical interpretation.
- Which topics can never be green.
- Which topics are draft-only.
- Which topics are answerable from the active plan.
- Which client-facing phrases are always forbidden.
- The user's green/yellow/red decision matrix if available.

Implementation intent:
- Split regulation-derived rules into:
  - forbidden action map
  - allowed action map
  - draft-only map
- Conflict order:
  - forbidden beats allowed
  - clinical risk beats green maximization
  - newest approved corpus version beats older versions
- Wire the permission graph into answerability.

Done criteria:
- Regulations help expand allowed green answers without weakening safety.
- Forbidden actions cannot be green.
- Approval remains external and structured.

## Phase 73: Green/Yellow/Red Calibration And Golden Tests
Goal: validate green maximization with zero unsafe green.

User documents required at the start of this phase:
- Synthetic or anonymized client-message examples.
- Expected green/yellow/red labels.
- Expected action: auto-send eligible, draft, handoff, no-ai.
- Reasoning notes when available.

Implementation intent:
- Expand golden cases for plan lookup, allowed substitution, logistics, progress logging, plan change, supplement/medication/insulin, lab, symptom, pregnancy, minor, eating-disorder, emergency, and mixed intent.
- Add metrics:
  - `green_coverage_rate`
  - `source_backed_green_rate`
  - `false_yellow_rate`
  - `unsafe_green_rate`
  - `blocked_by_covenant_count`
  - `mixed_intent_block_count`
- Audit green decisions with source authority and intent.

Done criteria:
- Unsafe green is zero.
- False yellow is measured and reduced only where source-backed.
- Clinical taxonomy gate remains external.

## Phase 74: Transactional Redaction, Export, And DSAR Hardening
Goal: make data lifecycle safe for 5,000-client production pilot.

User documents required at the start of this phase:
- Retention preferences.
- Export format expectations.
- Anonymization and hard-delete preferences.
- DSAR/deletion SLA expectations.
- Legal/privacy requirements for data lifecycle.

Implementation intent:
- Move client removal/anonymization into a dedicated transactional contract.
- Redact promptable context, messages, form responses, context updates, memories, handoffs, notifications, risk assessments, decisions, and channel identity atomically.
- Preserve minimized audit/export evidence.
- Ensure removed clients cannot enter prompts, internal copilot, simulator, WhatsApp, or provider paths.

Done criteria:
- No partial redaction states.
- Removed clients are excluded from all prompt/source paths.
- DSAR/export evidence is test-covered.

## Phase 75: Gemini Provider Production Gate
Goal: prepare Gemini-only production provider integration behind gates.

User documents required at the start of this phase:
- Gemini/provider terms or approval.
- Retention, logging, and training-use decision.
- Health-data eligibility decision.
- Provider/vendor approval artifact.
- Legal/privacy approval artifact.

Implementation intent:
- Add real provider adapter behind env and structured launch-gate evidence.
- Preserve model routing:
  - green -> `gemini-1.5-flash`
  - yellow -> internal draft path only, no client send
  - red -> no LLM call
- Enforce PromptContext allowlist.
- Enforce product communication covenant on provider output.
- Fail closed on provider errors.
- Record provider audit metadata without raw secrets or unnecessary sensitive data.

Done criteria:
- Real provider egress is impossible without gates and env flag.
- Red never calls provider.
- Yellow never client-sends.
- Covenant violations block send.

## Phase 76A: Dietitian Chat Form Update Proposals
Goal: let dietitians turn selected client-chat notes into reviewed form/context updates without making the internal copilot a mutation agent.

User documents required at the start of this phase:
- None. This phase uses existing Phase 70 client-form fields and existing dietitian authorization.

Implementation intent:
- Keep internal copilot answers read-only.
- Add a separate proposal action that accepts dietitian-entered chat text for the selected client.
- Create pending proposals with deterministic, allowlisted, additive patches only.
- Block sensitive clinical, medication, system-field, provider, channel, AI-mode, and lifecycle mutation requests.
- Require explicit dietitian apply/reject.
- Reject stale proposals when client context revision changed after proposal creation.
- On apply, update the active client form response, mirror allowed client fields, create Critical Context and audit evidence, increment context revision once, and invalidate stale drafts.
- Include proposal records in export/anonymization governance.

Done criteria:
- Chat text never mutates form/context until explicit apply.
- Unsupported/sensitive/system requests cannot produce applicable patches.
- Applied proposals are auditable and draft-invalidating.
- Internal copilot remains read-only.
- Production pilot remains `NO-GO`.

## Phase 76B: Expanded Chat Form Safety Updates
Goal: keep the same simple chat proposal UX while allowing dietitians to approve safety-profile form updates.

User documents required at the start of this phase:
- None. This phase uses existing Phase 70 form fields and dashboard/handoff manual controls.

Implementation intent:
- Allow proposal patches for pregnancy/breastfeeding, adult/minor status, diagnosed condition, medication/insulin, lab-result availability, recent symptom, and eating-disorder risk.
- Mirror supported safety form values into `ClientRecord.healthProfile`.
- Store sensitive details in form responses without making them direct prompt/answerability sources.
- Show manual-only warnings for AI active/passive, AI mode, channel permission, opt-out, red lock, yellow hold, and autopilot/reactivation requests.
- Allow dietitians to edit or remove proposal rows before apply without changing target field identities.
- Keep real Gemini extraction disconnected while preserving a Gemini-ready proposal JSON contract.

Done criteria:
- Clinical/safety form flags can be approved from one proposal card.
- Operational AI/channel/lock controls cannot be changed from chat.
- Edited patch values cannot change patch targets.
- Production pilot remains `NO-GO`.

## Phase 76C: Structured Food Rule Green Capacity Spec
Goal: lock the PRD and technical specification for expanding source-backed green food decisions before any WhatsApp production adapter work.

User documents required at the start of this phase:
- None. This phase documents the downstream track only.

Implementation intent:
- Define structured food-rule fields, deterministic food-rule engine contract, intent-specific answerability matrix, clinical second-layer false-yellow calibration rules, trusted product-ingredient verification contract, PromptContext/output guard requirements, dashboard/proposal requirements, permission-graph and calibration wiring plan, lifecycle coverage, edge cases, and downstream phase map 76D-76Q.
- Position the food-rule green capacity track before WhatsApp production adapter in the canonical roadmap.

Done criteria:
- `docs/PHASE_76C_STRUCTURED_FOOD_RULE_GREEN_CAPACITY_SPEC.md` exists and continuity docs are updated.
- No runtime behavior, schema, provider, channel, launch-gate approval, R-405 status, or real-data handling changes occur.
- `npm run release:verify` passes with production pilot still `NO-GO`.

## Phase 76D: Structured Food Rule Data Model And Form Upgrade — Completed 2026-06-08
Goal: convert Phase 70 food-related fields from coarse free text into structured, answerability-ready food rules.

Completed:
- Added `docs/PHASE_76D_STRUCTURED_FOOD_RULE_DATA_MODEL_SPEC.md`, `phase-76d-food-rule-fields.ts`, and `phase-76d-food-rule-model.ts`.
- Registry-backed structured forbidden/allowed food items and groups, diet-type rules, equivalent exchange groups, mandatory/optional foods, skip tolerance, portion boundaries, ingredient keywords, product-label review policy, and uncertainty policy fields.
- Registry version bumped to `phase-76d-food-rule-registry-v1`; seed data, autopilot completeness checks, and form/client sync updated.
- Verification: core tests 122/122, app tests 234/234, `npm run release:verify` passed with only documented R-405 findings.
- Production pilot remains `NO-GO`.

## Phase 76E: Food Rule Engine — Completed 2026-06-08
Goal: deterministic evaluator for allowed, forbidden, equivalent substitution, diet-type, skip, and product-ingredient food decisions.

Completed:
- Added `docs/PHASE_76E_FOOD_RULE_ENGINE_SPEC.md`, core `food-rule-engine.js`, app `food-rule-runtime.ts`, orchestrator audit-only `contextManifest.foodRule`, and simulator structured-food-rule wiring.
- Verification: core tests 132/132, app tests 238/238, `npm run release:verify` passed with only documented R-405 findings.
- Production pilot remains `NO-GO`.

## Phase 76F: Intent-Specific Answerability — Completed 2026-06-08
Goal: intent-family approved-source matching and food-rule alignment before green provider calls.

Completed:
- Added `docs/PHASE_76F_INTENT_SPECIFIC_ANSWERABILITY_SPEC.md`, core `intent-specific-answerability.js`, orchestrator hot-path wiring, structured food-rule source categories, and substitution legacy plan/manual fallback.
- Verification: core tests 139/139, app tests 240/240, `npm run release:verify` passed with only documented R-405 findings.
- Production pilot remains `NO-GO`.

## Phase 76: WhatsApp Production Adapter
Goal: prepare WhatsApp-first production channel for 5,000 clients.

User documents required at the start of this phase:
- WhatsApp Business Cloud API details.
- Webhook verification configuration.
- Phone number mapping rules.
- Opt-in/opt-out text and procedure.
- Template decisions.
- Channel policy approval artifact.

Implementation intent:
- Add webhook verification.
- Normalize inbound messages.
- Enforce exact known-client mapping.
- Quarantine unknown, ambiguous, reused-phone, and group contexts.
- Enforce idempotency.
- Handle opt-out before AI processing.
- Handle service-window/template behavior.
- Store delivery status and send failures.

Done criteria:
- Duplicate inbound does not duplicate-send.
- Unknown or ambiguous identity never reaches AI/provider.
- Opted-out clients receive no automation.
- Production traffic remains blocked until channel gate closes.

## Phase 77: Production Observability And Operations
Goal: make the direct 100-dietitian pilot operable.

User documents required at the start of this phase:
- Incident owners.
- Handoff SLA preferences.
- Monitoring/alerting preferences.
- Quiet-hour/escalation expectations.
- Backup/restore decisions.
- Secret rotation decisions.

Implementation intent:
- Expand operational health:
  - open/urgent handoffs
  - stale drafts
  - provider failures
  - rate-limit denials
  - WhatsApp delivery failures
  - quarantines
  - launch gates
  - corpus status
- Add rollback controls:
  - global autopilot disable
  - tenant disable
  - dietitian disable
  - client disable
- Prepare incident, DSAR, backup, and secret rotation evidence.

Done criteria:
- Operations can see and control pilot health.
- Rollback is tested.
- Ops gates have structured evidence candidates.

## Phase 78: Dependency And R-405 Closure
Goal: resolve or formally accept R-405 before production.

User documents required if no technical fix exists:
- Formal security/engineering risk acceptance.

Implementation intent:
- Follow `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Recheck stable `next@latest` and `eslint-config-next@latest`.
- Update dependencies only if stable Next bundles patched PostCSS.
- Do not use `npm audit fix --force`, canary/beta/rc, invalid overrides, or major downgrades.

Done criteria:
- R-405 is technically resolved or externally accepted.
- Dependency audit clearance gate can be represented as structured evidence.

## Phase 79: Full 100x50 Synthetic Rehearsal
Goal: rehearse full production scale without real production launch.

User documents required at the start of this phase:
- 100-dietitian roster plan.
- 5,000-client launch structure.
- Client qualification plan.
- Rollback owner.
- Launch date target.
- Pilot communication plan.

Implementation intent:
- Generate synthetic 100-dietitian / 5,000-client state.
- Simulate WhatsApp-like inbound bursts.
- Simulate green/yellow/red mix.
- Simulate duplicate events, opt-outs, removed clients, provider failures, stale drafts, context updates, and form updates.
- Exercise dashboard, mobile views, internal copilot, operational health, and rollback.

Done criteria:
- No unsafe green.
- No yellow/red client-facing AI send.
- No duplicate send.
- No unknown identity provider call.
- Load and rollback evidence pass.

## Phase 80: External Launch Gate Closure
Goal: close all launch gates through structured evidence.

User documents required at the start of this phase:
- Legal/privacy approval.
- Clinical taxonomy approval.
- Official PDF corpus approval.
- Form privacy/prompt approval.
- Provider/vendor approval.
- WhatsApp policy approval.
- Incident/DSAR approval.
- Backup/restore approval.
- Secret rotation approval.
- Dependency/R-405 artifact.
- Final launch authorization.

Implementation intent:
- Convert external approvals into sanitized `LaunchGateEvidenceRecord` entries.
- Reject draft, conditional, stale, expired, incomplete, or unsanitized artifacts.
- Update gate closure dossier and final readiness summary.

Done criteria:
- All production launch gates are closed.
- R-405 is closed or formally accepted.
- Latest RLS/migration evidence is current.
- Final go/no-go can be evaluated.

## Phase 81: Direct Production Pilot GO
Goal: launch the direct 100-dietitian / 5,000-client production pilot only after all gates close.

Implementation intent:
- Verify production env, secrets, WhatsApp webhook, Gemini gate, monitoring, rollback controls, client qualification, AI defaults, handoff owners, incident channel, and audit event recording.
- Start the production pilot with 100 dietitians and minimum 5,000 clients.

Done criteria:
- All production traffic is auditable.
- All risky messages route internally.
- Green responses are source-backed and covenant-clean.
- Monitoring and rollback remain active.

## User Document Timing Summary
- Phase 70: dietitian and client forms.
- Phase 71: official regulation PDFs and source metadata.
- Phase 72: legal/privacy interpretation, clinical interpretation, and green/yellow/red decision matrix.
- Phase 73: synthetic/anonymized example messages and expected labels/actions.
- Phase 74: retention, export, anonymization, hard-delete, and DSAR requirements.
- Phase 75: Gemini/provider approval package.
- Phase 76A: no new user document package; uses existing form/context approval flow.
- Phase 76B: no new user document package; expands the same approval flow to existing safety form fields.
- Phase 76: WhatsApp Business, opt-in/out, template, and channel approval package.
- Phase 77: incident, monitoring, backup, restore, and secret rotation decisions.
- Phase 78: R-405 resolution or formal risk acceptance.
- Phase 79: 100-dietitian / 5,000-client launch roster and rollback ownership.
- Phase 80: final external launch-gate approval artifacts.

## Metrics

Safety:
- `unsafe_green_rate = 0`
- `red_client_send_count = 0`
- `yellow_client_send_count = 0`
- `ai_self_disclosure_count = 0`
- `forbidden_referral_phrase_count = 0`

Green maximization:
- `green_coverage_rate`
- `source_backed_green_rate`
- `false_yellow_rate`
- `plan_lookup_success_rate`
- `allowed_substitution_success_rate`
- `logistics_auto_answer_rate`

Scale:
- 100 dietitians loaded.
- 5,000 clients loaded.
- Client list, timeline, handoff queue, notifications, and internal copilot reads are paginated or scoped.
- Duplicate handling and rate-limit denials are controlled.

Operational:
- Open handoffs.
- Urgent handoffs.
- Stale drafts.
- Provider failures.
- WhatsApp delivery failures.
- Quarantine count.
- Corpus status.
- Launch gate status.

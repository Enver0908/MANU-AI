# MANU-AI Next Phase Execution Plan

## Current Position

MANU-AI is in pilot-foundation mode. The local SaaS/PWA prototype, Supabase-backed state, fallback store, simulator, risk assessment persistence, core safety tests, RLS guard, controlled API errors, expanded dashboard visual smoke checks, voice-profile workflow, dynamic client forms, read-only internal dietitian copilot, and dietitian-entered critical context updates exist.

Real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, and real client health data remain disconnected.

The most recent execution layer is Phase 33 / Completion Roadmap Phase 4: external approval evidence intake. It created a structured intake packet for all eight production-pilot launch gates without approving any gate. R-405 remains open, and R-406 remains blocked because Phase 31 could not produce local Supabase RLS evidence without Docker Desktop's Linux engine.

## Phase 0: Baseline, Documentation, And Workspace Safety

Goal: make the current state and next execution path unambiguous before adding more features.

Work:

- Keep this file as the canonical next-phase execution plan.
- Keep `PLAN.md`, `PROJECT_PLAN.md`, `HANDOFF_FOR_NEXT_CODEX.md`, `docs/RISK_REGISTER.md`, `docs/DATA_INVENTORY.md`, `docs/MOBILE_APP_STRATEGY.md`, and `docs/NEXT_SUPABASE_FOUNDATION_SPEC.md` aligned with the current state.
- Record that this workspace currently has no `.git` directory, so rollback/checkpoint strategy is an operational risk until the user chooses a VCS/checkpoint approach.
- Keep the real-channel/provider boundary explicit in every handoff.

Done criteria:

- Documentation has no conflicting next-action lists.
- The current completed work from 2026-05-25 is represented in the plan and handoff docs.
- Open risks include VCS/checkpoint, dependency audit, consent, notification, data governance, provider, and channel gates.
- No real external messaging or model provider is connected.

## Phase 1: Pilot Foundation Hardening - Completed 2026-05-25

Goal: reduce brittleness in the local pilot foundation.

Work:

- Expand Playwright visual coverage for draft approval, red handoff, safety-checklist-blocked, and mobile overflow states.
- Add tests for forced fallback mode and risk assessment duplicate behavior.
- Add controlled API errors for unknown client/conversation and invalid draft operations.
- Keep dependency audit findings documented; do not run `npm audit fix --force` because the current suggested fix is breaking.

Done criteria:

- Core tests pass.
- App lint, unit tests, build, and visual tests pass.
- RLS tests run only against local Supabase unless explicitly overridden.
- Dependency risk has an explicit documented decision.
- Known local API failures return controlled JSON errors instead of uncontrolled exceptions.
- Long message content does not create horizontal overflow in desktop, tablet, or mobile visual smoke checks.

Status:

- Completed in the local prototype on 2026-05-25.
- Continue treating real WhatsApp, Telegram, Gemini, and real health data as disconnected.
- Dependency risk R-405 remains open until a safe Next.js/PostCSS patch path exists.

## Phase 2: Production-Style Auth And Onboarding Shell - Completed 2026-05-25

Goal: separate local demo auth from production tenant/dietitian onboarding behavior.

Work:

- Keep demo sign-in for local testing.
- Add production-style login and empty/error states for unauthenticated, no membership, and missing dietitian profile.
- Keep demo bootstrap isolated to demo endpoints.
- Show role/membership state in the UI without enabling incomplete assistant access controls.

Done criteria:

- Authenticated tenant members can reach the dashboard.
- Users without membership see a controlled forbidden state.
- Users with membership but no dietitian profile see a controlled onboarding/error state.
- Fallback local mode still works.
- Demo and production auth behavior are documented separately.

Status:

- Confirmed that `proxy.ts` is the native Next.js 16 middleware — no separate `middleware.ts` needed. Build output shows `ƒ Proxy (Middleware)`.
- Added `/api/auth-state` endpoint that returns user auth/membership/profile state without loading full app state.
- Added server-side auth resolution in `dashboard/page.tsx` with distinct UI states for no-membership and no-dietitian-profile.
- Added `NoMembershipState` and `NoDietitianProfileState` UI components in `auth-states.tsx`.
- Updated `use-manu-state.ts` to capture and expose 401/403 auth errors instead of silently falling back.
- Added `MembershipBadge` showing authenticated user display name and role in dashboard header.
- Added `authError` handling in `DashboardApp` with session error state and sign-in redirect.
- Added 6 auth-context unit tests. App tests: 24/24.
- Demo auth path unchanged. Fallback mode unchanged.
- See `docs/PHASE_2_AUTH_ONBOARDING_SHELL_SPEC.md` for full spec.

## Phase 3: Consent, Permission, And Channel Governance - Completed 2026-05-25

Goal: prepare safe channel permission enforcement before real WhatsApp or Telegram adapters.

Work:

- Extend permission tracking beyond `ready`, `pending`, and `blocked` with opt-in/out metadata.
- Add internal opt-out simulation and audit behavior.
- Design unknown and ambiguous identity quarantine flows.
- Keep client-facing legal copy out of the app until the user-provided documents exist.

Done criteria:

- Permission-blocked clients cannot trigger AI generation.
- Permission-pending clients cannot trigger AI generation (NEW — previously only blocked was checked).
- Permission-opted-out clients cannot trigger AI generation (NEW).
- Permission changes are audited with previous/new values and distinct opt-out event type.
- Unknown or ambiguous identities cannot reach the orchestrator (empty channelUserId, unknown adultStatus).
- Real WhatsApp and Telegram credentials remain disconnected.

Status:

- Extended `PermissionState` type with `opted_out` value.
- Strengthened `getPreflightBlock()`: only `channelPermission === "ready"` allows AI generation.
- Added identity quarantine: empty `channelUserId` blocks AI.
- Added identity quarantine: `adultStatus === "unknown"` blocks AI.
- Added permission change auditing with `channel_permission_changed` and `channel_permission_opted_out` events.
- Updated dashboard UI with `opted_out` permission option.
- Added 6 new simulator tests. App tests: 30/30.
- See `docs/PHASE_3_CONSENT_PERMISSION_CHANNEL_GOVERNANCE_SPEC.md` for full spec.

## Phase 4: Handoff Notification Architecture - Completed 2026-05-25

Goal: make urgent handoffs operationally visible without sending external notifications yet.

Work:

- Add an in-app notification model and notification center.
- Convert the current `handoff_notification_queued` audit event into a backed notification record.
- Add mobile-focused urgent handoff views.
- Document future email/push adapters and the rule that external notifications must not include raw health-message content.

Done criteria:

- Red handoffs create notification records.
- Notifications can be read or acknowledged in the dashboard.
- Notification body never contains raw client message content (safe text only).
- Mobile viewport can handle urgent handoff review.
- No external push/email provider is connected.

Status:

- Added `NotificationRecord` type and `notifications` state array.
- Handoff creation in simulator creates safe-text notification records.
- Added `/api/notifications/[id]/read` and `/api/notifications/[id]/acknowledge` endpoints.
- Added Notification Center UI in dashboard header with unread badge and dropdown panel.
- Added 2 new tests verifying notification creation and safe-text rules. App tests: 32/32.
- Created `docs/PHASE_4_HANDOFF_NOTIFICATION_ARCHITECTURE_SPEC.md` for full spec.

## Phase 5: Data Governance - Completed 2026-05-25

Goal: create the technical skeleton for retention, deletion, anonymization, and export before pilot data.

Work:

- Define retention policy placeholders by table and data category.
- Add client deletion/anonymization workflow design.
- Add memory invalidation requirements.
- Add tenant/client-scoped export design.

Done criteria:

- Deleted clients cannot remain in promptable context.
- Memory invalidation is testable.
- Export scope is tenant/client bounded.
- Final retention durations remain marked as legal-review dependent.

Status:

- Added `docs/PHASE_5_DATA_GOVERNANCE_SPEC.md`.
- Added `RETENTION_POLICY_PLACEHOLDERS` with legal-review-required retention decisions.
- Added tenant/client-scoped export helpers and `/api/clients/[id]/export`.
- Added client anonymization/memory invalidation helpers and `/api/clients/[id]/anonymize`.
- Anonymization clears promptable health profile, diet plan, notes, channel identifier, conversation memory, message bodies, and AI decision references while adding a minimized audit event.
- Added tests for scoped export, promptable-context invalidation, retention placeholders, and fallback API routes. App tests: 37/37.
- Added Supabase migration `20260525010000_add_opted_out_permission_state.sql` to close the Phase 3 enum gap for `channelPermission = opted_out`.
- Final retention durations remain blocked on legal review.

## Phase 6: Clinical Governance And Evaluation - Completed 2026-05-25

Goal: move safety from prototype rules toward pilot-grade clinical governance.

Work:

- Expand the safety taxonomy and JSONL golden tests.
- Add expected risk, action, and model assertions for golden cases.
- Expand persona invariant tests.
- Document the dietitian review workflow for taxonomy changes.

Done criteria:

- Red cases never call a provider.
- Persona changes do not alter safety decisions.
- Golden test failures block safety taxonomy changes.
- Qualified dietitian approval remains a launch gate.

Status:

- Added `docs/PHASE_6_CLINICAL_GOVERNANCE_EVALUATION_SPEC.md`.
- Added `docs/CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`.
- Added JSONL clinical golden cases in `dietitian-ai-assistant/tests/clinical-golden-cases.jsonl`.
- Added `clinical-governance.test.mjs` to assert expected risk, action, model, provider-call behavior, and persona invariants.
- Expanded the safety classifier to `dietetic-risk-v0.2.0` with normalized Turkish/ASCII matching and additional minor/body-image, supplement dose, lab, medication, glucose, allergy, pregnancy, self-harm, and eating-disorder coverage.
- Core tests now include 35 tests.
- Qualified dietitian approval remains a launch gate before pilot use.

## Phase 7: Channel Adapter Readiness - Completed 2026-05-25

Goal: define WhatsApp/Telegram adapter contracts without connecting production channels.

Work:

- Define normalized inbound and outbound adapter contracts.
- Add mock adapter tests for known, unknown, ambiguous, duplicate, permission-blocked, and opt-out events.
- Define provider payload redaction rules.

Done criteria:

- Mock WhatsApp/Telegram events use the same orchestrator path.
- Unknown or ambiguous identities are quarantined.
- Duplicate events do not duplicate-send.
- Real channel credentials remain absent.

Status:

- Added `docs/PHASE_7_CHANNEL_ADAPTER_READINESS_SPEC.md`.
- Added normalized mock inbound event contract in `app/src/lib/channel-adapters.ts`.
- Added mock WhatsApp and Telegram adapter tests for known events using the same simulator/orchestrator path.
- Added unknown and ambiguous channel identity quarantine before message persistence or AI decisions.
- Added provider-event idempotency checks so duplicate mock channel events do not duplicate-send.
- Added permission-blocked and opted-out mock channel tests using the existing safety gate.
- Added provider metadata redaction helper that removes raw body, prompt, profile, diet plan, allergy, memory, and clinical note fields.
- App tests now include 45 tests.
- No real WhatsApp or Telegram credentials were connected.

## Phase 8: AI Provider Readiness - Completed 2026-05-25

Goal: prepare provider abstraction without sending real health data to an LLM provider.

Work:

- Add mock provider abstraction for generation, timeout, retry, model metadata, and provider error taxonomy.
- Add prompt version metadata to AI decisions.
- Document no-storage/no-retention provider requirements.

Done criteria:

- Mock provider works for green and yellow flows.
- Red flows never call the provider.
- Provider failure produces safe no-send or review behavior.
- Real Gemini health-data use remains blocked until vendor/legal review.

Status:

- Added `docs/PHASE_8_AI_PROVIDER_READINESS_SPEC.md`.
- Added `docs/AI_PROVIDER_REQUIREMENTS.md`.
- Added deterministic local mock provider in `app/src/lib/ai-provider.ts`.
- Simulator generation now uses the mock provider abstraction instead of inline reply generation.
- AI decisions now include `promptVersion`, `providerId`, `providerStatus`, and `providerErrorCode`.
- Added Supabase migration `20260525020000_ai_provider_decision_metadata.sql`.
- Provider timeout/error failures produce safe `no_ai` decisions without outbound AI messages.
- Red and preflight-blocked flows keep provider status as `not_called`.
- App tests now include 49 tests.
- No real Gemini or external LLM provider was connected.

## Phase 9: Pilot Readiness Closure - Completed 2026-05-25

Goal: close the next operational gaps before any production channel or provider integration.

Work:

- Add a local Git checkpoint strategy and root ignore rules.
- Align app seed and RLS test classifier metadata with `dietetic-risk-v0.2.0`.
- Add Supabase persistence for in-app notification records.
- Make Supabase notification read and acknowledge endpoints tenant-scoped instead of returning `501`.
- Keep dependency audit risk documented without applying breaking `npm audit fix --force`.

Done criteria:

- Core tests pass.
- App lint, unit tests, build, and visual tests pass.
- RLS notification coverage exists and skips safely unless local Supabase is available.
- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data is connected.

Status:

- Added `docs/PHASE_9_PILOT_READINESS_CLOSURE_SPEC.md`.
- Initialized local Git repository and added root `.gitignore`.
- Added migration `20260525030000_notifications.sql`.
- Supabase store now loads and persists notification records.
- Supabase notification read and acknowledge APIs now update persisted notification records.
- Fallback notification APIs now return controlled `notification_not_found` errors for unknown IDs.
- App tests now include 51 tests.
- Local Supabase migrations were applied with `npx supabase db push --local`; RLS integration tests passed 5/5 against local Supabase with fallback disabled.
- R-405 remains open by explicit decision: stable Next.js 16.2.6 still pins nested PostCSS 8.4.31, canary Next.js is not a safe pilot baseline, npm override invalidates the dependency tree, and `npm audit fix --force` proposes a breaking downgrade.

## Phase 10: Production Readiness Gates - Completed 2026-05-25

Goal: make external production-pilot approvals explicit and testable before real providers, channels, or health data are connected.

Work:

- Define the required production-pilot launch gate set.
- Keep all gates externally approved only; the app must not claim legal, clinical, provider, or channel approval by itself.
- Add a machine-readable evaluator that reports approved, open, and ignored gate ids.
- Keep the default state blocked.

Done criteria:

- Missing approval input blocks launch.
- Unknown approval keys are ignored.
- Launch is allowed only when every known gate is approved.
- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data is connected.

Status:

- Added `docs/PHASE_10_PRODUCTION_READINESS_GATES_SPEC.md`.
- Added `app/src/lib/launch-gates.ts` with the production-pilot gate set and evaluator.
- Added launch gate unit tests. App tests now include 54 tests.

## Phase 11: Operational Evidence Readiness - Completed 2026-05-25

Goal: connect production-pilot launch gates to concrete evidence expectations and draft runbooks without approving the gates.

Work:

- Add required evidence labels to every production-pilot gate.
- Draft incident response, backup/restore, and secret rotation runbooks.
- Keep launch blocked by default and approval external.

Done criteria:

- Every launch gate has at least one required evidence item.
- Every launch gate remains externally approved only.
- Runbooks contain no production secrets, real client identifiers, or raw health data.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, or secret manager is connected.

Status:

- Added `docs/PHASE_11_OPERATIONAL_EVIDENCE_READINESS_SPEC.md`.
- Added `docs/INCIDENT_RESPONSE_RUNBOOK.md`.
- Added `docs/BACKUP_RESTORE_RUNBOOK.md`.
- Added `docs/SECRET_ROTATION_RUNBOOK.md`.
- Extended `app/src/lib/launch-gates.ts` with `requiredEvidence`.
- Added launch gate evidence coverage. App tests now include 55 tests.

## Phase 12: RBAC Authorization - Completed 2026-05-25

Goal: make production Supabase API paths fail closed by role before assistant/auditor access is expanded.

Work:

- Add typed tenant roles to app auth context.
- Add a capability helper for Supabase-backed API routes.
- Preserve owner/admin/dietitian access to current workflows.
- Restrict assistant/auditor to read-only app-state access until client assignments and minimized auditor views exist.

Done criteria:

- Unknown or unsupported roles cannot perform production actions.
- Assistant/auditor mutation, export, anonymization, simulator, draft, handoff, takeover, and notification actions return controlled 403 errors.
- Fallback local demo mode remains unchanged.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data is connected.

Status:

- Added `docs/PHASE_12_RBAC_AUTHORIZATION_SPEC.md`.
- Added `TenantRole`, `AppCapability`, `hasCapability()`, and `requireCapability()`.
- Supabase-backed API routes now check capability before existing production actions.
- App tests now include 58 tests.

## Phase 13: Client Assignment And Scoped Access - Completed 2026-05-25

Goal: add client assignment foundations and role-scoped Supabase app-state loading before assistant/auditor access is expanded.

Work:

- Add a `client_assignments` table and RLS policy.
- Filter Supabase-loaded app state by role and assignment.
- Keep owner/admin tenant-wide.
- Keep dietitian scoped to owned plus assigned clients.
- Keep assistant scoped to assigned clients only.
- Keep auditor free of raw client/message state until a minimized auditor view exists.

Done criteria:

- Unassigned assistant receives no raw client records.
- Auditor receives no raw clients, messages, AI decisions, handoffs, notifications, or risk assessments.
- Assignment tenant isolation is covered by RLS integration.
- Fallback local demo mode remains unchanged.

Status:

- Added `docs/PHASE_13_CLIENT_ASSIGNMENT_SCOPED_ACCESS_SPEC.md`.
- Added migration `20260525040000_client_assignments.sql`.
- Added `scopeSupabaseState()` and scoped access unit tests.
- Added RLS integration assertions for `client_assignments`.
- App tests now include 62 tests.

## Phase 14: DSAR, Retention, And Legal Ops Ledger - Completed 2026-05-25

Goal: record client data export and anonymization operations in a tenant/client-scoped legal operations ledger.

Work:

- Add `data_requests` records to local app state and Supabase.
- Record completed export and anonymization operations.
- Include client-scoped data request history in export bundles.
- Keep final retention durations and deletion automation behind legal review.

Done criteria:

- Export creates a completed `export` data request.
- Anonymization creates a completed `anonymization` data request.
- Export bundles include only the target client's data request history.
- RLS integration covers `data_requests` tenant isolation.
- No automatic destructive deletion job is added.

Status:

- Added `docs/PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`.
- Added migration `20260525050000_data_requests.sql`.
- Added `DataRequestRecord` and `dataRequests` state.
- Supabase and fallback export/anonymization paths now record legal ops ledger entries.
- App tests now include 63 tests.

## Phase 15: Safe Observability And Operational Health - Completed 2026-05-25

Goal: add safe internal operational health signals without connecting a monitoring vendor or exposing raw health data.

Work:

- Add an operational health snapshot helper.
- Count safe aggregate operational signals.
- Include production-pilot launch gate blocked status.
- Document future monitoring payload rules.

Done criteria:

- Snapshot includes only aggregate counts and launch gate ids.
- Snapshot excludes message bodies, prompts, channel identifiers, health profiles, audit metadata, provider credentials, and secrets.
- No external monitoring, analytics, logging, email, push, WhatsApp, Telegram, Gemini, or secret-manager integration is connected.

Status:

- Added `docs/PHASE_15_SAFE_OBSERVABILITY_OPERATIONAL_HEALTH_SPEC.md`.
- Added `docs/ERROR_MONITORING_POLICY.md`.
- Added `app/src/lib/operational-health.ts`.
- Added safe snapshot tests. App tests now include 66 tests.

## Phase 16: Channel Policy Simulation Hardening - Completed 2026-05-25

Goal: harden local channel-policy behavior before real WhatsApp or Telegram webhooks.

Work:

- Add mock channel policy preflight checks.
- Block missing provider event ids before client lookup or AI processing.
- Block empty channel message bodies before client lookup or AI processing.
- Handle explicit opt-out commands without entering the AI path.
- Keep audit metadata minimized.

Done criteria:

- Missing provider event id creates no messages, AI decisions, or risk assessments.
- Empty channel body creates no messages, AI decisions, or risk assessments.
- Matched-client opt-out commands set `channelPermission = opted_out`.
- Duplicate opt-out or empty-body provider events are ignored by idempotency.
- Channel policy audit metadata excludes raw message bodies and channel identifiers.
- Real WhatsApp, Telegram, Gemini, monitoring, email, push, secret manager, and real health data remain disconnected.

Status:

- Added `docs/PHASE_16_CHANNEL_POLICY_SIMULATION_HARDENING_SPEC.md`.
- Hardened `processMockChannelInbound()` with channel policy preflight checks.
- Added exact opt-out command handling for `STOP`, `DUR`, `IPTAL`, `IPTAL ET`, and `CANCEL`.
- Added channel adapter tests. App tests now include 70 tests.

## Phase 17: Provider Policy Guard And Prompt Boundary - Completed 2026-05-25

Goal: add a local provider payload boundary before any real LLM provider is connected.

Work:

- Add a runtime mock-provider input guard.
- Allow only `risk` and `client.dietPlan.summary` into mock provider input.
- Reject prompt/capsule/message/memory style payloads at the provider boundary.
- Reject red-risk provider calls as defense in depth.
- Convert provider policy violations into safe no-send simulator decisions.

Done criteria:

- Valid green and yellow mock provider calls still work.
- Raw prompt, capsule, message collection, memory, channel identity, health profile, clinical notes, and pinned notes cannot be passed into the mock provider input.
- Red-risk provider calls fail closed at the provider boundary.
- Simulator records provider policy violations as controlled failed-provider no-send decisions.
- Real Gemini, external LLMs, monitoring, analytics, secret manager, real channels, and real health data remain disconnected.

Status:

- Added `docs/PHASE_17_PROVIDER_POLICY_GUARD_PROMPT_BOUNDARY_SPEC.md`.
- Added `buildMockProviderInput()` and `assertMockProviderInputPolicy()`.
- Updated simulator provider calls to use the allowlisted provider input builder.
- Added provider and simulator tests. App tests now include 75 tests.

## Phase 18: Notification SLA And Internal Escalation - Completed 2026-05-25

Goal: add safe internal SLA signals for handoff notifications without external notification providers.

Work:

- Define local acknowledgement SLA thresholds for urgent and standard handoff notifications.
- Count unacknowledged open handoff notifications that breach SLA.
- Count urgent handoff notifications due for internal escalation.
- Add SLA counts to the safe operational health snapshot.
- Keep all output aggregate-only.

Done criteria:

- Acknowledged notifications are not counted as breaches.
- Notifications tied to resolved or missing handoff cases are ignored.
- Urgent notifications older than 15 minutes are counted as escalation due.
- Standard notifications older than 4 hours are counted as SLA breaches.
- Operational health exposes only aggregate SLA counts.
- Real email, push, WhatsApp, Telegram, monitoring, analytics, secret manager, and real health data remain disconnected.

Status:

- Added `docs/PHASE_18_NOTIFICATION_SLA_INTERNAL_ESCALATION_SPEC.md`.
- Added `app/src/lib/notification-sla.ts`.
- Added notification SLA tests.
- Extended operational health snapshot with SLA breach and urgent escalation counts.
- App tests now include 78 tests.

## Phase 19: Release Verification, CI Script, And Dependency Gate - Completed 2026-05-25

Goal: add a repeatable local release verification command and conservative dependency audit gate.

Work:

- Add a local release verification script.
- Run core package tests, lint, unit/API tests, production build, and production dependency audit from one command.
- Keep R-405 visible without applying breaking `npm audit fix --force`.
- Fail on unknown production audit findings.
- Keep RLS and visual tests as separate explicit checks.

Done criteria:

- `npm run release:verify` exists.
- The command passes when the only production audit findings are the documented R-405 Next.js/PostCSS findings.
- The command fails closed for malformed audit output, unknown production findings, or high/critical production findings.
- Dependency gate output states that R-405 remains a production launch blocker.
- No dependency upgrade, provider, real channel, monitoring, analytics, or real health data is connected.

Status:

- Added `docs/PHASE_19_RELEASE_VERIFICATION_DEPENDENCY_GATE_SPEC.md`.
- Added `app/scripts/release-verify.mjs`.
- Added app `release:verify` npm script.
- Phase 19 verification passed with 35 core tests, 78 app tests, and the known R-405 production audit warning.

## Phase 20: Pilot Readiness Evidence Pack - Completed 2026-05-25

Goal: collect pilot-foundation evidence without approving production launch gates.

Work:

- Create a pilot readiness evidence pack.
- Map all production-pilot launch gates to current internal evidence and remaining blockers.
- Record the latest release verification result.
- Keep external approval status explicit.

Done criteria:

- All eight launch gates are listed.
- Internal evidence and external approval are clearly separated.
- Production pilot remains blocked.
- R-405 remains open.
- No real provider, real channel, external notification, monitoring, secret manager, or real health data is connected.

Status:

- Added `docs/PHASE_20_PILOT_READINESS_EVIDENCE_PACK_SPEC.md`.
- Added `docs/PILOT_READINESS_EVIDENCE_PACK.md`.
- Evidence pack initially recorded the Phase 20 `npm run release:verify` result: 35 core tests, 78 app tests, lint, build, and known R-405 audit warning. The current evidence pack is updated later with the Phase 26 verification baseline.

## Phase 21: External Approval Dossier - In Progress

Goal: prepare external approval materials without approving launch gates or connecting real production systems.

Work:

- Create a Phase 21 PRD/tech spec before changing product behavior.
- Create a production-pilot gate closure dossier for all 8 launch gates.
- Record the latest 2026-05-28 `npm run release:verify` baseline.
- Keep R-405 open until a safe stable patch path exists or formal risk acceptance is provided.
- Keep real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, and real health data disconnected.

Done criteria:

- `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md` lists each gate, required evidence, internal evidence, missing external decision, acceptable approval artifact, and status.
- Planning and handoff docs point to external approval work as the next step.
- All gates remain open unless the user supplies external approval evidence.
- `npm run release:verify` passes with only the known R-405 production audit finding.

Status:

- Added `docs/PHASE_21_EXTERNAL_APPROVAL_DOSSIER_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`.
- Phase 21 verification on 2026-05-28 passed: 35 core tests, 78 app tests, lint, build, and known R-405 only.

## Phase 22: R-405 Dependency Remediation - Blocked Pending Stable Patch

Goal: resolve R-405 through a safe stable Next.js/PostCSS path, or keep the production launch gate blocked if no safe path exists.

Work:

- Document the R-405 remediation decision tree.
- Re-check npm metadata for `next@latest`, `next@canary`, and production audit output.
- Keep rejected fixes explicit: no `npm audit fix --force`, no canary baseline, no invalid override, and no major downgrade.
- Define the exact stable patch procedure for updating `next` and `eslint-config-next` together once a stable patched release exists.

Done criteria:

- If stable `next@latest` depends on `postcss >= 8.5.10`, update dependencies and require `npm run release:verify` plus clean production audit.
- If stable `next@latest` still depends on vulnerable PostCSS, do not change dependency files and keep R-405 open.
- R-405 cannot be marked resolved unless `npm audit --omit=dev --json` no longer reports the known findings.

Status:

- Added `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- 2026-05-31 check: `next@latest` is `16.2.6` with `postcss@8.4.31`; `eslint-config-next@latest` is `16.2.6`; `next@canary` remains rejected for pilot baseline.
- No dependency files were changed; R-405 remains an open production launch blocker.

## Phase 23: AI Context And Memory Architecture - Completed 2026-05-30

Goal: make the AI prompt context bounded, auditable, and fail-closed when the client references missing historical context.

Work:

- Add a PRD/tech spec before code changes.
- Compile a deterministic `PromptContext` with only allowlisted segments.
- Limit recent conversation context to the last 8 promptable messages plus rolling summary.
- Store/audit a `ContextManifest` without raw message text.
- Add the missing historical context invariant to system instructions.
- Guard provider output for `[ERROR: missing_historical_context]`.
- Block send/draft when the missing-history token appears and route to human takeover.
- Invalidate pending AI drafts when prompt-affecting context changes.
- Add Supabase schema fields for context revisions, memory revisions, provider output safety, token budget, and send status.

Done criteria:

- Manifest segments never contain raw client message text.
- Provider boundary receives only stripped context segments and risk.
- Missing historical context output is classified with `severity="block"`.
- Missing historical context creates `send_status="send_blocked"` and human takeover, with no client-facing AI message.
- Legacy or invalidated AI drafts cannot be approved without recompile/review.
- Real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, and real health data remain disconnected.

Status:

- Added `docs/PHASE_23_AI_CONTEXT_MEMORY_ARCHITECTURE_SPEC.md`.
- Added core `context-compiler.js`, prompt context rendering, context manifest metadata, and context compiler tests.
- Added provider output guard support for missing historical context block severity.
- Wired the simulator to use the bounded prompt context and safe provider boundary.
- Added draft invalidation and controlled 409 approval errors for stale/legacy drafts.
- Added Supabase migration `20260530000000_phase_23_context_send_safety.sql`.
- Phase 23 verification on 2026-05-30 passed: core tests 39/39, app tests 82/82, app lint, and production build.

## Phase 24: Dietitian Voice Sample Infrastructure - Completed 2026-05-30

Goal: collect approved dietitian message examples after onboarding and generate a reusable voice profile.

Status:

- Added `docs/PHASE_24_DIETITIAN_VOICE_SAMPLE_INFRASTRUCTURE_SPEC.md`.
- Added paste/TXT-style voice sample parsing, duplicate filtering, approval/rejection states, and 10-approved-sample generation threshold.
- Added voice sample/profile app state, fallback APIs, Supabase migration support, and dashboard `Voice` panel.
- Simulator now passes the generated dietitian voice profile to the core orchestrator when available.
- Added unit tests for parsing, duplicate handling, minimum threshold, and profile generation.

## Phase 25: Dynamic Client Form Infrastructure - Completed 2026-05-30

Goal: let the user define and later change client forms without losing old answers or leaking non-prompt fields to the LLM.

Status:

- Added `docs/PHASE_25_DYNAMIC_CLIENT_FORM_INFRASTRUCTURE_SPEC.md`.
- Added versioned form schemas, published-schema snapshots, client form responses, fallback APIs, Supabase migration support, and dashboard `Forms` panel.
- PromptContext now supports `client_form_summary`, built only from fields marked `prompt_allowed`.
- Saving a form response increments client context revision and invalidates pending AI drafts.
- Added tests for versioned responses, prompt allowlist behavior, and draft invalidation.

## Phase 26: Internal Dietitian Copilot - Completed 2026-05-30

Goal: add a read-only internal AI chat for dietitian teams using curated tenant-scoped database tools.

Status:

- Added `docs/PHASE_26_INTERNAL_COPILOT_SPEC.md`.
- Added app-state records for internal copilot messages, tool calls, and source refs.
- Added Supabase migration `20260530020000_phase_26_internal_copilot.sql` with tenant-scoped RLS policies.
- Added deterministic local/mock internal copilot tools for visible-client resolution, client snapshots, diet plans, recent messages, form responses, handoffs, and AI decision history.
- Added `/api/internal-copilot/messages` with `internal_copilot_chat` capability.
- Owner/admin/dietitian can use the internal copilot; assistant/auditor are blocked in v1.
- Added dashboard `Copilot` tab with source chips and no send-to-client action.
- Added tests for intent routing, ambiguous/hidden clients, source refs, prompt-injection-as-data behavior, fallback API persistence, RBAC, and Supabase state scoping.
- Re-verified on 2026-05-30 with `npm run release:verify`: core tests 39/39, app tests 96/96, lint passed, production build passed, and production dependency audit reported only the known R-405 findings.
- Updated the data inventory, provider requirements, dataset strategy, evidence pack, and production pilot dossier so Phase 26 records and provider-egress boundaries are explicit.
- No raw SQL, mutation tools, real provider, real channel, external notification, monitoring, secret manager, or real health data was connected.

## Phase 27: Dietitian Critical Context Updates - Completed 2026-05-30

Goal: let dietitians add confirmed client context from phone, Zoom, face-to-face, or other non-chat conversations so AI is not limited to WhatsApp/Telegram message history.

Status:

- Added `docs/PHASE_27_DIETITIAN_CONTEXT_UPDATE_SPEC.md`.
- Added `client_context_updates` app-state records and Supabase migration.
- Added `POST /api/clients/[id]/context-updates`.
- Added dashboard Critical Context panel on the selected client surface.
- Active context updates increment client context revision, invalidate pending drafts, and enter PromptContext as bounded `dietitian_context_update` segments.
- Newer `dietitian_manual` WhatsApp/Telegram/manual messages remain authoritative over older Critical Context records through the latest dietitian-authored source rule.
- ContextManifest remains raw-text-free and now preserves current inbound message id.
- Client export includes context updates; anonymization redacts them and marks them superseded.
- No old WhatsApp messages are rewritten; newer dietitian context supersedes older prompt context.
- No real provider, channel, external notification, monitoring, secret manager, or real health data was connected.
- Re-verified on 2026-05-31 with `npm run release:verify`: core tests 41/41, app tests 99/99, lint passed, production build passed, and production dependency audit reported only the known R-405 findings.

## Phase 28: AI Security Remediation - Completed 2026-05-31

Goal: close repo-level AI architecture/security audit findings before any real provider or channel integration.

Status:

- Added `docs/PHASE_28_AI_SECURITY_REMEDIATION_SPEC.md`.
- Added Supabase migration `20260530040000_ai_security_remediation.sql` for `provider_attempted`, provider-status invariants, tenant-aware channel/idempotency uniqueness, helper functions, and scoped RLS/RBAC policies.
- Provider no-call paths now record `providerAttempted=false`, `model=null`, `providerId=null`, and `providerStatus=not_called`.
- Actual mock-provider attempts record provider metadata, and only `MockProviderError` is normalized as provider failure.
- PromptContext segments now include source id, origin, timestamp, and authority metadata; the newest dietitian-authored source is explicitly marked authoritative across manual messages and Critical Context updates.
- Draft approve/edit-send now revalidates context revision, channel permission, takeover lock, AI mode/status, latest promptable message id, and memory version/revision/staleness before client-facing send.
- Provider input is guarded by an allowlisted segment boundary and fails closed for red risk, unknown/overlong segments, extra keys, raw prompts, capsules, and raw message/profile objects.
- Core declaration types now expose concrete CoreResult, PromptContext, ContextManifest, provider-attempt, activation, and mode decision contracts.
- Clinical golden coverage now includes typo/diacritic handling, English emergencies, medication dose requests, minor/body-image language, eating-disorder euphemisms, and pregnancy complications.
- Re-verified on 2026-05-31 with `npm run release:verify`: core tests 49/49, app tests 103/103, lint passed, production build passed, and production dependency audit reported only the known R-405 findings.

## Phase 29: Pilot Gate Closure And Evidence Hardening - Completed 2026-05-31

Goal: make the Phase 28-secured local prototype clearer for external review without adding features, connecting real providers/channels, approving launch gates, or resolving R-405.

Status:

- Added `docs/PHASE_29_PILOT_GATE_CLOSURE_EVIDENCE_HARDENING_SPEC.md`.
- Updated the production pilot dossier and evidence pack to use the Phase 27-28 baseline.
- Recorded the 2026-05-31 npm metadata check: stable `next@latest` remains 16.2.6 with `postcss@8.4.31`; `eslint-config-next@latest` remains 16.2.6.
- Confirmed no dependency files should change because no safe stable Next.js/PostCSS path exists.
- Recorded that the latest RLS run skipped because local Supabase was not configured; expanded RLS coverage remains an environment evidence item to rerun against local Supabase.
- Kept all eight production-pilot launch gates open.
- Re-verified on 2026-05-31 with `npm run release:verify`: core tests 49/49, app tests 103/103, lint passed, production build passed, and production dependency audit reported only the known R-405 findings.
- No real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, or real client health data was connected.

## Phase 30: Completion Roadmap Phase 1 - Checkpoint And Baseline - Completed 2026-05-31

Goal: implement Phase 1 of the 13-phase completion roadmap by making the Phase 27-29 checkpoint explicit and verifiable before continuing.

Status:

- Added `docs/PHASE_30_COMPLETION_PHASE_1_CHECKPOINT_BASELINE_SPEC.md`.
- Confirmed the working branch is `codex/phase-29-baseline-checkpoint`.
- Confirmed the starting checkpoint is `c75564e Add Phase 27-29 pilot readiness checkpoint`.
- Confirmed no runtime behavior, schema, dependency, provider, channel, launch-gate, or real-data changes are part of this phase.
- Re-verified with `npm run release:verify` after the documentation update.
- R-405 remains open and R-406 remains pending local Supabase RLS execution.

## Phase 31: Completion Roadmap Phase 2 - Local Supabase RLS Evidence - Blocked 2026-05-31

Goal: run the expanded local Supabase RLS suite and update R-406 with current evidence.

Status:

- Added `docs/PHASE_31_COMPLETION_PHASE_2_RLS_EVIDENCE_SPEC.md`.
- Confirmed the RLS test guard still skips non-local Supabase URLs unless `MANU_ALLOW_REMOTE_RLS_TESTS=true` is explicitly set.
- Confirmed `app/.env.local` is currently configured for a cloud Supabase URL, so it is not acceptable RLS evidence input by default.
- Attempted to start local Supabase with Supabase CLI `2.101.0`.
- Local Supabase start failed because Docker Desktop's Linux engine pipe was unavailable: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`.
- Ran `npm run test:rls`; it exited by skipping the guarded suite with 1 skipped file and 10 skipped tests.
- No passing RLS evidence was produced.
- R-406 remains blocked pending local Docker/Supabase availability.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria still unmet:

- Local Supabase starts successfully.
- Migrations are available in the local database.
- `npm run test:rls` runs the expanded 10-test suite instead of skipping.
- R-406 and evidence docs are updated only after a passing local RLS run.

## Phase 32: Completion Roadmap Phase 3 - R-405 Stable Patch Recheck - Completed 2026-05-31

Goal: re-check R-405 through the Phase 22 stable dependency remediation procedure.

Status:

- Added `docs/PHASE_32_COMPLETION_PHASE_3_R405_RECHECK_SPEC.md`.
- Re-read `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Ran `npm view next@latest version dependencies --json`.
- Ran `npm view eslint-config-next@latest version --json`.
- Ran `npm audit --omit=dev --json`.
- Confirmed `next@latest` is still `16.2.6`.
- Confirmed stable Next still depends on `postcss@8.4.31`, below the accepted `postcss >= 8.5.10` remediation threshold.
- Confirmed `eslint-config-next@latest` is still `16.2.6`.
- Confirmed production audit still reports only the known R-405 moderate `next`/`postcss` findings.
- No dependency files were changed.
- No `npm audit fix --force`, canary, override, major downgrade, provider, channel, launch-gate, or real-data change was made.
- R-405 remains open.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Latest npm metadata is recorded.
- Dependency files remain untouched because the accepted stable patch path is unavailable.
- R-405 remains a production launch blocker until a stable Next.js release bundles `postcss >= 8.5.10` or external formal risk acceptance is supplied.

## Phase 33: Completion Roadmap Phase 4 - External Approval Evidence Intake - Completed 2026-05-31

Goal: make external approval evidence collection actionable without approving production launch.

Status:

- Added `docs/PHASE_33_COMPLETION_PHASE_4_EXTERNAL_APPROVAL_INTAKE_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`.
- Mapped all eight canonical launch gate ids to required evidence, approval owner, acceptable artifact, current status, and notes.
- Confirmed no external approval artifacts were supplied in this phase.
- Kept all production-pilot launch gates open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- External review has a single intake packet for artifact tracking.
- The intake packet warns against repo storage of secrets, raw client health data, and real client identifiers.
- Internal evidence remains separated from external approval.

## Always-On Gates

- No real health data before legal/privacy review.
- No production messaging before WhatsApp/Telegram policy review.
- No real LLM provider call with health data before vendor-risk and retention review.
- No real-provider internal copilot egress before a separate provider, legal/privacy, security, and data-minimization review.
- No real-provider use of dietitian context updates before provider, legal/privacy, clinical, and data-minimization review.
- No fine-tuning on raw client messages.
- No tenant mixing in datasets or prompt retrieval.
- No raw health messages in external notification payloads.

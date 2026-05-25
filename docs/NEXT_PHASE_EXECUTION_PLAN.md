# MANU-AI Next Phase Execution Plan

## Current Position

MANU-AI is in pilot-foundation mode. The local SaaS/PWA prototype, Supabase-backed state, fallback store, simulator, risk assessment persistence, core safety tests, RLS guard, controlled API errors, and expanded dashboard visual smoke checks exist.

Real WhatsApp, Telegram, Gemini, and real client health data remain disconnected.

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

## Always-On Gates

- No real health data before legal/privacy review.
- No production messaging before WhatsApp/Telegram policy review.
- No real LLM provider call with health data before vendor-risk and retention review.
- No fine-tuning on raw client messages.
- No tenant mixing in datasets or prompt retrieval.
- No raw health messages in external notification payloads.

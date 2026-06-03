# MANU-AI Next Phase Execution Plan

## Current Position

MANU-AI is in pilot-foundation mode. The local SaaS/PWA prototype, Supabase-backed state, fallback store, simulator, risk assessment persistence, core safety tests, RLS guard, controlled API errors, expanded dashboard visual smoke checks, voice-profile workflow, dynamic client forms, read-only internal dietitian copilot, and dietitian-entered critical context updates exist.

Real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, and real client health data remain disconnected.

The most recent execution layers after the 13-phase completion roadmap are Phase 43 multilingual language support, Phase 44 red-risk reactivation lock, Phase 45 client removal data lifecycle, Phase 46 WhatsApp group quarantine, Phase 47 RLS quarantine evidence coverage, Phase 48 R-405 stable patch recheck, Phase 49 safety/orchestration hardening, Phase 50 production Supabase hardening, Phase 51 transactional RPC coverage, Phase 52 integration test coverage, Phase 53 scale/broad read contracts, Phase 54 R-405/launch-gate recheck, Phase 55 audit remediation safety boundary, Phase 56 clinical safety second-layer local evidence, Phase 57 yellow-risk hold/draft refresh, Phase 58 dietitian client language control, Phase 59 architecture review remediation, Phase 60 audit remediation, Phase 61 scope guard (RAG + LLM) second layer mock-first, and Phase 62 architecture review remediation wave 2. The production-pilot decision remains `NO-GO`: all eight launch gates remain open and R-405 remains open. R-406 is now mitigated in the local prototype after Docker Desktop/local Supabase was started, the Phase 50 migration was applied, and `npm run test:rls` passed with 19/19 tests on 2026-06-02. Draft review, form response, client context update, handoff status, and red-risk reactivation now use transactional RPC commits locally; remaining broad reads are classified in a test-covered contract, while client removal/anonymization bulk redaction and pagination implementation remain future production hardening work. R-310 is partially mitigated locally by deterministic second-layer evidence, Phase 57 yellow supervision, Phase 59 glucose/symptom hardening, and Phase 61 escalate-only scope guard (default no-op until approved corpus), but qualified dietitian approval, approved regulation corpus, and the clinical taxonomy launch gate remain open.

## Phase 49: Safety, Orchestration, And Concurrency Hardening - Completed (archive)

Goal: close the verified architecture-analysis gaps that should be handled before any real provider/channel connection or production pilot.

Planned work:

- Add `docs/PHASE_49_SAFETY_ORCHESTRATION_CONCURRENCY_HARDENING_SPEC.md`.
- Expand multilingual quality-guard output blocking across all supported response languages.
- Add persona output-contract checks for emoji and short-response constraints.
- Connect health-profile flags to classifier yellow escalation.
- Add cumulative risk analysis over recent promptable messages plus the current inbound message.
- Move reusable inbound preflight evaluation into the core package and reuse it from app paths.
- Add optimistic concurrency controls for Supabase-backed write paths.
- Add tenant/client scoped rate limiting for inbound, simulator, manual reply, draft review, and internal copilot paths.
- Add expired activation lazy cleanup/audit or safe notification behavior.
- Later split `simulator.ts` into domain modules and clean up legacy `buildReplyPrompt`.

Done criteria:

- All Phase 49 risks in `docs/RISK_REGISTER.md` are either mitigated in local prototype or explicitly accepted.
- Core/app tests cover the new safety, preflight, concurrency, rate-limit, and activation behavior.
- Red-risk and preflight-blocked flows still never call a provider.
- No real WhatsApp, Telegram, Gemini/external LLM, push/email, monitoring, secret manager, or real client health data is connected.

Status:

- Planned on 2026-06-02.
- Documentation/risk lock completed as the first Phase 49 step.
- Clinical output safety completed locally: multilingual quality guard and persona output-contract checks are implemented and covered by core tests.
- Core preflight extraction and cumulative yellow-risk escalation completed locally and are covered by core/app tests.
- Concurrency and abuse protection completed for the local prototype: Supabase client-row writes use expected `context_revision` checks with controlled `409 concurrent_state_update`, and simulator/mock-channel/manual/draft/internal-copilot entrypoints use scoped app-instance rate limits with controlled `429 rate_limit_exceeded`.
- Final local cleanup completed: health-profile flags now drive context-sensitive yellow escalation, expired activation windows lazily passivate clients with safe audit/notification signals, simulator risk/model routing lives in a dedicated module, and the unused legacy `buildReplyPrompt` export was removed.
- Remaining production hardening work: distributed production rate limiting, broader multi-table transaction/revision hardening, narrowed Supabase reads for scale, and external launch-gate approvals.

## Phase 50: Production Supabase Hardening - Completed (archive)

Goal: move the local hardening from Phase 49 toward production-shaped Supabase behavior without connecting real provider/channel infrastructure.

Status:

- Phase 50 plan created on 2026-06-02 with four phases: Supabase RPC/foundation, app integration, narrowed Supabase reads, and launch-gate evidence/docs.
- Phase 1 foundation added migration `app/supabase/migrations/20260602030000_phase_50_production_hardening_foundation.sql` for database-backed rate-limit buckets and transactional commit RPC wrappers. On 2026-06-02, `npx supabase db reset --local` applied the migration to local Supabase and DB checks confirmed the rate-limit/RPC foundation exists.
- Phase 2 app integration is complete for the currently targeted local mutation paths: app entrypoints call the async scoped rate limiter, Supabase-backed limiter RPC is wired with hashed keys, and manual reply plus client-scoped inbound simulation use commit RPCs. Phase 51 added transactional message, AI-decision, handoff, form-response, and client-context update payload support for draft review, form response save, client context update, handoff status update, and red-risk reactivation.
- Phase 3 narrowed Supabase reads is partially complete: manual reply, client-scoped inbound simulation, draft approval/dismissal, human takeover release, handoff status update, red-risk reactivation, client form response save, and client context update now use client/handoff/draft scoped operation loaders instead of full tenant state reads before mutation. The scoped loaders explicitly include required target messages, decisions, handoffs, form schemas, draft messages, and draft decision rows needed for existing validation/invalidation behavior.
- Form response saves now persist changed draft invalidations after form-change state updates.
- Validation completed locally after Phase 3 changes: `app npm test` passed 126/126, `app npm run lint` passed, and `dietitian-ai-assistant npm test` passed 57/57.
- Phase 4 launch-gate evidence/docs completed locally on 2026-06-02: added `docs/PHASE_50_PRODUCTION_SUPABASE_HARDENING_EVIDENCE_SPEC.md`, updated the pilot evidence pack, gate closure dossier, final readiness summary, risk register, and handoff notes.
- Phase 4 verification: `npm run release:verify` passed from `app` with core tests 57/57, app tests 126/126, lint, production build, and only documented R-405 findings. `npm run test:rls` passed against local Supabase with 1 file and 11/11 tests, so R-406 is mitigated in the local prototype.
- Phase 51 transactional RPC coverage completed locally on 2026-06-02: added `docs/PHASE_51_TRANSACTIONAL_RPC_COVERAGE_SPEC.md`, extended `manu_commit_state_delta` with `messageUpdates`, `aiDecisionUpdates`, and `handoffUpdates`, added `commit_handoff_status`, moved draft review, form response save, client context update, handoff status update, and red-risk reactivation to RPC commits, and expanded local RLS coverage to 14/14 passing tests.
- Phase 52 integration test coverage completed locally on 2026-06-02: added `docs/PHASE_52_INTEGRATION_TEST_COVERAGE_SPEC.md`, expanded local Supabase integration coverage for rate-limit isolation, controlled rate-limit denial, stale revision rejection, and manual/inbound RPC atomicity, and expanded local RLS/integration coverage to 19/19 passing tests.
- Phase 53 scale/broad read contracts completed locally on 2026-06-02: added `docs/PHASE_53_SCALE_BROAD_READ_CONTRACTS_SPEC.md`, `app/src/lib/supabase-read-contracts.ts`, and tests that classify intentional broad legal/admin reads, future paginated dashboard/copilot/client create/patch reads, and already scoped mutation reads. `npm run release:verify` passed with core tests 57/57, app tests 130/130, lint, production build, and only documented R-405 findings.
- Phase 54 R-405 and launch gates recheck completed locally on 2026-06-02: added `docs/PHASE_54_R405_AND_LAUNCH_GATES_RECHECK_SPEC.md`, re-ran the Phase 22 stable dependency procedure, confirmed stable `next@latest` 16.2.7 still bundles nested `postcss@8.4.31`, confirmed production audit still reports only known R-405 findings, made no dependency changes, and kept all eight launch gates open because no external approval artifacts were supplied. `npm run release:verify` passed with core tests 57/57, app tests 130/130, lint, production build, and only documented R-405 findings.
- Phase 55 audit remediation safety boundary completed locally on 2026-06-03: added `docs/PHASE_55_AUDIT_REMEDIATION_SAFETY_BOUNDARY_SPEC.md`, hardened real Turkish Unicode classifier normalization, expanded multilingual pregnancy/lactation yellow routing, added prompt-injection yellow review routing, wrapped client-authored PromptContext text as data, kept safety-critical pinned notes untruncated, and added red-risk preflight regression coverage. `npm run release:verify` passed with core tests 72/72, app tests 132/132, lint, production build, and only documented R-405 findings.
- Phase 56 clinical safety second-layer local evidence completed locally on 2026-06-03: added `docs/PHASE_56_CLINICAL_SAFETY_SECOND_LAYER_LOCAL_EVIDENCE_SPEC.md`, introduced deterministic second-layer yellow escalation for context-sensitive uncertainty, recorded combined classifier evidence, and kept real LLM/provider/channel/schema/launch-gate changes out of scope. R-310 is partially mitigated in the local prototype only.
- Phase 57 yellow-risk hold/draft refresh completed locally in code on 2026-06-03: added `docs/PHASE_57_YELLOW_RISK_HOLD_DRAFT_REFRESH_SPEC.md`, introduced `yellowRiskHold`, passivated AI on yellow risk, refreshed the same pending draft for later green/yellow messages, preserved the yellow draft when later red risk creates a manual lock, and added `clients.yellow_risk_hold` migration/RPC support. Verification passed with app simulator tests 34/34, app tests 135/135, core tests 75/75, app lint, and `npm run release:verify`. Local Supabase/RLS evidence remains open because Docker Desktop Linux engine was unavailable; `npx supabase db reset --local` failed before applying the Phase 57 migration and `npm run test:rls` skipped 20/20 tests.
- Phase 58 dietitian client language control completed locally on 2026-06-03: added `docs/PHASE_58_DIETITIAN_CLIENT_LANGUAGE_CONTROL_SPEC.md`, synchronized client creation/profile language fields, made language changes prompt-affecting, and verified subsequent AI replies use the dietitian-selected language. Targeted verification passed with 54/54 tests.
- Phase 59 architecture review remediation completed locally on 2026-06-03: added `docs/PHASE_59_ARCHITECTURE_REVIEW_REMEDIATION_SPEC.md`, fail-closed unknown AI modes, core provider error boundary, clinical taxonomy hardening, simulator yellow-hold helper refactor, multilingual voice-profile scoring, and provider-native token counting documented as a future gate. Verification passed with core tests 85/85, app tests 137/137, app lint, and `npm run release:verify`. No schema/RLS, dependency, real provider, channel, launch-gate, or R-405 changes.
- Phase 60 audit remediation completed locally on 2026-06-03: added `docs/PHASE_60_AUDIT_REMEDIATION_SPEC.md`, fixed glucose false-positive extraction (`dietetic-risk-v0.3.1`), core `providerOutputSafety` on provider failures, architecture type-contract alignment, expanded tests, and documentation continuity updates. Verification passed with core tests 104/104, app tests 138/138, app lint, and `npm run release:verify`.
- Phase 62 architecture review remediation wave 2 completed locally on 2026-06-04: added `docs/PHASE_62_ARCHITECTURE_REVIEW_REMEDIATION_WAVE2_SPEC.md`, provider-failure dietitian handoff (no client send), shared `normalizeSafetyText`, overlap scope retrieval, glucose cost-unit filter, constraint-accepted notes for Bulgu 3/9/10. Verification passed with core tests 114/114, app tests 150/150, app lint, and `npm run release:verify`. Bulgu 1 unchanged by product decision.
- Phase 61 scope guard (RAG + LLM) second layer mock-first completed locally on 2026-06-04: added `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`, core `scope-guard.js` escalate-only merge, app mock lexical retrieval + deterministic evaluator + runtime wiring after `classifySimulationRisk`, Supabase `scope_rules` / `scope_rule_chunks` / `scope_guard_evaluations` migration with RLS, placeholder draft corpus (inactive by default), operational-health corpus signals, launch-gate scope corpus evidence on `clinical_taxonomy_approval`, and disconnected real embedding/LLM seams. Verification passed with core tests 112/112, app tests 150/150, app lint, and `npm run release:verify`. Real Gemini/embedding not connected; production pilot remains `NO-GO`.

## Phase 62: Architecture Review Remediation Wave 2 - Completed 2026-06-04

Goal: remediate actionable post–Phase 61 architecture findings without changing Bulgu 1 (passive/manual red routing) or connecting real providers.

Status:

- Provider failure on active clients → `handoff` + dietitian notification; no client-facing AI reply.
- Shared `normalize-safety-text.js`; overlap retrieval; glucose TL/lira skip; `modelForRisk` removed.
- Bulgu 3/9/10 documented as constraint-accepted in RISK_REGISTER and Phase 62 spec.
- Verification: core 114/114, app 150/150, `npm run release:verify` passed (R-405 only).

Remaining:

- Design a dedicated transactional payload for client removal/anonymization bulk redaction before moving that lifecycle fully to RPC commits.
- Implement dashboard/internal-copilot pagination and client create/patch scoped reloads only after accepting the Phase 53 contracts; keep that work separate from mutation refactors.
- Approve and load real dietetic-regulation corpus via `clinical_taxonomy_approval` before scope guard is active in production-shaped pilots.
- Re-run `npm run test:rls` against local Supabase when available to record Phase 61 `scope_*` table RLS evidence.
- Keep all eight production-pilot launch gates open until external approval artifacts are supplied.

## Phase 61: Scope Guard (RAG + LLM) Second Layer Mock-First - Completed 2026-06-04

Goal: add an independent second safety axis for dietetic-regulation (scope) tasks using mock-first RAG-shaped retrieval and a deterministic evaluator, merged escalate-only with the existing classifier, without connecting real Gemini/embedding.

Planned work:

- Add `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`.
- Add core `dietitian-ai-assistant/src/scope-guard.js` (`mergeScopeDecision`, `applyScopeRules`, `SCOPE_GUARD_VERSION`).
- Add app corpus governance, mock lexical `RetrievalProvider`, mock `ScopeEvaluator`, and `scope-guard-runtime` wiring after `classifySimulationRisk`.
- Add Supabase `scope_rules`, `scope_rule_chunks`, `scope_guard_evaluations` with tenant read / system write RLS.
- Add placeholder draft corpus (inactive by default), operational-health signals, and launch-gate scope corpus evidence on `clinical_taxonomy_approval`.
- Keep real embedding/LLM disconnected behind env + gate (`MANU_ALLOW_REAL_SCOPE_GUARD=true`).

Done criteria:

- Core and app tests cover escalate-only merge, no-op on empty/unapproved corpus, fail-safe unavailable escalation, and prompt-injection-as-data boundaries.
- `npm run release:verify` passes with only documented R-405 findings.
- Production pilot remains `NO-GO`; no launch gate closed; R-405 untouched.

Status:

- Completed locally on 2026-06-04.
- Verification: core tests 112/112, app tests 150/150, app lint, `npm run release:verify` passed.
- R-310 partially mitigated in local prototype; qualified dietitian taxonomy and approved regulation corpus still required for production.

## Phase 48: R-405 Stable Patch Recheck - Completed 2026-06-01

Goal: re-check whether a safe stable Next.js/PostCSS remediation path exists before any dependency edit.

Status:

- Added `docs/PHASE_48_R405_STABLE_PATCH_RECHECK_SPEC.md`.
- Ran `npm view next@latest version dependencies --json`.
- Ran `npm view eslint-config-next@latest version --json`.
- Ran `npm audit --omit=dev --json`.
- Confirmed `next@latest` is `16.2.7`.
- Confirmed stable Next still bundles nested `postcss@8.4.31`.
- Confirmed `eslint-config-next@latest` is `16.2.7`.
- Confirmed production audit still reports only the known moderate R-405 `next`/`postcss` findings.
- No dependency files were changed.
- R-405 remains open.

## Phase 47: RLS Quarantine Evidence Coverage - Completed 2026-06-01; R-406 Still Blocked

Goal: include the Phase 46 `inbound_quarantines` table in the expanded RLS evidence suite.

Status:

- Added `docs/PHASE_47_RLS_QUARANTINE_EVIDENCE_SPEC.md`.
- Added `inbound_quarantines` fixtures to the Supabase RLS integration test.
- Added tenant-member, outsider, assistant, auditor, and cross-tenant write checks for quarantine rows.
- Added Supabase-backed group quarantine persistence coverage.
- `npm run lint` passed from `app`.
- `npm run test` passed from `app`: 16 files, 117 tests.
- `npm run test:rls` skipped 1 file and 11 guarded tests because Docker Desktop's Linux engine is unavailable.
- R-406 remains blocked until the expanded 11-test suite passes against local Supabase.

## Phase 46: WhatsApp Group Quarantine - Completed 2026-06-01

Goal: ensure WhatsApp group messages are treated as unsupported high-risk inbound context and never reach client-specific AI processing.

Work:

- Added `InboundQuarantineRecord`.
- Added Supabase `inbound_quarantines` table.
- Added simulator support for `sourceConversationType="group"`.
- Group messages are quarantined before client lookup, risk classification, context assembly, provider call, message storage, AI decision, risk assessment, or handoff creation.
- Group quarantine records store only minimized provenance metadata and never raw group message text.
- Added `inbound_group_message_quarantined` audit event.
- Duplicate group events remain idempotent.

Done criteria:

- Group messages cannot be promptable.
- Group messages cannot cause automatic replies or drafts.
- Group messages cannot be accidentally attached to one client identity.
- No real provider, channel, launch-gate approval, or real health-data connection is introduced.

Status:

- Completed locally on 2026-06-01.
- `npm run lint` passed from `app`.
- `npm run test` passed from `app`: 16 files, 117 tests.
- `npm run release:verify` passed from `app`: core tests 52/52, app tests 117/117, lint, production build, known R-405 only.
- R-405 remains open and R-406 remains blocked.

## Phase 45: Client Removal Data Lifecycle - Completed 2026-06-01

Goal: make "remove client" a soft-delete/anonymization operation that hides the client from normal operations and clears promptable health/channel/message/form/memory data while retaining minimized legal/audit metadata.

Work:

- Added `ClientRecord.lifecycleStatus` and `removedAt`.
- Added Supabase `clients.lifecycle_status` and `removed_at`.
- Added `/api/clients/[id]/remove` and dashboard remove action.
- Removed clients are hidden from normal dashboard client lists and simulator selection.
- Removed clients are blocked from inbound simulation, manual replies, profile edits, form response save, and internal copilot tools.
- Removal redacts promptable profile, phone/channel identifiers, memory summaries, messages, form response answers/submitted phone, context updates, handoff text, notification text, AI decision details, risk assessment reasons, and active red-risk/takeover state.
- Removal records a completed `deletion` data request and `client_removed_anonymized` audit event.

Done criteria:

- Removed clients cannot remain in promptable context.
- Removed clients cannot be matched through normal dashboard/client-facing operations.
- Export remains available as a minimized legal/audit bundle.
- Hard delete remains legal-review gated.
- No real provider, channel, launch-gate approval, or real health-data connection is introduced.

Status:

- Completed locally on 2026-06-01.
- `npm run lint` passed from `app`.
- `npm run test` passed from `app`: 16 files, 114 tests.
- `npm run release:verify` passed from `app`: core tests 52/52, app tests 114/114, lint, production build, known R-405 only.
- R-405 remains open and R-406 remains blocked.

## Phase 44: Red-Risk Reactivation Lock - Completed 2026-06-01

Goal: prevent AI from re-entering a clinically sensitive red-risk conversation until the dietitian explicitly closes the handoff and reactivates AI.

Work:

- Added `ClientRecord.redRiskLock` and Supabase `clients.red_risk_lock`.
- Red-risk handoff creation now forces `aiStatus=passive`, `aiMode=manual`, and `humanTakeoverLocked=true`.
- Direct AI reactivation, takeover release, normal handoff resolution, and red-locked handoff dismissal are blocked while the lock is active.
- Manual dietitian replies and notification acknowledgement do not clear the lock.
- Added `POST /api/handoffs/[id]/resolve-and-reactivate` for explicit dietitian reactivation with a required resolution reason.
- Dashboard handoff queue now shows a red-risk reactivation control; copilot is the default reactivation mode and autopilot requires completed mandatory safety.

Done criteria:

- Red-risk locks are created and audited.
- No LLM path is reachable while a red-risk lock is active.
- Reactivation is auditable and tied to the handoff, dietitian, timestamp, reason, and selected AI mode.
- No real provider, channel, launch-gate approval, or real health-data connection is introduced.

Status:

- Completed locally on 2026-06-01.
- `npm run lint` passed from `app`.
- `npm run test` passed from `app`: 16 files, 112 tests.
- `npm run release:verify` passed from `app`: core tests 52/52, app tests 112/112, lint, production build, known R-405 only.
- R-405 remains open and R-406 remains blocked.

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
- Re-verified documentation-only changes with `npm run release:verify` after clearing a transient Windows/OneDrive `.next` EPERM build artifact: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- External review has a single intake packet for artifact tracking.
- The intake packet warns against repo storage of secrets, raw client health data, and real client identifiers.
- Internal evidence remains separated from external approval.

## Phase 34: Completion Roadmap Phase 5 - Legal And Privacy Review Packet - Completed 2026-05-31

Goal: prepare the `legal_privacy_review` launch gate for external legal/privacy review.

Status:

- Added `docs/PHASE_34_COMPLETION_PHASE_5_LEGAL_PRIVACY_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`.
- Mapped legal/privacy review questions to current internal artifacts, including data inventory, data governance, legal ops ledger, internal copilot, dietitian context updates, and AI security remediation.
- Listed required counsel decisions for lawful basis, privacy notice, permission flow, medical-device/CDS classification, retention, DSAR/deletion, internal copilot records, dietitian context updates, provider dependency, and channel dependency.
- Confirmed no legal/privacy approval artifact was supplied in this phase.
- Kept `legal_privacy_review` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.

Done criteria:

- Legal/privacy counsel has a review packet that separates internal implementation evidence from external approval.
- The packet warns against storing secrets, raw client health data, and real client identifiers in repo docs.
- The production-pilot legal/privacy gate remains open until acceptable external approval evidence is supplied.

## Phase 35: Completion Roadmap Phase 6 - Clinical Taxonomy Review Packet - Completed 2026-05-31

Goal: prepare the `clinical_taxonomy_approval` launch gate for qualified dietitian review.

Status:

- Added `docs/PHASE_35_COMPLETION_PHASE_6_CLINICAL_TAXONOMY_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`.
- Summarized current green/yellow/red golden case coverage and expected behavior.
- Mapped internal evidence to the required qualified dietitian sign-off artifact.
- Confirmed no qualified dietitian approval artifact was supplied in this phase.
- Kept `clinical_taxonomy_approval` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No classifier, golden-case, runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Qualified dietitian reviewer has a packet that separates internal test evidence from external clinical approval.
- The packet warns against storing real client messages, identifiers, medical records, provider payloads, or secrets in repo docs.
- The production-pilot clinical taxonomy gate remains open until acceptable qualified dietitian approval evidence is supplied.

## Phase 36: Completion Roadmap Phase 7 - Provider Vendor Review Packet - Completed 2026-05-31

Goal: prepare the `provider_vendor_review` launch gate for external vendor, legal, and security review.

Status:

- Added `docs/PHASE_36_COMPLETION_PHASE_7_PROVIDER_VENDOR_REVIEW_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`.
- Mapped current local/mock provider controls to required vendor, retention, logging, training-use, region, access-control, and incident-obligation decisions.
- Confirmed no provider/vendor approval artifact was supplied in this phase.
- Kept `provider_vendor_review` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel, credential, launch-gate approval, logging-vendor, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Vendor/legal/security reviewers have a packet that separates internal provider-boundary evidence from external vendor approval.
- The packet warns against storing provider secrets, real client identifiers, raw client health messages, real provider prompts/completions, or non-repository contract text in repo docs.
- The production-pilot provider/vendor gate remains open until acceptable external approval evidence is supplied.

## Phase 37: Completion Roadmap Phase 8 - Channel Policy Review Packet - Completed 2026-05-31

Goal: prepare the `channel_policy_review` launch gate for external WhatsApp and Telegram platform-policy review.

Status:

- Added `docs/PHASE_37_COMPLETION_PHASE_8_CHANNEL_POLICY_REVIEW_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`.
- Mapped current mock WhatsApp/Telegram channel controls to required healthcare-use, opt-in/out, template, service-window, webhook, delivery-status, account-quality, and fallback decisions.
- Confirmed no channel policy approval artifact was supplied in this phase.
- Kept `channel_policy_review` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel integration, webhook, credential, template registry, launch-gate approval, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Platform/policy reviewers have a packet that separates internal mock-channel evidence from external WhatsApp/Telegram approval.
- The packet warns against storing channel secrets, real phone numbers, Telegram user ids, raw client health messages, production webhook payloads, or non-repository platform review text in repo docs.
- The production-pilot channel policy gate remains open until acceptable external approval evidence is supplied.

## Phase 38: Completion Roadmap Phase 9 - Incident And DSAR Review Packet - Completed 2026-05-31

Goal: prepare the `incident_response_runbook` launch gate for external operations, legal, privacy, and clinical review.

Status:

- Added `docs/PHASE_38_COMPLETION_PHASE_9_INCIDENT_DSAR_REVIEW_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`.
- Mapped the draft incident runbook, DSAR/export/anonymization skeleton, legal ops ledger, and safe operational health evidence to required owner, escalation, notification, DSAR/deletion, breach, and re-enable decisions.
- Confirmed no incident/DSAR approval artifact was supplied in this phase.
- Kept `incident_response_runbook` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel, monitoring, notification, ticketing, launch-gate approval, owner assignment, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Operations/legal/privacy/clinical reviewers have a packet that separates internal draft runbook evidence from external operating procedure approval.
- The packet warns against storing real client identifiers, raw client health messages, production incident payloads, credentials, private security contacts, or sensitive legal communications in repo docs.
- The production-pilot incident/DSAR gate remains open until acceptable external approval evidence is supplied.

## Phase 39: Completion Roadmap Phase 10 - Backup Restore Review Packet - Completed 2026-05-31

Goal: prepare the `backup_restore_test` launch gate for external operations, security, and legal review.

Status:

- Added `docs/PHASE_39_COMPLETION_PHASE_10_BACKUP_RESTORE_REVIEW_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`.
- Mapped the draft backup/restore runbook to required provider, region, retention, restore-drill, encryption, legal-hold, tenant-isolation, RLS, data-governance, and drill evidence decisions.
- Confirmed no backup/restore approval artifact or restore-drill evidence was supplied in this phase.
- Kept `backup_restore_test` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel, backup provider, storage, secret manager, infrastructure, launch-gate approval, restore drill, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Operations/security/legal reviewers have a packet that separates internal draft backup/restore evidence from external restore-drill approval.
- The packet warns against storing backup credentials, real client identifiers, raw client health data, production snapshot contents, restore credentials, or sensitive legal-hold artifacts in repo docs.
- The production-pilot backup/restore gate remains open until acceptable external approval evidence is supplied.

## Phase 40: Completion Roadmap Phase 11 - Secret Rotation Review Packet - Completed 2026-05-31

Goal: prepare the `secret_rotation_plan` launch gate for external security and operations review.

Status:

- Added `docs/PHASE_40_COMPLETION_PHASE_11_SECRET_ROTATION_REVIEW_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`.
- Mapped the draft secret rotation runbook to required secret manager, inventory, owner, cadence, emergency revocation, break-glass, access-review, health-check, smoke-test, and evidence decisions.
- Confirmed no secret-rotation approval artifact, production secret manager, or rotation evidence was supplied in this phase.
- Kept `secret_rotation_plan` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel, backup provider, storage, secret manager, infrastructure, credential, launch-gate approval, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Security/operations reviewers have a packet that separates internal draft secret-rotation evidence from external signed secret-rotation approval.
- The packet warns against storing secret values, token prefixes, connection strings, provider credentials, webhook secrets, database passwords, private deployment URLs, or secret-bearing logs in repo docs.
- The production-pilot secret rotation gate remains open until acceptable external approval evidence is supplied.

## Phase 41: Completion Roadmap Phase 12 - Dependency Audit Clearance Packet - Completed 2026-05-31

Goal: prepare the `dependency_audit_clearance` launch gate for engineering/security review and re-check R-405 through the accepted stable Next.js/PostCSS procedure.

Status:

- Added `docs/PHASE_41_COMPLETION_PHASE_12_DEPENDENCY_AUDIT_CLEARANCE_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md`.
- Re-read `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Ran `npm view next@latest version dependencies --json`.
- Ran `npm view eslint-config-next@latest version --json`.
- Ran `npm audit --omit=dev --json`.
- Confirmed stable `next@latest` remains `16.2.6` with nested `postcss@8.4.31`.
- Confirmed `eslint-config-next@latest` remains `16.2.6`.
- Confirmed production audit still reports only the known moderate R-405 `next`/`postcss` findings.
- No dependency files were changed.
- No dependency clearance or formal R-405 risk acceptance was supplied.
- Kept `dependency_audit_clearance` open.
- Kept R-405 open.
- Kept R-406 blocked.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Engineering/security reviewers have a packet that separates current dependency audit evidence from external remediation or formal risk acceptance.
- The packet warns against rejected paths: `npm audit fix --force`, `next@9.3.3`, canary/beta/rc baseline, invalid overrides, and self-approval of R-405.
- The production-pilot dependency audit gate remains open until acceptable technical remediation or external formal risk acceptance is supplied.

## Phase 42: Completion Roadmap Phase 13 - Final Readiness Closure - Completed 2026-05-31

Goal: close the 13-phase completion roadmap with a final production-pilot readiness summary and go/no-go decision record.

Status:

- Added `docs/PHASE_42_COMPLETION_PHASE_13_FINAL_READINESS_CLOSURE_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`.
- Recorded the current production-pilot decision as `NO-GO`.
- Confirmed all eight production-pilot launch gates remain open.
- Confirmed R-405 remains open.
- Confirmed R-406 remains blocked.
- Confirmed no external approval artifacts were supplied during the completion roadmap.
- No runtime behavior, schema, dependency, provider, channel, monitoring, secret manager, backup provider, launch-gate approval, R-405 acceptance, R-406 mitigation, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- The final closure summary separates internal readiness evidence from production-pilot approval.
- The summary lists the remaining blockers and next required actions.
- Production pilot remains blocked until acceptable external approval evidence, R-405 clearance or acceptance, and R-406 passing local RLS evidence are supplied.

## Phase 43: Multilingual Language Support - Completed 2026-05-31

Goal: add deterministic support for Turkish, English, German, French, Spanish, Portuguese, and Czech across dashboard preferences, client identity, dynamic forms, prompt context, local/mock provider behavior, and safety tests.

Status:

- Added `docs/PHASE_43_MULTILINGUAL_LANGUAGE_SUPPORT_SPEC.md`.
- Added canonical supported-language and strict E.164 phone helpers.
- Added per-dietitian dashboard UI language preference.
- Added per-client `primaryPhoneE164` and `communicationLanguage`.
- Added form schema/response `languageCode` and response `submittedPhoneE164`.
- Added a Supabase migration for the new language/phone fields and tenant-scoped non-null phone uniqueness.
- Updated fallback and Supabase stores, API routes, and dashboard controls for client phone/language, form language, and dietitian dashboard language.
- Updated PromptContext with a bounded `conversation_language` segment and ContextManifest language metadata.
- Updated local/mock provider replies and handoff safe acknowledgements to use the stored client language.
- Expanded multilingual safety patterns and clinical golden cases without approving the clinical taxonomy launch gate.
- Re-verified with `npm run release:verify`: core tests 52/52, app tests 107/107, lint, production build, and only documented R-405 findings.
- No automatic translation, public form link, real provider, real channel, external translation service, monitoring, secret manager, backup provider, or real client health data was connected.
- Production pilot remains `NO-GO`; all eight launch gates remain open; R-405 remains open; R-406 remains blocked.

Done criteria:

- Supported-language validation exists at app/core boundaries.
- Form responses update client conversation language and invalidate stale drafts.
- Provider allowlist accepts only the bounded `conversation_language` segment rather than raw client/profile objects.
- Dashboard language controls are available for dietitian UI, client communication language, and form language.
- Multilingual behavior is covered by app tests and core clinical golden tests.

## Always-On Gates

- No real health data before legal/privacy review.
- No production messaging before WhatsApp/Telegram policy review.
- No real LLM provider call with health data before vendor-risk and retention review.
- No real-provider internal copilot egress before a separate provider, legal/privacy, security, and data-minimization review.
- No real-provider use of dietitian context updates before provider, legal/privacy, clinical, and data-minimization review.
- No fine-tuning on raw client messages.
- No tenant mixing in datasets or prompt retrieval.
- No raw health messages in external notification payloads.

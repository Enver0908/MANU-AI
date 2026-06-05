# MANU-AI Plan

## Project Summary

MANU-AI is a supervised AI messaging assistant for dietitians. It helps dietitians answer routine client messages over WhatsApp and Telegram, while preserving strict client isolation and escalating risky nutrition or health messages to the dietitian.

The product must be both:

- A web dashboard for full management.
- A mobile-installable app experience, starting as a PWA and later becoming native iOS/Android if the pilot validates it.

The current implementation is an architecture/core package, not yet the full SaaS app.

## Workspace

All project files are under:

```text
C:\Users\Dell\OneDrive\Masaüstü\MANU-AI
```

Important files:

- `PLAN.md`: current canonical plan.
- `PROJECT_PLAN.md`: long detailed roadmap and launch gates.
- `HANDOFF_FOR_NEXT_CODEX.md`: continuation file for a new Codex chat.
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`: current phased execution plan and done criteria.
- `docs/DATA_INVENTORY.md`: data categories and prompt allowlist.
- `docs/DATASET_STRATEGY.md`: how to use dietitian/manual/AI message data.
- `docs/MOBILE_APP_STRATEGY.md`: web + PWA + native mobile path.
- `docs/RISK_REGISTER.md`: current risk register.
- `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`: scope guard (RAG + LLM) second layer PRD/tech spec.
- `docs/PHASE_62_ARCHITECTURE_REVIEW_REMEDIATION_WAVE2_SPEC.md`: post-review remediation (provider handoff, normalization, overlap retrieval, glucose tuning).
- `docs/PLAN_GAP_AUDIT.md`: audit history of plan gaps.
- `dietitian-ai-assistant/`: testable core architecture package.

## Core Product Decisions

### Interface

Dietitians manage everything from MANU-AI:

- Web dashboard for full operations.
- Mobile PWA for phone use.
- Future native app through React Native/Expo after validation.

WhatsApp and Telegram are client communication channels, not the main control surface.

### AI Activation

AI is not always on.

Each client has:

- `aiStatus`: `active` or `passive`
- optional `aiActiveFrom`
- optional `aiActiveUntil`
- `aiMode`: `autopilot`, `copilot`, `manual`, or `paused`

The dietitian can activate or deactivate AI for any client at any time.

If `aiStatus` is `passive`, the system stores and audits messages but does not generate an AI reply or draft.

### AI Modes

When AI is active:

- `autopilot`: green messages may be sent automatically.
- `copilot`: AI drafts only; dietitian approves before send.
- `manual`: no AI generation.
- `paused`: AI is suspended due to risk, handoff, or dietitian choice.

There is no fixed two-week copilot period.

### Risk Routing

Every inbound client message is classified:

- `green`: routine, safe message.
- `yellow`: review-required message.
- `red`: risky message requiring human handoff.

Routing:

- Green + active autopilot: can auto-send after quality guard.
- Green + copilot: draft for approval.
- Yellow: AI becomes passive/paused and creates one dietitian approval draft.
- Red: no LLM call; handoff to dietitian.
- Passive AI: no AI generation.

Clinical safety evaluation (three independent axes; escalate-only merge):

1. **Regex/deterministic classifier** (`dietetic-risk-v0.3.1`) — primary green/yellow/red routing.
2. **Clinical safety second layer** (`clinical-safety-second-layer-v0.1.0`) — deterministic context-sensitive yellow escalation above regex-only green.
3. **Scope guard** (`scope-rag-v0.1.0`) — dietetic-regulation corpus retrieval + evaluation in app; monotonic merge in core `scope-guard.js`. Default seed corpus is draft-only, so scope guard is a **no-op** until qualified dietitian approval loads an approved corpus. Real embedding/LLM remain disconnected until `clinical_taxonomy_approval` and `MANU_ALLOW_REAL_SCOPE_GUARD=true`.

Combined version string when all layers apply: `dietetic-risk-v0.3.1+clinical-safety-second-layer-v0.1.0+scope-rag-v0.1.0`.

Scope guard rules:

- Scope guard never downgrades risk (no red/yellow → green).
- Escalation level (`yellow` or `red`) comes from each approved regulation rule, not a global default.
- Evaluator/retrieval failure fail-safe escalates to yellow with reason `scope_guard_unavailable`.
- Audit records store rule ids and scores only (no raw client message text).
- Regulation corpus is system-level, tenant read-only; not client-owned data.

Yellow-risk hold rule:

- A yellow-risk message creates a `yellowRiskHold`, passivates AI, and waits for dietitian approval.
- While `yellowRiskHold` is active, later green/yellow inbound messages do not receive client-facing AI replies; they refresh the same pending draft so the dietitian reviews the conversation from the first yellow message through the latest message.
- Dietitian approve or edit-and-send resolves the yellow hold and restores the previous AI status/mode if no red lock is active.
- If a red-risk message arrives during a yellow hold, the yellow draft is preserved, red lock/manual handoff wins, and approving the yellow draft does not reactivate AI.

Red-risk reactivation rule:

- A red-risk handoff now creates an explicit client-level red risk lock.
- The lock forces `aiStatus=passive`, `aiMode=manual`, and `humanTakeoverLocked=true`.
- Notification read/acknowledge, dietitian manual replies, normal handoff resolution, takeover release, or direct AI-control edits do not reactivate AI.
- AI can reactivate only through explicit dietitian resolve-and-reactivate action with a resolution reason.
- Reactivation defaults to copilot; autopilot reactivation requires the mandatory safety checklist to be complete.
- The lock creation and reactivation are audited.

### Model Routing

The selected LLM routing is:

- `green`: `gemini-1.5-flash`
- `yellow`: `gemini-3`
- `red`: no LLM call

Google Gemini/provider retention and health-data eligibility must be reviewed before real client health data is sent to a model provider.

### Client Conversation Language

Each client has a dietitian-controlled `communicationLanguage`.

- The dietitian can change the client conversation language from the MANU-AI client profile.
- The selected language is synchronized with `healthProfile.preferredLanguage`.
- The prompt context includes the selected conversation language, so subsequent AI replies use that language.
- Changing the language is prompt-affecting state and invalidates stale pending drafts through the existing context revision safety path.
- Clinical safety routing is unchanged by language selection.

### Personas

Personas are communication behavior contracts, not clinical-rule changes.

Current personas:

- Dengeli Koç
- Sıcak Destekçi
- Disiplinli Takipçi
- Minimal Yanıt
- Motivasyon Ortağı
- Klinik Resmi

Personas can change:

- tone
- message length
- warmth
- formality
- emoji behavior
- boundary phrasing

Personas must never change:

- clinical safety rules
- red/yellow routing
- medication or emergency boundaries
- tenant or client isolation

### Dietitian Voice Profile

The system can analyze approved sample messages from a dietitian to infer:

- average message length
- formality
- emoji policy
- greetings
- closing style
- brief style notes

This is used to make replies feel closer to the dietitian's style.

## Message Provenance

The system must know who wrote each message.

Message origins:

- `client_inbound`: client wrote it.
- `ai_generated`: AI generated and sent it.
- `dietitian_manual`: dietitian wrote it manually.
- `system_event`: system event.
- `imported_unknown`: imported historical message with uncertain author.

This is mandatory because WhatsApp conversations may contain mixed messages: some from AI, some directly from the dietitian.

## Dataset Strategy

The new dataset created by message provenance is valuable.

Best examples:

- Client message -> dietitian manual reply.
- AI draft -> dietitian edited final reply.
- AI reply -> later dietitian follow-up.

MVP usage:

- Do not fine-tune on raw client messages.
- Use dietitian manual replies as style examples.
- Use AI draft edits as correction/evaluation data.
- Keep retrieval scoped to the same tenant and ideally the same dietitian.
- Do not treat AI-generated messages as ground truth unless approved or edited by the dietitian.
- Exclude `imported_unknown` messages from evaluation until reviewed.

## Clinical Safety Rules

AI must not:

- diagnose
- prescribe
- adjust medication
- set supplement doses
- manage emergencies
- independently change diet plans
- interpret lab reports, prescriptions, PDFs, images, or voice notes in MVP
- promote unsafe dieting, body shaming, purging, laxatives, or extreme restriction

AI must escalate:

- emergency symptoms
- allergic reactions
- eating disorder warning signs
- self-harm language
- pregnancy complications
- severe glucose/diabetes concerns
- medication or insulin dosing
- lab result interpretation
- supplement dosing
- diagnosed condition management
- unclear symptom questions
- plan-change requests

## Legal And Permission Layer

The user will prepare client-facing legal and permission documentation separately.

The app must still have integration points to enforce:

- channel permission state
- opt-in/opt-out
- legal/permission status before production messaging

Do not hard-code client-facing legal copy until those documents exist.

## WhatsApp And Telegram

Recommended order:

1. WhatsApp Business Platform
2. Telegram Bot API

WhatsApp requirements:

- Use WhatsApp Business Platform, not personal WhatsApp.
- Verify webhook.
- Handle duplicate webhook idempotency.
- Map phone number to exactly one active client.
- Quarantine unknown or ambiguous numbers.
- Respect opt-in and opt-out.
- Handle approved templates and service-window constraints.
- Record delivery status.
- Avoid healthcare-use policy violations.

Telegram requirements:

- Bot webhook.
- Telegram user ID mapping.
- Bot privacy-policy link.
- Same core orchestrator as WhatsApp.

## Web And Mobile App Plan

MVP should be:

- Next.js web dashboard
- mobile-first responsive design
- installable PWA
- push-notification-ready urgent handoff flow

Mobile PWA should support:

- urgent handoff alerts
- AI active/passive toggle
- draft approval/edit/send
- manual reply
- conversation review
- message origin visibility
- quick client search

Native app should come later:

- React Native
- Expo
- shared backend/API
- APNs/FCM push notifications

## Current Core Package

Path:

```text
dietitian-ai-assistant
```

Key modules:

- `src/orchestrator.js`: end-to-end inbound decision flow.
- `src/ai-activation.js`: active/passive and activation-window logic.
- `src/model-routing.js`: green/yellow/red model routing.
- `src/message-provenance.js`: message origin helpers.
- `src/safety-classifier.js`: dietetic risk classifier.
- `src/clinical-safety-second-layer.js`: deterministic context-sensitive yellow escalation.
- `src/scope-guard.js`: escalate-only scope/regulation merge (`scope-rag-v0.1.0`).
- `src/response-quality-guard.js`: post-generation safety guard.
- `src/context-capsule.js`: tenant/client-scoped context.
- `src/personas.js`: six personas.
- `src/voice-profile.js`: dietitian tone profile builder.
- `docs/data-model.sql`: reference database model.

Current tests:

```bash
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\dietitian-ai-assistant"
npm test
```

Last verified result (Phase 65, 2026-06-04):

```text
114/114 tests passing
```

## Current Local App Prototype

Path:

```text
app
```

Status as of 2026-06-04 (Phase 62):

- Provider failures on active clients: core orchestrator opens dietitian handoff without client-facing AI reply; simulator persists handoff + notification.
- Shared `normalize-safety-text.js` used by classifier, second layer, and scope corpus tokenization.
- Scope retrieval uses overlap coefficient; match threshold `0.4`.
- Glucose numeric window skips TL/lira and similar non-glucose units after numbers.
- Core tests 114/114; app tests 150/150.

Status as of 2026-06-04 (Phase 64):

- Structured `LaunchGateEvidenceRecord` evaluation requires sanitized artifact references, owner, explicit approval status, approval date, review cadence, non-expired evidence, and complete required-evidence coverage before a launch gate is treated as closed.
- Legal/privacy and clinical gate definitions now include Phase 63 user-supplied form and official PDF corpus evidence requirements.
- Operational health can consume structured launch-gate evidence without exposing raw content.
- Real scope guard egress cannot be enabled by legacy approved id lists alone; it requires structured clinical taxonomy and provider/vendor evidence plus `MANU_ALLOW_REAL_SCOPE_GUARD=true`.
- App tests 158/158; production pilot remains `NO-GO`.

Status as of 2026-06-04 (Phase 65):

- Official regulation PDF corpus QA foundation exists in `app/src/lib/official-regulation-corpus.ts`.
- PDF-derived corpus intake now requires sanitized source metadata, SHA-256 checksum, page-level extraction evidence, page/section references, derived rule drafts, and synthetic corpus golden cases.
- QA-passing derived rules can become draft scope rules with source references, but they are not approved or active.
- Clinical launch-gate evidence for the official PDF corpus can be built only from QA-passing corpus evidence plus external approval metadata; QA failure keeps the evidence draft.
- App tests 166/166; production pilot remains `NO-GO`.

Status as of 2026-06-04 (Phase 63):

- Production pilot planning is rebaselined to WhatsApp-first, Gemini-only, up to 100 dietitians, and 50+ clients per dietitian.
- Dietitian and client forms are user-supplied inputs; they require schema, privacy, prompt-allowlist, clinical, versioning, and migration review before production use.
- Official health-regulation PDFs are user-supplied inputs; they require traceable extraction, page/section references, approved derived rules, corpus versioning, corpus golden cases, and explicit clinical/legal approval before active green/yellow/red routing.
- Green autopilot remains gate-bound and may only be enabled after launch gates, client qualification, monitoring, rollback, and sample-review evidence.
- Production pilot remains `NO-GO`; this phase did not change runtime code, schema, providers, channels, dependencies, R-405, or real-data handling.

Status as of 2026-06-04 (Phase 61):

- Scope guard modules: `scope-corpus.ts`, `scope-retrieval.ts`, `scope-evaluator.ts`, `scope-guard-runtime.ts`, `scope-guard-provider.ts`; wired from `simulator-risk.ts` after clinical classification.
- Supabase migration `20260604000000_phase_61_scope_corpus.sql` for system-level regulation corpus and raw-text-free scope guard audit.
- Placeholder draft regulation corpus in seed (scope guard no-op until approved).
- App tests 150/150; `npm run release:verify` passes with only documented R-405 findings.
- Real embedding/LLM for scope guard remain disconnected.

Status as of 2026-05-22:

- Next.js 16 app created with TypeScript, Tailwind, and lucide icons.
- Local demo auth gate protects `/dashboard` through `src/proxy.ts`.
- PWA shell added with `public/manifest.webmanifest`, `public/sw.js`, and `public/icon.svg`.
- Supabase browser client placeholder added; app runs in local demo mode until Supabase env vars are supplied.
- Supabase migration added at `app/supabase/migrations/20260522000000_initial_manu_ai_schema.sql`.
- Dashboard shell includes overview, clients, conversation timeline, simulator, and handoff queue.
- Client controls include active/passive, mode, persona, activation window, safety profile completion, permission state, and human takeover lock.
- Simulator calls the existing `dietitian-ai-assistant` `handleInboundMessage` orchestration through a local file dependency.
- Simulator stores message provenance labels for client inbound, AI generated, dietitian manual, and system messages.
- App tests cover green, yellow, red, passive, scheduled activation, duplicate inbound simulation, human takeover, and missing safety fields.

Status as of 2026-05-23:

- `codex.md` project rules were read and are treated as active local project rules.
- Supabase local config was added under `app/supabase/config.toml`.
- Supabase schema fix migration was added for message status, AI decision reasons, client safety checklist, dietitian auth uniqueness, and membership-based RLS policies.
- A short implementation spec was added at `docs/NEXT_SUPABASE_FOUNDATION_SPEC.md`.
- Dashboard state moved from browser `localStorage` to API-backed state endpoints.
- API endpoints now cover app state loading/reset, client create/update, simulator runs, manual messages, and handoff resolve/dismiss.
- Current API store uses a dev fallback in-memory state until local Supabase credentials and auth bootstrap are wired.
- App tests now include store operation coverage in addition to simulator coverage.

Status later on 2026-05-23:

- Added `app/src/lib/supabase-store.ts`.
- API routes now use Supabase persistence when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
- Without those env vars, the same API routes continue using the dev fallback store.
- Supabase store auto-seeds demo tenant, dietitian, clients, conversations, seed messages, seed AI decision, and processed seed event.
- Supabase store supports state loading/reset, client create/update, manual reply persistence, simulator persistence, and handoff resolve/dismiss.

Status after Supabase Auth wiring on 2026-05-23:

- Supabase SSR browser/server client helpers were added.
- Demo sign-in now creates or reuses `demo@manu.local` when Supabase is configured.
- The demo auth user is linked to the demo tenant through `tenant_memberships` and `dietitians.auth_user_id`.
- `/dashboard` requires a verified Supabase Auth user when Supabase is configured.
- Supabase-backed API routes resolve tenant and dietitian context from the authenticated user.
- Supabase-backed API routes return `401` without a session and `403` without tenant/dietitian membership.
- Fallback store mode still uses the local demo cookie behavior when Supabase credentials are missing.
- RLS integration tests now run through `npm run test:rls` and verify tenant-member reads, membership-less reads, and cross-tenant write blocking against local Supabase.
- Draft approval, edit-send, and dismiss actions now persist through `/api/messages/drafts/[id]`.
- Explicit human takeover release now persists through `/api/clients/[id]/release-takeover` and writes a `human_takeover_released` audit event.
- Autopilot readiness now uses detailed `safetyChecklist` validation instead of only a single demo boolean.

Status after pilot foundation hardening on 2026-05-23:

- Added `docs/PILOT_FOUNDATION_HARDENING_SPEC.md`.
- Added `app/supabase/migrations/20260524000000_restore_auxiliary_rls_policies.sql` to restore RLS policies for `client_ai_status_events`, `conversation_memories`, and `risk_assessments`.
- Expanded RLS integration tests from 3 to 5 tests, covering tenant access for auxiliary clinical/audit tables, simulator idempotency channel persistence, and Supabase-backed AI control audit events.
- Fixed simulator idempotency persistence so Telegram simulations store `processed_inbound_events.channel = telegram` instead of falling back to the first client.
- Supabase-backed client AI status, mode, and activation window changes now write `client_ai_status_events` plus a `client_ai_control_updated` audit event.

Local runtime verification on 2026-05-23:

- Local Supabase was started successfully for project `manu-ai-local`.
- Supabase migrations were applied to the local database.
- Local Supabase endpoints:
  - API: `http://127.0.0.1:54321`
  - Studio: `http://127.0.0.1:54323`
  - Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `app/.env.local` was created with the generated local publishable and secret keys.
- Dashboard route `http://localhost:3000/dashboard` returned HTTP 200 through the local Next.js server.
- `/api/app-state` loaded demo data from live local Supabase.
- `/api/simulator` persisted a simulated inbound message, AI decision, generated reply, processed idempotency key, and audit event to Supabase.
- `/api/messages/manual` persisted a dietitian manual reply to Supabase.
- Demo state was reset back to the seed state after verification.
- Codex in-app browser could not open localhost because of its own URL policy, but Windows/default browser was opened to `http://localhost:3000/dashboard`.
- Verified commands after these changes: `npm run lint`, `npm test`, and `npm run build` in `app`.

Run:

```bash
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\app"
npm run dev
npm test
npm run build
```

Note: app scripts currently use `next dev --webpack` and `next build --webpack` because Turbopack did not resolve the local symlinked core package reliably.

## Immediate Next Sprint

Goal: turn the architecture package into a working local SaaS prototype and mobile-ready PWA shell.

Progress as of 2026-05-23: the first working local prototype exists, dashboard state is API-backed, the Supabase-backed store has been verified against a live local Supabase instance, local Supabase Auth/session handling resolves tenant membership for the demo user, RLS integration tests cover the first tenant-isolation cases, draft approval workflows persist locally and in Supabase, human takeover release is now an explicit audited workflow, and autopilot safety readiness uses detailed checklist validation.

Additional hardening as of 2026-05-23: RLS coverage now includes activation events, memories, and risk assessments; simulator idempotency channel persistence is fixed; and Supabase-backed AI control changes are audited.

Pilot foundation execution update as of 2026-05-25: simulator inbound messages now persist `risk_assessments`, duplicate simulator events do not create duplicate risk records, RLS tests fail closed for non-local Supabase unless explicitly overridden, fallback mode can be forced with `MANU_DEV_FALLBACK_STORE=true`, core safety golden tests were added, Playwright dashboard visual smoke coverage was expanded for desktop/tablet/mobile Chromium, controlled JSON API errors were added for known local failure paths, long message rendering is mobile-safe, and handoff creation now queues an in-app notification audit event.

Phase 2 auth onboarding shell completed on 2026-05-25: production-style auth gates added to dashboard with server-side membership/profile resolution. Dashboard shows controlled error states for unauthenticated, no-membership, and missing-dietitian-profile users. Membership badge shows authenticated user name and role in dashboard header. Auth errors from API calls are captured and shown instead of silently falling back. 6 auth-context unit tests added (24/24 total). `proxy.ts` confirmed as native Next.js 16 middleware. Fallback mode and demo auth unchanged.

Phase 3 consent/permission/channel governance completed on 2026-05-25: only `channelPermission === "ready"` allows AI generation (pending, blocked, opted_out all block). Identity quarantine blocks AI for empty channelUserId and unknown adultStatus. Permission changes audited with previous/new values and distinct opt-out event type. 6 new simulator tests added (30/30 total).

Phase 4 handoff notification architecture completed on 2026-05-25: `NotificationRecord` added with `markNotificationRead` and `acknowledgeNotification` APIs. Dashboard Bell icon added with unread badge and dropdown panel. Red handoffs automatically generate safe-text notifications in the simulator. 2 new simulator tests added to enforce safe-text rule (32/32 total).

Phase 5 data governance completed on 2026-05-25: retention policy placeholders were added with all final durations marked legal-review-required. Tenant/client-scoped export and client anonymization APIs were added. Anonymization clears promptable client context, channel identifiers, rolling memory, message bodies, and AI decision references while preserving a minimized audit event. A Supabase migration was added for the Phase 3 `opted_out` permission enum gap. App tests now cover scoped export, anonymization, memory invalidation, retention placeholders, and fallback API routes (37/37 total).

Phase 6 clinical governance and evaluation completed on 2026-05-25: added clinical golden JSONL cases with expected risk/action/model/provider-call behavior, expanded persona invariant tests, upgraded the safety classifier to `dietetic-risk-v0.2.0`, and documented the qualified-dietitian taxonomy review workflow. Core tests now include 35 passing tests.

Phase 7 channel adapter readiness completed on 2026-05-25: added normalized mock inbound channel event contracts for WhatsApp/Telegram, unknown and ambiguous identity quarantine, duplicate provider-event idempotency, permission-blocked and opted-out mock channel tests, and provider metadata redaction rules. Real WhatsApp/Telegram credentials remain disconnected. App tests now include 45 passing tests.

Phase 8 AI provider readiness completed on 2026-05-25: added deterministic local mock provider abstraction, prompt version metadata, provider id/status/error metadata on AI decisions, Supabase decision metadata migration, timeout/error taxonomy, and safe no-send behavior for provider failures. Real Gemini and external LLM providers remain disconnected. App tests now include 49 passing tests.

Phase 9 pilot readiness closure completed on 2026-05-25: added a local Git checkpoint foundation with root ignore rules, aligned app classifier metadata with `dietetic-risk-v0.2.0`, added Supabase notification persistence migration, wired Supabase notification read/acknowledge endpoints, and added controlled fallback notification errors. Local Supabase migrations were applied and RLS integration tests passed 5/5 against local Supabase with fallback disabled. App tests now include 51 passing tests.

Phase 10 production readiness gates completed on 2026-05-25: added `docs/PHASE_10_PRODUCTION_READINESS_GATES_SPEC.md` and a machine-readable launch gate evaluator. Production pilot remains blocked by default until legal/privacy, clinical taxonomy, provider/vendor, channel policy, incident response, backup/restore, secret rotation, and dependency audit gates are externally approved. App tests now include 54 passing tests.

Phase 11 operational evidence readiness completed on 2026-05-25: launch gates now list required external evidence, and draft incident response, backup/restore, and secret rotation runbooks were added without approving any gate or connecting real providers/channels. App tests now include 55 passing tests.

Phase 12 RBAC authorization completed on 2026-05-25: production Supabase API paths now resolve membership role and enforce fail-closed capabilities. Owner/admin/dietitian keep existing workflow access, while assistant/auditor are limited to read-only app-state access until assignment and minimized auditor views exist. App tests now include 58 passing tests.

Phase 13 client assignment and scoped access completed on 2026-05-25: added `client_assignments` migration, service-layer Supabase app-state scoping, and RLS assertions. Owner/admin remain tenant-wide, dietitians see owned plus assigned clients, assistants see assigned clients only, and auditors receive no raw client/message state until a minimized auditor view exists. App tests now include 62 passing tests.

Phase 14 DSAR, retention, and legal ops ledger completed on 2026-05-25: added `data_requests` migration and app-state ledger records for completed export/anonymization operations. Export bundles now include target-client data request history, while final retention durations and deletion automation remain legal-review-gated. App tests now include 63 passing tests.

Phase 15 safe observability and operational health completed on 2026-05-25: added a safe internal operational health snapshot with aggregate counts and launch-gate status, plus an error monitoring policy draft. No raw messages, prompts, channel identifiers, health profiles, secrets, or external monitoring vendor were connected. App tests now include 66 passing tests.

Phase 16 channel policy simulation hardening completed on 2026-05-25: mock WhatsApp/Telegram channel events now fail closed for missing provider event ids and empty bodies before AI processing. Matched-client opt-out commands (`STOP`, `DUR`, `IPTAL`, `IPTAL ET`, `CANCEL`) update channel permission to `opted_out` without entering the AI path, and minimized audit metadata excludes raw bodies and channel identifiers. App tests now include 70 passing tests.

Phase 17 provider policy guard and prompt boundary completed on 2026-05-25: mock provider input is now built through an allowlist and guarded at runtime. Only `risk` and `client.dietPlan.summary` can enter the mock provider input; prompt/capsule/message/memory/channel/profile/clinical-note leakage fails closed, red-risk provider calls are rejected, and policy violations become safe no-send simulator decisions. App tests now include 75 passing tests.

Phase 18 notification SLA and internal escalation completed on 2026-05-25: added aggregate in-app SLA signals for handoff notifications. Urgent unacknowledged open handoff notifications breach after 15 minutes and count as internal escalation due; standard handoff notifications breach after 4 hours. Operational health now includes only aggregate SLA breach/escalation counts. No external email, push, WhatsApp, Telegram, monitoring, analytics, or real health data was connected. App tests now include 78 passing tests.

Phase 19 release verification, CI script, and dependency gate completed on 2026-05-25: added `npm run release:verify`, which runs core package tests, lint, app tests, production build, and a conservative production dependency audit gate. The gate allows only the documented R-405 Next.js/PostCSS production audit finding, fails on unknown/high/critical findings, and keeps `npm audit fix --force` blocked. Phase 19 verification passed with 35 core tests and 78 app tests while reporting R-405 as an open production launch blocker.

Phase 20 pilot readiness evidence pack completed on 2026-05-25: added a pilot-foundation evidence pack mapping all eight production-pilot launch gates to internal evidence, remaining external blockers, and open status. The pack records release verification results and explicitly states that production pilot, real health data, real WhatsApp/Telegram messaging, real Gemini/provider calls, external notifications, monitoring, and R-405 clearance remain blocked.

Phase 21 external approval dossier started on 2026-05-28: added a PRD/tech spec and production-pilot gate closure dossier. The Phase 21 `npm run release:verify` baseline was re-run successfully with 35 core tests, 78 app tests, lint, build, and only the known R-405 production audit finding. All launch gates remain open until external approval evidence is supplied.

Phase 22 R-405 dependency remediation planning completed on 2026-05-28: added a remediation spec that rejects `npm audit fix --force`, canary Next.js, invalid overrides, and major downgrade paths. Current stable `next@latest` still bundles vulnerable `postcss@8.4.31`; dependency files must not change until a stable Next.js release bundles `postcss >= 8.5.10` or external formal risk acceptance is provided.

Phase 23 AI context and memory architecture completed on 2026-05-30: added a bounded `PromptContext` compiler, raw-text-free `ContextManifest`, the missing historical context invariant, provider-output guard blocking for `[ERROR: missing_historical_context]`, send-status tracking, draft invalidation on prompt-affecting context changes, human-takeover routing for missing history, and Supabase schema fields for context/send safety. Core tests now include 39 passing tests; app tests now include 82 passing tests. Real providers, channels, monitoring, secret manager, and real health data remain disconnected.

Phase 24-25 voice sample and dynamic form infrastructure completed on 2026-05-30: added dietitian voice sample intake with approval/rejection and generated voice profiles, plus versioned dynamic client form schemas and response snapshots. PromptContext now includes only `prompt_allowed` form response summaries, and form response saves invalidate stale AI drafts. Real providers/channels/health data remain disconnected.

Phase 26 internal copilot completed on 2026-05-30: added a read-only internal dietitian copilot backed by curated tenant-scoped database tools over already-visible app state. Owner/admin/dietitian roles can ask local/mock questions about visible client status, diet plans, recent messages, form responses, handoffs, and AI decision history. Assistant/auditor are blocked from copilot chat in v1. Copilot questions, tool calls, assistant answers, and source refs are persisted in fallback and Supabase-backed state. No raw SQL, mutation tools, real LLM provider, real channel, external notification, monitoring, secret manager, or real health data was connected.

Phase 27 dietitian context updates completed on 2026-05-30: added a Critical Context workflow so dietitians can record confirmed client information from phone, Zoom, in-person, or other non-chat conversations. These records are stored as active client context updates, increment client context revision, invalidate pending drafts, enter bounded PromptContext as `dietitian_context_update` segments, and are included in export/anonymization governance. Old WhatsApp messages are not rewritten; newer dietitian context supersedes older prompt context, and newer `dietitian_manual` WhatsApp/Telegram/manual messages supersede older Critical Context records. Real providers, real channels, monitoring, secret manager, and real health data remain disconnected.

Phase 28 AI security remediation completed on 2026-05-31: added `providerAttempted`/`provider_attempted` audit semantics, no-call provider metadata cleanup, narrow `MockProviderError` provider-failure handling, PromptContext source metadata, newest dietitian-authored source marking, send-time draft revalidation, provider segment allowlist fail-closed checks, tenant-aware channel/idempotency uniqueness, scoped RLS/RBAC helper policies, stricter core TypeScript declarations, and expanded clinical golden cases. Latest verification: core tests 49/49, app tests 103/103, lint/build pass, and release audit reports only documented R-405. Real providers, real channels, monitoring, secret manager, and real health data remain disconnected.

Phase 29 pilot gate closure and evidence hardening completed on 2026-05-31: added `docs/PHASE_29_PILOT_GATE_CLOSURE_EVIDENCE_HARDENING_SPEC.md`, updated the production pilot dossier and evidence pack to use the Phase 27-28 baseline, recorded the RLS evidence gap when local Supabase is unavailable, and rechecked R-405 metadata. Stable `next@latest` remains 16.2.6 with `postcss@8.4.31`, and `eslint-config-next@latest` remains 16.2.6, so dependency files must not change. `npm run release:verify` passed after Phase 29 with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings. All production-pilot gates remain open.

Completion roadmap Phase 1 completed on 2026-05-31: added `docs/PHASE_30_COMPLETION_PHASE_1_CHECKPOINT_BASELINE_SPEC.md`, confirmed branch `codex/phase-29-baseline-checkpoint`, confirmed starting checkpoint `c75564e Add Phase 27-29 pilot readiness checkpoint`, and re-verified the baseline with `npm run release:verify`. No runtime behavior, schema, dependency, provider, channel, launch-gate, or real-data changes were made.

Completion roadmap Phase 2 attempted on 2026-05-31: added `docs/PHASE_31_COMPLETION_PHASE_2_RLS_EVIDENCE_SPEC.md`, confirmed the RLS guard is still safe for non-local Supabase URLs, attempted to start local Supabase, and ran `npm run test:rls`. Local Supabase could not start because Docker Desktop's Linux engine pipe was unavailable, and `npm run test:rls` skipped 10 guarded tests. No passing RLS evidence was produced, so R-406 remains blocked pending local Docker/Supabase availability. `npm run release:verify` passed after the Phase 2 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 3 completed on 2026-05-31: added `docs/PHASE_32_COMPLETION_PHASE_3_R405_RECHECK_SPEC.md` and rechecked R-405 through the Phase 22 procedure. `next@latest` remains `16.2.6` with `postcss@8.4.31`, `eslint-config-next@latest` remains `16.2.6`, and production audit still reports only the known moderate `next`/`postcss` findings. No dependency files were changed, no `npm audit fix --force` was run, and R-405 remains an open production launch blocker. `npm run release:verify` passed after the Phase 3 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 4 completed on 2026-05-31: added `docs/PHASE_33_COMPLETION_PHASE_4_EXTERNAL_APPROVAL_INTAKE_SPEC.md` and `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md` to make the eight production-pilot launch gates actionable for external evidence collection. No external approval artifacts were supplied, so all launch gates remain open; R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data changes were made. `npm run release:verify` passed after the Phase 4 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 5 completed on 2026-05-31: added `docs/PHASE_34_COMPLETION_PHASE_5_LEGAL_PRIVACY_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md` to prepare the `legal_privacy_review` launch gate for external counsel review. No legal/privacy approval artifact was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data changes were made. `npm run release:verify` passed after clearing a transient Windows/OneDrive `.next` EPERM build artifact, with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 6 completed on 2026-05-31: added `docs/PHASE_35_COMPLETION_PHASE_6_CLINICAL_TAXONOMY_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md` to prepare the `clinical_taxonomy_approval` launch gate for qualified dietitian review. No qualified dietitian approval artifact was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No classifier, golden-case, runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data changes were made. `npm run release:verify` passed after the Phase 6 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 7 completed on 2026-05-31: added `docs/PHASE_36_COMPLETION_PHASE_7_PROVIDER_VENDOR_REVIEW_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md` to prepare the `provider_vendor_review` launch gate for external vendor, legal, and security review. No provider/vendor approval artifact was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel, launch-gate approval, credential, logging-vendor, or real-data changes were made. Real provider egress for client replies, internal copilot, and dietitian context updates remains blocked. `npm run release:verify` passed after the Phase 7 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 8 completed on 2026-05-31: added `docs/PHASE_37_COMPLETION_PHASE_8_CHANNEL_POLICY_REVIEW_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md` to prepare the `channel_policy_review` launch gate for external WhatsApp and Telegram platform-policy review. No channel policy approval artifact was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel integration, webhook, credential, template registry, launch-gate approval, or real-data changes were made. Real WhatsApp and Telegram traffic remains blocked. `npm run release:verify` passed after the Phase 8 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 9 completed on 2026-05-31: added `docs/PHASE_38_COMPLETION_PHASE_9_INCIDENT_DSAR_REVIEW_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md` to prepare the `incident_response_runbook` launch gate for external operations, legal, privacy, and clinical review. No incident/DSAR approval artifact was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel, monitoring, notification, ticketing, launch-gate approval, owner assignment, or real-data changes were made. `npm run release:verify` passed after the Phase 9 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 10 completed on 2026-05-31: added `docs/PHASE_39_COMPLETION_PHASE_10_BACKUP_RESTORE_REVIEW_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md` to prepare the `backup_restore_test` launch gate for external operations, security, and legal review. No backup/restore approval artifact or restore-drill evidence was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel, backup provider, storage, secret manager, infrastructure, launch-gate approval, restore drill, or real-data changes were made. `npm run release:verify` passed after the Phase 10 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 11 completed on 2026-05-31: added `docs/PHASE_40_COMPLETION_PHASE_11_SECRET_ROTATION_REVIEW_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md` to prepare the `secret_rotation_plan` launch gate for external security and operations review. No secret-rotation approval artifact, production secret manager, or rotation evidence was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel, backup provider, storage, secret manager, infrastructure, credential, launch-gate approval, or real-data changes were made. `npm run release:verify` passed after the Phase 11 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 12 completed on 2026-05-31: added `docs/PHASE_41_COMPLETION_PHASE_12_DEPENDENCY_AUDIT_CLEARANCE_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md` to prepare the `dependency_audit_clearance` launch gate for engineering/security review. Rechecked R-405 through the Phase 22 procedure: stable `next@latest` remains `16.2.6` with nested `postcss@8.4.31`, `eslint-config-next@latest` remains `16.2.6`, and production audit still reports only the known moderate `next`/`postcss` findings. No dependency files were changed, no dependency clearance or formal risk acceptance was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. `npm run release:verify` passed after the Phase 12 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 13 completed on 2026-05-31: added `docs/PHASE_42_COMPLETION_PHASE_13_FINAL_READINESS_CLOSURE_SPEC.md` and `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md` to close the 13-phase completion roadmap with a final production-pilot readiness summary. Current decision is `NO-GO` for production pilot: all eight launch gates remain open, R-405 remains open, R-406 remains blocked, and no external approval artifacts were supplied. No runtime behavior, schema, dependency, provider, channel, monitoring, secret manager, backup provider, launch-gate approval, R-405 acceptance, R-406 mitigation, or real-data changes were made. `npm run release:verify` passed after the Phase 13 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Phase 43 multilingual language support completed on 2026-05-31: added canonical supported-language support for Turkish, English, German, French, Spanish, Portuguese, and Czech. Dietitian dashboard language is stored per dietitian; client communication language and canonical E.164 phone identity are stored per client; dynamic form schemas/responses store language metadata; saved form responses update the client's conversation language by phone/client identity; PromptContext includes a bounded `conversation_language` segment; local/mock provider replies and handoff acknowledgements localize to the stored client language; and multilingual clinical golden cases were added. This phase did not connect real providers, channels, translation services, monitoring, secret manager, backup provider, or real client health data, and it did not approve any production-pilot launch gate. `npm run release:verify` passed with core tests 52/52, app tests 107/107, lint, production build, and only documented R-405 findings. R-405 remains open and R-406 remains blocked.

Phase 44 red-risk reactivation lock completed on 2026-06-01: added a client-level `redRiskLock`, Supabase `clients.red_risk_lock`, explicit resolve-and-reactivate endpoint, and dashboard handoff controls. Red-risk handoffs now force AI passive/manual with human takeover locked; manual dietitian replies and notification acknowledgement do not reactivate AI; normal handoff resolution, direct AI-control edits, takeover release, and red-locked dismissal are rejected while locked. AI can resume only after explicit dietitian resolve-and-reactivate with an audit reason; copilot is the default and autopilot requires completed mandatory safety. This phase did not connect real providers, channels, monitoring, secret manager, backup provider, or real client health data, and it did not approve any production-pilot launch gate. `npm run release:verify` passed with core tests 52/52, app tests 112/112, lint, production build, and only documented R-405 findings. `npm run test:rls` still skipped 10 guarded tests because local Supabase evidence is unavailable. R-405 remains open and R-406 remains blocked.

Phase 45 client removal data lifecycle completed on 2026-06-01: added a soft-delete/anonymization lifecycle with `lifecycleStatus=removed_anonymized`, `removedAt`, `/api/clients/[id]/remove`, dashboard remove action, and Supabase lifecycle migration. Removed clients are hidden from normal dashboard client lists, blocked from inbound/manual/form/internal-copilot operations, and keep only minimized export/audit evidence. Promptable health data, phone/channel identity, rolling memory, message bodies, form response answers/submitted phone metadata, context updates, handoff text, notifications, red-risk locks, and AI decision/risk details are redacted or minimized. Hard delete remains legal-review gated. This phase did not connect real providers, channels, monitoring, secret manager, backup provider, or real client health data, and it did not approve any production-pilot launch gate. `npm run release:verify` passed with core tests 52/52, app tests 114/114, lint, production build, and only documented R-405 findings. R-405 remains open and R-406 remains blocked.

Phase 46 WhatsApp group quarantine completed on 2026-06-01: added an unsupported inbound context quarantine for group messages. Requests marked `sourceConversationType=group` are blocked before client lookup, risk classification, context assembly, provider calls, message storage, AI decisions, risk assessments, or handoffs. The system records minimized `InboundQuarantineRecord` metadata and `inbound_group_message_quarantined` audit events without storing raw group message text. Duplicate group events remain idempotent. This phase did not connect real WhatsApp, Telegram, providers, monitoring, secret manager, backup provider, or real client health data, and it did not approve any production-pilot launch gate. `npm run release:verify` passed with core tests 52/52, app tests 117/117, lint, production build, and only documented R-405 findings. R-405 remains open and R-406 remains blocked.

Phase 47 RLS quarantine evidence coverage completed on 2026-06-01: added explicit `inbound_quarantines` coverage to the expanded Supabase RLS integration suite, including tenant member visibility, outsider blocking, assistant/auditor blocking, cross-tenant write blocking, and Supabase-backed group quarantine persistence without client message/risk/decision/handoff artifacts. `npm run lint` and `npm run test` passed, and `npm run test:rls` now reports 11 guarded tests but still skips because Docker Desktop's Linux engine is unavailable. R-406 remains blocked until the 11-test suite passes against local Supabase.

Phase 48 R-405 stable patch recheck completed on 2026-06-01: rechecked `next@latest`, `eslint-config-next@latest`, and production audit. Stable `next@latest` is now `16.2.7`, but it still bundles nested `postcss@8.4.31`; `eslint-config-next@latest` is `16.2.7`; production audit still reports only the known moderate `next`/`postcss` findings and proposes the rejected semver-major `next@9.3.3` path. No dependency files were changed. R-405 remains open.

Phase 50 production Supabase hardening evidence completed locally on 2026-06-02: added `docs/PHASE_50_PRODUCTION_SUPABASE_HARDENING_EVIDENCE_SPEC.md`, recorded Supabase rate-limit/RPC groundwork, narrowed pre-mutation Supabase reads for the main client/handoff/draft operation paths, and updated pilot evidence/gate/final-readiness docs. `npm run release:verify` passed from `app` with core tests 57/57, app tests 126/126, lint, production build, and only documented R-405 findings. Docker Desktop/local Supabase was started, `npx supabase db reset --local` applied all migrations through Phase 50, and `npm run test:rls` passed against local Supabase with 1 file and 11/11 tests. R-406 is mitigated in the local prototype. No launch gate was approved; R-405 remains open.

Phase 51 transactional RPC coverage completed locally on 2026-06-02: added `docs/PHASE_51_TRANSACTIONAL_RPC_COVERAGE_SPEC.md`, extended `manu_commit_state_delta` with message, AI-decision, handoff, client-context, and form-response update payloads, added `commit_handoff_status`, and moved draft approval/dismissal, form response save, client context update, handoff status update, and red-risk reactivation to transactional RPC commits. `npm run lint`, `npm test`, and `npm run test:rls` passed from `app`; the RLS suite now passes 1 file and 14/14 tests against local Supabase. Client removal/anonymization bulk redaction remains out of scope pending a dedicated transactional redaction contract. Production pilot remains `NO-GO`; R-405 and all external launch gates remain open.

Phase 52 integration test coverage completed locally on 2026-06-02: added `docs/PHASE_52_INTEGRATION_TEST_COVERAGE_SPEC.md` and expanded Supabase-backed integration coverage for `consume_rate_limit` tenant/scope/key isolation, controlled `429 rate_limit_exceeded`, stale client revision `concurrent_state_update`, manual reply transaction atomicity, and inbound simulation transaction atomicity. `npm run test:rls` now passes against local Supabase with 1 file and 19/19 tests. `npm run lint`, `npm test`, and `npm run release:verify` passed; release verification still reports only known R-405 findings. No launch gate was approved.

Phase 53 scale/broad read contracts completed locally on 2026-06-02: added `docs/PHASE_53_SCALE_BROAD_READ_CONTRACTS_SPEC.md`, a test-covered `app/src/lib/supabase-read-contracts.ts` catalog, and `app/src/lib/supabase-read-contracts.test.ts`. Remaining broad Supabase reads are now classified as intentional legal/admin broad reads, future paginated reads, or already scoped mutation reads. Dashboard/internal-copilot pagination and client create/patch scoped reload contracts are designed but not implemented. `npm test` passed from `app` with 18 files and 130/130 tests, `npm run lint` passed, and `npm run release:verify` passed with core tests 57/57, app tests 130/130, lint, production build, and only known R-405 findings. R-115 remains partially mitigated, but the broad-read ambiguity is reduced.

Phase 54 R-405 and launch gates recheck completed locally on 2026-06-02: added `docs/PHASE_54_R405_AND_LAUNCH_GATES_RECHECK_SPEC.md` and re-ran the Phase 22 stable dependency procedure. `next@latest` is stable `16.2.7` but still depends on nested `postcss@8.4.31`; `eslint-config-next@latest` is `16.2.7`; `npm audit --omit=dev --json` still reports only the known moderate R-405 `next:postcss` and `postcss:GHSA-qx2v-qp2m-jg93` findings and proposes the rejected `next@9.3.3` downgrade. No dependency files were changed. No external approval artifacts were supplied, all eight launch gates remain open, R-405 remains open, and production pilot remains `NO-GO`. `npm run release:verify` passed with core tests 57/57, app tests 130/130, lint, production build, and only documented R-405 findings.

Phase 55 audit remediation safety boundary completed locally on 2026-06-03: added `docs/PHASE_55_AUDIT_REMEDIATION_SAFETY_BOUNDARY_SPEC.md`, hardened real Turkish Unicode safety normalization, expanded multilingual pregnancy/lactation yellow routing, added `prompt_injection_attempt` yellow routing, rendered client-authored PromptContext segments as explicit data boundaries, kept safety-critical pinned notes untruncated with fail-closed budget behavior, and added red-risk lock/preflight regression coverage. `npm test` passed from `dietitian-ai-assistant` with 72/72 tests and from `app` with 18 files and 132/132 tests; `npm run lint` passed from `app`; `npm run release:verify` passed with core tests 72/72, app tests 132/132, lint, production build, and only documented R-405 findings. This phase did not change schema, RLS, dependencies, providers, channels, monitoring, secret manager, backup provider, launch gates, R-405 status, or real-data handling. Production pilot remains `NO-GO`.

Phase 56 clinical safety second-layer local evidence completed locally on 2026-06-03: added `docs/PHASE_56_CLINICAL_SAFETY_SECOND_LAYER_LOCAL_EVIDENCE_SPEC.md`, introduced a deterministic `clinical-safety-second-layer-v0.1.0` evaluator above the regex classifier, and routed otherwise-green allergy/restriction mentions, ambiguous clinical references, missing-history references, minor weight/restriction context, and eating-disorder-sensitive ambiguous restriction language to yellow dietitian review. The combined classifier version is recorded as `dietetic-risk-v0.3.0+clinical-safety-second-layer-v0.1.0`; core/app tests cover the second-layer JSONL fixture, no-downgrade behavior, orchestrator draft routing, and simulator risk/decision evidence. This phase did not connect a real LLM-based safety evaluator, real provider, real channel, monitoring, secret manager, backup provider, schema/RLS/RPC changes, external launch-gate approval, or real health data. Production pilot remains `NO-GO`; R-310 is partially mitigated in the local prototype only.

Phase 57 yellow-risk hold/draft refresh completed locally on 2026-06-03: added `docs/PHASE_57_YELLOW_RISK_HOLD_DRAFT_REFRESH_SPEC.md`, introduced `yellowRiskHold`, passivated AI on yellow risk, refreshed one pending draft for later green/yellow messages, preserved the yellow draft when later red risk creates a manual lock, and added `clients.yellow_risk_hold` migration/RPC support. Verification passed with app simulator tests 34/34, app tests 135/135, core tests 75/75, app lint, and `npm run release:verify`. Local Supabase/RLS evidence for the Phase 57 migration may remain open when Docker Desktop/local Supabase is unavailable. Production pilot remains `NO-GO`.

Phase 58 dietitian client language control completed locally on 2026-06-03: added `docs/PHASE_58_DIETITIAN_CLIENT_LANGUAGE_CONTROL_SPEC.md`, synchronized client creation/profile `communicationLanguage` with `healthProfile.preferredLanguage`, made language changes prompt-affecting, and verified subsequent AI replies use the dietitian-selected language in simulator tests. Targeted verification passed with 54/54 tests. Production pilot remains `NO-GO`.

Phase 59 architecture review remediation completed locally on 2026-06-03: added `docs/PHASE_59_ARCHITECTURE_REVIEW_REMEDIATION_SPEC.md`, fail-closed unknown AI modes, core provider error boundary around `generateReply`, numeric glucose-context escalation and expanded multilingual symptom patterns with new golden cases, simulator `appendCoreSimulationResult` helper refactor without behavior change, multilingual voice-profile formal/informal scoring, and provider-native token counting documented as a future integration gate. Verification passed with core tests 85/85, app tests 137/137, app lint, and `npm run release:verify`. No schema/RLS, dependency, real provider, channel, launch-gate approval, or R-405 changes. Production pilot remains `NO-GO`; qualified dietitian clinical taxonomy approval remains required.

Phase 60 audit remediation completed locally on 2026-06-03: added `docs/PHASE_60_AUDIT_REMEDIATION_SPEC.md`, fixed glucose false-positive numeric extraction (`dietetic-risk-v0.3.1`), added core `providerOutputSafety` on provider failures, aligned `dietitian-ai-assistant-architecture.d.ts` with runtime, expanded symptom/voice/simulator tests, and synchronized handoff/plan/pilot documentation. Verification passed with core tests 104/104, app tests 138/138, app lint, and `npm run release:verify`. Production pilot remains `NO-GO`.

Phase 62 architecture review remediation wave 2 completed locally on 2026-06-04: added `docs/PHASE_62_ARCHITECTURE_REVIEW_REMEDIATION_WAVE2_SPEC.md`, provider-failure handoff without client send, `normalize-safety-text.js`, overlap scope retrieval, glucose cost-unit filtering, dead code removal, and constraint-accepted documentation for Bulgu 3/9/10. Verification passed with core tests 114/114, app tests 150/150, app lint, and `npm run release:verify`. Production pilot remains `NO-GO`; R-402 partially mitigated in local prototype.

Phase 63 production pilot GO rebaseline completed locally on 2026-06-04: added `docs/PHASE_63_PRODUCTION_PILOT_GO_REBASELINE_SPEC.md`, restructured the path out of production-pilot `NO-GO` around a WhatsApp-first/Gemini-only pilot for up to 100 dietitians with 50+ clients each, and recorded user-supplied dietitian/client forms plus official health-regulation PDFs as mandatory gated inputs. The plan now requires traceable PDF extraction, page/section mapping, approved corpus rules, corpus golden tests, form schema/privacy/prompt-allowlist review, structured launch-gate evidence, scale/load evidence, and rollback/monitoring gates before production pilot. Verification passed with core tests 114/114, app tests 150/150, app lint, and `npm run release:verify`. No runtime, schema, provider, channel, dependency, approval, R-405, or real-data change was made.

Phase 64 structured launch-gate evidence engine completed locally on 2026-06-04: added `docs/PHASE_64_STRUCTURED_LAUNCH_GATE_EVIDENCE_ENGINE_SPEC.md`, implemented typed structured evidence records and evaluator, expanded Phase 63 legal/clinical required evidence, wired operational health to structured evidence, and hardened real scope-guard provider allowance so legacy gate ids alone cannot enable real egress. Verification passed with core tests 114/114, app tests 158/158, app lint, production build, and `npm run release:verify`. No approval artifact was supplied, no gate was closed, no real provider/channel/data path was connected, and production pilot remains `NO-GO`.

Phase 65 official regulation PDF corpus QA foundation completed locally on 2026-06-04: added `docs/PHASE_65_OFFICIAL_REGULATION_PDF_CORPUS_QA_SPEC.md` and `app/src/lib/official-regulation-corpus.ts`. The local foundation evaluates user-supplied official PDF corpus packages for source metadata, checksum, page extraction evidence, page/section references, derived rule drafts, and corpus golden cases. QA-passing derived rules can be converted only into draft scope rules with source references; external clinical/legal approval remains required before active production routing or launch-gate closure. Verification passed with core tests 114/114, app tests 166/166, app lint, production build, and `npm run release:verify`. No real PDF was supplied or parsed, no corpus was approved, no launch gate was closed, no provider/channel/data path was connected, and production pilot remains `NO-GO`.

Post-Phase 65 direct 100-dietitian completion plan added on 2026-06-05: `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md` is now the canonical strategic roadmap. The plan locks production pilot to direct 100 dietitians x 50 clients (minimum 5,000 clients), no small production ring, no client-facing AI self-disclosure or doctor/dietitian/professional referral language, no yellow/red client-facing AI boundary reply, and green maximization through approved source-backed answerability. Phase 66 Product Communication Covenant Lock, Phase 67 Approved Source Answerability Engine, and Phase 68 Green Maximization Intent Taxonomy are now complete; the next implementation phase is Phase 69 Direct 5,000 Client Scale Foundation, followed by user-supplied form hardening, official PDF ingestion, regulation permission graph, calibration, redaction/DSAR hardening, Gemini, WhatsApp, ops, R-405 closure, full 100x50 rehearsal, external gate closure, and direct pilot GO.

Phase 66 product communication covenant lock completed locally on 2026-06-05: added `docs/PHASE_66_PRODUCT_COMMUNICATION_COVENANT_LOCK_SPEC.md`, core `PRODUCT_COMMUNICATION_COVENANT_VERSION`, multilingual forbidden client-facing phrase detection, a PromptContext covenant instruction, provider output safety metadata for covenant failures, internal-only handoff acknowledgement text, mock-provider covenant self-checks, and send-time draft blocking for non-green AI drafts or covenant-violating draft edits. Verification passed with core tests 116/116, app tests 170/170, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No real provider, channel, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected. Production pilot remains `NO-GO`.

Phase 67 approved source answerability engine completed locally on 2026-06-05: added `docs/PHASE_67_APPROVED_SOURCE_ANSWERABILITY_ENGINE_SPEC.md`, core `APPROVED_SOURCE_ANSWERABILITY_VERSION`, deterministic `evaluateApprovedSourceAnswerability`, pre-provider green answerability gating, `contextManifest.answerability` evidence, active diet plan field fallback when plan summary is empty, and tests proving missing sources/AI-generated-only sources do not call the provider while dietitian manual sources can support green answerability. Verification passed with core tests 120/120, app tests 171/171, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No real provider, channel, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected. Production pilot remains `NO-GO`.

Phase 68 green maximization intent taxonomy completed locally on 2026-06-05: added `docs/PHASE_68_GREEN_MAXIMIZATION_INTENT_TAXONOMY_SPEC.md`, core `GREEN_INTENT_TAXONOMY_VERSION`, deterministic `evaluateGreenIntentTaxonomy`, pre-provider green intent audit/blocking after approved-source answerability, `contextManifest.greenIntent` evidence, and tests proving green intent families are recorded, sensitive green-looking calorie/macro/portion requests block before provider, and yellow/red decisions are not downgraded. Verification passed with core tests 122/122, app tests 171/171, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No real provider, channel, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected. Production pilot remains `NO-GO`.

Phase 61 scope guard (RAG + LLM) second layer mock-first completed locally on 2026-06-04: added `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`, core `scope-guard.js` (`scope-rag-v0.1.0`) with monotonic `mergeScopeDecision`, app mock lexical retrieval and deterministic evaluator, `scope-guard-runtime` wiring in simulator risk path, Supabase `scope_*` tables with tenant read / system write RLS, raw-text-free `scope_guard_evaluations` audit, operational-health corpus signals, placeholder draft corpus (no-op until approved), and fail-closed disconnected real embedding/LLM behind clinical taxonomy gate + `MANU_ALLOW_REAL_SCOPE_GUARD=true`. Combined classifier version: `dietetic-risk-v0.3.1+clinical-safety-second-layer-v0.1.0+scope-rag-v0.1.0`. Verification passed with core tests 112/112, app tests 150/150, app lint, and `npm run release:verify`. Production pilot remains `NO-GO`; R-310 partially mitigated in local prototype only.

Tasks:

1. Implement Phase 69 Direct 5,000 Client Scale Foundation before direct 100-dietitian production pilot readiness.
2. Then implement user-supplied form hardening before accepting final user forms as production answerability sources.
3. Accept user-supplied dietitian/client forms in Phase 70 and harden schema, prompt visibility, clinical sensitivity, answerability source classification, versioning, and migrations.
4. Accept official regulation PDFs in Phase 71 and use the Phase 65 QA foundation; do not activate official corpus routing until Phase 72 permission graph and external approvals pass.
5. Accept legal/privacy, clinical interpretation, and green/yellow/red decision matrix in Phase 72-73 for permission graph and calibration.
6. Complete transactional redaction/DSAR, Gemini provider gate, WhatsApp adapter, production ops, R-405 closure, full 100x50 rehearsal, and external launch-gate closure before direct production GO.
7. Use `docs/PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, and `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md` to collect external approval evidence without storing secrets or raw client data in repo docs.
8. Re-check R-405 again only through the `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md` procedure before any future dependency edit.
9. Keep real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, and real client health data disconnected.

Definition of done:

- App runs locally.
- Dashboard works on desktop and mobile widths.
- App is installable as a PWA shell.
- Dietitian can create a client.
- Dietitian can activate/deactivate AI per client.
- Dietitian can set persona and AI mode per client.
- Simulated inbound messages produce correct decisions.
- Conversation timeline distinguishes client, AI, dietitian, and system messages.
- No real WhatsApp or Telegram credentials are required yet.

## Non-Negotiable Launch Gates

Before real health data or production messaging:

- Legal/privacy review completed.
- Medical-device or clinical-decision-support classification reviewed.
- Dietitian credential requirements defined.
- Client-facing legal and permission documents completed.
- WhatsApp healthcare-use feasibility reviewed.
- Gemini/provider data-retention and health-data eligibility reviewed.
- Clinical taxonomy approved by a qualified dietitian.
- Red/yellow/green golden tests exist.
- Incident response and deletion workflows exist.

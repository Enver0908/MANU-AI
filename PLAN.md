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
- Yellow: draft for approval only.
- Red: no LLM call; handoff to dietitian.
- Passive AI: no AI generation.

### Model Routing

The selected LLM routing is:

- `green`: `gemini-1.5-flash`
- `yellow`: `gemini-3`
- `red`: no LLM call

Google Gemini/provider retention and health-data eligibility must be reviewed before real client health data is sent to a model provider.

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

Last verified result:

```text
49/49 tests passing
```

## Current Local App Prototype

Path:

```text
app
```

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

Tasks:

1. Unblock completion roadmap Phase 2 by starting Docker Desktop/local Supabase, rerunning `npm run test:rls`, and updating R-406/evidence docs only if the expanded RLS suite passes.
2. Use `docs/PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, and `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md` to collect external legal/privacy approval evidence without storing secrets or raw client data in repo docs.
3. Re-check R-405 again only through the `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md` procedure before any future dependency edit.
4. Keep Phase 23-34 prompt-context, voice-profile, dynamic-form, internal-copilot, dietitian context update, provider-boundary, send-revalidation, evidence, dependency, external-approval, legal/privacy, and RLS controls covered by tests before any real provider integration.
5. Keep clinical taxonomy approval, provider review, real-channel policy review, operational ownership, R-405 clearance, and R-406 passing local RLS evidence as launch gates.
6. Keep real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, and real client health data disconnected.

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

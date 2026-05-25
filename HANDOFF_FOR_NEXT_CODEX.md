# Handoff For Next Codex

## Read This First

You are continuing the MANU-AI project.

Workspace:

```text
C:\Users\Dell\OneDrive\Masaüstü\MANU-AI
```

Use this folder for all new files.

Start by reading:

1. `PLAN.md`
2. `PROJECT_PLAN.md`
3. `docs/NEXT_PHASE_EXECUTION_PLAN.md`
4. `docs/RISK_REGISTER.md`
5. `docs/DATA_INVENTORY.md`
6. `docs/DATASET_STRATEGY.md`
7. `docs/MOBILE_APP_STRATEGY.md`
8. `dietitian-ai-assistant/README.md`
9. `dietitian-ai-assistant/docs/architecture.md`
10. `dietitian-ai-assistant/docs/data-model.sql`

## User's Product Goal

Build MANU-AI: an AI assistant for dietitians that replies to their clients over WhatsApp/Telegram, while the dietitian controls activation, mode, persona, handoff, and manual takeover from a MANU-AI dashboard and mobile app.

The product must be both:

- Web dashboard
- Phone-installable app experience, starting with PWA, later native React Native/Expo

## Important User Decisions

- The product is for dietitians and their clients.
- Clients communicate mostly through WhatsApp or Telegram.
- Dietitian controls everything from MANU-AI, not WhatsApp.
- AI can be active or passive per client.
- Dietitian can activate/passivate AI for any client at any time.
- Optional activation time windows are supported.
- There is no fixed two-week copilot period.
- There is no confidence score or trust score gate.
- The user will prepare client-facing legal/permission documents separately.
- Do not add product copy saying "AI-supported tracking" to the client.
- Keep neutral legal/permission integration points only.
- Model routing:
  - green -> `gemini-1.5-flash`
  - yellow -> `gemini-3`
  - red -> no LLM call
- Personas affect communication style only, never clinical safety.
- The system must know which WhatsApp/Telegram messages were written by AI and which were written manually by the dietitian.

## Current Implementation

The current code now has two layers:

```text
dietitian-ai-assistant
app
```

`dietitian-ai-assistant` is the testable core architecture package.

`app` is the first local SaaS/PWA prototype. It is not production-connected yet; it uses API-backed dashboard state, live local Supabase persistence when local env vars are configured, and a dev fallback store when Supabase env vars are missing.

Core key files:

- `src/orchestrator.js`
- `src/ai-activation.js`
- `src/model-routing.js`
- `src/message-provenance.js`
- `src/safety-classifier.js`
- `src/response-quality-guard.js`
- `src/context-capsule.js`
- `src/personas.js`
- `src/voice-profile.js`
- `docs/data-model.sql`

App key files:

- `app/src/components/dashboard-app.tsx`
- `app/src/components/auth-states.tsx`
- `app/src/lib/app-state-store.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/lib/auth-context.ts`
- `app/src/lib/simulator.ts`
- `app/src/lib/simulator.test.ts`
- `app/src/lib/auth-context.test.ts`
- `app/src/lib/seed-data.ts`
- `app/src/lib/use-manu-state.ts`
- `app/src/proxy.ts`
- `app/src/app/dashboard/page.tsx`
- `app/src/app/api/auth-state/route.ts`
- `app/public/manifest.webmanifest`
- `app/public/sw.js`
- `app/supabase/migrations/20260522000000_initial_manu_ai_schema.sql`
- `app/supabase/migrations/20260523000000_app_state_schema_fixes.sql`
- `docs/NEXT_SUPABASE_FOUNDATION_SPEC.md`
- `docs/PHASE_2_AUTH_ONBOARDING_SHELL_SPEC.md`

## Current Behavior

Local app state:

- Dashboard loads state through `/api/app-state`, not browser `localStorage`.
- API routes use `app/src/lib/supabase-store.ts` when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist.
- API routes fall back to `app/src/lib/app-state-store.ts` when Supabase env vars are missing.
- Supabase store auto-seeds demo tenant, dietitian, clients, conversations, messages, AI decision, and processed seed event.
- Supabase-backed operations currently include app state load/reset, client create/update, manual replies, simulator persistence, and handoff resolve/dismiss.
- Supabase Auth-backed demo sign-in creates or reuses `demo@manu.local`, links it to the demo tenant membership, and issues Supabase Auth cookies.
- Supabase-backed API routes resolve tenant/dietitian context from the verified auth user and return `401` without a session or `403` without membership.
- `/dashboard` requires a verified Supabase Auth user when Supabase is configured; fallback mode still uses the local demo cookie.

Inbound flow:

1. Build client context capsule.
2. Classify risk as green/yellow/red.
3. Check AI activation state.
4. If passive, return `no_ai`.
5. If active, decide mode action.
6. Select model by risk.
7. Generate only if allowed.
8. Quality guard validates output.
9. Return/send/draft/handoff/no_ai.

AI activation:

- `active`: AI may operate according to mode.
- `passive`: AI does not generate reply or draft.
- `aiActiveFrom` and `aiActiveUntil` can schedule activation.

Message provenance:

- `client_inbound`
- `ai_generated`
- `dietitian_manual`
- `system_event`
- `imported_unknown`

## Tests

Run core tests:

```powershell
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\dietitian-ai-assistant"
npm test
```

Current expected result:

```text
35/35 tests passing
```

Covered:

- green autopilot uses `gemini-1.5-flash`
- red handoff makes no model call
- passive client blocks AI generation
- scheduled activation blocks generation before start
- copilot drafts green messages
- yellow uses `gemini-3`
- quality guard blocks unsafe plan changes
- tenant isolation rejects mismatched context
- voice profile extraction
- message provenance for AI vs dietitian messages

Run app checks:

```powershell
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\app"
npm run lint
npm test
npm run test:rls
npm run build
```

Current expected app result:

- ESLint passes.
- 49/49 app tests pass.
- RLS integration tests pass against local Supabase; when pointed at non-local Supabase they skip unless `MANU_ALLOW_REMOTE_RLS_TESTS=true`.
- `next build --webpack` passes.
- `npm run test:visual` passes across desktop, tablet, and mobile Chromium viewports.

Note: app scripts intentionally use `--webpack` because Turbopack did not resolve the local symlinked `dietitian-ai-assistant-architecture` package. The core package now has `"exports": "./src/index.js"`.

## Local Supabase Runtime Status

Verified on 2026-05-23:

- Local Supabase project `manu-ai-local` starts successfully.
- Migrations apply successfully to local Supabase Postgres.
- `app/.env.local` exists with local Supabase URL, publishable key, and service secret.
- Supabase CLI is installed as an app dev dependency: run it from `app` with `$env:SUPABASE_TELEMETRY_DISABLED='1'; npx supabase ...`.
- `app/.env.local` is currently pointed at the user's cloud Supabase MANU-AI project `nafcfexwveutnvirhwej`; the file is gitignored and must not be committed or echoed.
- Cloud seed verification returned 1 tenant, 1 dietitian, 3 clients, 3 conversations, 2 messages, 1 AI decision, and 1 processed inbound event.
- Local Supabase API: `http://127.0.0.1:54321`
- Local Supabase Studio: `http://127.0.0.1:54323`
- Local database URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `http://127.0.0.1:3000/api/app-state` returns seeded demo data from Supabase.
- `http://127.0.0.1:3000/dashboard` returns HTTP 200.
- `/api/simulator` writes inbound message, AI reply, AI decision, idempotency key, and audit event to Supabase.
- `/api/messages/manual` writes dietitian manual replies to Supabase.
- `/api/messages/drafts/[id]` approves, edit-sends, or dismisses AI drafts and persists the outcome to Supabase.
- `/api/clients/[id]/release-takeover` releases human takeover locks and records `human_takeover_released`.
- Autopilot readiness uses detailed `safetyChecklist` fields and reports missing checklist keys in simulator decision reasons.
- Unauthenticated `/api/app-state` returns HTTP 401 when Supabase is configured.
- Unauthenticated `/dashboard` redirects to `/` when Supabase is configured.
- Demo sign-in creates a Supabase Auth session and `/api/app-state` then returns seeded demo data.
- `npm run test:rls` verifies tenant-member reads, membership-less reads, cross-tenant write blocking, auxiliary table RLS, Telegram idempotency channel persistence, and Supabase-backed AI control audit events.
- Draft approve, edit-send, and dismiss were verified against local Supabase; demo state was reset afterward.
- Human takeover release was verified against local Supabase; demo state was reset afterward.
- Safety checklist blocking and completion were verified against local Supabase; demo state was reset afterward.
- Added `docs/PILOT_FOUNDATION_HARDENING_SPEC.md`.
- Added migration `app/supabase/migrations/20260524000000_restore_auxiliary_rls_policies.sql` for `client_ai_status_events`, `conversation_memories`, and `risk_assessments`.
- The `20260524000000` local migration was marked as applied with `npx supabase migration repair --local --status applied 20260524000000`.
- `/api/simulator` Supabase persistence now stores processed idempotency events with the simulated client's channel.
- Supabase-backed client AI control updates now write `client_ai_status_events` and `client_ai_control_updated` audit events.
- Demo state was reset back to seed after write verification.
- Codex in-app browser could not open localhost because of its URL policy; use Windows/default browser at `http://localhost:3000/dashboard`.
- Pilot foundation execution continued on 2026-05-25:
  - Added `docs/PILOT_FOUNDATION_EXECUTION_SPEC.md`.
  - Added migration `app/supabase/migrations/20260525000000_risk_assessment_message_uniqueness.sql`.
  - Simulator inbound messages now persist `risk_assessments` in fallback and Supabase-backed state.
  - Duplicate simulator idempotency keys do not create duplicate risk assessments.
  - `MANU_DEV_FALLBACK_STORE=true` now forces fallback mode at Supabase config/proxy resolution.
  - `npm run test:rls` skips unless Supabase URL is local or `MANU_ALLOW_REMOTE_RLS_TESTS=true`.
  - Core safety golden tests now cover green/yellow/red dietetic risk categories and quality guard blocks.
- Playwright visual smoke coverage was added for desktop, tablet, and mobile Chromium.
- Phase 1 visual coverage now includes dashboard navigation, clients, conversation, simulator, draft controls, manual long reply rendering, red handoff, safety-checklist blocking, handoff queue visibility, and horizontal overflow checks.
- Controlled JSON API errors were added for known simulator, manual reply, draft, handoff, and takeover failures.
- Handoff creation now records `handoff_notification_queued` audit events as the first in-app notification stub.
- Phase 2-5 later added production-style auth states, consent/permission governance, backed in-app notifications, data-governance export/anonymization helpers, and the `opted_out` Supabase enum migration.
- Added `docs/NEXT_PHASE_EXECUTION_PLAN.md` as the canonical next phased execution plan.
- Updated risk/data/mobile/Supabase foundation docs to track VCS/checkpoint, dependency audit, consent, notification, data governance, and provider/channel launch gates.
- Current workspace does not appear to contain a `.git` directory; treat rollback/checkpoint strategy as an open operational risk until the user chooses one.

## Next Recommended Work

Continue from the local SaaS prototype:

1. Complete Phase 9 verification and preserve the local Git checkpoint baseline.
2. Keep real WhatsApp, Telegram, Gemini, and real client health data disconnected.

Local dev server:

```powershell
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\app"
npm run dev
```

Open:

```text
http://localhost:3000/dashboard
```

If starting from the root page, use the demo sign-in button to enter `/dashboard`.

Do not connect real WhatsApp or Telegram yet.

## Coding Boundaries

- Keep all new files inside `C:\Users\Dell\OneDrive\Masaüstü\MANU-AI`.
- Do not delete existing files.
- Preserve current core package tests.
- Prefer extending the existing `dietitian-ai-assistant` logic instead of rewriting it.
- Do not add real health-data processing before legal/provider gates are complete.
- Do not fine-tune on raw client messages.
- Do not mix tenants in datasets.

## Key Docs To Maintain

When you make changes, update:

- `PLAN.md`
- `PROJECT_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- relevant `docs/*.md`
- relevant `dietitian-ai-assistant/docs/*.md`

## Final Context For New Chat

The user's last request was to close the current chat and continue in a new chat without losing context. This handoff file exists for that purpose.

## Phase 2 Handoff Notes — 2026-05-25

Completed by: Antigravity (temporary session while Codex was offline)

### What Was Done

- **Confirmed** `proxy.ts` is native Next.js 16 middleware. `middleware.ts` is not needed and Next.js 16 errors if both exist. Build output confirms `ƒ Proxy (Middleware)`.
- **Created** `/api/auth-state` endpoint (`app/src/app/api/auth-state/route.ts`) — returns JSON describing user auth/membership/profile state: `authenticated`, `no_membership`, `no_dietitian_profile`, `unauthenticated`, or `fallback_demo`.
- **Created** `app/src/components/auth-states.tsx` — `NoMembershipState`, `NoDietitianProfileState`, and `MembershipBadge` UI components.
- **Replaced** `app/src/app/dashboard/page.tsx` — now has server-side auth resolution. Renders controlled error states for missing membership or missing dietitian profile. Redirects to `/` if unauthenticated. Falls back to `DashboardApp` directly in fallback mode.
- **Updated** `app/src/lib/use-manu-state.ts` — captures 401/403 auth errors from API calls into `authError` state. Exposes `authError` to consumers.
- **Updated** `app/src/components/dashboard-app.tsx` — accepts `authInfo` prop, shows `MembershipBadge` in header, handles `authError` with session error UI and sign-in redirect link.
- **Created** `app/src/lib/auth-context.test.ts` — 6 unit tests for AppAuthError and authErrorResponse.
- **Created** `docs/PHASE_2_AUTH_ONBOARDING_SHELL_SPEC.md` — full spec for Phase 2.

### Files Changed

| Action | File |
| --- | --- |
| NEW | `app/src/app/api/auth-state/route.ts` |
| NEW | `app/src/components/auth-states.tsx` |
| NEW | `app/src/lib/auth-context.test.ts` |
| NEW | `docs/PHASE_2_AUTH_ONBOARDING_SHELL_SPEC.md` |
| MODIFIED | `app/src/app/dashboard/page.tsx` |
| MODIFIED | `app/src/lib/use-manu-state.ts` |
| MODIFIED | `app/src/components/dashboard-app.tsx` |
| MODIFIED | `docs/NEXT_PHASE_EXECUTION_PLAN.md` |
| MODIFIED | `PLAN.md` |
| MODIFIED | `HANDOFF_FOR_NEXT_CODEX.md` |
| MODIFIED | `app/README.md` |

### Verification Commands — All Passed

```
dietitian-ai-assistant: npm test → 23/23 ✓
app: npm run lint → passed ✓
app: npm test → 24/24 ✓ (6 new auth-context tests)
app: npm run test:rls → 5 skipped (expected, non-local Supabase)
app: npm run build → passed ✓
app: npm run test:visual → 3/3 ✓ (desktop/tablet/mobile)
```

### What Was NOT Done

- No real WhatsApp, Telegram, Gemini, or real health data was connected.
- No destructive git/file commands were run.
- No `npm audit fix --force` was run.
- No `.env.local` contents were printed.
- No breaking refactors were made.
- `proxy.ts` was not modified.

### Remaining Risks

- R-005 (no VCS) remains open.
- R-405 (dependency audit) remains open.
- No real OAuth/SSO — only demo auth exists.
- No multi-tenant switching UI.
- No production signup/registration flow.

### Next Correct Step For Codex

Phase 4: Handoff Notification Architecture — see `docs/NEXT_PHASE_EXECUTION_PLAN.md`. Focus on making urgent handoffs operationally visible without sending external notifications yet.

## Phase 3 Handoff Notes — 2026-05-25

Completed by: Antigravity (temporary session while Codex was offline)

### What Was Done

- **Extended** `PermissionState` type with `opted_out` value in `types.ts`.
- **Strengthened** `getPreflightBlock()` in `simulator.ts`: only `channelPermission === "ready"` allows AI. Pending, blocked, and opted_out all block generation.
- **Added** identity quarantine: empty `channelUserId` blocks AI with `identity_quarantine_no_channel_id`.
- **Added** identity quarantine: `adultStatus === "unknown"` blocks AI with `identity_quarantine_adult_status_unknown`.
- **Added** permission change auditing in `updateClientInState()`: emits `channel_permission_changed` or `channel_permission_opted_out` audit events with previous/new values.
- **Updated** dashboard UI with `opted_out` permission option.
- **Added** 6 new simulator tests for pending/opted_out blocking, identity quarantine, and permission audit.

### Files Changed

| Action | File |
| --- | --- |
| NEW | `docs/PHASE_3_CONSENT_PERMISSION_CHANNEL_GOVERNANCE_SPEC.md` |
| MODIFIED | `app/src/lib/types.ts` |
| MODIFIED | `app/src/lib/simulator.ts` |
| MODIFIED | `app/src/lib/simulator.test.ts` |
| MODIFIED | `app/src/components/dashboard-app.tsx` |
| MODIFIED | `docs/NEXT_PHASE_EXECUTION_PLAN.md` |
| MODIFIED | `PLAN.md` |
| MODIFIED | `HANDOFF_FOR_NEXT_CODEX.md` |
| MODIFIED | `app/README.md` |

### Verification Commands — All Passed

```
dietitian-ai-assistant: npm test → 23/23 ✓
app: npm run lint → passed ✓
app: npm test → 30/30 ✓ (14 simulator + 6 auth-context + 7 store + 1 supabase-config + 2 api-errors)
app: npm run test:rls → 5 skipped (expected)
app: npm run build → passed ✓
app: npm run test:visual → 3/3 ✓
```

### What Was NOT Done

- No client-facing consent/legal copy or KVKK/GDPR text added.
- No real channel opt-in/opt-out webhook handling.
- No real WhatsApp, Telegram, Gemini, or real health data connected.
- No `.env.local` contents printed.
- No breaking refactors.

### Next Correct Step For Codex

Phase 6: Clinical Governance And Evaluation — see `docs/NEXT_PHASE_EXECUTION_PLAN.md`.

## Phase 5 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_5_DATA_GOVERNANCE_SPEC.md`.
- Added `app/src/lib/data-governance.ts` with retention placeholders, client-scoped export, and client anonymization/memory invalidation helpers.
- Added `/api/clients/[id]/export` and `/api/clients/[id]/anonymize`.
- Added fallback and Supabase-backed skeleton support for client export/anonymization.
- Added migration `app/supabase/migrations/20260525010000_add_opted_out_permission_state.sql` to close the Phase 3 Supabase enum gap for `opted_out`.
- Added tests for export scoping, promptable-context invalidation, retention placeholders, and fallback API routes.

### Verification Commands

```text
app: npm test -> 37/37 passed
app: npm run lint -> passed
app: npm run build -> passed
```

### What Was NOT Done

- No final legal retention durations were set.
- No production DSAR workflow or scheduled deletion job was added.
- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data was connected.

### Next Correct Step For Codex

Phase 7: Channel Adapter Readiness. Define normalized WhatsApp/Telegram adapter contracts and mock adapter tests without connecting real channel credentials.

## Phase 7 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_7_CHANNEL_ADAPTER_READINESS_SPEC.md`.
- Added `app/src/lib/channel-adapters.ts` with normalized mock inbound event handling.
- Added `app/src/lib/channel-adapters.test.ts` with mock WhatsApp/Telegram coverage.
- Known mock channel events now resolve clients and use the existing simulator/orchestrator path.
- Unknown and ambiguous channel identities are quarantined before message persistence or AI decisions.
- Duplicate provider events return `duplicate_ignored` without duplicate sends.
- Permission-blocked and opted-out clients stay blocked by the existing safety gate.
- Provider metadata redaction removes raw body, prompt, health profile, diet plan, allergy, memory, and clinical note fields.

### Verification Commands

```text
app: npm test -> 45/45 passed
app: npm run lint -> passed
```

### What Was NOT Done

- No real WhatsApp Business Cloud API connection was added.
- No real Telegram Bot API connection was added.
- No webhook signing, provider credentials, template sending, or outbound delivery state machine was added.

### Next Correct Step For Codex

Phase 8: AI Provider Readiness. Add a mock provider abstraction without sending real health data to Gemini or any external LLM provider.

## Phase 8 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_8_AI_PROVIDER_READINESS_SPEC.md`.
- Created `docs/AI_PROVIDER_REQUIREMENTS.md`.
- Added `app/src/lib/ai-provider.ts` with a deterministic local mock provider.
- Added `app/src/lib/ai-provider.test.ts`.
- Added `app/supabase/migrations/20260525020000_ai_provider_decision_metadata.sql`.
- Simulator generation now uses the mock provider abstraction.
- AI decisions now include prompt version, provider id, provider status, and provider error code metadata.
- Provider timeout/error failures produce safe `no_ai` decisions without outbound AI-generated messages.

### Verification Commands

```text
app: npm test -> 49/49 passed
app: npm run lint -> passed
app: npm run build -> passed
```

### What Was NOT Done

- No real Gemini or external LLM provider was connected.
- No provider SDK, credentials, prompt logging service, fine-tuning, or raw health-data export was added.
- Vendor/legal/provider retention review remains required before real provider use.

### Next Correct Step For Codex

Do not connect production providers or channels yet. The next work should address launch gates: VCS/checkpoint strategy, qualified dietitian clinical approval, provider/legal review, and real WhatsApp/Telegram policy review.

## Phase 4 Handoff Notes — 2026-05-25

Completed by: Antigravity (temporary session while Codex was offline)

### What Was Done

- **Added** `NotificationRecord` type and `notifications` array to `ManuAppState` in `types.ts`.
- **Updated** `simulator.ts` to create a safe-text `NotificationRecord` when an urgent handoff is triggered, converting the previous `handoff_notification_queued` audit event into a backed notification.
- **Added** `markNotificationRead` and `acknowledgeNotification` functionality to `app-state-store.ts` and `use-manu-state.ts`.
- **Created** `/api/notifications/[id]/read` and `/api/notifications/[id]/acknowledge` endpoints.
- **Updated** `supabase-store.ts` to support the new `notifications` array (currently initialized as empty since Supabase push/email adapters are not yet built).
- **Added** Notification Center UI to `dashboard-app.tsx` header: a Bell icon with an unread badge that opens a dropdown panel listing recent notifications.
- **Added** safe-text rules: notification body never contains raw client message content.
- **Added** 2 new simulator tests to verify notification creation and safe-text rules.

### Files Changed

| Action | File |
| --- | --- |
| NEW | `docs/PHASE_4_HANDOFF_NOTIFICATION_ARCHITECTURE_SPEC.md` |
| NEW | `app/src/app/api/notifications/[id]/read/route.ts` |
| NEW | `app/src/app/api/notifications/[id]/acknowledge/route.ts` |
| MODIFIED | `app/src/lib/types.ts` |
| MODIFIED | `app/src/lib/simulator.ts` |
| MODIFIED | `app/src/lib/simulator.test.ts` |
| MODIFIED | `app/src/lib/app-state-store.ts` |
| MODIFIED | `app/src/lib/use-manu-state.ts` |
| MODIFIED | `app/src/lib/supabase-store.ts` |
| MODIFIED | `app/src/components/dashboard-app.tsx` |
| MODIFIED | `docs/NEXT_PHASE_EXECUTION_PLAN.md` |
| MODIFIED | `PLAN.md` |
| MODIFIED | `HANDOFF_FOR_NEXT_CODEX.md` |
| MODIFIED | `app/README.md` |

### Verification Commands — All Passed

```
dietitian-ai-assistant: npm test → 23/23 ✓
app: npm run lint → passed ✓
app: npm test → 32/32 ✓ (2 new tests)
app: npm run test:rls → 5 skipped (expected)
app: npm run build → passed ✓
app: npm run test:visual → 3/3 ✓
```

### What Was NOT Done

- No external push/email provider connected.
- No Supabase table created for `notifications` yet, as this will happen in a future integration milestone.
- No raw client health messages were included in notifications.

### Next Correct Step For Codex

Phase 6: Clinical Governance And Evaluation — see `docs/NEXT_PHASE_EXECUTION_PLAN.md`.
 
## Phase 6 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_6_CLINICAL_GOVERNANCE_EVALUATION_SPEC.md`.
- Created `docs/CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`.
- Added `dietitian-ai-assistant/tests/clinical-golden-cases.jsonl`.
- Added `dietitian-ai-assistant/tests/clinical-governance.test.mjs`.
- Expanded the safety classifier to `dietetic-risk-v0.2.0` with normalized Turkish/ASCII matching.
- Added golden assertions for expected risk, action, model, and provider-call behavior.
- Added expanded persona invariant tests proving persona changes do not alter risk/action/model decisions.

### Verification Commands

```text
dietitian-ai-assistant: npm test -> 35/35 passed
```

### What Was NOT Done

- No real LLM provider was connected.
- No client-facing legal or medical copy was added.
- Qualified dietitian approval is still required before pilot use.

### Next Correct Step For Codex

Phase 7: Channel Adapter Readiness. Define normalized WhatsApp/Telegram adapter contracts and mock adapter tests without connecting real channel credentials.

## Phase 9 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_9_PILOT_READINESS_CLOSURE_SPEC.md`.
- Initialized a local Git repository and added a root `.gitignore`.
- Updated app seed classifier metadata and RLS expectation to `dietetic-risk-v0.2.0`.
- Added migration `app/supabase/migrations/20260525030000_notifications.sql`.
- Supabase store now loads and persists notification records.
- Supabase notification read and acknowledge endpoints now persist state instead of returning `501 not_implemented`.
- Fallback notification actions now return `notification_not_found` for unknown IDs.
- Added fallback API tests for notification read/acknowledge and missing notification errors.
- Added RLS integration coverage for notification tenant isolation.

### What Was NOT Done

- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data was connected.
- No `npm audit fix --force` was run.
- No final clinical, legal, provider, or channel launch-gate approval was claimed.

### Verification Commands

```text
dietitian-ai-assistant: npm test -> 35/35 passed
app: npm run lint -> passed
app: npm test -> 51/51 passed
app: npm run test:rls -> 5 skipped when default .env.local points at remote Supabase without MANU_ALLOW_REMOTE_RLS_TESTS=true
app: npm run test:rls -> 5/5 passed against local Supabase after npx supabase db push --local, with fallback disabled through temporary local env vars
app: npm run build -> passed
app: npm run test:visual -> 3/3 passed
app: npm audit --omit=dev -> R-405 still open; stable Next.js 16.2.6 pins nested PostCSS 8.4.31, canary Next.js is not a safe pilot baseline, npm override invalidates the tree, and only breaking npm audit fix --force is offered
```

### Next Correct Step For Codex

Continue with the next remaining production-readiness step. Keep production provider/channel work blocked until external launch gates are approved.

## Phase 10 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_10_PRODUCTION_READINESS_GATES_SPEC.md`.
- Added `app/src/lib/launch-gates.ts` with the production-pilot launch gate definitions and evaluator.
- Added `app/src/lib/launch-gates.test.ts`.
- Production pilot launch is blocked by default until every known gate is externally approved.
- Unknown approval keys are ignored and reported.

### What Was NOT Done

- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data was connected.
- No legal, clinical, provider, channel, incident, backup, secret, or dependency approval was claimed.
- No admin UI or persistence table for approvals was added.

### Verification Commands

```text
app: npm test -- launch-gates -> 54/54 passed
app: npm run lint -> passed
```

### Next Correct Step For Codex

Continue with the next remaining production-readiness step while keeping the production-pilot gate evaluator blocked by default.

## Phase 11 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_11_OPERATIONAL_EVIDENCE_READINESS_SPEC.md`.
- Created `docs/INCIDENT_RESPONSE_RUNBOOK.md`.
- Created `docs/BACKUP_RESTORE_RUNBOOK.md`.
- Created `docs/SECRET_ROTATION_RUNBOOK.md`.
- Extended `app/src/lib/launch-gates.ts` so every production-pilot gate lists required external evidence.
- Added a unit test proving every gate remains externally approved and has evidence requirements.

### What Was NOT Done

- No launch gate was approved.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data was connected.
- No production secrets, real client identifiers, or raw health data were added to runbooks.

### Verification Commands

```text
app: npm test -- launch-gates -> 55/55 passed
app: npm run lint -> passed
```

### Next Correct Step For Codex

Move to the next production-readiness layer only after preserving this checkpoint. Keep launch blocked until external gate evidence is reviewed and approved.

## Phase 12 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_12_RBAC_AUTHORIZATION_SPEC.md`.
- Added `TenantRole` to app types.
- Extended `resolveAppTenantContext()` so authenticated Supabase requests carry membership role.
- Added `AppCapability`, `hasCapability()`, and `requireCapability()` in `auth-context.ts`.
- Added capability checks to Supabase-backed API routes before existing production actions.
- Owner/admin/dietitian keep current workflow access.
- Assistant/auditor are limited to `read_app_state` until client assignments and minimized auditor views are implemented.

### What Was NOT Done

- No client assignment model was added.
- No auditor minimized dashboard was added.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -- auth-context -> 58/58 passed
app: npm run lint -> passed
```

### Next Correct Step For Codex

Proceed to client assignment and scoped access. Keep assistant/auditor mutation access blocked until that model exists.

## Phase 13 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_13_CLIENT_ASSIGNMENT_SCOPED_ACCESS_SPEC.md`.
- Added migration `app/supabase/migrations/20260525040000_client_assignments.sql`.
- Added `client_assignments` RLS coverage to `supabase-rls.integration.test.ts`.
- Added `scopeSupabaseState()` in `supabase-store.ts`.
- Added `supabase-store.test.ts` coverage for owner/admin, dietitian, assistant, and auditor scoping.
- Owner/admin see all tenant app-state records.
- Dietitians see owned plus assigned clients.
- Assistants see assigned clients only.
- Auditors receive no raw client/message/decision/handoff/notification records in app-state.

### What Was NOT Done

- No team-management or assignment UI was added.
- No minimized auditor dashboard was added.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -> 62/62 passed
app: npm run lint -> passed
app: npx supabase db push --local -> applied 20260525040000_client_assignments.sql
app: npm run test:rls -> 5/5 passed against local Supabase
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to DSAR, retention, and legal operations ledger. Keep assignment UI and minimized auditor dashboard as future work unless explicitly requested.

## Phase 14 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`.
- Added migration `app/supabase/migrations/20260525050000_data_requests.sql`.
- Added `DataRequestRecord` and `dataRequests` to `ManuAppState`.
- Fallback export now records a completed `export` data request and minimized `client_data_exported` audit event.
- Fallback anonymization now records a completed `anonymization` data request.
- Supabase export/anonymization paths persist `data_requests`.
- Client export bundles include target-client data request history.
- RLS integration covers `data_requests` tenant isolation.

### What Was NOT Done

- No automatic deletion scheduler was added.
- No final retention durations were set.
- No client-facing DSAR portal was added.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -> 63/63 passed
app: npm run lint -> passed
app: npx supabase db push --local -> applied 20260525050000_data_requests.sql
app: npm run test:rls -> 5/5 passed against local Supabase
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Safe Observability and Operational Health. Keep deletion automation and final retention durations blocked until legal review.

## Phase 15 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_15_SAFE_OBSERVABILITY_OPERATIONAL_HEALTH_SPEC.md`.
- Created `docs/ERROR_MONITORING_POLICY.md`.
- Added `app/src/lib/operational-health.ts`.
- Added `app/src/lib/operational-health.test.ts`.
- Operational health snapshots now report aggregate counts for open/urgent handoffs, failed provider decisions, unread notifications, pending/stale drafts, passive clients, and launch-gate blocked state.
- Snapshot tests prove raw message, prompt, channel identifier, diet plan fragment, and secret-like values are not emitted.

### What Was NOT Done

- No dashboard UI was changed.
- No external monitoring, analytics, logging, email, push, WhatsApp, Telegram, Gemini, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -> 66/66 passed
app: npm run lint -> passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Channel Policy Simulation Hardening. Keep real WhatsApp/Telegram production webhooks blocked until policy review is approved.

## Phase 16 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_16_CHANNEL_POLICY_SIMULATION_HARDENING_SPEC.md`.
- Hardened `processMockChannelInbound()` in `app/src/lib/channel-adapters.ts`.
- Missing provider event ids now fail closed before client lookup, message creation, risk assessment, or AI decision creation.
- Empty channel bodies now fail closed and are marked idempotently processed by provider event id.
- Exact opt-out commands (`STOP`, `DUR`, `IPTAL`, `IPTAL ET`, `CANCEL`) update matched clients to `channelPermission = opted_out` without entering the AI path.
- Channel policy audit metadata records only safe booleans/reasons and excludes raw body text and raw channel identifiers.
- Added channel adapter tests for missing provider ids, empty bodies, opt-out handling, duplicate blocked events, and minimized audit metadata.

### What Was NOT Done

- No real WhatsApp or Telegram webhook was connected.
- No webhook signature verification was added.
- No outbound template registry or 24-hour service-window enforcement was added.
- No external monitoring, analytics, logging, email, push, Gemini, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -- channel-adapters -> 70/70 passed
app: npm run lint -> passed
app: npm test -> 70/70 passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Provider Policy Guard and Prompt Boundary. Keep real provider calls and real channel integrations blocked until external launch gates are approved.

## Phase 17 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_17_PROVIDER_POLICY_GUARD_PROMPT_BOUNDARY_SPEC.md`.
- Added `buildMockProviderInput()` in `app/src/lib/ai-provider.ts`.
- Added `assertMockProviderInputPolicy()` runtime guard in `app/src/lib/ai-provider.ts`.
- Mock provider input now allows only `risk` and `client.dietPlan.summary`.
- Runtime guard rejects prompt/capsule-style payloads, extra client fields, extra diet-plan fields, invalid summary types, and red-risk provider calls.
- Simulator provider calls now use the allowlisted input builder instead of passing the full client object.
- Provider policy violations are normalized as `provider_policy_violation` and become safe no-send simulator decisions.
- Added provider and simulator tests for allowlist construction, boundary rejection, red-risk defense, and controlled safe no-send behavior.

### What Was NOT Done

- No real Gemini or external LLM provider was connected.
- No core architecture prompt rewrite was done.
- No provider logging, analytics, monitoring, or prompt storage service was added.
- No real WhatsApp, Telegram, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -- ai-provider -> 74/74 passed
app: npm test -- simulator -> 75/75 passed
app: npm run lint -> passed
app: npm test -> 75/75 passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Notification SLA and Internal Escalation. Keep external email/push/WhatsApp/Telegram notifications blocked until notification payload policy and launch gates are approved.

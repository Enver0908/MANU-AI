# MANU-AI Supabase Foundation Spec

## Goal

Move the local dashboard prototype from browser-only `localStorage` state to a local Supabase-backed SaaS foundation while keeping real WhatsApp, Telegram, Gemini, and real client health data disconnected.

## Success Criteria

- Dashboard can load tenant, dietitian, clients, conversations, messages, AI decisions, and handoffs from API-backed state.
- Client create/update, manual replies, simulator runs, and handoff status changes persist through API routes.
- Simulator still calls the existing `dietitian-ai-assistant` core orchestrator.
- Duplicate simulator idempotency keys do not create duplicate messages or AI decisions.
- Local development can run without cloud Supabase credentials by using local demo bootstrap endpoints and documented local Supabase env vars.
- Existing core tests, app simulator tests, lint, and build keep passing.

## Implementation Status

Completed on 2026-05-23:

- Added local Supabase config in `app/supabase/config.toml`.
- Added initial schema migration and schema-fix migration under `app/supabase/migrations`.
- Replaced dashboard `localStorage` state with API-backed state.
- Added app state, client, simulator, manual message, and handoff API routes.
- Added `app/src/lib/app-state-store.ts` as the dev fallback store.
- Added `app/src/lib/supabase-store.ts` as the Supabase-backed persistence layer.
- Added Supabase admin client helper in `app/src/lib/supabase.ts`.
- Added `app/.env.local.example`.
- Created `app/.env.local` with local Supabase credentials after running local Supabase.
- Verified local Supabase project `manu-ai-local` starts and applies migrations.
- Verified `/api/app-state` loads seeded demo data from live Supabase.
- Verified `/api/simulator` persists simulator outputs to Supabase.
- Verified `/api/messages/manual` persists manual dietitian replies to Supabase.
- Reset demo state back to seed data after write verification.
- Verified `npm run lint`, `npm test`, and `npm run build` in `app`.

Completed later on 2026-05-23:

- Added Supabase SSR browser/server client helpers.
- Added verified Supabase Auth user resolution for API routes.
- Added tenant membership and dietitian profile resolution from `tenant_memberships.user_id = auth.uid()` and `dietitians.auth_user_id`.
- Updated `/dashboard` protection to require a Supabase Auth user when Supabase is configured.
- Updated demo sign-in to create/reuse `demo@manu.local`, bind the demo tenant membership to that auth user, and issue Supabase Auth cookies.
- Updated app state, client, simulator, manual message, and handoff routes to return `401` for unauthenticated Supabase-backed calls and `403` for users without tenant/dietitian membership.
- Verified unauthenticated `/api/app-state` returns `401`, unauthenticated `/dashboard` redirects, demo sign-in creates a session, `/api/app-state` returns demo tenant data, and `/api/simulator` still processes a green demo message.
- Added `npm run test:rls` with local Supabase integration coverage for tenant-member reads, membership-less reads, and cross-tenant write blocking.
- Added draft approval/edit-send/dismiss persistence through `/api/messages/drafts/[id]`.
- Verified local Supabase draft approve, edit-send, and dismiss actions, then reset demo state back to seed data.
- Added explicit human takeover release through `/api/clients/[id]/release-takeover`.
- Verified takeover lock blocks simulator generation, release records `human_takeover_released`, and a later green message can send again.
- Replaced the UI-facing single safety toggle with detailed `safetyChecklist` fields for goal, diet plan, allergies, restricted foods, risk flags, channel permission, and adult/minor status review.
- Autopilot now blocks when any checklist item is missing and includes missing checklist keys in the simulator decision reasons.

Completed during pilot foundation hardening on 2026-05-23:

- Added `docs/PILOT_FOUNDATION_HARDENING_SPEC.md`.
- Added `app/supabase/migrations/20260524000000_restore_auxiliary_rls_policies.sql`.
- Restored tenant-scoped RLS policies for `client_ai_status_events`, `conversation_memories`, and `risk_assessments`.
- Expanded RLS integration coverage to 5 tests.
- Fixed simulator idempotency event persistence so Telegram simulations store `channel = telegram`.
- Supabase-backed client AI control updates now write `client_ai_status_events` and `client_ai_control_updated` audit events.

Local runtime endpoints:

- Dashboard: `http://localhost:3000/dashboard`
- Supabase API: `http://127.0.0.1:54321`
- Supabase Studio: `http://127.0.0.1:54323`
- Supabase DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

Known local verification note:

- Codex in-app browser could not open localhost because of its own URL policy. The app was verified through HTTP checks and can be opened in the Windows/default browser.

## Scope

- In scope: local Supabase config, schema/migration corrections, seed/bootstrap data, API-backed app state, simulator persistence, and tests around mapping/persistence logic.
- Out of scope: production WhatsApp/Telegram adapters, real outbound messages, real Gemini calls, production legal copy, fine-tuning datasets, and real health-data processing.

## Remaining Work

- Continue Phase 6 clinical governance work from `docs/NEXT_PHASE_EXECUTION_PLAN.md`.
- Keep production DSAR operations, final retention durations, and scheduled deletion jobs blocked until legal review.

## Implementation Update - 2026-05-25

Completed:

- Added `docs/PILOT_FOUNDATION_EXECUTION_SPEC.md`.
- Added simulator `risk_assessments` persistence for every non-duplicate inbound simulator message.
- Added a uniqueness migration for `risk_assessments.message_id`.
- Added local-only RLS test protection: remote Supabase RLS tests require `MANU_ALLOW_REMOTE_RLS_TESTS=true`.
- Added `MANU_DEV_FALLBACK_STORE=true` support at Supabase config resolution so proxy/API/test flows can force fallback mode.
- Added core safety golden tests for green/yellow/red dietetic risk categories and quality guard blocks.
- Added a Playwright dashboard visual smoke test across desktop, tablet, and mobile Chromium viewports.
- Added `handoff_notification_queued` audit events as an in-app notification architecture stub.
- Expanded Phase 1 hardening with controlled API errors, forced fallback tests, duplicate risk-assessment coverage, and visual checks for draft controls, manual long replies, red handoff, safety-checklist blocking, handoff queue visibility, and mobile/tablet overflow.
- Added `20260525010000_add_opted_out_permission_state.sql` so Supabase supports the Phase 3 `opted_out` permission state.
- Added Phase 5 data-governance skeleton support for client-scoped export and client anonymization/memory invalidation.

## Edge Cases

- Unauthenticated API calls return `401` unless they are dev-only bootstrap/demo endpoints.
- Authenticated user with no tenant membership gets `403`.
- Client update cannot cross tenant boundaries.
- Manual replies with empty body do not create messages.
- Simulator duplicate idempotency key returns `duplicate_ignored`.
- Red risk creates a handoff and no AI-generated message.
- Passive AI and scheduled-not-yet-active clients create audit/system state without model generation.
- Autopilot with incomplete safety checklist is blocked before model generation.
- Handoff resolve/dismiss only affects open cases in the current tenant.
- Duplicate simulator idempotency keys do not create extra risk assessment records.
- Client anonymization clears promptable context and rolling memory while retaining minimized audit evidence.
- Visual smoke tests run against fallback mode and do not require real Supabase, WhatsApp, Telegram, or Gemini.

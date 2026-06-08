# MANU-AI Local App Prototype

This is the first local SaaS/PWA prototype for MANU-AI.

It uses:

- Next.js 16
- TypeScript
- Tailwind CSS
- Supabase-backed API store for local persistence
- Supabase CLI installed as a project dev dependency
- Local file dependency on `../dietitian-ai-assistant`
- Dev fallback store when local Supabase env vars are missing

## Run

```bash
npm run dev
```

Open:

```text
http://localhost:3000/dashboard
```

If starting from the root page, use the demo sign-in button to enter `/dashboard`.

## Checks

```bash
npm run lint
npm test
npm run test:rls
npm run build
npm run release:verify
```

The scripts use `--webpack` because Turbopack did not resolve the local symlinked core package reliably.

`npm run release:verify` runs the core package tests, lint, unit/API tests, production build, and the production dependency audit gate. It allows only the documented R-405 Next.js/PostCSS finding and does not run `npm audit fix --force`.

Latest local release verification on 2026-06-08 passed after Phase 76Q with core tests 165/165, app tests 284/284, lint, production build, and only the documented R-405 production audit finding. Phase 76Q formally closed the 76C–76P food-rule track with verify+commit protocol evidence; `npm run test:rls` skipped because local Supabase was unavailable. WhatsApp production adapter is next.

Phase 29 is documentation/evidence hardening only. It keeps production pilot blocked, records that stable `next@latest` 16.2.6 still bundles `postcss@8.4.31`, and requires local Supabase before RLS evidence can be counted as passed.

Completion Roadmap Phase 2 was attempted on 2026-05-31. Local Supabase could not start because Docker Desktop's Linux engine pipe was unavailable, so `npm run test:rls` skipped 10 guarded tests. R-406 remains blocked until Docker/local Supabase is available and the expanded RLS suite passes locally.

Completion Roadmap Phase 3 rechecked R-405 on 2026-05-31. Stable `next@latest` remains `16.2.6` with nested `postcss@8.4.31`, `eslint-config-next@latest` remains `16.2.6`, and production audit still reports only the known moderate `next`/`postcss` findings. No dependency files should change until stable Next bundles `postcss >= 8.5.10` or formal external risk acceptance is supplied.

Completion Roadmap Phase 7 prepared the provider/vendor review packet on 2026-05-31. `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md` is review evidence only; it does not approve real Gemini/external LLM use, internal copilot provider egress, dietitian context update provider egress, provider credentials, or prompt/completion logging.

Completion Roadmap Phase 8 prepared the channel policy review packet on 2026-05-31. `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md` is review evidence only; it does not approve real WhatsApp/Telegram use, production webhooks, channel credentials, template registries, or outbound messaging.

Completion Roadmap Phase 9 prepared the incident and DSAR review packet on 2026-05-31. `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md` is review evidence only; it does not approve production incident response, named production owners, monitoring/ticketing integrations, production DSAR/deletion operations, or real client health-data processing.

Completion Roadmap Phase 10 prepared the backup/restore review packet on 2026-05-31. `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md` is review evidence only; it does not approve production backup/restore operations, backup provider setup, storage, secret manager changes, restore-drill success, or real client health-data processing.

Completion Roadmap Phase 11 prepared the secret rotation review packet on 2026-05-31. `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md` is review evidence only; it does not approve production secret management, secret manager setup, real credential creation, credential rotation, or real provider/channel/infrastructure secrets.

Completion Roadmap Phase 12 prepared the dependency audit clearance packet on 2026-05-31. `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md` is review evidence only; it does not resolve or accept R-405. Stable `next@latest` remains `16.2.6` with nested `postcss@8.4.31`, so dependency files remain unchanged.

Completion Roadmap Phase 13 prepared the final readiness closure summary on 2026-05-31. `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md` records the current production-pilot decision as `NO-GO`: all eight launch gates remain open, R-405 remains open, and R-406 remains blocked.

## Supabase CLI

The Supabase CLI is installed locally as a dev dependency because global `npm install -g supabase` is not supported by Supabase. Use it from this folder with telemetry disabled:

```powershell
$env:SUPABASE_TELEMETRY_DISABLED='1'; npx supabase status
$env:SUPABASE_TELEMETRY_DISABLED='1'; npx supabase migration list --local
```

If a migration was manually applied to the local database and needs to be recorded in CLI history:

```powershell
$env:SUPABASE_TELEMETRY_DISABLED='1'; npx supabase migration repair --local --status applied <version>
```

## Current Scope

- Protected demo dashboard route
- Server-side auth resolution with controlled error states for no-membership and missing-dietitian-profile
- `/api/auth-state` endpoint for client-side auth state queries
- `NoMembershipState` and `NoDietitianProfileState` error UI components
- Membership badge showing authenticated user display name and role in dashboard header
- Auth error handling in `use-manu-state` with session error UI and sign-in redirect
- Channel permission governance: only `ready` allows AI; `pending`, `blocked`, and `opted_out` all block generation
- Identity quarantine: empty channelUserId and unknown adultStatus block AI
- Permission change auditing with previous/new values and distinct opt-out event type
- Mock WhatsApp/Telegram adapter contracts with identity quarantine and duplicate event idempotency (Phase 7)
- Deterministic mock AI provider with prompt/provider metadata and safe failure handling (Phase 8)
- Bounded PromptContext compilation, raw-text-free context manifests, missing-history fail-closed behavior, and stale draft invalidation (Phase 23)
- In-app notification center with `NotificationRecord` API backed by safe-text rules and Supabase persistence (Phase 9)
- Data governance skeleton with retention placeholders, client-scoped export, and client anonymization APIs (Phase 5)
- Client list and client detail controls
- AI active/passive controls
- Activation windows
- Persona and AI mode controls
- Detailed safety checklist for autopilot readiness
- Simulator risk assessment persistence
- Conversation timeline with message origin labels
- Draft approval, edit-send, and dismiss controls for AI-generated drafts
- Explicit human takeover release control with audit persistence
- Dietitian voice sample intake, approval/rejection, generated voice profile state, and `Voice` dashboard panel (Phase 24)
- Versioned dynamic client form schemas, response snapshots, prompt allowlist fields, and `Forms` dashboard panel (Phase 25)
- Multilingual language support for Turkish, English, German, French, Spanish, Portuguese, and Czech, including dietitian dashboard language, client communication language, client phone identity, form language metadata, localized mock replies, and localized safe handoff acknowledgements (Phase 43)
- Read-only internal dietitian `Copilot` tab and `/api/internal-copilot/messages` API using curated tenant-scoped local/mock tools with source refs (Phase 26)
- Dietitian-entered Critical Context panel and `/api/clients/[id]/context-updates` for phone, Zoom, in-person, or other non-chat client updates (Phase 27)
- Dietitian chat-to-form update proposals with explicit apply/reject, allowlisted additive patches, context revision checks, audit evidence, and `/api/clients/[id]/update-proposals` routes (Phase 76A)
- Expanded chat form/safety updates for pregnancy, adult/minor status, diagnosis, medication/insulin, lab, symptom, and eating-disorder form flags while keeping AI/channel/lock controls manual (Phase 76B)
- AI security remediation with provider-attempt audit semantics, PromptContext source metadata, send-time draft revalidation, provider segment allowlist, tenant-aware channel/idempotency uniqueness, and scoped RLS/RBAC helper policies (Phase 28)
- Inbound simulator wired to `handleInboundMessage`
- Handoff queue
- PWA manifest and service worker
- Supabase migration under `supabase/migrations`
- API-backed app state endpoints
- Supabase-backed API store when local Supabase env vars are configured
- Dev fallback store when local Supabase credentials are not configured
- Forceable dev fallback mode with `MANU_DEV_FALLBACK_STORE=true`
- Supabase Auth-backed demo session when local Supabase credentials are configured
- Playwright dashboard visual smoke checks for core flows and responsive overflow

No real WhatsApp, Telegram, cloud Supabase project, Gemini, external model provider, email, push, monitoring, analytics, secret manager, or real client health data is connected yet.

## Local Supabase Foundation

Local Supabase config lives in `supabase/config.toml`.

Use `.env.local.example` as the starting point for local credentials.

When `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are set, API routes use `src/lib/supabase-store.ts` and auto-seed demo data. When they are missing, the same routes use the in-memory dev fallback store.

Verified local runtime on 2026-05-23:

- Local Supabase project `manu-ai-local` starts successfully.
- Local migrations apply successfully.
- `.env.local` was created with local Supabase credentials.
- Dashboard: `http://localhost:3000/dashboard`
- `/api/auth-state` returns user auth/membership/profile state.
- `/api/clients/[id]/export` returns a tenant/client-scoped export bundle.
- `/api/clients/[id]/anonymize` clears promptable client context and rolling memory while preserving minimized audit evidence.
- Supabase API: `http://127.0.0.1:54321`
- Supabase Studio: `http://127.0.0.1:54323`
- `/api/app-state` loads seeded data from Supabase.
- `/api/simulator` and `/api/messages/manual` persist to Supabase.
- `npm run lint`, `npm test`, and `npm run build` pass.

Note: Codex in-app browser could not open localhost because of its own URL policy. Use the Windows/default browser for local visual checks.

Supabase Auth session handling and tenant membership resolution are now wired for the local demo user.

When Supabase is configured:

- The demo sign-in creates or reuses `demo@manu.local`.
- `MANU_DEMO_PASSWORD` can override the local demo password.
- The demo user is linked to the seeded demo tenant through `tenant_memberships`.
- `/dashboard` requires an authenticated Supabase session.
- Supabase-backed API routes return `401` without a session and `403` without tenant membership.
- `npm run test:rls` verifies tenant-member reads, membership-less reads, cross-tenant write blocking, scoped assistant/viewer/care-team/auditor behavior, internal copilot scoping, and tenant-aware channel/idempotency uniqueness against local Supabase when env vars are configured.
- `npm run test:rls` also verifies auxiliary RLS policies, Telegram simulator idempotency channel persistence, and Supabase-backed AI control audit events.
- `npm run test:rls` runs only against local Supabase unless `MANU_ALLOW_REMOTE_RLS_TESTS=true` is set.
- AI draft approve/edit-send/dismiss actions persist through `/api/messages/drafts/[id]`.
- Human takeover release persists through `/api/clients/[id]/release-takeover` and records `human_takeover_released`.
- Autopilot safety gating now uses the detailed `safetyChecklist` fields and reports missing checklist keys in simulator decisions.
- Simulator inbound messages persist `risk_assessments`; duplicate simulator idempotency keys do not duplicate those records.
- Supabase-backed red handoffs persist safe-text notification records.
- `/api/notifications/[id]/read` and `/api/notifications/[id]/acknowledge` persist read/acknowledged state when Supabase is configured.

## Visual Smoke Checks

The visual smoke test uses Chromium and fallback mode:

```powershell
npx playwright install chromium
npm run test:visual
```

`npm run test:visual` runs `npm run build` first and then checks the dashboard on desktop, tablet, and mobile viewports. Coverage includes dashboard navigation, client list, conversation view, simulator flow, draft controls, manual long replies, red handoff, safety-checklist blocking, handoff queue visibility, and horizontal overflow guards.

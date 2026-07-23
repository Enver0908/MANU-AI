# Phase 85 Stage 4C Evidence

Date: 2026-07-23
Status: **Faz 8 complete locally; Faz 9 is next (requires explicit user approval)**

Production remains `NO-GO`. R-405 remains open.

## Faz 1: Kanonik Plan, Tehdit Modeli ve Uygulama Okuma Kapisi

Status: **complete locally**

Historical detail remains in `docs/PHASE_85_STAGE_4C_PHASE_1_READ_GATE_EVIDENCE.md`.

- Branch at closure: `codex/stage-4b4-voice-transcription`
- Starting commit: `75e7ea9`
- Documentation-only; no runtime/schema change
- Risks `R-462` through `R-480` opened in `docs/RISK_REGISTER.md`

## Faz 2: Veri Modeli, Yetki, RLS ve Degismezlik Temeli

Status: **complete locally**

### Starting State

- Branch: `codex/stage-4b4-voice-transcription`
- Starting commit: `d422974 Document Stage 4C AI chat read gate`
- Worktree before edits: clean

### Files Created

- `app/supabase/migrations/20260722100000_phase_85_stage_4c_domain.sql`
- `app/supabase/migrations/20260722110000_phase_85_stage_4c_rls.sql`
- `app/src/lib/phase-85-stage-4c-contracts.ts`
- `docs/PHASE_85_STAGE_4C_EVIDENCE.md`

### Files Updated

- `app/src/lib/auth-context.ts`
- `app/src/lib/auth-context.test.ts`
- `app/src/lib/types.ts`
- `app/src/lib/seed-data.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/lib/supabase-rls.integration.test.ts`
- continuity docs

### Schema Delivered

Tables:

- `ai_chat_conversations`
- `ai_chat_branches`
- `ai_chat_messages`
- `ai_chat_message_versions`
- `ai_chat_runs`
- `ai_chat_run_events`
- `ai_chat_tool_calls`
- `ai_chat_context_snapshots`
- `ai_chat_source_refs`
- `ai_chat_memory_summaries`
- `ai_chat_provider_egress_manifests`
- `ai_chat_mutation_ledger`
- `ai_chat_events`

Constraints and helpers:

- Immutable `tenant_id`, creator, `scope_type`, and `client_id` on conversations
- Scope checks: `general => client_id IS NULL`, `client => client_id IS NOT NULL`
- Immutable message version rows
- General-scope client source ref rejection
- `p85_stage_4c_actor_owns_chat(...)`
- `p85_stage_4c_actor_can_access_client_chat(...)`
- Creator-private SELECT policies with client-access revalidation
- Worker/audit tables service-role only

### Verification (Faz 2)

| Command | Result |
| --- | --- |
| `npm run lint` | pass |
| `npx vitest run src/lib/auth-context.test.ts` | 11/11 pass |
| `npm run build` | pass |
| `npm run test:rls` | **46 skipped** — remote Supabase; migrations not applied remotely |

## Faz 3: Bounded Servis Katmani, CRUD API ve Istemci Arama

Status: **complete locally**

### Starting State

- Branch: `codex/stage-4b4-voice-transcription`
- Starting commit: `b13c4aa Complete Stage 4C Faz 2 AI chat data model, RLS, and capability baseline.`
- Scope: bounded store, CRUD/read API routes, client search, idempotency, revision control, opaque cursor — no message send, run lifecycle, delete, attachments, or UI

### Files Created

- `app/supabase/migrations/20260722120000_phase_85_stage_4c_bounded_api_rpcs.sql`
- `app/src/lib/client-reference-code.ts`
- `app/src/lib/phase-85-stage-4c-store.ts`
- `app/src/lib/phase-85-stage-4c-service.ts`
- `app/src/lib/phase-85-stage-4c-route.ts`
- `app/src/lib/phase-85-stage-4c-service.test.ts`
- `app/src/app/api/ai-chat/conversations/route.ts`
- `app/src/app/api/ai-chat/conversations/[chatId]/route.ts`
- `app/src/app/api/ai-chat/conversations/[chatId]/branches/route.ts`
- `app/src/app/api/ai-chat/conversations/[chatId]/branches/[branchId]/activate/route.ts`
- `app/src/app/api/ai-chat/clients/route.ts`

### Files Updated

- `app/src/lib/phase-85-stage-4c-contracts.ts` — limits, list/detail DTOs, error envelope, rate-limit constants
- `app/src/lib/app-errors.ts` — optional `field` and `revision` on `AppRequestError`
- `app/src/lib/rate-limit.ts` — `dietitian_ai_chat` scope and limits
- continuity docs

### Delivered Behavior

- `AiChatStore` bounded methods: `createConversation`, `listConversations`, `loadConversation`, `renameConversation`, `listBranches`, `activateBranch`, `searchAccessibleClients`
- `SupabaseAiChatStore` production adapter via bounded RPCs
- `InMemoryAiChatStore` only when `NODE_ENV=test` or `AI_CHAT_DETERMINISTIC_MODE=true`
- Production without Supabase → `503 ai_chat_store_unavailable` (no fallback)
- Client reference: reversible Crockford Base32 UUID encoding (`client-reference-code.ts`)
- Opaque base64url list cursor with scope/query validation → `400 ai_chat_cursor_invalid`
- Mutation idempotency via canonical body SHA-256 ledger
- Revision mismatch → `409 ai_chat_revision_conflict` with current revision
- Rate limits: read 120/min, mutation 60/min per user
- API error envelope `{ error: { code, retryable, field?, revision? }, requestId }`
- `title_source='user'` on create/rename; empty title → `400 ai_chat_title_required`
- Client search DTO: `id`, `fullName`, `displayReference`, `shortDisplay`, `channel` (no phone/email)

### API Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/ai-chat/conversations` | List with scope/query/cursor |
| POST | `/api/ai-chat/conversations` | Create conversation + initial branch |
| GET | `/api/ai-chat/conversations/[chatId]` | Load conversation detail |
| PATCH | `/api/ai-chat/conversations/[chatId]` | Rename (revision-gated) |
| GET | `/api/ai-chat/conversations/[chatId]/branches` | List branches |
| POST | `/api/ai-chat/conversations/[chatId]/branches/[branchId]/activate` | Activate branch (revision-gated) |
| GET | `/api/ai-chat/clients` | Search accessible active clients |

### Verification (Faz 3)

| Command | Result |
| --- | --- |
| `npm run lint` | pass |
| `npx vitest run src/lib/phase-85-stage-4c-service.test.ts` | 11/11 pass |
| `npm run build` | pass |
| `npm run test:rls` | **46 skipped** — remote Supabase; new migration chain not applied remotely |

### Test Coverage Added

- DTO parser unknown-field rejection
- Client reference encode/decode round-trip
- Cursor filter mismatch rejection
- Idempotent create
- Stale revision rename rejection
- Cross-tenant client search exclusion
- Production fail-closed store resolution (`503 ai_chat_store_unavailable`)
- Same-name client disambiguation via distinct reference codes

### Open Blockers After Faz 3

- Apply migrations to local Supabase and rerun `npm run test:rls` with **zero skipped** before broader closure evidence
- `R-405` remains open
- Production remains `NO-GO`
- UI (Faz 4) requires explicit user approval before implementation

### Next

Faz 4: Dashboard AI Chat Sayfasi ve ChatGPT Benzeri Arayuz Temeli — after explicit user approval.

## Faz 4: Dashboard AI Chat Sayfasi ve ChatGPT Benzeri Arayuz Temeli

Status: **complete locally**

### Starting State

- Branch: `codex/stage-4b4-voice-transcription`
- Starting commit: `db72c68 Complete Stage 4C Faz 3 bounded service layer, CRUD API, and client search.`
- Scope: dashboard shell extraction, real routes (`/dashboard/ai-chat`, `/dashboard/ai-chat/[chatId]`), nav replacement, legacy redirect, client "AI ile degerlendir" deep-link, three-pane workspace shell, history sidebar, new-chat client picker, focus mode, mobile drawers, i18n — no real message send/streaming (Faz 5)

### Files Created

- `app/src/app/dashboard/ai-chat/page.tsx`
- `app/src/app/dashboard/ai-chat/[chatId]/page.tsx`
- `app/src/components/ai-chat/ai-chat-page-client.tsx`
- `app/src/components/ai-chat/ai-chat-workspace.tsx`
- `app/src/components/ai-chat/ai-chat-history-sidebar.tsx`
- `app/src/components/ai-chat/ai-chat-client-picker.tsx`
- `app/src/components/ai-chat/ai-chat-message-list.tsx` (+ `.test.ts`)
- `app/src/components/ai-chat/ai-chat-composer.tsx`
- `app/src/components/ai-chat/ai-chat-context-drawer.tsx`
- `app/src/components/dashboard/dashboard-shell.tsx`
- `app/src/lib/dashboard-server-auth.ts`
- `app/src/lib/use-ai-chat.ts` (+ `.test.ts`)
- `app/tests/visual/ai-chat.visual.spec.ts` (+ snapshots)

### Files Updated

- `app/src/lib/phase-85-stage-4b-dashboard-routing.ts` / `.test.ts` — `DashboardNavKey`, `AI_CHAT_ROOT_PATH`, server-only `isAiChatUiEnabled()` (no `NEXT_PUBLIC_` prefix), `resolveLegacyCopilotSectionRedirect()`
- `app/src/lib/i18n.ts` — AI Chat strings across all seven languages
- `app/src/components/dashboard/dashboard-navigation.tsx` — removed Copilot nav entry; added real `Link`-based AI Chat entry gated by an `aiChatEnabled` prop (not the flag directly, so client bundles never need the server-only env var)
- `app/src/components/dashboard/clients-panel.tsx` — removed `tab_copilot`; added "AI ile degerlendir" command gated by `aiChatEnabled` prop, with loading/fail-closed error state
- `app/src/components/dashboard-app.tsx` — uses `DashboardShell`; legacy `?section=copilot` replace-redirect; `evaluateClientWithAi` (fail-closed error surface, no silent no-op)
- `app/src/app/dashboard/page.tsx` — uses extracted `resolveDashboardAuth`; passes server-resolved `aiChatEnabled` down as a prop
- `app/playwright.config.ts` — `desktop-xl` (1728x1117) project; `AI_CHAT_UI_ENABLED`/`AI_CHAT_DETERMINISTIC_MODE` webServer env
- `app/package.json` / `package-lock.json` — added `@axe-core/playwright` devDependency for the axe serious/critical violation tests required by the plan

### Architectural Decision: Feature Flag Is Server-Only, Not `NEXT_PUBLIC_`

`isAiChatUiEnabled()` reads `process.env.AI_CHAT_UI_ENABLED` (no `NEXT_PUBLIC_` prefix) so it is resolved fresh per request on the server and passed down as a prop, instead of being inlined into the client bundle at build time. Both AI Chat route files set `export const dynamic = "force-dynamic"` so `next start` re-evaluates the flag (and auth cookies) on every request — without this, Next's build-time static analysis would have frozen the route as a permanently-404 static page whenever the flag was off during `next build` (verified: without `force-dynamic` the root route built as `○ Static`; with it, `ƒ Dynamic`). This lets ops toggle the flag at runtime without a rebuild, which a `NEXT_PUBLIC_` build-time flag could not do.

### Delivered Behavior

- `DashboardShell` (skip-link, sidebar nav, mobile nav) shared verbatim between the classic dashboard and AI Chat routes
- AI Chat nav item is a real Next `Link` to `/dashboard/ai-chat`, gated by `aiChatEnabled`; old Copilot main-nav entry and client-detail tab removed
- `?section=copilot` deep links replace-redirect to `/dashboard/ai-chat` (redirect fires regardless of the flag; when the flag is off the route itself renders `notFound()`)
- Client detail "AI ile degerlendir" command creates a client-scoped chat and navigates to its URL; fails closed with a visible inline error (no silent no-op, no navigation) when creation fails
- Three-pane workspace: history sidebar (desktop inline / mobile-tablet drawer), message column, context panel (desktop inline / drawer) — `mobileDrawer` is a single tri-state value so history/context drawers are mutually exclusive by construction
- Unified history list with `Tumu`/`Genel`/`Danisan` segment control, client-side date grouping (Bugun/Son 7 Gun/Son 30 Gun/Daha Eski), 30-record cursor pages with `IntersectionObserver` infinite scroll, and a retry-able error state
- New-chat modal: general/client scope tabs, debounced (250ms, min 2 chars) client search, title field, Tab-cycle focus trap, Escape-to-close, no client-change/second-client control anywhere
- Chat header shows locked client name + reference code badge when scope is `client`; rename-in-place with revision-gated `PATCH`
- Focus mode via `?focus=1` hides all shell chrome and persists across reload/navigation
- Message list has a lightweight virtualization range calculator and per-chat `sessionStorage` scroll position; composer grows to a max of 8 lines (Enter sends, Shift+Enter newline) — actual sending remains disabled pending Faz 5's run/provider work
- All new strings added to `i18n.ts` for all seven supported languages; no marketing/feature-explainer copy, only status/error/action text

### Verification (Faz 4)

| Command | Result |
| --- | --- |
| `npm run lint` | pass, 0 errors |
| `npx vitest run src` | 206 files / 1282 passed, 8 skipped |
| `npm run build` | pass; both AI Chat routes render as `ƒ` (dynamic) |
| `npx playwright test tests/visual/ai-chat.visual.spec.ts` (all 5 viewport projects) | 48 passed, 2 skipped (compact-only test skipped on desktop/desktop-xl) |
| `npx playwright test --grep-invert "ai-chat"` (pre-existing suites, all viewports) | 96 passed; 3 failures are a pre-existing `stage4b-alerts-panel` masked-timestamp baseline drift (baseline dated 2026-07-12, unrelated to this phase) and 1 is a non-reproducing flake under bulk parallel load (passed in isolation) |

### Accessibility

`@axe-core/playwright` was added as a devDependency (test-only, zero production/runtime impact) because the plan requires an axe serious/critical violation test, which the repository did not previously have. A real violation was found and fixed: `text-stone-500` on the `#f7f5ef` page background fell to a 4.39:1 contrast ratio (below the 4.5:1 WCAG AA text threshold); all AI Chat secondary/muted text was bumped to `text-stone-600` (~7:1 against the same background). Both the AI Chat root route and the new-chat modal now report zero serious/critical axe violations.

### Test Coverage Added

- Nav: AI Chat is a real route link; old Copilot nav/tab fully removed
- Legacy `?section=copilot` deep-link redirect
- Client detail "AI ile degerlendir" fail-closed error surface (no backend in the test environment)
- Workspace shell renders with retry-able history error and empty-chat state
- New-chat modal: focus trap, Escape close, general/client scope toggle, debounced client search min-chars hint
- Focus mode chrome hiding + persistence across reload
- Mobile/tablet history/context drawer mutual exclusion
- Axe serious/critical violations (workspace root + new-chat modal)
- Screenshot baseline across 390x844, 768x1024, 1440x900, and the newly added 1728x1117 `desktop-xl` project (also backfilled baselines for the two pre-existing suites that now run on `desktop-xl`)

### Deferred To Faz 5 (Documented, Not Silently Dropped)

- Real message send/streaming, edit/regenerate/stop/copy, and branch UI (composer send button remains disabled; no backend run/provider yet)
- Visual tests for actual long message bodies / long client names in rendered chat content (requires Faz 5's real message data; the empty/error/history states reachable today are covered instead)
- `npm run test:rls` remains skipped (remote Supabase; local reset not run this session) — unchanged from Faz 2/3 status

### Open Blockers After Faz 4

- `R-405` remains open; production remains `NO-GO`
- `AI_CHAT_UI_ENABLED` remains unset (disabled) by default; no deployment config was changed
- Faz 5 (Metin Mesaji, Dal/Surum ve Dayanikli Run Akisi) requires explicit user approval before implementation

### Next

Faz 9: Klinik Risk, Bildirim, Handoff ve Guvenli Taslak Koprusu — after explicit user approval.

## Faz 8: Guvenli Gorsel, Dokuman ve Ses Eki Isleme

Completed locally on 2026-07-23.

### Delivered

- Migration `20260722160000_phase_85_stage_4c_multimodal.sql` — attachment/derivative/job/transfer tables, private storage buckets, RLS
- `app/src/lib/phase-85-stage-4c-attachments.ts` — MIME/limit validation, pdfjs/mammoth/yauzl/csv/sharp parsers, WAV/OGG canonicalization, PII scan, deterministic scanner/OCR/STT fixtures (production fail-closed)
- `app/src/lib/phase-85-stage-4c-attachment-workers.ts` — scan → parse → review/ready pipeline, citation locators, retrieval eligibility helpers
- `app/src/lib/phase-85-stage-4c-attachment-store.ts` + extended `phase-85-stage-4c-store.ts` — in-memory attachment lifecycle (Supabase path returns `ai_chat_attachment_store_unavailable`)
- API: `POST /api/ai-chat/attachments`, `POST .../complete`, `GET/PATCH/DELETE .../[attachmentId]`, `PATCH .../derivatives/[derivativeId]`, `POST .../commit-to-client-record`, `GET .../conversations/[chatId]/attachments`
- UI: composer file picker + mic recording, attachment strip, review modal, PCM worklet (`public/audio/ai-chat-pcm-recorder.worklet.js`)
- Worker scripts: `worker:ai-chat:stage4c` / `worker:ai-chat:stage4c:once`
- New prod deps: `pdfjs-dist`, `mammoth`, `yauzl`, `csv-parse`; dev: `@types/yauzl`

### Verification (Faz 8)

- `npm run lint` — 0 errors
- `npx vitest run src/lib/phase-85-stage-4c-attachments.test.ts src/lib/phase-85-stage-4c-run-service.test.ts` — 14/14 passed
- `npm test` — 1309 passed, 8 skipped (210 files)
- `npm run build` — success
- `npm run release:verify` — production dependency audit reports known `mammoth`/`yauzl` (moderate, new Faz 8 parsers) plus pre-existing `sharp`/`next:postcss` findings under open `R-405`; no new unexplained production gate closure claimed

### Open Blockers After Faz 8

- Faz 9 risk/handoff bridge requires explicit user approval
- Supabase attachment store RPCs remain stubbed; local in-memory path is the deterministic closure authority
- Real OCR/STT/scanner/web adapters remain disabled

## Faz 7: Kaynak Kayit Defteri, Answerability ve Kaynakli Klinik Yanit

Completed locally on 2026-07-22.

### Delivered

- Migration `20260722150000_phase_85_stage_4c_sources_answerability.sql` — approved source/chunk tables, answer envelopes, import/search/list RPCs
- `app/src/lib/phase-85-stage-4c-sources.ts` — Phase 71 manifest import, idempotent hash versioning, in-memory search, disabled web research port
- `dietitian-ai-assistant/src/dietitian-chat-answerability.js` — schema/source-scope/claim-support/clinical answerability validators
- Extended `dietitian-chat-output-guard.js` and run pipeline with bounded JSON repair + sourced validation
- `app/scripts/import-approved-ai-chat-sources.mjs` + CLI importer
- `GET /api/ai-chat/runs/[runId]/sources` and source drawer UI
- Tests: `phase-85-stage-4c-sources.test.ts`, `dietitian-chat-answerability.test.mjs`

### Verification (Faz 7)

- `npm run lint` — 0 errors
- Targeted vitest (`phase-85-stage-4c-sources.test.ts`, `phase-85-stage-4c-run-service.test.ts`, `phase-85-stage-4c-context-gateway.test.ts`) — 18/18 passed
- `node --test dietitian-ai-assistant/tests/dietitian-chat-answerability.test.mjs` — 7/7 passed
- `npm test` — 1300 passed, 8 skipped (209 files)
- `npm run build` — success

### Open Blockers After Faz 7

- Faz 8 multimodal attachments require explicit user approval

## Faz 6: Danisan Baglam Gecidi ve Buyuk Veri Kapsami

Completed locally on 2026-07-22.

### Delivered

- `app/src/lib/phase-85-stage-4c-context-gateway.ts` — `buildClientContext()` single entry, intent classification, tool planner, evidence budget, revision recheck
- `app/src/lib/phase-85-stage-4c-retrieval.ts` — FTS sanitizer, canonical verification, semantic retriever port (disabled by default; fixture-only in tests)
- Extended `phase-85-stage-4c-run-service.ts` — retrieving-phase gateway integration, snapshot persistence, `source.available` events, stale/not_authorized supersede before commit
- Extended `phase-85-stage-4c-store.ts` — gateway access/tool/snapshot methods (in-memory + Supabase RPC stubs)
- Extended `phase-85-stage-4c-provider.ts` — bounded `contextEnvelope` on generation requests
- Core: extended `dietitian-chat-context-policy.js`, `dietitian-chat-orchestrator.js`, `tests/dietitian-chat-context-policy.test.mjs`
- Migration: `20260722140000_phase_85_stage_4c_context_gateway.sql`

### Verification (Faz 6)

- `npm run lint` — 0 errors
- Targeted vitest (`phase-85-stage-4c-context-gateway.test.ts`, `phase-85-stage-4c-run-service.test.ts`) — 15/15 passed
- `node --test dietitian-ai-assistant/tests/dietitian-chat-context-policy.test.mjs` — 5/5 passed
- `npm run build` — success

### Open Blockers After Faz 6

- Faz 7 answerability/source registry UI requires explicit user approval
- Supabase context-tool RPC coverage is bounded to core loaders; remaining tool categories return empty arrays until expanded in a later hardening pass

## Faz 5: Metin Mesaji, Dal/Surum ve Dayanikli Run Akisi

Completed locally on 2026-07-22.

### Delivered

- Core package: `dietitian-chat-orchestrator.js`, `dietitian-chat-context-policy.js`, `dietitian-chat-output-guard.js`, tests
- App: `phase-85-stage-4c-run-service.ts`, `phase-85-stage-4c-provider.ts`, extended `phase-85-stage-4c-store.ts`
- API: POST message (202), PATCH edit, POST regenerate, GET SSE events, POST stop
- Migration: `20260722130000_phase_85_stage_4c_run_queue_streaming.sql` (`ai_chat_jobs`, run events/stop/claim RPCs)
- Worker: `app/scripts/worker-ai-chat-stage4c.mjs`
- UI: composer send, streaming deltas, stop, edit, regenerate, client-side copy
- Deterministic fixture provider only (`__fixture:*__`); unknown prompts return controlled unavailable (no fabricated clinical answers)

### Verification (Faz 5)

- `npm run lint` — 0 errors
- `npm test` — 1286 passed (8 skipped)
- `npm run build` — success
- `node --test dietitian-ai-assistant/tests/dietitian-chat-orchestrator.test.mjs` — 5/5 passed
- In-memory integration: send/complete, edit-not-latest-user guard

### Open Blockers After Faz 5

- Supabase RPCs for send/edit/regenerate/commit remain to be expanded for production store path (in-memory deterministic path is the local closure authority)
- Faz 6 requires explicit user approval before implementation

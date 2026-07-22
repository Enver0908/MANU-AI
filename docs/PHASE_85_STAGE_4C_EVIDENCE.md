# Phase 85 Stage 4C Evidence

Date: 2026-07-22
Status: **Faz 3 complete locally; Faz 4 is next**

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

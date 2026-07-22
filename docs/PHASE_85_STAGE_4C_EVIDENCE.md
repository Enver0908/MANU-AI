# Phase 85 Stage 4C Evidence

Date: 2026-07-22
Status: **Faz 2 complete locally; Faz 3 is next**

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
- `docs/PHASE_85_STAGE_4C_DIYETISYEN_AI_CHAT_ACTION_PLAN.md`
- `README.md`
- `PLAN.md`
- `PROJECT_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `app/README.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`

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
- `ai_chat_conversation_admin_metadata` view without title/content/file names
- `dietitian_ai_chat` capability in `auth-context.ts`
- `p85_stage_4c_create_conversation_v1(...)` service-role RPC

### Verification Commands

```powershell
git diff --check
cd app
npm run lint
npx vitest run src/lib/auth-context.test.ts
npm run build
npm run test:rls
```

### Verification Results

| Command | Result |
| --- | --- |
| `npm run lint` | pass |
| `npx vitest run src/lib/auth-context.test.ts` | 11/11 pass |
| `npm run build` | pass |
| `npm run test:rls` | **46 skipped** — environment uses remote Supabase (`https://pxyjocahjutcojltcalj.supabase.co`), not local `127.0.0.1` / `localhost`; new migrations are not applied remotely in this session |

### RLS Test Coverage Added

- Creator-private read isolation by tenant
- Cross-creator denial on same tenant/client
- Assistant/auditor denial
- Authenticated direct mutation denial
- Worker table read denial (`ai_chat_mutation_ledger`, `ai_chat_provider_egress_manifests`)
- General-scope client source ref trigger rejection
- Immutable scope update trigger rejection
- Client-bound chat read closure after assignment revocation

### Open Blockers After Faz 2

- Apply migrations to local Supabase and rerun `npm run test:rls` with **zero skipped** before Faz 3 closure evidence
- `R-405` remains open
- Production remains `NO-GO`

### Next

Faz 3: Bounded Servis Katmani, CRUD API ve Istemci Arama — after explicit user approval.

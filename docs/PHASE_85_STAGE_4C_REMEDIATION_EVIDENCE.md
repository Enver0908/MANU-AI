# Phase 85 Stage 4C Remediation Evidence

Date: 2026-07-25
Status: **Faz 2 complete locally with RLS blocked (Docker/local Supabase unavailable)**

Production remains `NO-GO`. R-405 remains open.

Authority plan: `docs/PHASE_85_STAGE_4C_REMEDIATION_ACTION_PLAN.md` (from user remediation plan 2026-07-25).

Historical `PASS_LOCAL_STAGE_4C` claims are superseded by remediation-required status until Faz 8 hard-zero closure passes with zero-skip RLS.

## Faz 2: Modüler Store, Atomik Chat RPC'leri ve Çalıştırılmış RLS Temeli

Status: **complete locally (code + targeted tests); RLS verification blocked**

### Starting State

- Branch: `codex/stage-4c-remediation`
- Base commit: `39107f5`
- Prior uncommitted R1 draft absorbed into remediation migration `20260725090000_phase_85_stage_4c_remediation_core_run_rpcs.sql`

### Delivered

- Split `phase-85-stage-4c-store.ts` into interface/factory plus:
  - `phase-85-stage-4c-in-memory-store.ts`
  - `phase-85-stage-4c-supabase-store.ts`
- Contract version bumped to `p85-stage-4c-contracts-v2` (scope/status/route values unchanged)
- Append-only migration `20260725090000_phase_85_stage_4c_remediation_core_run_rpcs.sql`:
  - active-run partial unique index on `(tenant_id, conversation_id)`
  - active-run user/status index on `(tenant_id, created_by_user_id, status)`
  - core RPCs: send/edit/regenerate/branch-chain/commit/finalize/title
  - terminal-state compare-and-set on `finalize_run_v1`
  - branch-chain depth column + auto-title first-user ordering fix
- `mapRpcError`: `ai_chat_user_run_limit` -> HTTP 429
- `assertSupabaseAiChatCoreContractReady()` startup guard for core send RPC wiring
- Tests: `phase-85-stage-4c-core-rpc-migration.test.ts`, `phase-85-stage-4c-store-conformance.test.ts`
- RLS preflight fail-closed retained in `supabase-rls.integration.test.ts`

### Verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass (warnings only) |
| `npx vitest run src/lib/phase-85-stage-4c-core-rpc-migration.test.ts src/lib/phase-85-stage-4c-store-conformance.test.ts src/lib/phase-85-stage-4c-run-service.test.ts src/lib/phase-85-stage-4c-service.test.ts` | 22/22 pass |
| `npm run test:rls` | **blocked** — Docker Desktop Linux engine unavailable; remote target requires `MANU_ALLOW_REMOTE_RLS_TESTS=true` |
| `npx supabase db reset --local` | **not run** — local Supabase unavailable |
| `npx supabase db lint --local` | **not run** — local Postgres unavailable |

### Open Blockers After Faz 2

- Apply migration to local Supabase and rerun `npm run test:rls` with **zero skipped** before Faz 3
- Supabase adapter conformance suite on real Postgres (currently in-memory only in this environment)
- Production remains `NO-GO`; R-405 remains open

### Next

Faz 3: Eksiksiz Context Gateway, Genel Kaynak Araması ve Birleşik Klinik Finalizasyon

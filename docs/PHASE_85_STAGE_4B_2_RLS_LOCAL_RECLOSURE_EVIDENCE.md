# Phase 85 Stage 4B-2 Local RLS Re-Closure Evidence

Date: 2026-07-13
Branch: `codex/phase-85-interstage-clinical-memory`
Status: **RLS local re-run passed**

## Scope

This evidence closes the previously blocked local RLS execution condition for Stage 4B-2 messaging. It does not approve production pilot launch, close R-405, enable real provider/channel paths, enable monitoring/backup/secret-manager paths, or connect real health-data processing.

## Environment

- Docker Desktop local Linux engine started successfully.
- Supabase CLI: `2.101.0`
- Local Supabase Project URL: `http://127.0.0.1:54321`
- Local Supabase Studio: `http://127.0.0.1:54323`
- RLS was executed against local Supabase only; hosted/free Supabase was not used as the RLS proof environment.

## Code and migration corrections

- `app/supabase/migrations/20260712120000_phase_85_stage_4b_postclosure_remediation.sql`: fixed the `p85_stage_4b_count_notifications_v2` revoke signature so a clean local `supabase db reset` can apply all migrations.
- `app/supabase/migrations/20260713024000_phase_85_stage_4b2_rls_local_reclosure.sql`: append-only local re-closure migration removes legacy broad notification policies, restores direct notification-update denial, re-routes form/context notification commits through the Stage 4B notification helper, fixes receipt RPC name ambiguity, and preserves service-role-only commit wrappers.
- `app/src/lib/supabase-store.ts`: avoids writing non-UUID fallback dietitian form response ids into the UUID-backed Supabase table.
- `app/src/lib/supabase-rls.integration.test.ts`: aligns direct message insert fixtures with the current non-null `content_status` schema.

## Verification

```text
npx supabase db reset
PASS

npm run test:rls
Test Files  1 passed (1)
Tests       35 passed (35)
Skipped     0
Failed      0

npx vitest run src/lib/supabase-store.test.ts src/lib/client-forms.test.ts --no-file-parallelism --maxWorkers=1
Test Files  2 passed (2)
Tests       9 passed (9)

git diff --check
PASS
```

## Subsequent SQL Plan Closure

R7 executed `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` against the authorized local seed for both bounded v2 projection-source RPCs. The list call completed in 9.767 ms with 2061 shared-hit blocks; the detail call completed in 8.565 ms with 1969 shared-hit blocks. Both had zero shared-read, temp-read/write, and local-read/write blocks. Full interpretation is recorded in `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`.

## Remaining Caveat

The previously surfaced local advisory for RLS-disabled `public.conversation_mutation_idempotency` and `public.personas` was closed as a separate hardening unit on 2026-07-13. Evidence: `docs/PHASE_85_STAGE_4B_2_SECURITY_ADVISORY_RLS_HARDENING_EVIDENCE.md`. The closure enables RLS on both tables, removes direct `anon`/`authenticated` grants, adds no direct-user policies, and preserves service-role mediated behavior.

The initial standalone SQL attempt lacked actor context and correctly failed closed. R7 supersedes that attempt with an authorized service-role seed context and records the resulting buffer evidence separately.

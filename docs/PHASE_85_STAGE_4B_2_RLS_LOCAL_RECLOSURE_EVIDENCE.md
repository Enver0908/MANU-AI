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

## Remaining Caveat

`npx supabase db query` surfaced a local advisory that RLS is disabled on `public.conversation_mutation_idempotency` and `public.personas`. This was not auto-remediated because enabling RLS without policies can break access. It must be handled as a separate explicit SQL/RLS policy decision.

SQL `EXPLAIN ANALYZE BUFFERS` for the Stage 4B-2 bounded list/detail RPCs was attempted after the RLS pass, but the standalone DB session did not contain the actor membership seed required by the actor-aware RPCs and correctly failed closed. This evidence therefore closes the zero-skip RLS execution blocker, but does not claim SQL buffer evidence closure.

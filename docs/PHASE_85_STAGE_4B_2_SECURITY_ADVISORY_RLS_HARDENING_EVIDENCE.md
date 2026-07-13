# Phase 85 Stage 4B-2 Security Advisory RLS Hardening Evidence

Date: 2026-07-13
Branch: `codex/phase-85-interstage-clinical-memory`
Status: **CLOSED LOCALLY**

## Scope

This closes the local Supabase advisory for RLS-disabled `public.conversation_mutation_idempotency` and `public.personas`. It is a narrow post-R7 security-hardening closure and does not reopen the Stage 4B-2 R0-R7 remediation sequence.

This does not approve production pilot launch, close R-405, enable real WhatsApp/Telegram/Gemini/provider paths, enable production billing, monitoring, backup, secret-manager paths, or connect real health-data processing.

## Diagnosis

- `conversation_mutation_idempotency` is an internal Stage 4B-2 idempotency table used through service-role mediated mutation RPCs. Direct table grants were already limited to `postgres` and `service_role`, but RLS was disabled and therefore the Supabase advisory remained open.
- `personas` is a global seed/reference table for `clients.selected_persona_id` and `ai_decisions.persona_id`. Runtime UI/API persona options come from the bundled `dietitian-ai-assistant/src/personas.js` catalog, not direct Supabase client reads. Local metadata showed broad `anon` and `authenticated` direct grants before this hardening.

## Implementation

Append-only migration:

- `app/supabase/migrations/20260713030000_phase_85_stage_4b2_security_advisory_rls_hardening.sql`

The migration:

- revokes all direct `public`, `anon`, and `authenticated` table privileges on `conversation_mutation_idempotency`;
- preserves `service_role` privileges on `conversation_mutation_idempotency`;
- enables RLS on `conversation_mutation_idempotency`;
- revokes all direct `public`, `anon`, and `authenticated` table privileges on `personas`;
- preserves `service_role` privileges on `personas`;
- enables RLS on `personas`;
- intentionally adds no `anon` or `authenticated` policies for either table.

Regression coverage:

- `app/src/lib/supabase-rls.integration.test.ts` now verifies authenticated direct reads/writes are denied for both advisory tables.

## Local Metadata Evidence

After `npx supabase db reset`, metadata inspection showed:

- `conversation_mutation_idempotency.relrowsecurity = true`
- `personas.relrowsecurity = true`
- both tables have no policies
- both tables have grants only for `postgres` and `service_role`
- no `anon` or `authenticated` grants remain on either table

The local Supabase advisory output no longer reported the previous RLS-disabled advisory for these two tables during metadata inspection.

## Verification

```text
npx supabase db reset
PASS

npm run test:rls
Initial run: 36 skipped because app/.env.local points at hosted Supabase and remote RLS is fail-closed by default.
Re-run with local Supabase URL and local development keys from `npx supabase status`: 36 passed / 0 skipped / 0 failed.

npm run test
Initial run: timed out at 184 seconds; not counted as pass.
Re-run with longer timeout: 153 test files passed, 959 passed / 6 skipped.

npm run lint
PASS with 0 errors and 3 pre-existing warnings.

npm run build
PASS

git diff --check
PASS with CRLF warning for the edited RLS test file.

Forbidden future-phase naming scan
Only intentional guard-test fixture references in `app/src/lib/phase-85-stage-4b2-verification.test.ts`.

Secret/token scan
Only documented/test guard strings and sandbox-marker fixtures; no new real secret was found in tracked files.
```

## Closure Decision

The advisory hardening is closed locally. `personas` and `conversation_mutation_idempotency` are now RLS-enabled, direct public/anon/authenticated access is removed, service-role mediated internal behavior is preserved, and Stage 4B-2 R0-R7 remains closed locally.

Production pilot remains `NO-GO`; R-405 remains open.

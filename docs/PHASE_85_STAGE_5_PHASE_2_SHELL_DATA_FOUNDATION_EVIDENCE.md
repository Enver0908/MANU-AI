# Phase 85 Stage 5 Phase 2 Shell Data Foundation Evidence

Date: 2026-08-02

Branch: `codex/stage-4c-remediation`

Status: **COMPLETE locally — server session activity, shell preferences foundation, and auth-context session guards**.

This phase implements Stage 5 Faz 2 only: append-only SQL, service-role-mediated RPCs, RLS deny-all direct table access, auth-context session inactivity enforcement, and tests. It does not implement shell API routes, UI shell/provider, offline lock, manifest branding, or `/dashboard/more`.

Production remains `NO-GO`. R-405 remains open. Push, PR, deploy, and production gates are out of scope.

## Scope

Implemented:

- Append-only migration `app/supabase/migrations/20260802090000_phase_85_stage_5_shell_foundation.sql`
- Tables `app_session_activity` and `app_user_shell_preferences` with RLS enabled and direct `anon`/`authenticated` grants revoked
- RPCs `p85_stage_5_assert_session_activity_v1`, `p85_stage_5_touch_session_activity_v1`, `p85_stage_5_update_shell_preferences_v1`
- Exact 15-minute server inactivity lock with 1-minute touch cooldown
- `session_started` and `session_locked` account security audit events (minimized metadata)
- `auth-context.ts` session claim validation and inactivity guard on every protected account context resolve
- Dedicated `resolveAccountTenantContextForSessionActivity()` touch resolver that cannot unlock locked sessions
- Local Supabase defense-in-depth `auth.sessions.inactivity_timeout = "15m"` in `app/supabase/config.toml`
- Session helper module `app/src/lib/phase-85-stage-5-shell-session.ts` with client-identity body rejection

Excluded (later Stage 5 phases):

- `/api/shell/*` and `/api/session/activity` HTTP routes (Faz 3)
- Shell contracts/DTO bootstrap projection (Faz 3)
- UI shell, bottom nav, offline unmount (Faz 4–7)

## Changed Files

- `app/supabase/migrations/20260802090000_phase_85_stage_5_shell_foundation.sql`
- `app/supabase/config.toml`
- `app/src/lib/auth-context.ts`
- `app/src/lib/phase-85-stage-4d-account-security.ts`
- `app/src/lib/phase-85-stage-5-shell-session.ts`
- `app/src/lib/phase-85-stage-5-shell-session.test.ts`
- `app/src/lib/phase-85-stage-5-shell-migration-contract.test.ts`
- `app/src/lib/supabase-rls.integration.test.ts`

## Data Flow

1. Cookie-bound Supabase client resolves `auth.getUser()` and verified JWT `session_id` claim.
2. Tenant membership and dietitian profile resolve as before (fail-closed unchanged).
3. `p85_stage_5_assert_session_activity_v1` (default) or `p85_stage_5_touch_session_activity_v1` (activity resolver only) runs atomically in PostgreSQL.
4. First seen session inserts activity row, starts inactivity clock, emits `session_started`.
5. Inactivity at or beyond 15 minutes locks session atomically and emits `session_locked`; all further assert/touch calls return `session_inactive`.
6. Touch updates `last_interactive_at` at most once per minute; polling/bootstrap paths use assert-only and do not extend the clock.
7. `AccountTenantContext` returns verified `sessionId`; `AppTenantContext` shape remains unchanged for existing API callers.

## Error And Boundary Cases

| Case | Behavior |
| --- | --- |
| Missing JWT `session_id` | `401 session_claim_missing` before tenant/entitlement work continues |
| 14:59 since last interactive touch | `assert` succeeds; session remains active |
| 15:00+ inactivity | Atomic lock + `401 session_inactive`; touch cannot reopen |
| Locked session heartbeat | Touch fails `session_inactive`; new login requires new Supabase session |
| Concurrent tabs within 1-minute cooldown | Only first touch updates timestamp |
| Cross-tenant session row mismatch | `401 session_claim_mismatch` |
| Client body `session_id` / `user_id` / `tenant_id` | `400 forbidden_client_identity_field` via helper (Faz 3 routes will use) |
| Direct authenticated table access | RLS + revoked grants → permission denied / zero rows |
| Preferences revision conflict | `preferences_revision_conflict` |
| Inaccessible `active_client_id` | `client_context_unavailable` |

## Verification

Executed from `app/` unless noted.

| Check | Result | Evidence |
| --- | --- | --- |
| Migration contract Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-migration-contract.test.ts` → 1 file, 3 tests passed |
| Shell session unit Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-session.test.ts` → 1 file, 4 tests passed |
| Auth context unit Vitest | PASS | `npx vitest run src/lib/auth-context.test.ts` → 1 file, 12 tests passed |
| Typecheck | PASS | `npm run typecheck` exited 0 |
| Clean local Supabase reset | BLOCKED | Docker Desktop Linux engine unavailable in this environment (`supabase db reset --local` failed) |
| RLS integration | BLOCKED | `npm run test:rls` requires local Supabase; new Stage 5 cases added to `supabase-rls.integration.test.ts` pending Docker availability |
| `git diff --check` | Pending at commit time | Run before commit |

## Security Notes

- No PHI, clinical notes, message bodies, or internal tenant/dietitian IDs are exposed through shell preference/session tables.
- Session audit events store only minimized metadata (`minimized: true`).
- Service-role-only internal helper `p85_stage_5_insert_session_security_event` is not granted to authenticated callers.
- Hosted Supabase must mirror `auth.sessions.inactivity_timeout = "15m"` manually (operational note; local config updated).

## Open Risks

- RLS integration for Stage 5 shell tables is authored but not executed in this environment (Docker blocked).
- Faz 3 HTTP shell APIs are not yet wired; existing routes now depend on session assert RPC when Supabase is configured.
- Production remains `NO-GO`; R-405 open.

## Completion Criteria

- [x] Append-only migration with session activity + shell preferences tables
- [x] RLS enabled; no direct authenticated table policies
- [x] Assert/touch/preferences RPCs with 15-minute lock and 1-minute touch cooldown
- [x] Auth context returns `sessionId` on account context and enforces inactivity fail-closed
- [x] Activity-only resolver cannot unlock locked sessions
- [x] Session lifecycle audit event types extended
- [x] Unit/migration contract tests pass; typecheck passes
- [ ] Local Supabase reset + RLS 0-skip (blocked — environment)

## Next Phase Entry (Faz 3)

Faz 3 may start after this evidence is accepted. Prerequisites:

- Local Supabase reset applies migration `20260802090000_phase_85_stage_5_shell_foundation.sql`
- `npm run test:rls` passes with new Stage 5 cases at 0 skipped
- Implement bounded `/api/shell/*` and `/api/session/activity` routes per Phase 1 contract

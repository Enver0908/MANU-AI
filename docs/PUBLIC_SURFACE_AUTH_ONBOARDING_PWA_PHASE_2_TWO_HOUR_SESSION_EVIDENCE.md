# Public Surface/Auth/Onboarding/PWA Phase 2 Evidence

Current authority (2026-09-04): historical Phase 2 PASS is superseded for current closure by Faz 8. Production remains `NO-GO`.

Date: 2026-09-03
Phase: `2 - Two-Hour Secure Session Continuity`
Authority: `c:\Users\Dell\Downloads\PLAN (7).md` Faz 2 (`P2.1`–`P2.9`)
Canonical plan: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md`
Parent HEAD: `2beace3935da56a8cfec75684c77f01c11c055a7`
Verdict: `PASS_LOCAL_PHASE_2_CLOSED`

## Scope

Server-authoritative idle timeout for the authenticated web dashboard and installed PWA is two hours (`7_200_000 ms` / `interval '2 hours'`). Hidden-tab timers and network polling do not extend the session. Returning to the foreground verifies the server first. After two hours of inactivity the shell clears local state and redirects to `/login?next=/dashboard`. A valid Supabase refresh token does not override the application idle lock. Production remains `NO-GO`. No deploy, remote migration, Stripe, WhatsApp, Z.ai, DNS, SMTP, or production gate change was executed.

## Prerequisite

Installed Next.js has no `app/node_modules/next/dist/docs/` tree. The session activity route already uses App Router `POST` with `no-store` JSON and does not set cookies; this phase did not change cookie behavior. Existing cookie/session handling remains in Supabase SSR and `dashboard-server-auth.ts`.

## Requirement-diff matrix

| Adım kimliği | Beklenen sonuç | Değişen dosyalar | İnceleme kanıtı | Durum | Test sonucu | Sapma | Kapanış |
|---|---|---|---|---|---|---|---|
| P2.1 | Extract every live 15-minute idle authority from client constant, session API, store/RPC, and migration | Evidence only | Live authorities were `SHELL_SESSION_INACTIVITY_MS = 15 * 60_000`, fallback `sessionExpiresAt`, SQL `interval '15 minutes'` in `p85_stage_5_record_session_activity_v2`, `p85_stage_5_assert_session_activity_v1`, `p85_stage_5_touch_session_activity_v1`, and `p85_stage_5_load_shell_bootstrap_v1`. `/api/session/activity` has no local duration; it calls v2. `customer-auth-session.ts` has no idle clock | `IMPLEMENTED_AND_INSPECTED` | Inventory grep | Historical SQL files keep 15-minute text as append-only history. Notification SLA “15 minutes” docs are unrelated | Closed |
| P2.2 | Change the client timeout constant to two hours | `phase-85-stage-5-shell-session-policy.ts`, `phase-85-stage-5-shell-session.ts`, `phase-85-stage-5-shell-provider-state.ts` | `SHELL_SESSION_INACTIVITY_MS = 7_200_000`. Fallback bootstrap expiry uses that constant | `IMPLEMENTED_AND_INSPECTED` | Session unit test asserts `7_200_000` | Client-safe policy module was split so the dashboard client does not import `next/headers` | Closed |
| P2.3 | Append-only migration updates server RPC idle checks to two hours | `app/supabase/migrations/20260903090000_public_surface_session_idle_timeout.sql` | Live helper `p85_stage_5_session_inactivity_window()` returns `interval '2 hours'` and is used by v1 assert/touch, v2 record, and bootstrap `sessionExpiresAt`. Touch cooldown remains `interval '1 minute'`. Direct table grants stay revoked | `IMPLEMENTED_AND_INSPECTED` | Migration contract test | Remote/production migration was not applied. Local RLS against an unmigrated database was not counted as PASS | Closed |
| P2.4 | Keep activity write cooldown; do not mutate on every pointer move | `shell-provider.tsx`, session policy helpers | Shell still listens to `pointerdown` and `keydown` only. Hidden tabs cannot write. Client cooldown remains 60 seconds, matching SQL `1 minute` | `IMPLEMENTED_AND_INSPECTED` | Cooldown unit tests plus source inspection (`pointermove` and `setInterval` absent) | `SHELL_ACTIVITY_MIN_INTERVAL_MS` remains the client write throttle and equals the SQL cooldown | Closed |
| P2.5 | On `visibilitychange` return, verify the server first, then touch only if allowed | `shell-provider.tsx` | Visible foreground awaits `runBootstrap("foreground")`, then `resolveShellForegroundSessionAction`. Hidden state does not verify or touch | `IMPLEMENTED_AND_INSPECTED` | Foreground action unit tests | No dedicated Playwright PWA device run this phase; web and PWA share this shell | Closed |
| P2.6 | At or beyond two hours, clear local shell state and apply a safe login redirect | `shell-provider.tsx`, `phase-85-stage-5-shell-provider-state.ts` | `session_inactive` and other 401 bootstrap/activity failures clear destination view state, set `session_locked`, and `router.replace("/login?next=/dashboard")`. 403 remains entitlement-blocked | `IMPLEMENTED_AND_INSPECTED` | HTTP failure mapping tests; 401 unauthenticated maps to `session_locked` | Dashboard shell blocker with login link remains as a fallback if navigation has not completed | Closed |
| P2.7 | Real activity in one tab refreshes the same user session | Session policy + RPC keyed by JWT `session_id` | `app_session_activity` is keyed by `session_id`, not tab id. `resolveSharedShellSessionIdleClock` returns the auth session id for any tab | `IMPLEMENTED_AND_INSPECTED` | Shared-clock unit test | No BroadcastChannel was added; background tabs re-check the server on foreground per P2.5 | Closed |
| P2.8 | Fake-clock tests for just below, exactly at, and above the boundary | `phase-85-stage-5-shell-session.test.ts` | SQL/client contract is `last + 7_200_000 <= now`. 7_199_999 ms remains open; 7_200_000 and 7_200_001 lock | `IMPLEMENTED_AND_INSPECTED` | Fake-timer unit test PASS | RLS boundary uses the same constant when a migrated local database is available | Closed |
| P2.9 | Client and SQL durations share one contract | Policy constant + Phase 2 migration contract test | `SHELL_SESSION_INACTIVITY_SQL_INTERVAL` is `interval '2 hours'` and must appear in the new migration; TypeScript value is `7_200_000` | `IMPLEMENTED_AND_INSPECTED` | Migration contract test PASS | Historical foundation SQL still contains 15-minute text by design | Closed |

## Surfaces kept

Offline lock still unmounts protected content. Expired/inactive entitlement still returns 403 independently of idle timeout. Dirty-state, tenant/account/client scope, and authenticated shell remain. No remember-me, offline health cache, or fake background keepalive was added.

## Verification

Command: `npx vitest run src/lib/phase-85-stage-5-shell-session.test.ts src/lib/phase-85-stage-5-shell-migration-contract.test.ts src/lib/phase-85-stage-5-shell-provider-state.test.ts --no-file-parallelism --maxWorkers=1`

```text
Test Files  3 passed (3)
Tests  26 passed (26)
```

Command: `npx vitest run src/lib/phase-85-stage-5-shell-pwa.test.ts --no-file-parallelism --maxWorkers=1` (earlier combined run)

```text
Included in the 33/33 combined unit run before the client/server split; PWA cache/offline reducer tests unchanged.
```

Command: `npx vitest run src/lib/phase-85-stage-5-shell-api.test.ts --no-file-parallelism --maxWorkers=1`

```text
Test Files  1 passed (1)
Tests  6 passed (6)
```

Command: `npm run typecheck`

```text
PASS - tsc --project tsconfig.production.json
```

Command: `npm run lint`

```text
0 errors, 77 existing unused-var warnings. Phase 2 files linted clean.
```

Command: `npm run build`

```text
PASS - webpack production build after moving client session policy out of the server-only session module.
```

Command: `git diff --check`

```text
PASS - no whitespace errors (CRLF conversion warnings only)
```

## Not executed / not counted as PASS

- Remote/production Supabase migration apply
- `npm run test:rls` against a database that has not applied `20260903090000_public_surface_session_idle_timeout.sql`
- Physical iPhone Safari/PWA: `WAIVED_NOT_EXECUTED`
- Full Playwright visual matrix
- Push, deploy, live billing, WhatsApp, Z.ai

## Production gates

Unchanged: `NO-GO`. Compatibility names unchanged. No secrets, PHI, or raw prompts are recorded here.

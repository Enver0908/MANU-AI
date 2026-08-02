# Phase 85 Stage 5 Phase 4 Authenticated Shell Provider Evidence

Date: 2026-08-02

Branch: `codex/stage-4c-remediation`

Status: **COMPLETE locally — canonical authenticated shell layout, provider state machine, typed destination routing, and `/dashboard/more` route**.

This phase implements Stage 5 Faz 4 only. It does not redesign responsive compact/medium/wide navigation (Faz 5), active-client selector UX (Faz 6), offline unmount/PWA update (Faz 7), or dirty-registry wiring (Faz 8).

Production remains `NO-GO`. R-405 remains open. Push, PR, deploy, and production gates are out of scope.

## Scope

Implemented:

- `app/src/app/dashboard/layout.tsx` — shared layout resolves install/auth view mode and wraps all `/dashboard/*` routes
- `app/src/components/dashboard/authenticated-shell-boundary.tsx` — PWA + provider + canonical shell boundary
- `app/src/components/dashboard/shell-provider.tsx` — bootstrap fetch, abort/sequence control, focus mode, header slots
- `app/src/lib/phase-85-stage-5-shell-provider-state.ts` — pure reducer + runtime mapping
- `app/src/components/dashboard/dashboard-shell.tsx` — owns nav chrome, header slots, focus exit, runtime blockers
- Shell routing helpers in `phase-85-stage-4b-dashboard-routing.ts`:
  - `resolveShellDestination`
  - `buildShellHref`
  - `resolveActiveDestination`
  - `sanitizeShellDestination`
- `app/src/app/dashboard/more/page.tsx` + minimal `more-page-client.tsx`
- `ui/app-shell.tsx` adapter: inside shell provider, does not emit a second navigation landmark
- Dashboard / AI Chat / Settings pages no longer wrap their own `PwaSubscriberShell` + `DashboardShell`

Excluded (later phases):

- Five-item compact bottom-nav redesign and SiriusAI icon set (Faz 5)
- Active-client selector sheet/popover (Faz 6)
- Full-screen offline lock and SW cache rename (Faz 7)
- Dirty registry confirmation flows (Faz 8)

## Architecture

1. URL is the source of truth for destination resolution.
2. Layout mounts `AuthenticatedShellBoundary` once for dashboard, AI Chat, Settings, and More.
3. `ShellProvider` starts in `booting`, calls `/api/shell/bootstrap` with no-store, and only enters `ready` after a validated response (or fallback synthetic bootstrap in demo mode).
4. While runtime is not `ready`, clinical route children are not rendered; blocker UI is shown instead.
5. Route pages keep independent server auth/entitlement gates.
6. Legacy `?section=copilot` resolves to `ai_chat` and is never emitted by `buildShellHref`.
7. Focus mode hides sidebar/bottom nav; exit-focus control remains visible.
8. Stale bootstrap responses are ignored via request sequence; route changes abort in-flight fetches.

## Verification

Executed from `app/` unless noted.

| Check | Result | Evidence |
| --- | --- | --- |
| Shell provider/routing Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-provider-state.test.ts` → 8 tests |
| Dashboard routing Vitest | PASS | `npx vitest run src/lib/phase-85-stage-4b-dashboard-routing.test.ts` |
| Shell contracts Vitest | PASS | existing Stage 5 contracts remain green |
| Typecheck | PASS | `npm run typecheck` exited 0 |
| Local Supabase reset / RLS | BLOCKED | Docker Desktop unavailable |

## Completion Criteria Check

| Criterion | Status |
| --- | --- |
| Dashboard, AI Chat, Settings share one provider/shell chrome | Met via `dashboard/layout.tsx` |
| Security decisions are not layout-only | Met: pages retain server auth gates; shell APIs remain fail-closed |
| Single navigation landmark under authenticated shell | Met: `AppShell` adapter suppresses duplicate chrome; canonical `DashboardShell` owns nav |
| `/dashboard/more` real route | Met |

## Next Phase Entry

Stage 5 Faz 5 (responsive navigation + SiriusAI branding) may start after this commit. Prefer local Supabase reset when Docker is available before claiming full stack closure.

## Changed Files

- `app/src/app/dashboard/layout.tsx`
- `app/src/app/dashboard/page.tsx`
- `app/src/app/dashboard/ai-chat/page.tsx`
- `app/src/app/dashboard/ai-chat/[chatId]/page.tsx`
- `app/src/app/dashboard/settings/page.tsx`
- `app/src/app/dashboard/more/page.tsx`
- `app/src/components/dashboard/authenticated-shell-boundary.tsx`
- `app/src/components/dashboard/shell-provider.tsx`
- `app/src/components/dashboard/dashboard-shell.tsx`
- `app/src/components/dashboard/dashboard-navigation.tsx`
- `app/src/components/dashboard/more-page-client.tsx`
- `app/src/components/dashboard-app.tsx`
- `app/src/components/ai-chat/ai-chat-page-client.tsx`
- `app/src/components/settings/settings-page-client.tsx`
- `app/src/components/ui/app-shell.tsx`
- `app/src/lib/phase-85-stage-4b-dashboard-routing.ts`
- `app/src/lib/phase-85-stage-5-shell-provider-state.ts`
- `app/src/lib/phase-85-stage-5-shell-provider-state.test.ts`
- Continuity docs

# Phase 85 Stage 5 Phase 7 PWA Offline Lock Update And Privacy Evidence

> Historical phase snapshot. Phase-level `BLOCKED` and open-risk entries below were superseded by the 2026-08-18 `STAGE_5_CLOSED` decision in `docs/PHASE_85_STAGE_5_CLOSURE_DECISION.json`; production remains independently `NO-GO`.

Date: 2026-08-02

Branch: `codex/stage-4c-remediation`

Status: **COMPLETE locally — offline privacy lock, reconnect-to-home bootstrap, session activity heartbeat, controlled SW updates, and client-version mutation gate**.

This phase implements Stage 5 Faz 7 only. It does not implement full dirty-registry UX across composers (Faz 8) beyond the existing dirty flag used to defer optional PWA reload.

Production remains `NO-GO`. R-405 remains open. Push, PR, deploy, and production gates are out of scope.

## Scope

Implemented:

- Manifest: SiriusAI name/short_name, theme/background, `/dashboard` start URL, standard + maskable icons; `orientation` removed
- Service worker rewrite:
  - navigation + `/api/*` network-only (never Cache API)
  - `/_next/static/` cache-first
  - icons/manifest stale-while-revalidate
  - activate deletes `manu-ai-shell-*` and any non-allowlist caches
  - no Background Sync / offline queue
  - `SKIP_WAITING` only after client message
- `PwaSubscriberShell` reduced to compatibility adapter; duties live in `ShellProvider` via `AuthenticatedShellBoundary`
- Offline → clear bootstrap/view-state, unmount protected subtree, full-screen `İnternet bağlantısı gerekli`
- Online → replace to `/dashboard` home first, then bootstrap; no auto-open prior client workflow
- Visibility → bootstrap/session validation before activity heartbeat
- Pointer/keyboard/successful nav mark activity; `/api/session/activity` at most once/min when visible+online
- `401 session_inactive` → clear state + privacy lock re-login
- SW `updatefound`/`waiting`/`controllerchange` wired; optional reload blocked when dirty; required update keeps screen readable with save-only mutations
- Authenticated mutation helper attaches build version + mutation kind; proxy returns `409 client_update_required` for below-min non-save mutations
- Webhooks, auth, logout, and session activity exempt from client-version enforcement
- Root layout exposes `siriusai-app-version` meta for client build identity

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| PWA contract Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-pwa.test.ts` |
| Install-gate / SW policy Vitest | PASS | `npx vitest run src/lib/phase-83d-pwa-install-gate.test.ts` |
| Branding Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-branding.test.ts` |
| Provider reducer Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-provider-state.test.ts` |
| Combined targeted | PASS | 24 tests |
| Typecheck | PASS | `npx tsc --project tsconfig.production.json --pretty false` exited 0 |
| Local Supabase reset / RLS | BLOCKED | Docker Desktop unavailable |

## Completion Criteria

| Criterion | Status |
| --- | --- |
| Offline protected app cannot open / mount clinical subtree | Met (`go_offline` clears bootstrap; shell blocker) |
| Reconnect/update does not reuse stale auth/client state blindly | Met (home-first reconnect + bootstrap revalidation; controllerchange clears view-state) |
| Cache allowlist excludes dashboard HTML/API/RSC | Met |
| Required update allows save, blocks other mutations, logout remains available | Met (save-only gate + exempt logout) |

## Next Phase Entry

Stage 5 Faz 8 (route integration, dirty-state, mobile work ergonomics) may start after this commit.

## Changed Files

- `app/public/sw.js`
- `app/public/manifest.webmanifest`
- `app/src/components/pwa-subscriber-shell.tsx`
- `app/src/components/dashboard/authenticated-shell-boundary.tsx`
- `app/src/components/dashboard/shell-provider.tsx`
- `app/src/components/dashboard/dashboard-shell.tsx`
- `app/src/app/layout.tsx`
- `app/src/proxy.ts`
- `app/src/lib/phase-85-stage-5-shell-pwa.ts`
- `app/src/lib/phase-85-stage-5-shell-authenticated-mutation.ts`
- `app/src/lib/phase-85-stage-5-shell-provider-state.ts`
- `app/src/lib/phase-83d-pwa-install-gate.ts` (+ tests)
- `app/src/lib/use-manu-state.ts`
- Continuity docs

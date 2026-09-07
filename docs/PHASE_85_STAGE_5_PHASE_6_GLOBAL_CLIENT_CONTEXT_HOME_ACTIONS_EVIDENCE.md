# Phase 85 Stage 5 Phase 6 Global Client Context And Home Actions Evidence

> Historical phase snapshot. Phase-level `BLOCKED` and open-risk entries below were superseded by the 2026-08-18 `STAGE_5_CLOSED` decision in `docs/PHASE_85_STAGE_5_CLOSURE_DECISION.json`; production remains independently `NO-GO`.

Date: 2026-08-02

Branch: `codex/stage-4c-remediation`

Status: **COMPLETE locally — active-client selector, status strip, preference-backed switch, home launcher, and in-memory list-detail view-state**.

This phase implements Stage 5 Faz 6 only. It does not implement offline lock/PWA update (Faz 7) or the full dirty-registry lifecycle (Faz 8). Dirty-switch confirmation is stubbed via a provider dirty flag for the selector path.

Production remains `NO-GO`. R-405 remains open. Push, PR, deploy, and production gates are out of scope.

## Scope

Implemented:

- Header `ActiveClientControl` (compact bottom sheet / medium-wide popover)
- Queryless recent-20 search + ≥2 char / 250 ms debounced `/api/shell/clients`
- Preference PATCH with `requestId` + `expectedRevision`; URL `clientId` only when destination accepts it
- Dirty-switch confirmation that repeats full name + short reference
- `ClientStatusStrip` with risk → handoff → channel → AI priority; stale/missing → `unknown`
- Overview `ShellHomeLauncher` fixed-order deep links (alerts / handoffs / messages / notifications / resume)
- No auto-select of first client on missing/invalid context
- General AI Chat keeps `activeClient: null` in provider context and continues to show `Genel sohbet — danışan bağlamı kullanılmıyor`
- In-memory destination view-state registry (search/tab/scroll); never localStorage/sessionStorage
- High-impact remove-client confirmation repeats identity

Excluded:

- Full offline unmount / SW cache rename (Faz 7)
- Full dirty registry across all editors (Faz 8)

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Active-client / home-action Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-active-client.test.ts` → 6 tests |
| Shell contracts Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-contracts.test.ts` |
| Typecheck | PASS | `npm run typecheck` exited 0 |
| Local Supabase reset / RLS | BLOCKED | Docker Desktop unavailable |

## Completion Criteria

| Criterion | Status |
| --- | --- |
| Client identity visible on client-scoped shell screens | Met via header active-client control |
| High-impact confirmation repeats identity | Met (remove client + dirty switch) |
| No silent first-client auto-select | Met in `dashboard-app` resolved client |
| Preference revision conflict refreshes bootstrap | Met in `selectActiveClient` 409 path |
| Failed switch leaves URL/client unchanged | Met (early return before navigation) |

## Next Phase Entry

Stage 5 Faz 7 (PWA offline lock, reconnect, update, privacy) may start after this commit.

## Changed Files

- `app/src/components/dashboard/active-client-control.tsx`
- `app/src/components/dashboard/client-status-strip.tsx`
- `app/src/components/dashboard/shell-home-launcher.tsx`
- `app/src/components/dashboard/shell-provider.tsx`
- `app/src/components/dashboard/dashboard-shell.tsx`
- `app/src/components/dashboard/clients-panel.tsx`
- `app/src/components/dashboard-app.tsx`
- `app/src/lib/phase-85-stage-5-shell-contracts.ts`
- `app/src/lib/phase-85-stage-5-shell-home-actions.ts`
- `app/src/lib/phase-85-stage-5-shell-active-client.test.ts`
- Continuity docs

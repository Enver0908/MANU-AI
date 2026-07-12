# Phase 85 Stage 4B-2 Post-Closure Remediation R4 Evidence

Date: 2026-07-12  
Branch: `codex/phase-85-interstage-clinical-memory`  
Baseline: `cbf95fb Implement Stage 4B-2 remediation R3 mutations`

## Scope

R4 owns hook, navigation, deep-link, responsive UI, and unread aggregate integration. No migration, provider, channel, billing, monitoring, backup, secret-manager, or real health-data path was opened.

## Implemented corrections

- `resolveMessagingRouteSelection` preserves an explicit `conversationId` URL when the legacy list/state cache does not contain that conversation. The bounded detail API remains the authorization and anchor-validity authority.
- `resolveMessagingTargetValidity` no longer rejects an anchor only because the legacy message cache does not contain it. Locally contradictory message/conversation links still fail closed; remote-target allowance is explicit and used only by the dashboard deep-link path.
- `useStage4B2Messaging` exposes `unreadConversationCount` and `unreadMessageCount` from the API response. Navigation and panel counts no longer sum the loaded page.
- Messaging uses the `md` breakpoint for the list/detail grid, with `min-w-0` and bounded list width. The mobile back affordance remains mobile-only.
- A detail projection can render without a matching legacy `ClientRecord`. The UI does not fabricate health/risk state; composer, draft, AI, and human-control mutations are hidden until a real client projection exists.
- Added route/integration regression tests and refreshed desktop, tablet, Android, and iOS messaging baselines.

## Verification

| Check | Result |
| --- | --- |
| Targeted Vitest: routing, integration, detail helpers | 17 passed |
| Targeted Stage 4B-2 routing, integration, projection/API/state-merge regression | 30 passed across 5 files |
| Core `dietitian-ai-assistant` suite | 234 passed |
| `npm run rehearse:stage-4b2:verification` | Passed: 5 passed / 1 skipped verification gate and 39 passed targeted messaging tests |
| `npm run lint` | Pass, 0 errors; 3 existing warnings |
| `npm run build` | Pass |
| `npx playwright test tests/visual/messaging.visual.spec.ts` | 4 passed: desktop, tablet, Android, iOS |
| Full `npm test` | Timed out at 124 seconds in the OneDrive workspace; not claimed as pass |
| Supabase/RLS | Remains environment-blocked by unavailable Docker; not claimed as pass |
| `git diff --check` | Pass |

The repository secret scan found only the existing `.env.local.example` placeholder and intentional negative-test/regex fixtures; no newly introduced secret or token was added. The forbidden-name scan likewise reports only the pre-existing negative fixture that asserts rejection behavior.

## Boundaries and next unit

R4 does not close RLS, SQL EXPLAIN/scale, concurrent replay, provider/channel, or production-pilot gates. Production remains `NO-GO`, R-405 remains open, and real provider/channel/health-data paths remain disabled. R5 is the next authorized remediation unit.

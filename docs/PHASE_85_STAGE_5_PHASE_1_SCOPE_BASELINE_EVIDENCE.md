# Phase 85 Stage 5 Phase 1 Scope Baseline Evidence

> Historical phase snapshot. Phase-level open items below were superseded by the 2026-08-18 `STAGE_5_CLOSED` decision in `docs/PHASE_85_STAGE_5_CLOSURE_DECISION.json`; production remains independently `NO-GO`.

Date: 2026-08-02

Branch: `codex/stage-4c-remediation`

Status: **COMPLETE - scope lock, architecture inventory, and baseline verification only**.

This phase does not change runtime behavior, UI behavior, database schema, service worker behavior, auth behavior, entitlement behavior, clinical workflow behavior, provider behavior, billing behavior, launch-gate status, or production status. It creates the Stage 5 implementation baseline that later phases must follow.

Production remains `NO-GO`. R-405 remains open. Real WhatsApp, Telegram, external LLM, embedding, OCR, STT, push, live billing, monitoring, backup, secret-manager, and real health-data egress paths remain closed.

## User-Approved Stage 5 Scope Lock

Stage 5 owns the professional authenticated dashboard and mobile PWA shell for dietitians. Dietitians are the primary users, and the mobile PWA is the primary end-user experience. Existing desktop productivity must be preserved while the authenticated shell is rebuilt into a mobile-first, dietitian-friendly, SiriusAI-branded experience.

Stage 5 includes:

- One canonical authenticated shell and shell provider used by `/dashboard`, `/dashboard/ai-chat`, `/dashboard/ai-chat/[chatId]`, `/dashboard/settings`, and the new `/dashboard/more`.
- Responsive shell behavior for `compact`, `medium`, and `wide` breakpoints.
- Compact mobile bottom navigation with exactly five destinations: `home`, `clients`, `messages`, `alerts`, `more`.
- Header notification bell instead of a bottom-nav notification tab.
- Role-aware destination availability.
- Global active-client context with minimal identity display: client name plus short stable reference only.
- Safe identity repetition for high-impact operations.
- Shell bootstrap/read-model APIs separate from the legacy broad `/api/app-state` compatibility path.
- Full-screen offline lock for protected PWA content. Offline protected content must not open and must not remain mounted.
- Safe reconnect flow that validates auth, tenant, entitlement, session, and version before returning to `/dashboard`.
- Dirty-state registry for navigation, update, logout, and route changes.
- Controlled PWA update flow that is dirty-state aware.
- SiriusAI brand cleanup in shell, manifest, install metadata, and app icons.
- Stage 5 scoped accessibility, localization, performance, visual, and closure evidence.

Stage 5 excludes:

- Stage 6 clinical workflow redesign internals.
- Push notifications.
- Offline data cache, offline draft, offline queue, or background sync.
- Provider/channel activation.
- Billing semantics rewrite.
- Clinical algorithms, risk logic, AI safety logic, or message orchestration changes.
- Actual dietitian usability study.
- Third-party analytics.
- Route migration that breaks existing `/dashboard?section=...` query compatibility.
- PR, push, deploy, production GO, R-405 closure, or external gate approval.

## Professional UX Reference Baseline

The Stage 5 mobile shell must follow proven mobile app patterns rather than inventing a dashboard-only navigation model:

- Apple Human Interface Guidelines remain the platform reference for Apple app experience and navigation conventions: `https://developer.apple.com/design/human-interface-guidelines`.
- Material Design 3 defines navigation bars as the common small-screen switching pattern and supports badges on navigation icons: `https://m3.material.io/components/navigation-bar/guidelines` and `https://m3.material.io/components/badges`.
- WCAG 2.2 target-size baseline is 24x24 CSS px minimum, but Stage 5 keeps the stricter product target of 44x44 CSS px for primary touch controls because this is safer for repeated mobile clinical use: `https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum`.
- Web PWA guidance confirms service workers can provide offline experiences, but this product has an approved privacy boundary: protected clinical content is network-only and offline displays only a branded connection-required state.

Stage 5 therefore uses a native-app-like mobile information architecture: stable bottom navigation, persistent destination identity, one primary mobile action at a time, safe-area-aware layout, and no hidden clinical data access while offline.

## Current Architecture Inventory

### Shell And Navigation

| Area | Current file | Current behavior | Stage 5 impact |
| --- | --- | --- | --- |
| Legacy dashboard shell | `app/src/components/dashboard/dashboard-shell.tsx` | Owns skip link, desktop sidebar, mobile nav wrapper, old `MANU-AI` shell label, stone/emerald styling, and delegates header/content to callers. | Must become part of one canonical authenticated shell or be replaced by it. |
| Design-system app shell | `app/src/components/ui/app-shell.tsx` | Generic desktop sidebar + mobile bottom nav component exported from UI primitives but not the active dashboard shell. | Must not remain a competing shell for authenticated dashboard routes. Either integrate into canonical shell or keep as low-level primitive only. |
| Dashboard navigation | `app/src/components/dashboard/dashboard-navigation.tsx` | Desktop has many items. Mobile resolves overview, clients, messages, alerts, simulator, optional AI Chat, and settings, then renders horizontal overflow items. | Must become fixed five-item compact nav: home, clients, messages, alerts, more. Notifications move to header bell. |
| Route contract | `app/src/lib/phase-85-stage-4b-dashboard-routing.ts` | `DashboardSection` is `overview`, `clients`, `messages`, `simulator`, `alerts`, `notifications`, `copilot`, `voice`, `forms`; `DashboardNavKey` adds `ai_chat` and `settings`. | Must add Stage 5 destination contract while preserving existing query compatibility. `more` becomes a real route. |
| Dashboard app state hook | `app/src/lib/use-manu-state.ts` | Hydrates broad `/api/app-state` snapshots. | Stage 5 shell bootstrap must be separate and minimal. `/api/app-state` remains compatibility until Stage 6. |

### Authenticated Routes

| Route | Current file | Current behavior | Stage 5 impact |
| --- | --- | --- | --- |
| Dashboard | `app/src/app/dashboard/page.tsx` | Resolves dashboard auth, derives gate, resolves mobile install access, wraps `DashboardApp` in `PwaSubscriberShell`. | Must keep server-side gate. Visual shell moves to canonical layout/provider. |
| AI Chat root | `app/src/app/dashboard/ai-chat/page.tsx` | Repeats dashboard auth gate, feature flag, mobile install access, and PWA wrapper. | Must keep independent server guard but consume shared shell state. General AI Chat must not inherit a forced active client. |
| AI Chat detail | `app/src/app/dashboard/ai-chat/[chatId]/page.tsx` | Same route family as AI Chat root with detail id. | Must preserve chat route and client-scoped behavior without breaking URL compatibility. |
| Settings | `app/src/app/dashboard/settings/page.tsx` | Uses settings read model, resolves install access, wraps `SettingsPageClient` in `PwaSubscriberShell`. | Must remain account/settings scoped. Active-client context is hidden here and under `more/account` areas. |
| More | not present | No real `/dashboard/more` route exists. | Must be added in a later phase as role-aware grouped navigation. |

### PWA And Install Surface

| Area | Current file | Current behavior | Stage 5 impact |
| --- | --- | --- | --- |
| PWA subscriber shell | `app/src/components/pwa-subscriber-shell.tsx` | Registers service worker in production when allowed, shows offline banner, checks stale session, and always renders `{children}`. | Must change in later phase to unmount protected children and show full-screen "Internet connection required" while offline. |
| Service worker | `app/public/sw.js` | Caches static prefixes `/_next/static/`, `/icon.svg`, and `/manifest.webmanifest`; does not cache `/api/*`. | Must remove old cache names, keep navigation/API network-only, and cache only hashed static assets plus safe manifest/icon metadata. |
| Manifest | `app/public/manifest.webmanifest` | Uses `MANU-AI`, emerald theme color, portrait-primary orientation, and single SVG icon. | Must be SiriusAI branded, orientation unlocked, and include production-quality maskable PNG icons. |
| Install gate library | `app/src/lib/phase-83d-pwa-install-gate.ts` | Current install/cache contract from Phase 83D. | Must be updated only when the Stage 5 PWA update/offline contract is implemented. |

### Security, Tenant, And Entitlement Boundary

| Area | Current file | Current behavior | Stage 5 impact |
| --- | --- | --- | --- |
| Auth context | `app/src/lib/auth-context.ts` | Resolves Supabase user, tenant membership, dietitian profile, entitlement, and capabilities. | Must remain the authorization source for shell APIs and routes. Shell state cannot replace server guards. |
| Dashboard auth | `app/src/lib/dashboard-server-auth.ts` | Server-side dashboard auth resolution. | Must continue guarding page entry independently because shared layouts do not replace per-route auth checks. |
| Settings read model | `app/src/lib/settings-server-read.ts` | Settings account read model and gate. | Must remain account-scoped and separate from active client context. |
| App state API | `app/src/app/api/app-state/route.ts` | Broad compatibility API with legacy and windowed read behavior. | Must stay compatible; new shell APIs must not widen this API. |

### Tests And Verification Assets

| Area | Current file | Current behavior | Stage 5 impact |
| --- | --- | --- | --- |
| Visual tests | `app/tests/visual/*.spec.ts` | Existing dashboard, messaging, AI Chat, settings, commercial visual coverage. | Must gain Stage 5 compact/medium/wide shell, offline lock, update, and More-route coverage. |
| Accessibility tests | `app/tests/visual/*accessibility.spec.ts` | Existing axe-based coverage for AI Chat and messaging. | Must gain shell-wide accessibility coverage, touch target checks, 320px and 200% zoom/reflow checks. |
| Playwright config | `app/playwright.config.ts` | Existing visual test project definitions. | Must be extended to real WebKit/Firefox/Chromium coverage as scoped by Stage 5. |
| Unit tests | `app/src/lib/*test.ts` | Existing routing, PWA, auth, Stage 4B/4C/4D domain tests. | Must add Stage 5 contracts: shell destination contract, bootstrap DTO, dirty registry, offline/update state machine, client search, and role-aware nav. |

## Stage 5 Contract Decisions Locked By Phase 1

### Destination IDs

`ShellDestinationId` in later code must include exactly these canonical IDs:

```text
home
clients
messages
alerts
notifications
simulator
voice
forms
ai_chat
settings
more
```

Compact bottom nav renders only:

```text
home
clients
messages
alerts
more
```

Desktop and medium shell may expose additional allowed destinations based on role and feature flags.

### Runtime States

`ShellRuntimeState` in later code must include:

```text
booting
ready
offline
session_locked
entitlement_blocked
update_required
service_unavailable
```

The later shell provider must fail closed for every state except `ready`.

### Active Client DTO

`ShellActiveClientDto` in later code must contain only:

```text
id
fullName
referenceShort
riskLevel
handoffState
channelReadiness
aiMode
```

It must not include full clinical notes, form responses, nutrition plan content, raw messages, attachments, transcripts, prompt text, provider metadata, payment data, or hidden operational data.

### API Surface

Later phases must implement these APIs as no-store, authenticated, tenant-scoped, fail-closed routes:

```text
GET   /api/shell/bootstrap?activeClientId=<uuid>
GET   /api/shell/clients?query=<text>&limit=20
PATCH /api/shell/preferences
POST  /api/session/activity
GET   /api/shell/version
```

All shell API errors must use:

```json
{ "error": "stable_code" }
```

The shell API must not replace existing page, API, mutation, RLS, or DAL authorization. It supplies shell display state only.

## Dependency And Data-Flow Baseline

Later Stage 5 phases must implement this data flow:

1. Server route guard validates auth, tenant membership, dietitian profile, entitlement, and route capability.
2. Client shell provider starts in `booting`.
3. Provider calls `/api/shell/bootstrap` with no-store cache policy.
4. Bootstrap validates current session, tenant, entitlement, role, optional active client access, build version, and PWA/update status.
5. Provider renders `ready` only after bootstrap succeeds.
6. Shell renders mobile/desktop navigation from the destination contract and role/capability availability.
7. Global active-client context is derived from URL-accessible client first, then persisted preference, then null. It never auto-selects the first client.
8. Route-specific page code continues using existing route/query contracts and route-specific read APIs.
9. Dirty-state registry blocks unsafe navigation, logout, update activation, and active-client switching.
10. Offline state unmounts protected children and clears shell/client state from memory.
11. Reconnect routes to safe home after validation and may offer "Son calismana don" without auto-opening the previous workflow.

## Error And Boundary Cases Locked By Phase 1

Later implementation must explicitly handle:

- No network at PWA launch: render only the full-screen connection-required state; do not mount protected dashboard children.
- Network loss while authenticated route is open: immediately enter `offline`, unmount protected content, clear shell/client memory state, and keep only the reconnect action.
- Expired or locked session: render `session_locked`; require new login.
- Entitlement revoked or unavailable: render `entitlement_blocked`; no protected content.
- Shell bootstrap returns inaccessible `activeClientId`: clear active client, render safe home, and do not retry with another client automatically.
- Assistant/auditor role: omit permanent unauthorized destinations and render allowed read-only destinations only.
- Temporary backend/service failure: show destination as unavailable with reason where the user already had access.
- Dirty form/draft/save state: block navigation, active-client switch, logout, and PWA update until the user resolves or discards changes.
- Required app update: block mutations after version validation fails; allow read-only recovery, save/cancel flow, and update activation.
- Long client search query: normalize to trimmed query, allow 2-80 chars, debounce 250ms, return max 20 results.
- Mobile keyboard and safe area: primary action must not overlap keyboard or bottom navigation.
- General AI Chat: do not force global active client into general chat mode.
- Settings/account views: hide active client context.

## Baseline Verification

Executed from `app/` unless noted.

| Check | Result | Evidence |
| --- | --- | --- |
| Targeted shell-adjacent Vitest | PASS | `npx vitest run src/lib/phase-85-stage-4b-dashboard-routing.test.ts src/lib/phase-83d-pwa-install-gate.test.ts src/lib/phase-83e3-app-shell.test.ts src/lib/phase-85-stage-4d-settings-contracts.test.ts --no-file-parallelism --maxWorkers=1` -> 4 files passed, 32 tests passed. |
| Typecheck | PASS | `npm run typecheck` exited 0. |
| Diff whitespace check | PASS | `git diff --check` exited 0. |
| Current worktree scan | RECORDED | `git status --short --branch` shows pre-existing modified files: `HANDOFF_FOR_NEXT_CODEX.md`, `PLAN.md`, `README.md`, `app/src/lib/commercial-install-access.ts`, `app/src/lib/phase-83d-pwa-install-gate.ts`, `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`. This Phase 1 did not modify those files. |

No production build, visual test, RLS reset, RLS integration suite, or release verification was executed in Phase 1 because no runtime code, SQL, service worker, manifest, route, or UI behavior was changed. Those checks are mandatory in the later phases that touch those surfaces.

## Phase 1 Completion Criteria

Phase 1 is complete when all of the following are true:

- Stage 5 user-approved scope and exclusions are recorded in a standalone evidence document.
- Existing shell, route, PWA, manifest, service worker, auth, state, and test assets are inventoried.
- The later contract names and API surface are locked before implementation begins.
- Known current divergences are explicitly recorded: competing shell components, mobile overflow nav, old MANU-AI shell/manifest branding, portrait manifest lock, offline banner that still renders protected children, broad `/api/app-state` hydration, and missing `/dashboard/more`.
- Shell-adjacent targeted tests pass.
- Typecheck passes.
- `git diff --check` passes.
- No user-owned pre-existing modifications are overwritten.

## Next Phase Entry Conditions

Phase 2 may start only after this document is accepted as the baseline. Phase 2 must implement the server session and shell data foundation with append-only SQL, service-role-only RPCs where required, RLS/fail-closed behavior, and tests proving the shell read model cannot expose broad clinical content.

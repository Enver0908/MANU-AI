# Public Surface/Auth/Onboarding/PWA Phase 1 Evidence

Current authority (2026-09-04): historical Phase 1 PASS is superseded for current closure by Faz 8. Production remains `NO-GO`.

Date: 2026-09-03
Phase: `1 - Dashboard Production Surface Cleanup`
Authority: `c:\Users\Dell\Downloads\PLAN (7).md` Faz 1 (`P1.1`–`P1.9`)
Canonical plan: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md`
Parent HEAD: `57410d74dfa846fca112e69eb4ad58f5ce388199`
Verdict: `PASS_LOCAL_PHASE_1_CLOSED`

## Scope

Visible dietitian dashboard demo, simulator, and operational-inspection chrome was removed from the authenticated production surface. Backend simulator, quarantine, trust-binding, and operational-foundation APIs/RPCs were left in place. Production remains `NO-GO`. No deploy, remote migration, Stripe, WhatsApp, Z.ai, DNS, SMTP, or production gate change was executed.

## Prerequisite

Local Next.js App Router docs were read from `app/node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` and `04-linking-and-navigating.md`. There is no `/dashboard/simulator` route file. Simulator was a `?section=simulator` query on `/dashboard`. Retired query sections use client `router.replace`, matching the existing copilot redirect pattern.

## Requirement-diff matrix

| Adım kimliği | Beklenen sonuç | Değişen dosyalar | İnceleme kanıtı | Durum | Test sonucu | Sapma | Kapanış |
|---|---|---|---|---|---|---|---|
| P1.1 | Inventory every removable control’s component, nav contract, and test | Evidence only | Render sources: `dashboard-app.tsx` header slots, `dashboard-shell.tsx` client picker and local-safe-mode footer, `phase-85-stage-5-shell-navigation.ts` wide/more simulator and admin operational-foundation items, `conversation-header.tsx` simulate button, `overview-panel.tsx` operational foundation, visual specs waiting on `Operasyon paneli` / `Simülatör` | `IMPLEMENTED_AND_INSPECTED` | Inventory grep against `app/src` and `app/tests` | None | Closed |
| P1.2 | Remove operational header title, top client picker, demo reset, and top language selector from the render tree | `dashboard-app.tsx`, `dashboard-shell.tsx`, `active-client-control.tsx` left on disk unused | Header slots no longer render `Operasyon paneli`, `Demoyu sıfırla`, or `Panel dili`. `ActiveClientControl` is not mounted. Read-only assistant/auditor badge remains in header actions | `IMPLEMENTED_AND_INSPECTED` | Playwright dashboard home asserts those strings/controls have count 0 | Header is not replaced with another operational title. Unused `active-client-control.tsx` is kept on disk | Closed |
| P1.3 | Notifications, account, and logout remain reachable; add missing items only to the existing menu | `phase-85-stage-5-shell-navigation.ts`, `more-page-client.tsx`, `dashboard-shell.tsx` | Header bell still opens notifications. Wide sidebar keeps `shell-logout`. Compact/medium More account section now includes logout (`more-item-logout`) plus settings | `IMPLEMENTED_AND_INSPECTED` | Compact dashboard path asserts More logout/settings; settings tests reach `/dashboard/settings` and `Arayüz dili` | Logout was previously wide-sidebar-only; it was added to More, not a new menu | Closed |
| P1.4 | Remove operational counters/inspection blocks from dashboard home | `overview-panel.tsx`, `dashboard-app.tsx` | `OperationalFoundationPanel` is not rendered. `/api/operational-foundation` is no longer fetched from dashboard home. Daily work entry (`Günlük iş girişi`) remains | `IMPLEMENTED_AND_INSPECTED` | `operational-foundation-panel` count 0 on dashboard home; home visual still shows Günlük iş girişi | `operational-foundation-panel.tsx` remains on disk unused. Human-control banner in conversation is kept | Closed |
| P1.5 | Remove simulator links from More/Settings and conversation surfaces | `phase-85-stage-5-shell-navigation.ts`, `conversation-header.tsx`, `conversation-panel.tsx`, `dashboard-app.tsx`, `i18n.ts` | Simulator is not in wide sidebar order or More sections. Conversation header keeps workspace only. Empty-conversation copy no longer tells the user to run the simulator | `IMPLEMENTED_AND_INSPECTED` | Nav unit tests assert no simulator/operational_foundation items; conversation tests assert simulate button count 0 | `DESTINATION_META.simulator` remains for `ShellDestinationId` compatibility. Unused i18n key `conversationSimulateInbound` remains | Closed |
| P1.6 | If simulator is reachable outside nav, redirect to `/dashboard` or remove an unused route file | `phase-85-stage-4b-dashboard-routing.ts`, `dashboard-app.tsx` | No `/dashboard/simulator` page exists. `resolveRetiredDashboardSectionRedirect("simulator")` returns `/dashboard`. DashboardApp `router.replace`s that href | `IMPLEMENTED_AND_INSPECTED` | Unit test plus Playwright `?section=simulator` lands on `/dashboard` with Günlük iş girişi and no simulator panels | Copilot continues to redirect to `/dashboard/ai-chat` | Closed |
| P1.7 | Update navigation-contract and visible-text tests | Nav/routing unit tests, visual helpers/specs, stage-7 catalog helpers, AI Chat snapshots | Tests now assert absence of removed chrome and seed drafts via `POST /api/simulator` with `x-siriusai-client-version` | `IMPLEMENTED_AND_INSPECTED` | See verification section | Historical `docs/PHASE_85_STAGE_7_SCENARIO_MATRIX.json` was not rewritten | Closed |
| P1.8 | Desktop, tablet, and mobile empty space, focus order, overflow | `dashboard-shell.tsx` overflow clip; visual/a11y specs | Playwright projects `desktop` (1440), `tablet` (768), `mobile-android` (390) plus the existing 320px hub test | `IMPLEMENTED_AND_INSPECTED` | Accessibility/keyboard specs passed; overflow assertions passed after shell `overflow-x-clip` | Physical iPhone Safari/PWA remains `WAIVED_NOT_EXECUTED`. Chromium mobile-ios project was not re-run in this phase | Closed |
| P1.9 | Prove every listed removable surface is gone | This evidence file plus remaining greps | Dietitian dashboard render tree no longer mounts simulator panel, operational foundation, demo reset, top language, top client picker, or local-safe-mode footer | `IMPLEMENTED_AND_INSPECTED` | Combined with P1.1–P1.8 tests | Admin console copy `Operasyon paneline bağlan` is out of Faz 1 (admin lifecycle is Faz 4). Unused panel files remain until a later unused-code phase | Closed |

## Surfaces kept

Clients and workspace, Critical Context, Forms, nutrition/menu plans, Messages, Alerts/Notifications, AI Chat, Settings language selector, logout, dirty-state, tenant/account/client scope, Voice, human-control conversation banner.

## Backend left in place

- `app/src/app/api/simulator/route.ts`
- `app/src/app/api/simulator/visual/route.ts`
- `app/src/app/api/simulator/voice/route.ts`
- `app/src/app/api/operational-foundation/route.ts`
- `app/src/components/dashboard/simulator-panel.tsx`
- `app/src/components/dashboard/operational-foundation-panel.tsx`
- `app/src/components/dashboard/active-client-control.tsx`

## Verification

Command: `npm run typecheck` (from `app/`)

```text
PASS - tsc --project tsconfig.production.json
```

Command: `npx vitest run src/lib/phase-85-stage-5-shell-navigation.test.ts src/lib/phase-85-stage-4b-dashboard-routing.test.ts tests/visual/stage-7/stage-7-phase-7-3-helpers.test.ts --no-file-parallelism --maxWorkers=1`

```text
Test Files  3 passed (3)
Tests  31 passed (31)
```

Command: `npx vitest run src/lib/phase-85-stage-5-shell-navigation.test.ts src/lib/phase-85-stage-4b-dashboard-routing.test.ts src/lib/phase-85-stage-6-dashboard-contracts.test.ts --no-file-parallelism --maxWorkers=1`

```text
Test Files  3 passed (3)
Tests  35 passed (35)
```

Command: `npm run lint` (from `app/`)

```text
0 errors. Existing unused-var warnings remain (previously recorded as 77). Phase 1 dashboard files linted clean after removing unused navigateToSection.
```

Command: `npm run build` (from `app/`, webpack)

```text
PASS - compiled, TypeScript, 77 static/dynamic routes. `/api/simulator` and `/api/operational-foundation` still present. No `/dashboard/simulator` route.
```

Command: `git diff --check`

```text
PASS - no whitespace errors (CRLF conversion warnings only)
```

Playwright (after production build; `PLAYWRIGHT_BROWSERS_PATH` pointed at `%USERPROFILE%\AppData\Local\ms-playwright`):

- Projects: `desktop`, `tablet`, `mobile-android`
- Specs: dashboard, messaging, settings, stage-6 visual, stage-6 accessibility, stage-4b3, stage-4b4, ai-chat
- Result after seed-header/reload and snapshot updates: dashboard core views PASS, messaging PASS, settings PASS, stage-6 visual/a11y PASS including keyboard and 320px overflow, retired simulator/visual/voice surfaces PASS, AI Chat snapshots 6/6 PASS
- First Playwright attempt used a sandbox browser path and was `environment-blocked` (chromium missing). That run is not counted as PASS. The rerun against the local Playwright cache is the counted result.
- `next start` printed the pre-existing standalone-output warning; the Playwright webServer still served `http://127.0.0.1:3100`

Visible-text scan after implementation: dietitian dashboard components no longer render `Operasyon paneli`, `Demoyu sıfırla`, `Yerel güvenli mod`, `Gelen mesaj simülatörü`, or `Gelen mesajı simüle et`. Remaining hits are unused files, i18n catalogs, admin console, or tests asserting absence.

## Not executed / not counted as PASS

- Physical iPhone Safari/PWA: `WAIVED_NOT_EXECUTED`
- Full `npm test` (entire `app/src` Vitest suite)
- Full `npm run test:visual` matrix (`desktop-xl`, `mobile-ios` emulation, WebKit, Firefox, stage-7 browser matrix)
- Push, deploy, remote migration, production worker, live billing, WhatsApp, Z.ai

## Production gates

Unchanged: `NO-GO`. Compatibility names unchanged. No secrets, PHI, or raw prompts are recorded here.

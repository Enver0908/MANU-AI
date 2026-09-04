# Public Surface/Auth/Onboarding/PWA Phase 6 Evidence

Date: 2026-09-04
Phase: `6 - PWA, App-Install, Responsive, and Accessibility`
Authority: `c:\Users\Dell\Downloads\PLAN (7).md` Faz 6 (`P6.1`–`P6.10`)
Canonical plan: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md`
Parent HEAD: `e58be1f75dd8375adae9bc535841ee79a9c21318`
Verdict: `PASS_LOCAL_PHASE_6_CLOSED`

## Scope

Confirm the AIya PWA remains reinstallable under the current identity, network-only for auth/dashboard/API, privacy-lock compatible when offline, and aligned with the web dashboard session/auth behavior. `/app-install` stays the only install route. Manual Android Chrome install guidance is shown when `beforeinstallprompt` is missing. Production remains `NO-GO`. No deploy, remote migration, WhatsApp, Z.ai, live billing, DNS, auth sender, or production gate change was executed.

## Prerequisite

Phase 5 is locally closed. Public CTAs are “Bize ulaşın” / “Giriş yap”. Password-first login, invite onboarding, two-hour session policy, and Phase 1 dashboard chrome removal already exist.

## Requirement-diff matrix

| Adım kimliği | Beklenen sonuç | Değişen dosyalar | İnceleme kanıtı | Durum | Test sonucu | Sapma | Kapanış |
|---|---|---|---|---|---|---|---|
| P6.1 | Re-extract manifest, SW, and install-route wiring | `public-surface-phase-6-pwa.test.ts` | Layout still points at `/manifest.webmanifest` and `PwaRuntime`. `pwa-runtime.tsx` returns null; `shell-provider.tsx` registers `/sw.js`, sends `SKIP_WAITING`, and bootstraps again on `controllerchange`. `/app-install` still gates through `resolveMobileInstallAccess` | `IMPLEMENTED_AND_INSPECTED` | Phase 6 inventory unit PASS | No new install route was added | Closed |
| P6.2 | Auth redirects use only `/app-install`; reject `/install` | `phase-84d-customer-auth.ts` (unchanged contract), `public-surface-phase-6-pwa.test.ts` | `POST_AUTH_REDIRECT_ALLOWLIST_PREFIXES` contains `/app-install` and not `/install`. `sanitizePostAuthRedirectPath("/install")` is null. No `app/src/app/install` route | `IMPLEMENTED_AND_INSPECTED` | Allowlist unit PASS | Existing `/app-install` page was already the canonical route | Closed |
| P6.3 | Manifest AIya name, start URL, scope, display, icons | `app/public/manifest.webmanifest` (unchanged product identity), `public-surface-phase-6-pwa.test.ts` | `name`/`short_name` are `AIya`; `start_url` is `/dashboard`; `scope` is `/`; `display` is `standalone`; 192/512/maskable icons exist | `IMPLEMENTED_AND_INSPECTED` | Manifest schema/icon unit PASS | Legacy `siriusai-*` icon aliases remain as compatibility names | Closed |
| P6.4 | SW does not cache API, auth, or navigation | `app/public/sw.js`, `phase-85-stage-5-shell-pwa.ts`, `phase-83d-pwa-install-gate.ts` | Classifier is network-only for `/api/*`, `navigate`, `/`, `/dashboard`, `/app-install`, `/login`, `/onboarding`, `/auth/callback`. Fetch handler uses `networkOnly` for that class and never `cache.put`s it. Compatibility cache names `siriusai-static-*`, `siriusai-assets-*`, `manu-ai-shell-*` remain | `IMPLEMENTED_AND_INSPECTED` | SW network-only + cache inspection unit PASS | Only hashed `/_next/static` and icon/manifest assets stay cacheable | Closed |
| P6.5 | Offline foreground/reopen privacy-lock | `shell-provider.tsx` `go_offline` reducer, `dashboard-shell.tsx`, `public-surface-pwa.visual.spec.ts` | Offline dispatch clears bootstrap. Blocker copy is “İnternet bağlantısı gerekli” / “Korumalı içerik çevrimdışıyken açılamaz…”. Daily-work heading and client roster are absent while offline | `IMPLEMENTED_AND_INSPECTED` | Reducer unit + Playwright offline lock PASS | No offline mutation or health-data cache was added | Closed |
| P6.6 | Phase 1 removed dashboard chrome stays absent in installed PWA | `dashboard-app.tsx`, `dashboard-navigation.tsx`, `dashboard/layout.tsx`, visual spec | Simulator/operational inspection strings and testids remain absent. Dashboard layout/shell do not fork chrome on `display-mode`. Installed PWA is the same `/dashboard` shell as web | `IMPLEMENTED_AND_INSPECTED` | Source contract + Playwright dashboard chrome absence PASS | Standalone `matchMedia` was not stubbed before bootstrap because an incomplete stub fail-closed the shell | Closed |
| P6.7 | Two-hour session policy in PWA background/foreground | `phase-85-stage-5-shell-session-policy.ts`, `shell-provider.tsx` | Idle window remains `7_200_000` ms. Hidden-tab does not write activity. Locked foreground redirects `/login?next=/dashboard`. Fallback visual store skips `/api/session/activity` so a local 503 cannot wipe the shell; live mode still posts and fail-closes | `IMPLEMENTED_AND_INSPECTED` | Session policy unit PASS | Fallback skip is local-store only; live PWA still uses the same two-hour server policy as web | Closed |
| P6.8 | Phase 3 password login and invite onboarding on mobile | `public-surface-pwa.visual.spec.ts`, `commercial-saas.visual.spec.ts` | 360px `/login` shows email+password and a 44px “Giriş yap” control. Unauthenticated `/onboarding` still fails closed to `/login` | `IMPLEMENTED_AND_INSPECTED` | Desktop/tablet/mobile-android visual PASS | Invite completion still requires a configured auth session; the fail-closed empty state is the honest mobile proof | Closed |
| P6.9 | 360px / tablet / desktop overflow, overlap, focus order | `public-surface-pwa.visual.spec.ts` | 360×800 public/login/onboarding/app-install have no horizontal overflow. Login tab order is email then password. Admin login does not overflow | `IMPLEMENTED_AND_INSPECTED` | Playwright 360/tablet/desktop PASS | Overlap is checked by focus remaining on the password field after Tab, not by a pixel-overlap screenshot | Closed |
| P6.10 | Android Chrome, installed Android PWA, TalkBack evidence | this file, `public-surface-pwa.visual.spec.ts` | Playwright Chromium Pixel 5 (`mobile-android`) is the local Android Chrome PASS. Installed-PWA PASS is the same authenticated shell at manifest `start_url=/dashboard` plus offline privacy-lock. TalkBack is `WAIVED_NOT_EXECUTED`. iPhone remains `WAIVED_NOT_EXECUTED` | `IMPLEMENTED_AND_INSPECTED` | mobile-android visual PASS; TalkBack not executed | Physical Android Chrome/TalkBack cannot run in this Windows Cursor environment and are not recorded as PASS | Closed |

## Surfaces kept

Manifest AIya identity, `/app-install`, network-only API/auth/navigation, compatibility cache names, two-hour live session policy, iPhone waiver, and production `NO-GO` remain. WhatsApp, Z.ai, live Stripe, domain, and deploy were not changed.

## Verification

Command: `npx vitest run src/lib/public-surface-phase-6-pwa.test.ts src/lib/phase-83d-pwa-install-gate.test.ts src/lib/phase-85-stage-5-shell-pwa.test.ts src/lib/phase-85-stage-5-shell-session.test.ts src/lib/phase-84d-customer-auth.test.ts --no-file-parallelism --maxWorkers=1`

```text
Test Files  5 passed (5)
Tests  46 passed (46)
```

Command: `npx playwright test tests/visual/public-surface-pwa.visual.spec.ts tests/visual/commercial-saas.visual.spec.ts --project=desktop --project=tablet --project=mobile-android`

```text
24 passed (29.1s)
```

Command: `npm run typecheck`

```text
PASS - tsc --project tsconfig.production.json
```

Command: `npm run lint`

```text
0 errors, 76 existing unused-var warnings. Phase 6 files linted clean.
```

Command: `npm run build`

```text
PASS - webpack production build. Routes include `/`, `/login`, `/onboarding`, `/app-install`, `/dashboard`.
```

Command: `git diff --check`

```text
PASS - no whitespace errors (CRLF conversion warnings only)
```

## Android / TalkBack / iPhone honesty

- Local Android Chrome PASS = Playwright Chromium `Pixel 5` project `mobile-android`.
- Local installed Android PWA PASS = same `/dashboard` shell as web, with Phase 1 chrome absent and offline privacy-lock. This is not a physical Add-to-Home-Screen device run.
- Android TalkBack = `WAIVED_NOT_EXECUTED`. It is not PASS.
- iPhone Safari/PWA = `WAIVED_NOT_EXECUTED`. It is not PASS.
- `failed`, `skipped`, `simulated`, `stale`, and `environment-blocked` are not treated as PASS.

## Production boundary

Production remains `NO-GO`. No push, deploy, Stripe live billing, WhatsApp, Z.ai, DNS, auth sender, remote migration, or production gate change is authorized. Next eligible unit is Phase 7 only after explicit user approval.

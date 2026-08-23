# Phase 85 Stage 7.4 Accessibility, Browser, and Performance Evidence

Date: 2026-08-24

Status: STAGE_7_4_A11Y_BROWSER_PERF

Stage 5: STAGE_5_CLOSED

Stage 6: STAGE_6_CLOSED

Physical iPhone: WAIVED_NOT_EXECUTED

Production: NO-GO

## Result

Stage 7.4 closed accessibility, browser convergence, and local-lab performance on the remediated public, commercial, auth, admin, dashboard, and PWA surfaces. WCAG 2.2 AA is an internal quality target for tested synthetic states. This is not a formal certification and not production GO.

Assigned open P0/P1/P2 after this phase: **0**.

## Assigned finding

Stage 7.1 recorded P2 `S7-F-pwa-pwa-offline-lock-dietitian-tr-chromium-deskt-03` on `pwa.pwa-offline-lock.dietitian.tr.chromium-desktop` (Tab stayed on BODY after in-app offline lock). It is **resolved**.

Root cause: the offline shell unmounted focused chrome and did not move focus onto the retry control.

Fix: the offline `ShellBlocker` focuses the first `button, a[href]` when it mounts. Playwright confirms Tab leaves BODY and reaches `shell-retry`. Service-worker cache/PHI/network-only policy is unchanged.

## Accessibility

- Axe helper is centralized on WCAG 2.0/2.1/2.2 A and AA tags. Best-practice is not a closure gate. Every WCAG A/AA violation is a blocker; serious/critical is not used as a filter.
- Axe after login, dashboard shell, active-client dialog/menu, dirty-navigation dialog when shown, offline lock, and dashboard routes: **0 violations**.
- Incomplete nodes were reviewed. None became a WCAG A/AA finding. Closed-trigger `aria-controls` is omitted unless the dialog is open. Open listbox uses `role="option"` results; empty/loading copy is text. Manual result: **PASS**.
- Landmark ARIA snapshot matches banner/navigation/main. Dialog snapshots match dialog/alertdialog.
- Keyboard protocol: skip-link, header/bottom nav, client selector (Enter/Escape/focus return), roster → hub → task, form save focus, messaging composer. No keyboard trap. Focus is visible and not covered by sticky chrome.
- Reflow: 320×720, 844×390, 200% text, 400% equivalent as 320×256 (not zoom stacked on 320). Page-level biaxial scroll absent. `prefers-reduced-motion: reduce` is honored.
- NVDA + Firefox critical smoke: login, dashboard navigation, client selection, form/dialog, messaging. **PASS**. NVDA absence would have been BLOCKED, not PASS.
- WebKit iPhone/iPad emulation: auth, shell, workspace, messaging, alerts/notifications, offline lock. **PASS**. This is not physical Safari or iPhone evidence.
- Firefox desktop: login, admin, dashboard, clients, messaging. **PASS**.

## Performance and bundle

Local lab only. Not field Core Web Vitals.

- Harness: `npm run test:stage-7-lab-perf` (`app/scripts/measure-stage-7-lab-perf.mjs`). Stage 5 script thresholds/semantics were not changed.
- Routes: `/`, `/login`, `/purchase`, `/app-install`, `/admin`, `/dashboard`, clients/messages/alerts/notifications, `/dashboard/ai-chat`, `/dashboard/settings`.
- Dense dashboard routes were seeded with `POST /api/app-state` before measurement.
- 10 runs per route, p75: LCP ≤2500ms, CLS ≤0.1, TBT ≤200ms, interaction proxy ≤200ms. **PASS**.
- Shell gzip 130486 bytes vs Stage 5 baseline 125698; 110% cap 138267. **withinBudget: true**.
- Report kind: `local_lab_only`. Production: **NO-GO**.

## Tests and gates

- Vitest helpers: WCAG tag set, Stage 5 budgets, 7.4 route scope, offline focus/dialog trap, NVDA absence is not PASS, privacy scan. 13 passed with 7.2/7.3 helpers.
- Playwright `stage-7-phase-7-4.spec.ts` on chromium-desktop, chromium-reflow 320×720, chromium-landscape 844×390, webkit-iphone, webkit-ipad, firefox-desktop: 16 passed, 32 skipped by project filter. A WebKit worker teardown hang occurred after the iPhone smoke **PASS**; it was not a test failure.
- `node scripts/verify-stage-7.mjs --self-test` still fails on unscoped open P1 and passes the 7.2 phase filter.
- `node scripts/verify-stage-7.mjs --phase=7.4` is the accessibility/browser/performance verify gate.
- Production typecheck passed. Production build was reused for lab perf and NVDA.
- Visual snapshot baselines were not refreshed.

## Explicit non-claims

- Production remains NO-GO.
- Physical iPhone remains WAIVED_NOT_EXECUTED.
- WebKit emulation is not physical iPhone or Safari PASS.
- Local lab is not field Core Web Vitals.
- No formal WCAG certification is claimed.
- Stage 7.5 physical Android / TalkBack / closure is not started.
- API, store, mutation, Stage 5/6 contracts, and service-worker cache/PHI/network-only policy are unchanged.

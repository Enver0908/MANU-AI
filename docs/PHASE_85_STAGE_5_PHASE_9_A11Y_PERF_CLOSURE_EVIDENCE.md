# Phase 85 Stage 5 Phase 9 Accessibility Language Performance And Closure Evidence

> Historical pre-remediation snapshot. The `BLOCKED` status below was superseded after dependency, performance, zero-skip RLS, and physical-device evidence passed. Current authority is the 2026-08-18 `STAGE_5_CLOSED` decision in `docs/PHASE_85_STAGE_5_CLOSURE_DECISION.json`; production remains independently `NO-GO`.

Date: 2026-08-02

Branch: `codex/stage-4c-remediation`

Status: **LOCAL AUTOMATION HARNESS COMPLETE — FULL STAGE 5 CLOSURE BLOCKED** on real-device PWA proof and clean local Supabase RLS (0-skip).

This phase implements Stage 5 Faz 9 only. Production remains `NO-GO`. R-405 remains open. Push/PR/deploy and real-provider activation are unchanged and out of scope.

## Scope Delivered

- Seven-language Stage 5 shell dictionary (`phase-85-stage-5-shell-i18n.ts`) with Turkish fallback via `t()`
- TR/DE/PT long-label overflow fixtures + unit coverage
- Playwright projects: keep Chromium visual matrix; add real `webkit-mobile`, `webkit-tablet`, `firefox-desktop` for Stage 5 shell suites; `mobile-ios` remains Chromium iOS *emulation* (not Safari)
- Stage 5 shell axe / keyboard / dirty-dialog / offline-blocker accessibility specs
- 320 px reflow, 200% text, orientation, reduced-motion, overflow fixture responsive specs
- Provider-independent `ShellMetricSink` + `ShellWebVitalsReporter` (`next/web-vitals`); production sink default no-op; payload excludes client ID / raw URL
- Bundle budget helpers (+10% over locked Faz 9 baseline; Faz 1 had no gzip number)
- `npm run test:stage-5-shell` (`scripts/verify-stage-5-shell.mjs`)
- `npm run test:stage-5-lab-perf` (`scripts/measure-stage-5-lab-perf.mjs`) — local lab only, not field CWV
- `release-verify.mjs` now includes Stage 5 shell verify after production build
- In-app browser install guide routing users to Safari/Chrome
- Shell DTO privacy allowlist unit scan

## Gate Matrix

| Gate | Result | Notes |
| --- | --- | --- |
| i18n completeness (7 langs) | PASS | Vitest `assertDashboardMessagesComplete` + shell keys |
| Overflow fixtures tr/de/pt | PASS | Unit + responsive spec authored |
| Playwright WebKit/Firefox projects | PASS (config) | Browsers must be installed locally to execute |
| Axe shell suites | AUTHORED | Requires production build + `playwright test` |
| Keyboard / skip / focus contracts | AUTHORED | Same |
| 320 / 200% / orientation / reduced-motion | AUTHORED | Same |
| Lab perf 10 cold runs + p75 targets | HARNESS READY | Run `npm run test:stage-5-lab-perf`; report is lab-only |
| Bundle ≤ baseline +10% | HARNESS READY | Baseline file created on first verify against `.next` |
| ShellMetricSink no-op default / sanitized payload | PASS | Unit tests |
| Clean Supabase reset + RLS 0-skip | BLOCKED | `npm run test:rls` fail-closed: local Supabase / `MANU_ALLOW_REMOTE_RLS_TESTS` unavailable (55 skipped) |
| Secret/PHI/cache scans (DTO allowlist) | PASS (unit) | Browser Cache Storage / storage live scan still part of device matrix |
| Real iPhone Safari + installed PWA | BLOCKED | Emulator results are not accepted as device proof |
| Real Android Chrome + installed PWA | BLOCKED | Same |
| iPad Safari / desktop Chrome-Edge / macOS Safari / Firefox matrix | PARTIAL | Firefox/WebKit projects added; real macOS Safari/iPad pending device access |
| In-app browser → Safari/Chrome guide | PASS | `AppInstallCenter` + UA detection |
| lint / typecheck / unit contracts | PASS (targeted) | Full `release:verify` not re-run end-to-end in this session |
| Production status / R-405 / push-PR-deploy | UNCHANGED | `NO-GO` / open / not performed |

## Honest Closure Verdict

**Stage 5 is NOT fully closed.** Faz 9 delivered the required automation, i18n, metric sink, bundle/perf harnesses, and evidence scaffolding. Completion criteria that require real iOS/Android PWA proof and clean local RLS 0-skip remain open blockers.

No production launch gate was closed. No real provider was activated. No usability study is claimed.

## Next Actions Before Stage 5 Full Closure

1. Provision local Supabase, clean reset, re-run `npm run test:rls` with 0 skipped.
2. Install Playwright WebKit/Firefox browsers; run Stage 5 shell a11y/responsive projects.
3. Capture real-device evidence checklist for iPhone Safari/PWA and Android Chrome/PWA (offline must not show client names).
4. Run `npm run test:stage-5-lab-perf` and attach p75 table; do not hide misses.
5. Run `npm run release:verify` once Docker/device gates are green.

## Changed Files (primary)

- `app/src/lib/phase-85-stage-5-shell-i18n.ts` (+ tests)
- `app/src/lib/phase-85-stage-5-shell-metric-sink.ts` (+ tests)
- `app/src/lib/phase-85-stage-5-shell-bundle-budget.ts` (+ tests)
- `app/src/lib/phase-85-stage-5-shell-privacy-scan.test.ts`
- `app/src/components/dashboard/shell-web-vitals-reporter.tsx`
- `app/src/components/dashboard/shell-provider.tsx` / `dashboard-shell.tsx` / dirty dialog
- `app/playwright.config.ts`
- `app/tests/visual/stage-5-shell.accessibility.spec.ts`
- `app/tests/visual/stage-5-shell.responsive.spec.ts`
- `app/scripts/verify-stage-5-shell.mjs`
- `app/scripts/measure-stage-5-lab-perf.mjs`
- `app/scripts/release-verify.mjs`
- `app/src/lib/phase-83d-pwa-install-gate.ts` (+ install center in-app guide)
- Continuity docs

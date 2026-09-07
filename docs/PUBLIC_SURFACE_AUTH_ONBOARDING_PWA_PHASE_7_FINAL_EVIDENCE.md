# Public Surface/Auth/Onboarding/PWA Phase 7 Final Evidence

Current authority (2026-09-04): historical Phase 7 PASS is superseded for current closure by Faz 8. RLS environment-blocked and Playwright-only Android/TalkBack are not PASS. Production remains `NO-GO`.

Date: 2026-09-04
Phase: `7 - Frontend Remnant Cleanup and Unified Local Closure`
Authority: `c:\Users\Dell\Downloads\PLAN (7).md` Faz 7 (`P7.1`–`P7.12`)
Canonical plan: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md`
Parent HEAD: `2d4278a28946a84e87ebde1f9644cc1ac42edc45`
Live VPS release: `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9` / `hs-4c7bbea8ba21-2c32cf194421`
Verdict: `PASS_LOCAL_PHASE_7_CLOSED`

## Scope

Remove proven-unused frontend UI after Phases 1–6, keep backend simulator/trust/quarantine/Stripe/WhatsApp contracts, run the unified local verification matrix, and reconcile current-authority documents. Production remains `NO-GO`. No deploy, remote migration, WhatsApp, Z.ai, live billing, DNS, auth sender, or production gate change was executed.

## Prerequisite

Phases 0–6 evidence files exist. Phase 6 is locally closed. Unused dashboard panel files were left on disk in Phase 1 for this phase.

## Requirement-diff matrix

| Adım kimliği | Beklenen sonuç | Değişen dosyalar | İnceleme kanıtı | Durum | Test sonucu | Sapma | Kapanış |
|---|---|---|---|---|---|---|---|
| P7.1 | Unused frontend import graph and route accessibility report | `public-surface-phase-7-closure.test.ts` | Scan found zero-import UI: `simulator-panel`, `operational-foundation-panel`, `active-client-control`, `client-status-strip`, `copilot-panel`, `handoffs-panel`, `aiya-marketing-page`, `contact-lead-form`. `ui/index.ts` is a live barrel, not unused. `/demo` remains a gated local route | `IMPLEMENTED_AND_INSPECTED` | Phase 7 graph unit PASS | Relative `./` imports keep live panels; they were not deleted | Closed |
| P7.2 | Delete only proven-unused UI files | deleted 8 UI files listed above | No remaining imports. Backend `/api/simulator*`, `/api/operational-foundation`, Stripe checkout/webhook, and WhatsApp webhook routes still exist in the production build | `IMPLEMENTED_AND_INSPECTED` | Build route list still includes those APIs | Compatibility names and historical evidence were not rewritten | Closed |
| P7.3 | Reconcile old snapshots/fixtures with the active surface | `public-surface-phase-5.test.ts`, `stage-5-shell.accessibility.spec.ts` | Phase 5 runtime scan no longer reads deleted marketing files; it scans live `ContactSection`. Compact-nav a11y fixture now focuses `a, button` because shell nav is link-based. Absence assertions for simulator panels remain | `IMPLEMENTED_AND_INSPECTED` | Phase 5 unit PASS; mobile-android a11y 5/5 after locator fix | Visual PNG snapshots that still match current UI were kept | Closed |
| P7.4 | Active runtime old brand/domain/demo text scan | `public-surface-phase-7-closure.test.ts`, `public-surface-phase-5.test.ts` | Public/auth/dashboard runtime has no `siriusai.store`, visible `SiriusAI`, `NO-GO`, `Demoyu sıfırla`, `Operasyon paneli`, or `Gelen mesaj simülatörü`. Compatibility names remain allowlisted | `IMPLEMENTED_AND_INSPECTED` | Brand/demo scan unit PASS | Historical docs and i18n catalog keys may still mention old terms | Closed |
| P7.5 | Cross-tenant, service-role, RLS boundary scan | `commercial-admin-store.ts`, reactivation SQL, `hosted-sandbox-tenant-isolation.test.ts`, `npm run test:rls` | Reactivate keeps `copiedClientData: false` and does not WhatsApp-backfill. RLS suite is environment-blocked (`MANU_ALLOW_REMOTE_RLS_TESTS` / no local Supabase) | `IMPLEMENTED_AND_INSPECTED` | Isolation/reactivate unit PASS; `test:rls` 1 failed fail-closed gate + 55 skipped | RLS is `environment-blocked`, not PASS | Closed |
| P7.6 | Unified public → contact → invite → onboarding → password login → dashboard → revoke → reactivate | existing Phase 3/4 contracts + Phase 7 binding tests + Playwright | Invite command, read-only invited email, password-first login, magic-link secondary, `/app-install` allowlist, revoke copy, `activate\|renew\|reactivate` remain | `IMPLEMENTED_AND_INSPECTED` | `npm test` 1698 passed / 9 skipped; commercial-saas + dashboard visual PASS | End-to-end live admin email send was not executed against production | Closed |
| P7.7 | PWA install, background session, offline privacy-lock, logout | Phase 6 contracts + `public-surface-pwa.visual.spec.ts` + shell-provider logout | Network-only SW, two-hour idle, offline blocker, and `demo-logout` remain | `IMPLEMENTED_AND_INSPECTED` | PWA visual 9/9 across desktop/tablet/mobile-android | TalkBack/iPhone remain `WAIVED_NOT_EXECUTED` | Closed |
| P7.8 | Full unit/integration/visual/a11y/build/release matrix | this file, `app/package-lock.json`, `app/scripts/verify-stage-5-dependencies.mjs`, `docs/PHASE_85_STAGE_5_DEPENDENCY_SECURITY_REPORT.json` | Commands below. Lint warnings remain 76/0 errors, no new warning class. Nested production `@xmldom/xmldom` 0.8.13→0.8.15 and `qs` 6.15.3→6.16.0 stay inside existing `mammoth`/`stripe` ranges. Audit capture retries registry 503 only; zero-vuln assertion is unchanged | `IMPLEMENTED_AND_INSPECTED` | See verification | `test:rls` environment-blocked; 4 a11y tests skipped by viewport/project gate; 9 unit tests skipped pre-existing | Closed |
| P7.9 | Bind every PLAN (7) requirement to diff/test evidence | this matrix + prior Phase 0-6 evidence files | Phase 0-6 evidence files exist with closed verdicts. Public contract changes (2h session, password-first login, reactivate, production dashboard chrome, contact/login CTAs, network-only PWA) remain in code | `IMPLEMENTED_AND_INSPECTED` | Evidence-file unit PASS | Historical Phase 0 verdict is `PASS_LOCAL_DOCUMENTATION_ONLY` | Closed |
| P7.10 | Reconcile README, roadmap, risk, handoff, AIya docs | `README.md`, `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `HANDOFF_FOR_NEXT_CODEX.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/RISK_REGISTER.md`, `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`, owner handoff, `docs/AIYA_BRAND_TRANSITION_EVIDENCE.md` | Current locks now point at this evidence. AIya brand evidence received only a current-lock paragraph; historical body unchanged | `IMPLEMENTED_AND_INSPECTED` | Document review | Historical Stage 7 TalkBack PASS records remain historical and are not this phase’s Android proof | Closed |
| P7.11 | Live release unchanged; production gates closed | this file | Live VPS remains `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9`. Local HEAD is ahead. Production `NO-GO`. Stripe/WhatsApp route diffs empty | `IMPLEMENTED_AND_INSPECTED` | Empty `git diff` on Stripe/WhatsApp routes | No deploy | Closed |
| P7.12 | Pre-commit diff, secret, stale-doc, worktree review | this file | Secret scan on changed app/docs found no live keys/SMTP passwords. Stale unused UI files are gone. Worktree reviewed before commit | `IMPLEMENTED_AND_INSPECTED` | `git diff --check` PASS; secret grep PASS | CRLF conversion warnings only | Closed |

## P7.1 unused frontend import graph

Scan method: TypeScript/TSX import graph from live App Router pages, `dashboard-app.tsx`, public landing, login/onboarding/admin, and relative `./` dashboard imports. A file is unused only if no live route, component, barrel consumed by live code, or required test fixture imports it.

Deleted after zero live imports:

- `simulator-panel.tsx`
- `operational-foundation-panel.tsx`
- `active-client-control.tsx`
- `client-status-strip.tsx` (only imported by unused `active-client-control.tsx`)
- `copilot-panel.tsx`
- `handoffs-panel.tsx`
- `aiya-marketing-page.tsx`
- `contact-lead-form.tsx` (live contact form is `ContactSection.tsx`)

Kept because still reachable:

- Live dashboard panels: Overview, Messaging, Voice, Forms, Clients, Conversation, Critical Context, AI Chat, Alerts
- `components/ui/index.ts` barrel (consumed by `@/components/ui`)
- `/demo` gated local demo route
- `stage-7-dashboard-state.tsx` dummy `active-client-control` testid for the Stage 7 harness
- Backend `/api/simulator*`, `/api/operational-foundation`, Stripe, WhatsApp webhook

Route accessibility: production dashboard chrome no longer exposes simulator/operational inspection routes. Backend APIs remain. `/signup` and `/register` remain absent. `/login`, `/onboarding`, `/app-install`, `/dashboard`, `/admin`, `/purchase` remain.

## Files removed

- `app/src/components/dashboard/simulator-panel.tsx`
- `app/src/components/dashboard/operational-foundation-panel.tsx`
- `app/src/components/dashboard/active-client-control.tsx`
- `app/src/components/dashboard/client-status-strip.tsx`
- `app/src/components/dashboard/copilot-panel.tsx`
- `app/src/components/dashboard/handoffs-panel.tsx`
- `app/src/components/aiya-marketing-page.tsx`
- `app/src/components/contact-lead-form.tsx`

## Surfaces kept

Backend `/api/simulator`, `/api/simulator/visual`, `/api/simulator/voice`, `/api/operational-foundation`, Stripe checkout/webhook/admin subscription remnants, WhatsApp webhook, Critical Context, Voice panel, AI Chat, password login, invite onboarding, revoke/reactivate, `/app-install`, network-only PWA, two-hour session, production `NO-GO`.

## Verification

Command: `npx vitest run src/lib/public-surface-phase-7-closure.test.ts --no-file-parallelism --maxWorkers=1`

```text
Test Files  1 passed (1)
Tests  9 passed (9)
```

Command: `npm test`

```text
Test Files  284 passed (284)
Tests  1698 passed | 9 skipped (1707)
```

The 9 skipped tests are pre-existing suite skips. They are not treated as PASS.

Command: `npm run typecheck`

```text
PASS - tsc --project tsconfig.production.json
```

Command: `npm run lint`

```text
0 errors, 76 existing unused-var warnings. No new warning class.
```

Command: `npm run build`

```text
PASS - webpack production build. `/api/simulator`, `/api/operational-foundation`, `/api/commercial/checkout`, `/api/whatsapp/webhook`, `/login`, `/onboarding`, `/app-install`, `/dashboard`, `/admin` remain. `/signup` and `/register` remain absent.
```

Command: Playwright visual/a11y (`public-surface-pwa`, `commercial-saas`, `dashboard.visual`, `stage-5-shell.accessibility` on desktop/tablet/mobile-android)

```text
First run: 49 passed, 4 skipped, 1 failed (compact nav locator still expected `button`).
P7.3 fixture fix: mobile-android accessibility 5 passed (10.2s).
```

The 4 skipped a11y tests are project/viewport gated. They are not treated as PASS.

Command: `npm run test:rls`

```text
1 failed | 55 skipped (56)
RLS suite blocked: MANU_ALLOW_REMOTE_RLS_TESTS. Run local Supabase or set MANU_ALLOW_REMOTE_RLS_TESTS=true for an approved remote RLS target.
```

This is `environment-blocked`, not PASS.

Command: `git diff -- app/src/app/api/commercial/admin/subscriptions/route.ts app/src/app/api/commercial/admin/subscriptions/cancel/route.ts app/src/app/api/commercial/checkout/route.ts app/src/app/api/whatsapp/webhook/route.ts`

```text
empty
```

Command: `git diff --check`

```text
PASS - no whitespace errors (CRLF conversion warnings only)
```

Command: secret/sensitive-value scan over changed Phase 7 app/docs files

```text
PASS - no sk_live_/SMTP password/private-key matches
```

Command: `npm run test:stage-5-dependencies`

```text
[stage-5-dependencies] PASS; R-405 technically resolved by clean production dependency audit.
productionAudit totals: info 0, low 0, moderate 0, high 0, critical 0, total 0
```

Command: `npm run release:verify`

```text
Release identity bound: hs-2d4278a28946-9207ef83561d @ 2d4278a28946 fingerprint 9207ef83561d
lint: 0 errors, 76 warnings
unit tests: 284 passed, 1698 passed | 9 skipped
production build: PASS
[stage-5-dependencies] PASS
[verify-stage-5-shell] PASS (local automation)
Production dependency audit passed with zero production vulnerabilities.
Release verification passed. Production dependency audit is clean; R-405 is technically resolved.
exit 0
```

## Production boundary

Production remains `NO-GO`. Live VPS release is unchanged. Owner gates still blocking any production action: Meta/WhatsApp Business approval, Z.ai provider approval, production secrets, production Supabase/remote migration approval, manual bank-transfer operations, incident/monitoring/rollback ownership, and exact release approval. iPhone Safari/PWA remains `WAIVED_NOT_EXECUTED`. TalkBack for this phase remains `WAIVED_NOT_EXECUTED`. This local track is complete; next eligible work is owner/production gates only after explicit user approval.

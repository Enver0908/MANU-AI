# Phase 85 Stage 7.2 Public/Shared Remediation Evidence

Date: 2026-08-23

Status: STAGE_7_2_PUBLIC_SHARED_REMEDIATION

Stage 5: STAGE_5_CLOSED

Stage 6: STAGE_6_CLOSED

Physical iPhone: WAIVED_NOT_EXECUTED

Production: NO-GO

## Result

Stage 7.2 closed the shared design-system and public/commercial program on tokens, primitives, public/auth/purchase/onboarding/install/admin surfaces, helper tests, and the phase-scoped verify gate. Snapshot baselines were not refreshed; that wait is bound to user visual approval of the representative before/after set.

## Assigned findings

Stage 7.1 recorded no public/commercial P0/P1/P2. The two open P1s from `pwa.pwa-offline-lock.dietitian.tr.chromium-desktop` (`document-title`, `html-has-lang`) remain **open** and were reassigned to **7.3**.

Root cause: the Stage 7 runner reloads `/dashboard` after `setOffline(true)` with `serviceWorkers: "block"`. Chromium then paints its interstitial document, which has no `lang` and no title. Product `layout.tsx` already sets `lang="tr"` and a non-empty title. Closing that pair requires an in-app PWA/dashboard offline lock that keeps the product document. That work is Stage 7.3, not 7.2.

The remaining P2 (Tab focus stayed on BODY in the same offline-lock scenario) stays **open** on **7.4**.

After reassignment, Stage 7.2-owned open P0/P1/P2 count is **0**.

## Shared primitive work

- Operational danger uses the semantic destructive token, darkened for WCAG AA on paper; clinical green/yellow/red stay on `MESSAGE_RISK` only.
- Skip-link uses the primary-foreground token.
- Document `overflow-x: hidden` is not used to mask layout defects.
- Flex/grid children and command labels wrap through `.free-text` and `.command-label`.
- Field wires `aria-invalid` / `aria-describedby` from hint or error.
- Dialog/sheet use shared modal focus: initial focus, Tab cycle, Escape, restore, body scroll lock.

## Public and commercial surfaces

- Landing keeps the SiriusAI first-viewport signal and a next-section cue to `#workspace-preview`.
- Contact, login, purchase, and admin login expose visible, associated validation/status text without changing submit/auth/invite payloads.
- Emergency admin remains visually secondary (muted paper/line, not a primary marketing treatment).
- Admin operational success/warning chrome uses sage/muted tokens, not clinical risk colors.
- Admin has no product Dialog. Keyboard-only admin coverage is the admin login form. Dialog N/A with that justification.
- Public mock chrome no longer uses clinical risk colors as window-control decoration.
- In-text commercial links stay underlined. Small operational copy uses `text-ink-muted` where 12px `text-ink-subtle` failed contrast.

## Tests

- Vitest helpers: catalog public/commercial surfaces, field described-by, danger vs clinical red, skip-link token, privacy scan.
- Playwright `stage-7-phase-7-2.spec.ts`: Chromium 1440 / 320 / landscape routes, axe WCAG A/AA, overflow, long German/Portuguese contact copy, keyboard-only contact/login/onboarding/admin login, WebKit iPhone/iPad smoke, Firefox login/admin smoke.
- `node scripts/verify-stage-7.mjs --self-test` still fails on unscoped open P1 and passes the 7.2 phase filter.
- `node scripts/verify-stage-7.mjs --phase=7.2` is the public/commercial verify gate.
- Production build is part of the 7.2 verification set.
- Visual snapshot baselines are unchanged.

## Representative visuals for user approval

Before/after set to review (baselines must not update until this set is approved):

- Landing desktop and mobile
- Login / onboarding
- Purchase error / success
- Admin dense / empty

Current after-state is the local public/commercial UI after this phase. Capture those screens during review; do not treat Playwright snapshot refresh as 7.2 closure.

## Explicit non-claims

- Production remains NO-GO.
- Physical iPhone remains WAIVED_NOT_EXECUTED.
- Stage 7.3 dashboard/PWA remediation is not started.
- Auth, invite, entitlement, API, store, migration, and service-worker cache/PHI policy are unchanged.

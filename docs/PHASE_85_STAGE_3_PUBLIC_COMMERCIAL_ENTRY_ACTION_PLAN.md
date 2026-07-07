# Phase 85 Stage 3: Public Website And Commercial Entry Action Plan

Date: 2026-07-07
Status: implemented, verified, and deployed to the hosted sandbox for public/commercial entry surfaces.
Production pilot: NO-GO.
Clinical production GO: not in scope.

## Summary

Stage 3 redesigns the SiriusAI public website and commercial entry surfaces around the real invite-code operating model:

```text
contact request -> team/admin review -> admin invite code -> invite-gated checkout -> magic-link login -> onboarding claim -> dashboard/PWA
```

This is not a self-serve signup or open purchase flow. The public site collects qualified interest, the operations/admin surface creates invite codes, and dietitians can begin only with an approved email plus invite code.

Implementation note, 2026-07-07: the user-provided `public-website-redesign.zip` visual direction was adapted into the current app without copying the zip's mock API routes. Existing Phase 83/84 API, auth, invite, sandbox checkout, onboarding, admin, PWA, and fail-closed production boundaries remain preserved. The runtime palette was corrected to match the user's own design system: paper `oklch(0.985 0.003 85)`, primary purple `oklch(0.41 0.14 310)`, and hover purple `oklch(0.37 0.14 310)`.

Hosted sandbox deployment note, 2026-07-07: release `phase85-stage3-redesign-20260707225306` was deployed to the Hetzner PM2/Nginx sandbox at `https://siriusai.store`. Verification returned 200 for `/`, `/login`, `/purchase`, `/purchase/success`, `/app-install`, and `https://admin.siriusai.store`; browser computed-color verification confirmed the corrected paper and purple primary tokens on the live domain. This is not production pilot approval.

No backend API contract, database schema, clinical safety logic, provider/channel path, live billing path, or production launch gate changes are allowed in Stage 3.

## Locked Navigation

The public navbar order is fixed:

```text
SiriusAI | Nasil calisir | Guvenlik | Mobil | Iletisim | Giris yap | Davet koduyla basla
```

Route and anchor mapping:

- `SiriusAI` -> `/`
- `Nasil calisir` -> `#nasil-calisir`
- `Guvenlik` -> `#guvenlik`
- `Mobil` -> `#mobil`
- `Iletisim` -> `#iletisim`
- `Giris yap` -> `/login`
- `Davet koduyla basla` -> `/purchase`

Visual hierarchy:

- `Davet koduyla basla` is the primary plum CTA.
- `Giris yap` is a quieter text/ghost action.
- Mobile navigation must preserve the same order and keep 44px touch targets.

## Phase Plan

### Phase 3.1 - Public Information Architecture And Shell

- Replace the current generic commercial marketing structure with an invite-led public journey.
- Keep `SiriusAI` as the first-viewport brand signal.
- Use Phase 85 paper/surface/ink/plum/sage/warm tokens only.
- Avoid the previous green-heavy Phase 83/84 visual language except for clinical risk semantics.
- Do not use abstract AI gradients, orbs, bokeh, or stock wellness decoration.
- Keep the public header sticky, readable, and compact across desktop, tablet, and mobile.

### Phase 3.2 - Landing Page Redesign

Hero:

- H1: `SiriusAI`
- Supporting message: `Diyetisyen-danisan iletisimi icin davetli klinik calisma alani`
- Primary CTA: `Iletisime gec` -> `#iletisim`
- Secondary CTA: `Davet koduyla basla` -> `/purchase`
- Hero visual: code-native product preview, not a photo or abstract AI graphic.

Hero preview must show:

- Client message.
- AI draft state.
- Risk separation.
- Dietitian approval.
- Invite/active workspace signal.

Landing sections:

1. `Nasil calisir`: `Talep birak` -> `Ekip degerlendirir` -> `Davet kodu olusturulur` -> `Calisma alani baglanir`.
2. `Guvenlik`: supervised AI, clinical risk separation, dietitian control, tenant isolation, invite/entitlement model.
3. `Mobil`: active subscribers can use PWA; subscriber-only install; API/PHI cache remains blocked.
4. `Iletisim`: contact lead form is the main conversion point for users without an invite code.
5. Footer: production pilot remains `NO-GO`; clinical production use requires separate approvals.

### Phase 3.3 - Commercial Entry Surfaces

- `/login`: title `SiriusAI musteri girisi`; magic-link login only for registered/approved customer email addresses; contact fallback for missing access.
- `/purchase`: title `Davet koduyla basla`; approved email + invite code eligibility check before checkout; avoid generic `Satın al` positioning.
- `/purchase/success`: title `Odeme dogrulandi`; explain magic-link account binding and onboarding claim as the next step.
- `/purchase/cancel`: title `Odeme tamamlanmadi`; retry or support path.
- `/onboarding`: title `Calisma alanini baglayin`; payment-backed tenant membership and dietitian profile claim.
- `/app-install`: title `Mobil PWA kurulumu`; active-entitlement-only PWA access.
- `/admin`: title `SiriusAI yonetim`; lead, invite, subscription, ledger, health, and audit operations. It must not be exposed as a public CTA.
- `/commercial-admin/emergency`: keep as token-based emergency fallback only; visually secondary and warning-led.

### Phase 3.4 - State, Copy, And Failure Mode Polish

The following states must remain fail-closed and be presented clearly:

- No active invite.
- Email does not match invite.
- Invalid invite code.
- Expired, revoked, or consumed invite.
- Billing/auth/admin store not configured.
- Checkout started but not completed.
- Payment session not recognized yet.
- User not authenticated.
- Workspace already claimed.
- Inactive, past-due, canceled, or revoked entitlement.
- PWA install blocked or fallback-demo state.
- Admin allowlist denied.

Do not echo secrets, token fragments, magic-link fragments, webhook payloads, or invite hashes in UI or documentation.

### Phase 3.5 - Visual And Responsive Acceptance

- All redesigned public/commercial surfaces must use the Phase 85 shared UI primitives where practical.
- Do not create nested cards or floating card-heavy sections.
- Keep card radius at 8px or less unless an editorial media area has a specific non-card need.
- Ensure no text overflow, nav overlap, button overflow, or horizontal page scroll on desktop/tablet/mobile.
- Clinical green/yellow/red remains reserved for message/risk semantics.
- Public pages should feel editorial and premium; operational entry pages should feel calm, precise, and trustworthy.

### Phase 3.6 - Verification And Closure

Required checks after implementation:

- Targeted Phase 83/84 commercial/auth/onboarding tests.
- `npx vitest run src/components/ui/ui-design-system.test.ts --no-file-parallelism --maxWorkers=1`
- `npm run lint`
- `npm run build`
- `npm run test:visual` when local Playwright/browser startup succeeds.
- `git diff --check`
- Secret/token scan across changed files.
- Continuity docs updated with final verification counts.

## Public Interfaces

No new backend routes, database migrations, or API wire-shape changes are planned.

Existing endpoint contracts must remain intact:

- `/api/contact/leads`
- `/api/commercial/invite-status`
- `/api/commercial/checkout`
- `/api/auth/magic-link`
- `/api/commercial/onboarding/status`
- `/api/commercial/onboarding/claim`
- `/api/admin/auth/magic-link`

## Assumptions

- No pricing table appears on the public website in Stage 3.
- Contact form fields remain: name, email, optional clinic name, message.
- The hero visual is a code-native product preview.
- Dashboard internal panels remain out of scope until Stages 4 and 5.
- Stage 3 does not change production pilot status, R-405, R-406, external approvals, real provider/channel status, or live billing readiness.

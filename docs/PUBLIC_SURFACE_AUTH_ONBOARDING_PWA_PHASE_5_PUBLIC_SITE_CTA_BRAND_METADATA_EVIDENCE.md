# Public Surface/Auth/Onboarding/PWA Phase 5 Evidence

Current authority (2026-09-04): historical Phase 5 PASS is superseded for current closure by Faz 8. Production remains `NO-GO`.

Date: 2026-09-04
Phase: `5 - Public Site, CTA, Brand, and Metadata`
Authority: `c:\Users\Dell\Downloads\PLAN (7).md` Faz 5 (`P5.1`–`P5.10`)
Canonical plan: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md`
Parent HEAD: `bfe2f2779c39ebcc34705eef825214f6b79ff204`
Verdict: `PASS_LOCAL_PHASE_5_CLOSED`

## Scope

Make the public surface a corporate AIya showcase. Public primary CTA is “Bize ulaşın”; existing-customer CTA is “Giriş yap”. Public “Davet koduyla başla” links are removed. `/purchase` remains for direct URL and future Stripe. Contact success copy describes review and a setup link, not an invite-code email. Login, admin login, purchase, onboarding, and app-install define their own canonical/OG metadata. Customer origin is `https://aiyaworkspace.com`; admin origin is `https://admin.aiyaworkspace.com`. Visible tenant fallback is `AIya Workspace`. Production remains `NO-GO`. No deploy, remote migration, WhatsApp, Z.ai, live billing, DNS, auth sender, or production gate change was executed.

## Prerequisite

Phase 4 is locally closed. Password-first customer login and invite onboarding already exist. Admin customer invite/revoke/reactivate already exists. Historical `MANU Tenant` strings in earlier SQL files remain as past-state records.

## Requirement-diff matrix

| Adım kimliği | Beklenen sonuç | Değişen dosyalar | İnceleme kanıtı | Durum | Test sonucu | Sapma | Kapanış |
|---|---|---|---|---|---|---|---|
| P5.1 | Classify old brand, domain, and internal copy in active runtime | `public-surface-phase-5.test.ts`, public/auth page and component inventory | Active public/auth runtime scan covers navbar/hero/footer/shell, marketing copy, login/admin/purchase/onboarding/app-install. Retired `siriusai.store`, visible `SiriusAI`, `NO-GO`, sandbox, simulator, and `MANU Tenant` are classified as mismatches | `IMPLEMENTED_AND_INSPECTED` | Brand-scan unit tests PASS | Admin operations console and emergency page keep internal NO-GO copy; they are not public marketing surfaces | Closed |
| P5.2 | Allowlist technical compatibility names and separate them from visible mismatches | `brand.ts`, `app/layout.tsx` | `AIYA_TECHNICAL_COMPATIBILITY_NAMES` and `AIYA_COMPATIBILITY_BRAND_NOTES` keep `MANU_*`, `x-siriusai-*`, `siriusai-app-version`, cache names, and `SIRIUSAI_PUBLIC_CONTACT_EMAIL`. Layout still emits `siriusai-app-version`. Manifest product name remains `AIya` | `IMPLEMENTED_AND_INSPECTED` | Compatibility allowlist + shell-branding tests PASS | Historical evidence docs still mention old brands by design | Closed |
| P5.3 | Simplify public nav/CTAs around “Bize ulaşın” and “Giriş yap” | `PublicNavbar.tsx`, `HeroSection.tsx`, `aiya-marketing-page.tsx`, `phase-84b-public-website.ts` | Navbar and hero primary CTA is `/#iletisim` “Bize ulaşın”; secondary is `/login` “Giriş yap”. Marketing copy `contactCta` is “Bize ulaşın”. Touch targets use `min-h-11` / 44px | `IMPLEMENTED_AND_INSPECTED` | CTA unit + desktop/mobile visual PASS | Unused `AiyaMarketingPage` was aligned so it cannot reintroduce purchase as a public CTA | Closed |
| P5.4 | Remove public “Davet koduyla başla” links; keep `/purchase` | `PublicNavbar.tsx`, `HeroSection.tsx`, `purchase/page.tsx`, `purchase-flow.tsx` | Public nav/hero have no `/purchase` link and no “Davet koduyla başla”. `/purchase` still renders `PurchaseFlow` for direct URL. Copy states the page is not self-serve checkout | `IMPLEMENTED_AND_INSPECTED` | Direct `/purchase` visual + unit route check PASS | Invite-token field remains on the remnant purchase form | Closed |
| P5.5 | Align contact success/error copy with real onboarding | `ContactSection.tsx`, `contact-lead-form.tsx`, `phase-84b-public-website.ts` | `PUBLIC_CONTACT_COPY` success/process text uses review + setup-link, not “davet kodu”. Error and unavailable states still fail closed to retry/email | `IMPLEMENTED_AND_INSPECTED` | Contact copy unit + landing visual PASS | Lead API validation was not rewritten | Closed |
| P5.6 | Remove NO-GO/sandbox/simulator/pilot copy from public footer/content | `PublicFooter.tsx`, `CommercialShell.tsx`, `HowItWorksSection.tsx`, `SecuritySection.tsx`, `admin-login-form.tsx`, `phase-84b-public-website.ts`, purchase cancel/success copy | Public footer/shell no longer show `NO-GO` or production-pilot status. How-it-works and contact process describe setup-link access. Purchase cancel no longer says sandbox. Admin login form no longer shows NO-GO | `IMPLEMENTED_AND_INSPECTED` | Public runtime scan + visual `NO-GO`/sandbox absence PASS | `commercial-admin-console.tsx` and emergency page retain internal pilot language | Closed |
| P5.7 | Define route-specific metadata for login, admin, purchase, onboarding, app-install | `brand.ts`, `page.tsx`, `login/page.tsx`, `admin/page.tsx`, `purchase/page.tsx`, `purchase/success/page.tsx`, `purchase/cancel/page.tsx`, `onboarding/page.tsx`, `app-install/page.tsx`, `account/recovery/page.tsx`, `layout.tsx` | `buildCustomerSurfaceMetadata` / `buildAdminSurfaceMetadata` set title, description, canonical, and OG URL per path. Root layout no longer exports `canonical: "/"` so children cannot inherit `/` | `IMPLEMENTED_AND_INSPECTED` | Metadata helper + page-source tests PASS | Account recovery also received customer canonical so it cannot fall back to `/` | Closed |
| P5.8 | Verify canonical, OG URL, title, and description per route and domain | `brand.ts`, `public-route-metadata.test.ts` | Customer `/login` canonical is `https://aiyaworkspace.com/login`. Admin `/admin` canonical is `https://admin.aiyaworkspace.com/admin` and does not use the customer origin. No runtime redirect to production canonical was added | `IMPLEMENTED_AND_INSPECTED` | Canonical/OG unit tests PASS | `metadataBase` remains a metadata value, not a navigation redirect | Closed |
| P5.9 | Replace visible `MANU Tenant ...` fallback with `AIya Workspace` or tenant name | `brand.ts`, `commercial-billing-store.ts`, `20260904120000_aiya_workspace_tenant_fallback.sql` | `resolveVisibleTenantDisplayName` returns the trimmed tenant name or `AIya Workspace`. Append-only SQL replaces only the RPC display fallback; historical migrations still contain `MANU Tenant` | `IMPLEMENTED_AND_INSPECTED` | Fallback unit + migration contract tests PASS | Local SQL file was not applied to remote/production Supabase | Closed |
| P5.10 | Verify desktop/mobile CTA hierarchy, overflow, and readability | `public-surface-cta.visual.spec.ts`, `commercial-saas.visual.spec.ts`, `dashboard.visual.spec.ts` | Desktop 1440 and mobile-android 390 assert contact/login CTAs, no public invite-start link, `/purchase` direct access, login vs admin split, contact setup-link copy, 44px primary CTA, and no horizontal overflow | `IMPLEMENTED_AND_INSPECTED` | Playwright 20/20 PASS on desktop + mobile-android | iPhone Safari/PWA remains `WAIVED_NOT_EXECUTED` | Closed |

## Surfaces kept

`/purchase` and Stripe checkout/webhook routes remain. `MANU_*` env names, `x-siriusai-*` headers, `siriusai-app-version`, and service-worker cache names remain. Historical evidence old-brand records remain. Production pilot remains `NO-GO`.

## Verification

Command: `npx vitest run src/lib/public-surface-phase-5.test.ts src/lib/public-route-metadata.test.ts src/lib/aiya-workspace-tenant-fallback-migration-contract.test.ts src/lib/phase-84b-public-website.test.ts src/lib/phase-84h-verification-refresh.test.ts src/lib/phase-85-stage-5-shell-branding.test.ts src/lib/commercial-entitlement-reactivation-migration-contract.test.ts --no-file-parallelism --maxWorkers=1`

```text
Test Files  7 passed (7)
Tests  25 passed (25)
```

Command: `npx playwright test tests/visual/public-surface-cta.visual.spec.ts tests/visual/commercial-saas.visual.spec.ts tests/visual/dashboard.visual.spec.ts --project=desktop --project=mobile-android -g "public landing|public landing CTAs|customer login|admin login|purchase remains|marketing contact|purchase success|onboarding route"`

```text
20 passed (16.2s)
```

Command: `npm run typecheck`

```text
PASS - tsc --project tsconfig.production.json
```

Command: `npm run lint`

```text
0 errors, 76 existing unused-var warnings. Phase 5 files linted clean.
```

Command: `npm run build`

```text
PASS - webpack production build. Routes include `/`, `/login`, `/admin`, `/purchase`, `/purchase/success`, `/purchase/cancel`, `/onboarding`, `/app-install`.
```

Command: `git diff --check`

```text
PASS - no whitespace errors (CRLF conversion warnings only)
```

## Production boundary

Production remains `NO-GO`. The append-only tenant-fallback migration is local-only and was not applied remotely. No push, deploy, Stripe live billing, WhatsApp, Z.ai, DNS, auth sender, or production gate change is authorized. Next eligible unit is Phase 6 only after explicit user approval. iPhone Safari/PWA remains `WAIVED_NOT_EXECUTED`.

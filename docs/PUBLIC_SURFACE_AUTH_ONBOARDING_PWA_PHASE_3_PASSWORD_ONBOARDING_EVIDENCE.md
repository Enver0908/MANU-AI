# Public Surface/Auth/Onboarding/PWA Phase 3 Evidence

Date: 2026-09-04
Phase: `3 - Password-First Login and Invite Setup Onboarding`
Authority: `c:\Users\Dell\Downloads\PLAN (7).md` Faz 3 (`P3.1`–`P3.10`)
Canonical plan: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md`
Parent HEAD: `ca036d02d7fa62c9b007a950e8f5a88e8e105865`
Verdict: `PASS_LOCAL_PHASE_3_CLOSED`

## Scope

Daily customer login is email+password. Magic link remains an explicit secondary option and recovery path. New customers still cannot self-register; they open an admin setup link, land on `/onboarding` after PKCE/callback, see the invited email read-only, set a password on the authenticated Supabase user, then call the existing idempotent claim endpoint. The post-auth redirect allowlist uses `/app-install` instead of `/install`. Production remains `NO-GO`. No deploy, remote migration, Stripe payment-flow change, WhatsApp, Z.ai, DNS, SMTP, or production gate change was executed. Passwords are not written to logs, audit metadata, or this evidence file.

## Prerequisite

Installed Next.js has no `app/node_modules/next/dist/docs/` tree. Auth callback already used App Router `GET`, PKCE `code` exchange, `token_hash` OTP (`invite`/`magiclink`/`recovery`), and `sanitizePostAuthRedirectPath`. Password login already existed at `/api/auth/password-login` with generic `invalid_credentials`. Onboarding status/claim already accepted `{ sessionId }` and `{ inviteId }` after authenticated email match.

## Requirement-diff matrix

| Adım kimliği | Beklenen sonuç | Değişen dosyalar | İnceleme kanıtı | Durum | Test sonucu | Sapma | Kapanış |
|---|---|---|---|---|---|---|---|
| P3.1 | Map callback, password login, onboarding status, and claim together with tests | Evidence only | Callback: PKCE + invite/magiclink OTP + fragment bridge. Password login: `signInWithPassword`, generic 401, sanitized `next`. Status/claim: `validateOnboardingClaimReference` then authenticated email match. Tests already covered callback PKCE, session-from-fragment, claim idempotency, and email mismatch | `IMPLEMENTED_AND_INSPECTED` | Inventory plus later targeted unit tests | Mapping did not change Stripe webhook or claim RPC contracts | Closed |
| P3.2 | Change redirect allowlist `/install` → `/app-install` | `phase-84d-customer-auth.ts`, `phase-84d-customer-auth.test.ts`, `password-login/route.test.ts` | `POST_AUTH_REDIRECT_ALLOWLIST_PREFIXES` contains `/app-install`. `/install`, `/signup`, and `/register` are rejected | `IMPLEMENTED_AND_INSPECTED` | Allowlist unit + password-login next-path tests PASS | Live `/install` route was already historical; no public `/install` page remained | Closed |
| P3.3 | Make password the default customer login method | `customer-login-form.tsx`, `login/page.tsx`, `commercial-saas.visual.spec.ts` | Default mode is `password`. Heading is “E-posta ve şifreyle giriş”. Primary command is “Giriş yap” | `IMPLEMENTED_AND_INSPECTED` | Visual desktop 5/5; open-signup/login-source test | Admin login remains a separate magic-link form | Closed |
| P3.4 | Keep magic link as a secondary explicit option | `customer-login-form.tsx` | Password form shows “Giriş bağlantısı gönder” which switches to magic-link submit. “Şifremi unuttum” posts `/api/auth/password-reset` with enumeration-safe copy | `IMPLEMENTED_AND_INSPECTED` | Source assertion + visual secondary button | Magic-link API contract unchanged | Closed |
| P3.5 | Onboarding panel reads both session and `invite_id` safely | `onboarding/page.tsx`, `onboarding-claim-panel.tsx`, `phase-84e-customer-onboarding.ts` | Panel accepts `sessionId` or `inviteId`. Both together fail closed. Unauthenticated login `next` preserves only the validated reference | `IMPLEMENTED_AND_INSPECTED` | `buildOnboardingPathFromReference` unit test | Stripe `{ sessionId }` path remains | Closed |
| P3.6 | Take invited email from status API and render it read-only | `onboarding/status/route.ts`, `onboarding-claim-panel.tsx` | Authenticated matching email is returned as `invitedEmail`. Unauthenticated and mismatch responses omit it. Input is `readOnly` | `IMPLEMENTED_AND_INSPECTED` | `selectInvitedEmailForStatus` unit test | Email is not leaked to unauthenticated status callers | Closed |
| P3.7 | Validate password/confirm and set password on the authenticated user | `phase-85-stage-4d-password-policy.ts`, `api/auth/password/route.ts`, `onboarding-claim-panel.tsx` | Existing 12–128 / upper / lower / digit / special policy is reused. Onboarding posts `/api/auth/password` with invite/session reference on the authenticated session, not service-role | `IMPLEMENTED_AND_INSPECTED` | Password policy bounds tests PASS | Recovery nonce cookie remains required for non-onboarding password changes | Closed |
| P3.8 | After password success, call the existing idempotent claim endpoint | `onboarding-claim-panel.tsx`, `onboarding/claim/route.ts` | Panel calls `/api/commercial/onboarding/claim` with `{ sessionId }` or `{ inviteId }`. If claim fails after password success, retry uses `passwordReady` on the same session | `IMPLEMENTED_AND_INSPECTED` | Existing claim idempotency store test plus panel flow inspection | Claim RPC and tenant insert were not rewritten | Closed |
| P3.9 | Fail-closed email mismatch, revoked/expired/consumed invite, repeat submit | `phase-84e-customer-onboarding.ts`, status/claim routes, `commercial-onboarding-store.ts` | `invite_revoked`, `invite_expired`, `authenticated_email_mismatch`, already-claimed idempotent success, and ambiguous refs reject. Repeat claim of the same tenant stays idempotent | `IMPLEMENTED_AND_INSPECTED` | phase-84e + store tests PASS | Consumed-but-unclaimed still requires existing consumed+active entitlement rules | Closed |
| P3.10 | Reconcile login, callback, and onboarding copy with AIya; evidence + commit | login/onboarding/callback copy, this file, action plan/handoff/next-phase/risk | Login/onboarding/callback use AIya copy. No SiriusAI on those surfaces. Open-signup routes are absent from the production build | `IMPLEMENTED_AND_INSPECTED` | Brand grep + visual login heading + build route list | Admin invite HTML email templates were not rewritten; PLAN (7) P3.10 is login/callback/onboarding copy | Closed |

## Surfaces kept

Admin login remains separate. Stripe purchase success still sends a magic-link CTA and does not become open signup. `{ sessionId }` and `{ inviteId }` claim paths both remain. Magic link and password-reset APIs remain. Service-role is not used as end-user auth. Production pilot remains `NO-GO`.

## Verification

Command: `npx vitest run src/lib/phase-84d-customer-auth.test.ts src/lib/phase-84e-customer-onboarding.test.ts src/lib/phase-85-stage-4d-account-security.test.ts src/lib/phase-84g-subscription-operations.test.ts src/lib/commercial-onboarding-store.test.ts src/app/auth/callback/route.test.ts src/app/api/auth/password-login/route.test.ts tests/commercial-auth-browser-boundary.test.ts --no-file-parallelism --maxWorkers=1`

```text
Test Files  8 passed (8)
Tests  41 passed (41)
```

Command: `npx vitest run src/app/api/auth/session-from-fragment/route.test.ts --no-file-parallelism --maxWorkers=1`

```text
Test Files  1 passed (1)
Tests  2 passed (2)
```

Command: `npx playwright test tests/visual/commercial-saas.visual.spec.ts --project=desktop`

```text
5 passed (23.6s)
```

Command: `npm run typecheck`

```text
PASS - tsc --project tsconfig.production.json
```

Command: `npm run lint`

```text
0 errors, 76 existing unused-var warnings. Phase 3 files linted clean. Unused MAGIC_LINK_RATE_LIMIT import was removed from the customer login form.
```

Command: `npm run build`

```text
PASS - webpack production build. First attempt hit a local EPERM lock on `.next/types/app`; retry after clearing `.next` succeeded. Route list includes `/login`, `/onboarding`, `/auth/callback`, `/app-install` and does not include `/signup` or `/register`.
```

Command: `git diff --check`

```text
PASS - no whitespace errors (CRLF conversion warnings only)
```

## Not executed / not counted as PASS

- Full Playwright visual matrix beyond desktop commercial-saas
- Physical iPhone Safari/PWA: `WAIVED_NOT_EXECUTED`
- Remote/production deploy or migration
- Live admin-invite email send
- Push, live billing, WhatsApp, Z.ai

## Production gates

Unchanged: `NO-GO`. Compatibility names unchanged. No secrets, PHI, passwords, or raw prompts are recorded here.

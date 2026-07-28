# Phase 85 Stage 4D — Faz 4 Account Security Evidence

**Date:** 2026-07-28  
**Branch:** `codex/stage-4c-remediation`  
**Scope:** Faz 4 only — magic-link default, optional password, email change, reset, local logout

## Delivered

- Auth routes: `password-login`, `reauthenticate`, `password`, `password-reset`, `email-change`
- Magic-link enumeration-safe response with `shouldCreateUser: false`
- Auth callback recovery redirect to `/account/recovery`
- `demo-logout` uses `signOut({ scope: "local" })`
- Settings security forms (email change, password set/change, reset request)
- Login UI: default magic-link tab + secondary password tab
- Migration `account_security_events` + `account-security-store.ts` (service-role audit, no PII)

## Security

- No password, nonce, token, raw email, IP, or user-agent in audit metadata
- RLS on `account_security_events`; anon/authenticated cannot insert directly
- Billing email domain unchanged; login email owned by Supabase Auth only

## Verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `phase-85-stage-4d-account-security.test.ts` | 5/5 PASS |
| `npm run test:rls` | BLOCKED — local Supabase not running |

## Out of scope (unchanged)

- MFA, session list, sign-out-all-devices
- Production `NO-GO`, R-405 open, live billing closed

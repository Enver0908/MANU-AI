# Hosted Sandbox Phase 2 Runtime Fixes Evidence

Date: 2026-08-25

Contract: `hosted-sandbox-environment-assurance-v1`

Phase: `HS-FAZ-2`

Independent review: `NOT_REQUESTED`

Production: `NO-GO`

## What this phase did

Faz 2 removed hosted demo fallback on `/api/app-state` failures, standardized API error bodies with `{ error, requestId }` and `Cache-Control: no-store`, preserved Supabase session-refresh cookies on admin-host rewrite, aligned magic-link limits to `1/email/IP/60s` with `Retry-After: 60`, added 60-second resubmit cooldowns on customer/admin login forms, switched dashboard primary navigation to real `Link` semantics with dirty-state interception, corrected Turkish shell nav labels, added desktop settings tab semantics, and rejected offline authenticated mutations before fetch.

## Commands

| Command | Exit code | Result |
| --- | --- | --- |
| `cd app && npx vitest run src/lib/hosted-sandbox-runtime-fixes.test.ts src/lib/phase-84d-customer-auth.test.ts src/lib/phase-85-stage-5-shell-api.test.ts src/lib/phase-85-stage-5-shell-authenticated-mutation.test.ts src/lib/auth-context.test.ts src/lib/phase-85-stage-5-shell-navigation.test.ts` | 0 | PASS 44/44 |

## Residual

- Full app `npm test` and Playwright were not rerun in this executor pass.
- Production remains `NO-GO`.
- Independent review remains `NOT_REQUESTED`.

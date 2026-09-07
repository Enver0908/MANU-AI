# Phase 85 Stage 4D — Faz 5 Billing Portal and PWA Evidence

**Date:** 2026-07-28  
**Branch:** `codex/stage-4c-remediation`  
**Scope:** Faz 5 only — owner/admin billing portal, PWA in Settings > Application, audit hardening

## Delivered

- `evaluateBillingPortalAccess` accepts `role`; blocks non-owner/admin with `billing_portal_role_forbidden`
- `POST /api/commercial/billing-portal`: role check before `loadBillingCustomerByTenantId`; returns only `{portalUrl}`; return URL `/dashboard/settings?tab=billing`; 403 responses omit `blockingReasons`
- Settings billing section: portal button for owner/admin with active entitlement (`SettingsBillingPortalButton`)
- Settings application section: embeds `AppInstallCenter` when PWA actions available
- `/app-install`: granted users redirect to `/dashboard/settings?tab=application`
- Mobile install audit: client body is `{eventType}` only; UA sanitized from request headers server-side
- `pwa-subscriber-shell.tsx` and `app-install-center.tsx`: removed `userAgentSummary` from audit POST bodies; offline guard before install prompt

## Security

- Stripe customer IDs and blocking reasons not exposed to client
- Billing portal limited to owner/admin before service-role billing customer query
- PWA install preference not persisted to profile/tenant/membership tables
- Service worker cache policy unchanged (no PHI cache)

## Verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | (run at commit) |
| `npm run lint` | (run at commit) |
| `npm run build` | (run at commit) |
| `phase-83c-stripe-billing-gate.test.ts` | (run at commit) |
| `phase-85-stage-4d-billing-pwa.test.ts` | (run at commit) |
| `npm run test:rls` | BLOCKED — local Supabase not running |

## Out of scope (unchanged)

- New checkout, live billing, subscription mutation, SW data cache changes
- Production `NO-GO`, R-405 open, live Stripe keys blocked

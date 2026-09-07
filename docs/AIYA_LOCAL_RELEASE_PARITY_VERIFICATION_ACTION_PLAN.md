# AIya Local Release Parity Verification Action Plan

Date: 2026-09-01
Branch: `codex/production-readiness-stage-1`
Verification HEAD: `2b33cc661b17ae171547ad23fe1b19328ea261db`
AIya code baseline: `609f31089d10d6e51aee59fad013efa2fa3144e9`
Status: `PHASE_2_LOCAL_PARITY_VERIFIED`

## Purpose

Verify that the local AIya release candidate is technically ready for a separately approved hosted deploy, without performing deploy, migration, production gate, or external system changes.

## In Scope

- Local typecheck, lint, build, targeted brand/PWA tests, and release verification.
- Local production server smoke for public, app-install, manifest, release health, and unauthenticated app-state route behavior.
- Active-surface legacy brand scan and scoped secret scan.
- Documentation updates for the verified local parity state.

## Out of Scope

- VPS deploy, rollback, PM2/nginx changes, or server log changes.
- Supabase remote migration or schema rollout.
- Supabase Auth sender, Resend, Stripe, WhatsApp, Z.ai, DNS, or provider/channel setting changes.
- Production `GO`, live billing, production worker start, live provider/channel egress, or real health-data processing.

## Result

The local release candidate is verified for AIya brand/runtime parity:

- Local production build passes.
- Local `/app-install` does not reproduce the live `500`; unauthenticated access redirects to `/`.
- Local `/api/app-state` and `/api/clients` return controlled `401 Unauthorized`, not `500`.
- Local `/manifest.webmanifest` uses `AIya` and `aiya-*` icons.
- Local active-surface legacy brand scan is clean except for the allowed compatibility note.
- `npm run release:verify` passes.

## Next Phase Candidate

`Phase 3 - Separately Approved Hosted Deploy And Live Smoke`

Only after a separate explicit deploy command:

- Deploy the verified artifact/revision to the hosted VPS.
- Confirm live release health reports the new commit/release id.
- Re-run public/admin/manifest/app-install/app-state smoke.
- Confirm live legacy brand scan is clean.
- Keep production `NO-GO` unless independent launch gates are explicitly changed later.
- Keep Supabase Auth sender as `OWNER_EXTERNAL_EVIDENCE_REQUIRED` unless owner provides non-sensitive proof or authorizes a safe external verification path.

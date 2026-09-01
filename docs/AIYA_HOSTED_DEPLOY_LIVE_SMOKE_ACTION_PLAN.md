# AIya Hosted Deploy And Live Smoke Action Plan

Date: 2026-09-01
Branch: `codex/production-readiness-stage-1`
Deployed HEAD: `82ee3725076566304e9e0308632b2efe9d3b1deb`
Status: `PHASE_3_HOSTED_AIYA_REDEPLOY_SMOKE_COMPLETE_WITH_ARTIFACT_PORTABILITY_DEBT`

## Purpose

Deploy the verified AIya release to the hosted VPS and prove live brand/runtime parity, while preserving production `NO-GO` and all real provider/channel/billing/worker gates.

## In Scope

- Build and verify a hosted release artifact for the current commit.
- Validate deploy archive extraction and file hashes with local dry-run.
- Stage the release artifact on the VPS through strict SSH host checking.
- Apply the hosted release with rollback protection.
- Smoke release identity, public/admin routes, PWA manifest, legacy brand scan, `/app-install`, app-state routes, DNS, and old-domain `410`.
- Record any deploy-tooling or artifact-portability debt found during the live apply.

## Out of Scope

- Remote Supabase migration or schema rollout.
- Supabase Auth sender edits, Resend edits, DNS edits, Stripe edits, WhatsApp edits, Z.ai edits.
- Production `GO`, live provider/channel egress, live billing, production worker start, or real health-data processing.
- iPhone Safari/PWA PASS; status remains `WAIVED_NOT_EXECUTED`.

## Completed Scope

- Hosted release artifact was rebuilt for AIya public/admin origins.
- Local deploy dry-run passed for the rebuilt artifact.
- Official remote apply wrapper reached SSH/staging but was blocked by the pre-existing missing remote helper.
- Manual guarded remote apply deployed `82ee3725076566304e9e0308632b2efe9d3b1deb` as `hs-82ee37250765-2c32cf194421`.
- Remote runtime env was restored from the secure repo-local operator env, with live public/admin URL overrides.
- Linux `sharp` optional runtime packages were installed in the live release after the Windows-built artifact omitted Linux optional dependencies.
- Live smoke passed for release identity, primary public/admin routes, PWA manifest, active brand scan, controlled unauthenticated API responses, and legacy-domain `410`.

## Remaining Work

- Fix the hosted artifact pipeline so Windows-built release archives include Linux runtime optional dependencies, or produce hosted artifacts in a Linux build environment. The current live release was repaired post-extract on the VPS.
- Install or ship the current remote deploy helper under `/opt/manu-ai/tools/hosted-sandbox/deploy/deploy-hosted-release.mjs` so `apply-hosted-release.mjs` can complete without the manual fallback.
- Obtain owner-external evidence for the Supabase Auth sender display name. The latest direct repo/domain evidence still cannot prove whether the sender has changed from the historical `SiriusAI <no-reply@auth.aiyaworkspace.com>` record.

## Completion Criteria

- `/api/health/release` reports commit `82ee3725076566304e9e0308632b2efe9d3b1deb`.
- `/`, `/login`, `/purchase`, `/app-install`, `/manifest.webmanifest`, and admin `/admin` return non-500 responses.
- `/api/app-state` and `/api/clients` return controlled `401` for unauthenticated requests, not `500`.
- Live manifest reports `AIya`.
- Active public/app-install/manifest scan has no `SiriusAI`, `MANU-AI`, or `AI-ya` hits.
- `siriusai.store`, `www.siriusai.store`, and `admin.siriusai.store` remain `410 Gone`.
- Production remains `NO-GO`.

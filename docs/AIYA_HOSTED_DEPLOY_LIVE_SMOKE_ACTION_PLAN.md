# AIya Hosted Deploy And Live Smoke Action Plan

Date: 2026-09-01
Branch: `codex/production-readiness-stage-1`
Deploy candidate HEAD: `dbad6dbb9dcadc42e140c5e4a448653420acbed9`
Status: `PHASE_3_REMOTE_APPLY_BLOCKED_ENV_MISSING`

## Purpose

Deploy the verified AIya release artifact to the hosted VPS and prove live brand/runtime parity, while preserving production `NO-GO` and all real provider/channel/billing/worker gates.

## In Scope

- Build and verify a hosted release artifact for the current commit.
- Validate deploy archive extraction and file hashes with local dry-run.
- Apply the hosted release only through the existing deploy wrapper when all required SSH/deploy environment values are present.
- After apply, smoke release identity, public/admin routes, PWA manifest, legacy brand scan, `/app-install`, app-state routes, DNS/TLS, and old-domain `410`.

## Out of Scope

- Remote Supabase migration or schema rollout.
- Supabase Auth sender edits, Resend edits, DNS edits, Stripe edits, WhatsApp edits, Z.ai edits.
- Production `GO`, live provider/channel egress, live billing, production worker start, or real health-data processing.
- iPhone Safari/PWA PASS; status remains `WAIVED_NOT_EXECUTED`.

## Required Remote Apply Inputs

The remote apply cannot run until the operator environment provides these values:

- `MANU_HOSTED_DEPLOY_HOST`
- `MANU_HOSTED_DEPLOY_USER`
- `MANU_SSH_KNOWN_HOSTS_FILE`
- `MANU_SSH_HOST_KEY_PIN`
- `MANU_HOSTED_DEPLOY_APPROVED=true`
- `MANU_SMOKE_BASE_URL=https://aiyaworkspace.com`
- `MANU_RELEASE_ARTIFACT_MANIFEST=<hosted artifact manifest path>`

Secret values and private key material must never be written to evidence or terminal output. Only presence/absence may be recorded.

## Apply Command Shape

After the required inputs are present:

```text
node tools/hosted-sandbox/deploy/apply-hosted-release.mjs
```

The wrapper must stage the archive, verify archive SHA-256 on the VPS, invoke the remote deploy helper, restart PM2 through the existing ecosystem config, and run release identity smoke. On smoke failure, the remote helper must roll back to the previous release pointer.

## Live Smoke After Apply

Required checks:

- `/api/health/release` reports the deployed commit and release id.
- `/`, `/login`, `/purchase`, `/app-install`, admin `/admin`, and admin `/login` do not return `500`.
- `/manifest.webmanifest` reports `AIya` and `aiya-*` icon paths.
- Live public/admin/manifest scan has no active `SiriusAI`, `MANU-AI`, or `AI-ya` hits.
- `/api/app-state` and `/api/clients` return controlled auth responses, not `500`.
- `siriusai.store` HTTP and HTTPS remain `410`.
- DNS/TLS remains valid for `aiyaworkspace.com`, `www.aiyaworkspace.com`, and `admin.aiyaworkspace.com`.

## Current Block

Remote apply is blocked in this local session because the required deploy/SSH environment values are missing. Local build, artifact generation, deploy tooling tests, and archive dry-run extraction pass.

# AIya Hosted Deploy And Live Smoke Evidence

Date: 2026-09-01
Branch: `codex/production-readiness-stage-1`
Deploy candidate HEAD: `dbad6dbb9dcadc42e140c5e4a448653420acbed9`
Status: `PHASE_3_REMOTE_APPLY_BLOCKED_ENV_MISSING`

## Boundary

No hosted VPS apply, PM2 restart, nginx edit, DNS edit, Supabase migration, Supabase Auth edit, Resend edit, Stripe edit, WhatsApp edit, Z.ai edit, worker start, production `GO`, live provider/channel traffic, live billing, or real health-data processing was executed.

## Pre-Deploy Build

Command:

```text
npm run build
```

Result: `PASS`.

Observed:

- Next.js `16.3.0`
- Production build compiled successfully.
- Static pages generated `77/77`.
- `/app-install`, `/api/app-state`, `/api/clients`, `/manifest.webmanifest`, and `/api/health/release` are present in the build output.
- Known warning: custom cache-control headers for `/_next/static/:path*`.

## Hosted Artifact Generation

Command:

```text
node tools/hosted-sandbox/deploy/build-release-artifact.mjs
```

Result: `PASS`.

Observed:

```json
{
  "mode": "archive",
  "releaseId": "hs-dbad6dbb9dca-2c32cf194421",
  "archiveSha256": "723137e0a0f3702f1e43666ef7948ca1ee927201548e55fbb2972a6bcf46015c"
}
```

## Deploy Tooling Finding And Fix

Initial hosted deploy dry-run with the archive failed before any remote action:

```text
extracted release file hash mismatch: release-manifest.json
```

Root cause:

- `app/scripts/build-release-artifact.mjs` wrote `release-manifest.json`.
- It then collected package file hashes including `release-manifest.json`.
- It wrote `release-manifest.json` again with that file list, invalidating the manifest's self-hash.

Fix:

- Exclude `release-manifest.json` from the archive file hash list.
- Keep manifest identity validation in the deploy extractor.
- Keep all other package file hash verification.
- Harden the deploy dry-run test so it does not accidentally consume stale local runtime artifacts.

Changed tooling files:

- `app/scripts/build-release-artifact.mjs`
- `app/scripts/release-artifact.test.mjs`
- `tools/hosted-sandbox/deploy/hosted-sandbox-deploy.test.mjs`

## Tooling Verification

Command:

```text
npm run test:release-artifact
```

Result: `PASS`.

Summary:

```text
tests 1
pass 1
fail 0
```

Command:

```text
node --test tools/hosted-sandbox/deploy/hosted-sandbox-deploy.test.mjs
```

Result: `PASS`.

Summary:

```text
tests 8
pass 8
fail 0
```

## Hosted Deploy Dry-Run

Command shape:

```text
MANU_RELEASE_ARTIFACT_MANIFEST=<local hosted artifact manifest>
MANU_RELEASE_ARTIFACT_REQUIRED=true
node tools/hosted-sandbox/deploy/deploy-hosted-release.mjs
```

Result: `PASS`.

Observed:

```json
{
  "result": "PASS",
  "mode": "dry-run",
  "releaseId": "hs-dbad6dbb9dca-2c32cf194421",
  "commitSha": "dbad6dbb9dcadc42e140c5e4a448653420acbed9",
  "artifactMode": "archive",
  "artifactSha256": "723137e0a0f3702f1e43666ef7948ca1ee927201548e55fbb2972a6bcf46015c"
}
```

## Remote Apply Environment Check

Required deploy environment values in this local session:

- `MANU_RELEASE_ARTIFACT_MANIFEST`: missing before explicit local command binding
- `MANU_HOSTED_DEPLOY_HOST`: missing
- `MANU_HOSTED_DEPLOY_USER`: missing
- `MANU_SSH_KNOWN_HOSTS_FILE`: missing
- `MANU_SSH_HOST_KEY_PIN`: missing
- `MANU_HOSTED_DEPLOY_APPROVED`: missing
- `MANU_SMOKE_BASE_URL`: missing
- `MANU_EXPECTED_MIGRATION_FINGERPRINT`: missing

Installed local tools:

- `ssh.exe`: present
- `scp.exe`: present
- `ssh-keygen.exe`: present
- `tar.exe`: present

Finding: real remote apply is blocked by missing deploy/SSH environment inputs, not by local build, artifact, or dry-run extraction.

## Classification

- Hosted artifact readiness: `PASS`
- Deploy archive extraction/hash verification: `PASS`
- Remote hosted apply: `BLOCKED_ENV_MISSING`
- Live smoke after deploy: `NOT_EXECUTED`
- Live brand mismatch: still `OPEN`
- Live route `500`: still `OPEN`
- Supabase Auth sender: still `OWNER_EXTERNAL_EVIDENCE_REQUIRED`
- Production status: `NO-GO`

## Next Required Action

Provide the required deploy/SSH environment values in a secure operator shell, then run:

```text
node tools/hosted-sandbox/deploy/apply-hosted-release.mjs
```

After remote apply, run the live smoke checklist in `docs/AIYA_HOSTED_DEPLOY_LIVE_SMOKE_ACTION_PLAN.md`. Do not change production `NO-GO` unless a later independent launch-gate phase explicitly does so.

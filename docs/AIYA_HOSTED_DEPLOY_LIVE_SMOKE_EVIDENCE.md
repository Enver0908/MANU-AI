# AIya Hosted Deploy And Live Smoke Evidence

Date: 2026-09-01
Branch: `codex/production-readiness-stage-1`
Deployed HEAD: `82ee3725076566304e9e0308632b2efe9d3b1deb`
Status: `PHASE_3_HOSTED_AIYA_REDEPLOY_SMOKE_COMPLETE_WITH_ARTIFACT_PORTABILITY_DEBT`

## Boundary

Hosted VPS release apply and PM2 restart were executed after explicit owner approval. No nginx edit, DNS edit, Supabase migration, Supabase Auth edit, Resend edit, Stripe edit, WhatsApp edit, Z.ai edit, worker start, production `GO`, live provider/channel traffic, live billing, or real health-data processing was executed.

Secret values, private key material, and raw environment values were not written to this evidence.

## Artifact Build

Command shape:

```text
NEXT_PUBLIC_APP_URL=https://aiyaworkspace.com
MANU_ADMIN_HOST=admin.aiyaworkspace.com
MANU_ADMIN_APP_URL=https://admin.aiyaworkspace.com
node tools/hosted-sandbox/deploy/build-release-artifact.mjs
```

Result: `PASS`.

Observed:

```json
{
  "mode": "archive",
  "releaseId": "hs-82ee37250765-2c32cf194421",
  "archiveSha256": "1ef465a9797e545f97531f8d72887e54664887a2e1f8ad67aba0a338aad75bf5"
}
```

## Local Deploy Dry-Run

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
  "releaseId": "hs-82ee37250765-2c32cf194421",
  "commitSha": "82ee3725076566304e9e0308632b2efe9d3b1deb",
  "artifactMode": "archive",
  "artifactSha256": "1ef465a9797e545f97531f8d72887e54664887a2e1f8ad67aba0a338aad75bf5"
}
```

## Remote Preconditions

SSH preflight result: `PASS`.

Observed:

```text
REMOTE_PREFLIGHT_PASS node=v22.23.1
pm2=7.0.3
```

DNS check:

```text
aiyaworkspace.com A=167.233.207.102
siriusai.store A=167.233.207.102
```

Known-host status:

```text
siriusai.store known_host=present
167.233.207.102 known_host=present
aiyaworkspace.com known_host=missing
```

Deployment therefore used the existing strict SSH alias `siriusai.store` to reach the same VPS and used `https://aiyaworkspace.com` for public smoke.

## Official Apply Attempt

Command shape:

```text
MANU_HOSTED_DEPLOY_HOST=siriusai.store
MANU_HOSTED_DEPLOY_USER=root
MANU_SSH_KNOWN_HOSTS_FILE=<local known_hosts>
MANU_SSH_HOST_KEY_PIN=<known_hosts pin>
MANU_HOSTED_DEPLOY_APPROVED=true
MANU_SMOKE_BASE_URL=https://aiyaworkspace.com
node tools/hosted-sandbox/deploy/apply-hosted-release.mjs
```

Result: `FAIL_REMOTE_HELPER_MISSING`.

Observed:

```text
Cannot find module '/opt/manu-ai/tools/hosted-sandbox/deploy/deploy-hosted-release.mjs'
```

Remote state after the failed official apply:

```text
current=/opt/manu-ai/releases/d1e0b5f40e3a6e3b535e2a889ebf68025c5e548a/app
release_exists=no
stage_files=hs-82ee37250765-2c32cf194421.tar.gz release-manifest.json
remote_tools=missing
```

No release switch occurred in this failed official apply attempt.

## Manual Guarded Apply

Manual apply used the staged archive and manifest, verified SHA-256 and manifest file hashes, wrote release metadata, switched `/opt/manu-ai/current`, restarted PM2 process `manu-ai`, and ran local plus public release-health smoke. The rollback path preserved the previous pointer:

```text
/opt/manu-ai/releases/d1e0b5f40e3a6e3b535e2a889ebf68025c5e548a/app
```

Result: `PASS`.

Observed:

```text
REMOTE_MANUAL_DEPLOY_PASS commit=82ee3725076566304e9e0308632b2efe9d3b1deb release=hs-82ee37250765-2c32cf194421 previous=/opt/manu-ai/releases/d1e0b5f40e3a6e3b535e2a889ebf68025c5e548a/app
```

Runtime env presence after PM2 restart:

```text
NEXT_PUBLIC_APP_URL=true
NEXT_PUBLIC_SUPABASE_URL=true
Supabase anon env present=true
Supabase service-role env present=true
MANU_DEV_FALLBACK_STORE=true
MANU_CI_NO_PRODUCTION_EFFECTS=true
MANU_RELEASE_ID=true
MANU_RELEASE_COMMIT_SHA=true
NODE_ENV=true
PORT=true
HOSTNAME=true
```

## Runtime Dependency Finding

First live smoke after deploy still returned `500` for `/app-install`, `/api/app-state`, and `/api/clients`.

PM2 logs showed `sharp` could not load the Linux runtime. Direct package presence check showed:

```text
node_modules/sharp=present
node_modules/@img/sharp-linux-x64=missing
node_modules/@img/sharp-linuxmusl-x64=missing
node_modules/@img/sharp-libvips-linux-x64=missing
node_modules/@img/sharp-wasm32=present
```

Root cause: the release archive was built on Windows and carried non-Linux optional `sharp` runtime artifacts. This is a hosted artifact portability debt, not an AIya brand regression.

Remote mitigation executed inside the deployed release app:

```text
npm install --omit=dev --no-audit --no-fund @img/sharp-linux-x64@0.35.3 @img/sharp-libvips-linux-x64@1.3.2
```

Result: `PASS`.

Observed:

```text
added 3 packages, and changed 1 package in 3s
sharp_require=pass
REMOTE_SHARP_EXPLICIT_INSTALL_AND_RESTART_PASS
```

## Live Release Smoke

Release health:

```json
{
  "status": "ok",
  "releaseId": "hs-82ee37250765-2c32cf194421",
  "commitSha": "82ee3725076566304e9e0308632b2efe9d3b1deb",
  "migrationFingerprint": "2c32cf1944215123cd9a90999c906a5e49b7e3c6f1d145a3805afb4d929d78bd",
  "compatibilityVersion": "0.0.0+82ee372"
}
```

Route smoke:

```text
https://aiyaworkspace.com/api/health/release status=200
https://aiyaworkspace.com/ status=200
https://aiyaworkspace.com/login status=200
https://aiyaworkspace.com/purchase status=200
https://aiyaworkspace.com/app-install status=200
https://aiyaworkspace.com/manifest.webmanifest status=200
https://aiyaworkspace.com/api/app-state status=401
https://aiyaworkspace.com/api/clients status=401
https://admin.aiyaworkspace.com/admin status=200
```

The unauthenticated `401` responses for `/api/app-state` and `/api/clients` are the expected fail-closed auth boundary for this smoke. They are no longer `500`.

Manifest:

```json
{
  "name": "AIya",
  "short_name": "AIya",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "iconCount": 6
}
```

Active brand scan:

```text
https://aiyaworkspace.com/ status=200 hasAIya=True legacy=<none>
https://aiyaworkspace.com/login status=200 hasAIya=True legacy=<none>
https://aiyaworkspace.com/purchase status=200 hasAIya=True legacy=<none>
https://aiyaworkspace.com/app-install status=200 hasAIya=True legacy=<none>
https://aiyaworkspace.com/manifest.webmanifest status=200 hasAIya=True legacy=<none>
```

Legacy domain shutdown:

```text
siriusai.store A=167.233.207.102
www.siriusai.store A=167.233.207.102
admin.siriusai.store A=167.233.207.102
https://siriusai.store/ status=410
https://www.siriusai.store/ status=410
https://admin.siriusai.store/ status=410
```

## Classification

- Hosted AIya release identity: `PASS`
- Live active AIya brand parity: `PASS`
- Live `/app-install` route: `PASS`
- Live unauthenticated app-state routes: `PASS_CONTROLLED_401`
- Legacy domain `410`: `PASS`
- Official deploy wrapper: `BLOCKED_REMOTE_HELPER_MISSING`
- Hosted artifact Linux optional dependency portability: `OPEN_TECHNICAL_DEBT`
- Supabase Auth sender display name: `OWNER_EXTERNAL_EVIDENCE_REQUIRED`
- Production status: `NO-GO`

## Next Required Action

Run a narrow follow-up phase to make the hosted artifact/deploy path fully repeatable without manual remote repair:

- Ship or install the remote deploy helper expected by `apply-hosted-release.mjs`.
- Update the artifact pipeline or build environment so Linux `sharp` optional runtime packages are included before upload.
- Rebuild, dry-run, and perform a no-regression hosted redeploy smoke.

Do not change production `NO-GO` unless a later independent launch-gate phase explicitly does so.

# AIya Hosted Deploy Repeatability Evidence

Date: 2026-09-02
Branch: `codex/production-readiness-stage-1`
Final deployed HEAD: `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9`
Final release: `hs-4c7bbea8ba21-2c32cf194421`
Status: `PHASE_4_HOSTED_DEPLOY_REPEATABILITY_COMPLETE`

## Boundary

This phase changed hosted deploy tooling and executed hosted VPS release applies after explicit owner approval. It did not change production `NO-GO`, did not run remote Supabase migrations, and did not edit DNS, Supabase Auth, Resend, Stripe, WhatsApp, or Z.ai settings. No live provider/channel egress, live billing, production worker start, or real client health-data processing was executed.

Secret values, private keys, raw env values, prompts, file contents from users, and real health data were not written to this evidence.

## Code Changes

- `apply-hosted-release.mjs` now packages and uploads the remote deploy runtime as one tar archive, including the helper, PM2 config, smoke checker, deploy contract, release identity helper, and current migration files.
- `apply-hosted-release.mjs` now forwards release identity, migration fingerprint, compatibility version, smoke base URL, and SSH host-key pin to the staged remote helper.
- `deploy-hosted-release.mjs` now normalizes Windows archive paths on Linux, verifies extracted artifact hashes, installs missing Linux `sharp` optional runtime packages when needed, and verifies `require("sharp")`.
- `deploy-hosted-release.mjs` now deletes stale `manu-ai-hosted-sandbox`, restarts the single `manu-ai` PM2 process from the active release root, passes release identity into PM2 env, retries readiness smoke, and restarts PM2 with the previous release identity during rollback.
- `build-release-artifact.mjs` now builds hosted artifacts with `NODE_ENV=production` and default `MANU_RELEASE_ENVIRONMENT=hosted-sandbox`.
- `run-smoke-check.mjs` now checks release identity, active AIya public surfaces, manifest brand, `/app-install` non-500 behavior, and unauthenticated fail-closed `401` API behavior when expected identity is supplied.

## Commits In This Phase

```text
3fee07e Harden hosted deploy repeatability
c6b2ca6 Pass release identity to staged deploy runtime
4ddcbf0 Normalize release artifact paths on remote deploy
e34b990 Propagate host key pin to staged deploy helper
5739d68 Upload staged deploy runtime as archive
edc223d Align hosted deploy PM2 contract
3c5d304 Report hosted deploy smoke failure details
044ff7f Add hosted deploy readiness retry and cleanup
ba194c0 Restart hosted PM2 process on release switch
1ac318b Bind release identity during hosted PM2 restart
4c7bbea Build hosted artifacts with hosted release environment
```

## Final Artifact Build

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
  "result": "PASS",
  "mode": "archive",
  "releaseId": "hs-4c7bbea8ba21-2c32cf194421",
  "archiveSha256": "b4046a27ec34405fa20005963886b54e5004d3638bf0b5af8a6b1fcad539298e"
}
```

Artifact package manifest check:

```json
{
  "releaseId": "hs-4c7bbea8ba21-2c32cf194421",
  "commitSha": "4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9",
  "environment": "hosted-sandbox",
  "compatibilityVersion": "0.0.0+4c7bbea"
}
```

## Local Deploy Dry-Run

Command shape:

```text
MANU_RELEASE_ARTIFACT_MANIFEST=<local hosted artifact manifest>
MANU_RELEASE_ARTIFACT_REQUIRED=true
MANU_HOSTED_DEPLOY_APPROVED=true
node tools/hosted-sandbox/deploy/deploy-hosted-release.mjs
```

Result: `PASS`.

Observed:

```json
{
  "result": "PASS",
  "mode": "dry-run",
  "releaseId": "hs-4c7bbea8ba21-2c32cf194421",
  "commitSha": "4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9",
  "artifactMode": "archive",
  "artifactSha256": "b4046a27ec34405fa20005963886b54e5004d3638bf0b5af8a6b1fcad539298e"
}
```

## Official Hosted Apply

Command shape:

```text
MANU_RELEASE_ARTIFACT_MANIFEST=<local hosted artifact manifest>
MANU_RELEASE_ARTIFACT_REQUIRED=true
MANU_HOSTED_DEPLOY_HOST=siriusai.store
MANU_HOSTED_DEPLOY_USER=root
MANU_SSH_KNOWN_HOSTS_FILE=<local known_hosts>
MANU_SSH_HOST_KEY_PIN=<known_hosts pin>
MANU_HOSTED_DEPLOY_APPROVED=true
MANU_HOSTED_DEPLOY_REMOTE_ROOT=/opt/manu-ai
MANU_SMOKE_BASE_URL=https://aiyaworkspace.com
node tools/hosted-sandbox/deploy/apply-hosted-release.mjs
```

Result: `PASS`.

Observed:

```json
{
  "result": "PASS",
  "remote": "root@siriusai.store",
  "remoteStage": "/opt/manu-ai/staging/4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9",
  "commitSha": "4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9",
  "releaseId": "hs-4c7bbea8ba21-2c32cf194421"
}
```

## Live Runtime Smoke

Release health:

```json
{
  "status": "ok",
  "releaseId": "hs-4c7bbea8ba21-2c32cf194421",
  "commitSha": "4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9",
  "migrationFingerprint": "2c32cf1944215123cd9a90999c906a5e49b7e3c6f1d145a3805afb4d929d78bd",
  "compatibilityVersion": "0.0.0+4c7bbea"
}
```

Route smoke:

```text
https://aiyaworkspace.com/ => 200
https://aiyaworkspace.com/login => 200
https://aiyaworkspace.com/purchase => 200
https://aiyaworkspace.com/app-install => 307
https://aiyaworkspace.com/manifest.webmanifest => 200
https://admin.aiyaworkspace.com/admin => 200
https://aiyaworkspace.com/api/app-state => 401
https://aiyaworkspace.com/api/clients => 401
https://siriusai.store/ => 410
https://www.siriusai.store/ => 410
https://admin.siriusai.store/ => 410
```

`/app-install` returning `307` is accepted for this smoke because it is a non-500 controlled auth/navigation response.

Active brand scan:

```text
CLEAN https://aiyaworkspace.com/
CLEAN https://aiyaworkspace.com/login
CLEAN https://aiyaworkspace.com/purchase
CLEAN https://aiyaworkspace.com/app-install
CLEAN https://admin.aiyaworkspace.com/admin
CLEAN https://aiyaworkspace.com/manifest.webmanifest
```

PM2:

```text
name=manu-ai status=online restarts=0
```

PM2 release env:

```text
MANU_RELEASE_COMMIT_SHA=4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9
MANU_RELEASE_COMPATIBILITY_VERSION=0.0.0+4c7bbea
MANU_RELEASE_ENVIRONMENT=hosted-sandbox
MANU_RELEASE_ID=hs-4c7bbea8ba21-2c32cf194421
MANU_RELEASE_MIGRATION_FINGERPRINT=2c32cf1944215123cd9a90999c906a5e49b7e3c6f1d145a3805afb4d929d78bd
```

Linux runtime check in `/opt/manu-ai/current/app`:

```text
sharp_require=pass
sharp_linux_x64=present
sharp_libvips_linux_x64=present
```

## DNS And TLS

DNS:

```text
aiyaworkspace.com A=167.233.207.102
admin.aiyaworkspace.com A=167.233.207.102
```

TLS:

```text
Subject=CN=aiyaworkspace.com
Issuer=CN=YE1, O=Let's Encrypt, C=US
NotBefore=2026-09-01T13:13:29+03:00
NotAfter=2026-11-30T13:13:28+03:00
SAN=admin.aiyaworkspace.com, aiyaworkspace.com, www.aiyaworkspace.com
```

HTTP security headers observed on public/admin routes include CSP, permissions policy, referrer policy, HSTS, `x-content-type-options: nosniff`, and `x-frame-options: DENY`.

## Verification

Passed:

```text
node --check tools/hosted-sandbox/deploy/apply-hosted-release.mjs
node --check tools/hosted-sandbox/deploy/build-release-artifact.mjs
node --check tools/hosted-sandbox/deploy/deploy-hosted-release.mjs
node --test tools/hosted-sandbox/deploy/hosted-sandbox-deploy.test.mjs
npm run test:release-artifact
npm run typecheck
npm run lint
npm run build
npm run release:verify
git diff --check
scoped secret scan on git diff
```

Observed details:

```text
hosted-sandbox-deploy.test.mjs: 10/10 PASS
test:release-artifact: 1/1 PASS
typecheck: PASS
lint: PASS with 0 errors and 77 pre-existing warnings
build: PASS
release:verify on 1ac318b: PASS, core 295/295, app 1642 passed / 9 skipped, production build, release artifact, Stage 5 shell verify, production dependency audit clean
release:verify on 4c7bbea: core 295/295 PASS and lint 0 errors / 77 warnings before the long app-test run was interrupted; targeted deploy, build, typecheck, lint, artifact, live smoke, and prior full release verification cover this deploy-tooling-only delta
```

Note: the final `release:verify` rerun for `4c7bbea` was stopped after its long app-test phase stopped producing terminal output. It is not counted as a final full PASS for that exact rerun. The phase closure relies on the passed targeted deploy-tooling tests, production build, artifact checks, live official apply smoke, and the earlier full `release:verify` pass on the immediately preceding deploy-tooling commit.

## Classification

- Official hosted apply wrapper: `PASS`
- Remote deploy helper availability: `CLOSED_BY_STAGED_RUNTIME_UPLOAD`
- Hosted Linux `sharp` runtime portability: `CLOSED_BY_REMOTE_OPTIONAL_DEP_INSTALL_AND_REQUIRE_CHECK`
- PM2 process contract: `PASS_SINGLE_MANU_AI_PROCESS`
- Live AIya release identity: `PASS`
- Live active AIya brand parity: `PASS`
- Live public/admin route smoke: `PASS`
- Live unauthenticated API boundary: `PASS_CONTROLLED_401`
- Legacy domain shutdown: `PASS_410`
- Supabase Auth sender display name: `OWNER_EXTERNAL_EVIDENCE_REQUIRED`
- Production status: `NO-GO`

## Remaining Work

The Phase 3 deploy repeatability findings are closed. The remaining launch blockers are not this hosted deploy script: they are owner/external production gates, especially Supabase Auth sender display-name proof, Meta/WhatsApp approval, Z.ai/provider approval, production secrets, production Supabase/migration approval, manual transfer operations approval, incident/monitoring/rollback ownership, and exact production release approval.

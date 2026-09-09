# Exact HEAD Hosted Release Parity Preflight Evidence

Status: `PASS_LOCAL_PREFLIGHT`
Date: 2026-09-09
Branch: `codex/production-readiness-stage-1`
Candidate HEAD: `db32fe91488a40122cc44a96ac2efcdebff96bd0`
Candidate release ID: `hs-db32fe91488a-b55ed4ff550f`
Production decision: `NO-GO`

## Boundary

This phase performed local preflight and read-only live release-health probes only.

No deploy, rollback, PR, merge, branch switch, remote migration, production schema rollout, secret/env edit, DNS/TLS/SMTP edit, Stripe edit, WhatsApp edit, Z.ai edit, monitoring edit, live billing change, production worker start, production gate change, provider/channel egress, or real health-data processing was executed.

## Git And Remote Verification

- `git status --short --branch`
  - Result before preflight: `## codex/production-readiness-stage-1...origin/codex/production-readiness-stage-1`
- `git rev-parse HEAD`
  - Result: `db32fe91488a40122cc44a96ac2efcdebff96bd0`
- `git ls-remote --symref origin HEAD refs/heads/codex/production-readiness-stage-1`
  - Result: remote default `HEAD` points to `refs/heads/codex/phase-29-baseline-checkpoint`; `refs/heads/codex/production-readiness-stage-1` points to `db32fe91488a40122cc44a96ac2efcdebff96bd0`.
- `git diff --check`
  - Result before documentation edits: exit code `0`, no output.

## Live Release Health

Read-only HTTP probes executed on 2026-09-09:

- `https://aiyaworkspace.com/api/health/release`
  - Status: `200`
  - Body: `{"status":"ok","releaseId":"hs-1c9756046b01-b55ed4ff550f","commitSha":"1c9756046b01cb1bd224fb601ec9094a7f471606","migrationFingerprint":"b55ed4ff550f7e9ba8fc25957774341a19b7b05c1a35a891633369b4aff95f25","compatibilityVersion":"0.0.0+1c97560"}`
- `https://admin.aiyaworkspace.com/api/health/release`
  - Status: `200`
  - Body: `{"status":"ok","releaseId":"hs-1c9756046b01-b55ed4ff550f","commitSha":"1c9756046b01cb1bd224fb601ec9094a7f471606","migrationFingerprint":"b55ed4ff550f7e9ba8fc25957774341a19b7b05c1a35a891633369b4aff95f25","compatibilityVersion":"0.0.0+1c97560"}`

Interpretation:

- Live still serves `hs-1c9756046b01-b55ed4ff550f` at commit `1c9756046b01cb1bd224fb601ec9094a7f471606`.
- Current local/remote HEAD is `db32fe91488a40122cc44a96ac2efcdebff96bd0`.
- The migration fingerprint is unchanged: `b55ed4ff550f7e9ba8fc25957774341a19b7b05c1a35a891633369b4aff95f25`.
- A later deploy would change the live commit/release ID, not the migration fingerprint.

## Candidate Release Identity

Command:

- `node -e "import('./app/scripts/lib/release-identity.mjs').then(m=>{const i=m.buildReleaseIdentity({repoRoot:process.cwd(),env:{...process.env,NODE_ENV:'production'}}); console.log(JSON.stringify(i,null,2));})"`

Result:

```json
{
  "releaseId": "hs-db32fe91488a-b55ed4ff550f",
  "commitSha": "db32fe91488a40122cc44a96ac2efcdebff96bd0",
  "builtAt": "2026-09-09T13:57:38.000Z",
  "environment": "production",
  "migrationFingerprint": "b55ed4ff550f7e9ba8fc25957774341a19b7b05c1a35a891633369b4aff95f25",
  "compatibilityVersion": "0.0.0+db32fe9"
}
```

## Local Verification

- `npm run typecheck`
  - Result: PASS.
- `npm run lint`
  - Result: PASS with 74 warnings and 0 errors. Warnings are existing unused/dependency warnings in account recovery, Phase 84D, Phase 85 Stage 4C stores/tests, PWA helper, and Stage 6 API.
- `npm run test:release-artifact`
  - Result: PASS, 1/1 test passed.
- `npm run build`
  - First attempt: environment-blocked by Windows/OneDrive `EPERM` while unlinking `app/.next/types/app`.
  - Recovery: existing generated `app/.next` was moved within the app workspace to `app/.next-preflight-blocked-20260909170559`, then later moved under ignored `app/.manu-runtime/preflight-backups/next-preflight-blocked-20260909170559`.
  - Second attempt: PASS. Next.js 16.3.0 compiled successfully, finished TypeScript, generated 79 static pages, finalized optimization, collected traces, and emitted the route manifest.
- `npm run release:artifact`
  - Result: PASS.

Artifact result:

```json
{
  "releaseId": "hs-db32fe91488a-b55ed4ff550f",
  "cacheVersion": "hs-db32fe91488a-b55ed4ff550f",
  "archiveSha256": "2b9fc8efeeefee593ddea1a11c9aa588461a092ceadbdedcf7406307a64cee33",
  "fileCount": 2736
}
```

Generated artifact paths:

- `app/.manu-runtime/release-artifacts/hs-db32fe91488a-b55ed4ff550f/release-manifest.json`
- `app/.manu-runtime/release-artifacts/hs-db32fe91488a-b55ed4ff550f.tar.gz`
- `app/.manu-runtime/release-artifacts/hs-db32fe91488a-b55ed4ff550f.tar.gz.sha256`

Archive checksum file:

```text
2b9fc8efeeefee593ddea1a11c9aa588461a092ceadbdedcf7406307a64cee33  hs-db32fe91488a-b55ed4ff550f.tar.gz
```

## Manifest Verification

Manifest inspection of `app/.manu-runtime/release-artifacts/hs-db32fe91488a-b55ed4ff550f/release-manifest.json`:

- `releaseId`: `hs-db32fe91488a-b55ed4ff550f`
- `commitSha`: `db32fe91488a40122cc44a96ac2efcdebff96bd0`
- `migrationFingerprint`: `b55ed4ff550f7e9ba8fc25957774341a19b7b05c1a35a891633369b4aff95f25`
- `compatibilityVersion`: `0.0.0+db32fe9`
- `environment`: `production`
- `operations.productionPilotGo`: `false`
- `workerCommands`: 6
- `files`: 2736

## Deploy Smoke Plan For Separate Approval

If a later phase receives explicit deploy approval, smoke must verify:

- `https://aiyaworkspace.com/api/health/release` returns `hs-db32fe91488a-b55ed4ff550f`.
- `https://admin.aiyaworkspace.com/api/health/release` returns `hs-db32fe91488a-b55ed4ff550f`.
- Customer and admin visible surfaces remain AIya-branded.
- `/`, `/login`, `/purchase`, `/app-install`, `/manifest.webmanifest`, and `/admin` are non-500.
- Unauthenticated protected APIs fail closed.
- Legacy `siriusai.store` routes remain `410 Gone`.
- Production `NO-GO` remains unchanged unless the owner explicitly supplies a separate `GO` decision.

## Final Interpretation

Exact HEAD `db32fe91488a40122cc44a96ac2efcdebff96bd0` has a locally built release candidate artifact `hs-db32fe91488a-b55ed4ff550f`. The candidate migration fingerprint matches the currently live release fingerprint. The only expected live delta is release commit/compatibility identity.

This evidence does not authorize deploy. Production remains `NO-GO`.

## Post-Documentation Verification

Commands executed after documentation updates:

- `rg -n "EXACT_HEAD_HOSTED_RELEASE_PARITY_PREFLIGHT|hs-db32fe91488a-b55ed4ff550f|db32fe91488a40122cc44a96ac2efcdebff96bd0|2b9fc8efeeefee593ddea1a11c9aa588461a092ceadbdedcf7406307a64cee33|NO-GO|owner-approved exact hosted deploy" HANDOFF_FOR_NEXT_CODEX.md docs/NEXT_PHASE_EXECUTION_PLAN.md docs/RISK_REGISTER.md docs/EXACT_HEAD_HOSTED_RELEASE_PARITY_PREFLIGHT_PLAN.md docs/EXACT_HEAD_HOSTED_RELEASE_PARITY_PREFLIGHT_EVIDENCE.md`
  - Result: current plan/evidence paths, candidate HEAD, candidate release ID, archive SHA, production `NO-GO`, and next eligible owner-approved deploy/evidence language are present in the updated authority documents.
- `git diff --check`
  - Result: exit code `0`; no whitespace error lines were reported. Git emitted Windows line-ending notices for touched Markdown files.
- `git status --short --branch --ignored=matching app/.next app/.manu-runtime`
  - Result: `app/.next/` and `app/.manu-runtime/` are ignored generated artifacts.
- `git status --short --branch`
  - Result: only this phase's documentation files are modified or untracked.

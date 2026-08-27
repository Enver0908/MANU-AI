# Hosted Sandbox Phase 5 - CI, Deploy, and Network Evidence

**Phase:** HS-FAZ-5  
**Date:** 2026-08-27
**Independent review:** NOT_REQUESTED  
**Production:** NO-GO

## Scope

- HS-DEPLOY-001: Product CI workflow templates, install script, and hardening verifier.
- HS-DEPLOY-002: Migration/deploy workflow templates, atomic deploy dry-run, rollback smoke gate.
- HS-DEPLOY-003: Nginx template, Next/proxy security headers, cache policy headers.
- HS-DEPLOY-004: Deploy preparation is bound to the real release archive manifest (`.tar.gz` + external SHA-256) created by the app release artifact builder.
- HS-DEPLOY-005: Activation apply preparation requires the archive manifest before the deploy switch can proceed; dry-run remains local and no remote apply is performed.

## Executor checks

| Command | Result |
| --- | --- |
| `node --test tools/hosted-sandbox/deploy/hosted-sandbox-deploy.test.mjs` | PASS |
| `cd app && npx vitest run src/lib/hosted-sandbox-security-headers.test.ts` | PASS |
| `node tools/hosted-sandbox/deploy/verify-workflow-hardening.mjs` | PASS |
| `node tools/hosted-sandbox/deploy/build-release-artifact.mjs --manifest-only` | PASS |
| `node tools/hosted-sandbox/deploy/build-release-artifact.mjs` | PASS |
| `node tools/hosted-sandbox/deploy/verify-nginx-template.mjs` | PASS |
| `node --test tools/hosted-sandbox/activation/hosted-activation.test.mjs` | PASS |
| `node tools/hosted-sandbox/activation/run-hosted-activation.mjs` | PASS dry-run |
| `cd app && npx vitest run src/lib/hosted-sandbox-security-headers.test.ts src/lib/hosted-sandbox-release-identity.test.ts --no-file-parallelism --maxWorkers=1` | PASS |
| `cd app && npm run typecheck` | PASS |
| `cd app && npm run lint` | PASS with existing 77 warnings |

## Notes

- Workflow templates live under `tools/hosted-sandbox/deploy/workflow-templates/` and are copied into `.github/workflows/` by `install-workflows.mjs`.
- Product CI now runs a production build and creates the hosted release archive manifest. The deploy workflow requires `MANU_RELEASE_ARTIFACT_REQUIRED=true`, builds the archive manifest before deploy dry-run, and the deploy script records the archive SHA-256 beside the release pointer.
- The hosted deploy manifest records `mode: "archive"` only when the app release artifact builder has created the real archive and `.tar.gz.sha256` sidecar.
- The Nginx verifier compares the template CSP to `app/src/lib/hosted-sandbox-security-headers.ts` and checks forwarded host/IP headers used by the trusted-proxy boundary.
- Activation apply preparation passes the release artifact manifest path into the deploy switch and requires archive metadata in apply mode. Local dry-run still uses `manifest-only`.
- Remote GitHub environment approvals, SSH apply, and VPS activation remain user-command gated.
- Forbidden production/provider/channel/billing deploy flags are rejected by deploy contract checks.

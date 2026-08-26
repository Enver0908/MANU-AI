# Hosted Sandbox Phase 5 - CI, Deploy, and Network Evidence

**Phase:** HS-FAZ-5  
**Date:** 2026-08-25  
**Independent review:** NOT_REQUESTED  
**Production:** NO-GO

## Scope

- HS-DEPLOY-001: Product CI workflow templates, install script, and hardening verifier.
- HS-DEPLOY-002: Migration/deploy workflow templates, atomic deploy dry-run, rollback smoke gate.
- HS-DEPLOY-003: Nginx template, Next/proxy security headers, cache policy headers.

## Executor checks

| Command | Result |
| --- | --- |
| `node --test tools/hosted-sandbox/deploy/hosted-sandbox-deploy.test.mjs` | PASS |
| `cd app && npx vitest run src/lib/hosted-sandbox-security-headers.test.ts` | PASS |
| `node tools/hosted-sandbox/deploy/verify-workflow-hardening.mjs` | PASS |
| `node tools/hosted-sandbox/deploy/build-release-artifact.mjs --manifest-only` | PASS |

## Notes

- Workflow templates live under `tools/hosted-sandbox/deploy/workflow-templates/` and are copied into `.github/workflows/` by `install-workflows.mjs`.
- Remote GitHub environment approvals, SSH apply, and VPS activation remain user-command gated.
- Forbidden production/provider/channel/billing deploy flags are rejected by deploy contract checks.

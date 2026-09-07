# Hosted Sandbox Phase 4 - Release Identity Evidence

**Phase:** HS-FAZ-4
**Date:** 2026-08-28
**Independent review:** NOT_REQUESTED
**Production:** NO-GO

## Current status

Phase 4 release identity debt is locally closed for the hosted sandbox technical-debt plan. The previous 2026-08-25 build failure caused by the browser -> `node:crypto` chain is superseded by the 2026-08-27 validation run.

## Executor checks

| Command | Result |
| --- | --- |
| `cd app && npx vitest run src/lib/hosted-sandbox-release-identity.test.ts --no-file-parallelism --maxWorkers=1` | PASS as part of targeted 3-file run: 20/20 total |
| `cd app && npm run typecheck` | PASS |
| `cd app && npm run lint` | PASS, 77 existing warnings, 0 errors |
| `cd app && npm run build` | PASS; `/api/health/release` included as dynamic route |
| `cd app && npm run release:artifact` | PASS in earlier local closure |
| `node tools/hosted-sandbox/deploy/build-release-artifact.mjs` | PASS; release `hs-67892db854e1-b66efff838fe`; commit `67892db854e12ca4d71f0dc6d8f3ca12cb4e8b99`; migration fingerprint `b66efff838fedfab0818f7ec8f835cef2acfa03442d1f80774c29851faef398a`; archive SHA-256 `c68d985ed64dc5987209b85caabf3afab6c3350d7522f9fbe88a90561898059f` |
| `cd app && npm run release:verify` | PASS; full app unit suite 1593 passed / 9 skipped and production dependency audit clean |
| `curl https://siriusai.store/api/health/release` | PASS; public hosted sandbox returned exact release identity for commit `67892db854e12ca4d71f0dc6d8f3ca12cb4e8b99` |

## Requirements

- HS-VERIFY-001: PASS. Release identity is bound to commit SHA and migration fingerprint.
- HS-VERIFY-002: PASS for local production build, release artifact generation, and public hosted exact release smoke.
- HS-VERIFY-003: PASS. Hosted fallback version remains forbidden when hosted Supabase is configured.

## Boundary

This evidence does not approve production, provider/channel egress, live billing, production schema rollout, real client data processing, or iPhone Safari/PWA PASS. Production remains NO-GO.

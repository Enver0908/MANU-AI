# Hosted Sandbox Phase 6 - Activation and E2E Acceptance Evidence

**Phase:** HS-FAZ-6
**Date:** 2026-08-25
**Independent review:** NOT_REQUESTED
**Production:** NO-GO

## Scope

- HS-ACCEPT-001: Controlled activation orchestrator with maintenance gate, backup freshness check, manifest/fingerprint binding, deploy dry-run, and smoke simulation.
- HS-ACCEPT-002: Demo cleanup dry-run wiring; remote apply remains user-command gated.
- HS-ACCEPT-003: Android/mobile regression documented as pending live replay; physical iPhone remains WAIVED_NOT_EXECUTED.

## Executor checks

| Command | Result |
| --- | --- |
| `node --test tools/hosted-sandbox/activation/hosted-activation.test.mjs` | PASS 3/3 |
| `node tools/hosted-sandbox/activation/run-hosted-activation.mjs` | PASS dry-run |
| `node --test tools/hosted-sandbox/deploy/hosted-sandbox-deploy.test.mjs` | PASS 6/6 |

## Activation sequence (local dry-run)

1. maintenance_on — SIMULATED
2. backup_freshness — SIMULATED
3. release_manifest — PASS
4. migration_fingerprint — PASS
5. demo_cleanup_dry_run — BLOCKED_NO_SUPABASE without hosted URL
6. demo_cleanup_apply — BLOCKED_NO_SUPABASE locally
7. deploy_switch — DRY_RUN_PASS
8. smoke_check — SIMULATED
9. maintenance_off — SIMULATED

## Remote waivers (not executed)

- Remote migration, backup upload, restore drill, hosted cleanup apply, VPS symlink/PM2 apply, and live magic-link/dashboard E2E require separate user approvals and environment secrets.
- Physical iPhone Safari/PWA: WAIVED_NOT_EXECUTED (never PASS).

## Notes

- Maintenance mode is enforced when `MANU_MAINTENANCE_MODE=true`; `/api/shell/version` remains available for deploy smoke identity checks.
- Apply mode requires all approval env flags.


# AIya Public Surface Faz 8 Clean-HEAD Evidence Reconciliation

Status: `FAZ_8_CLOSED_LOCAL_CLEAN_HEAD`
Date: 2026-09-07
Branch: `codex/production-readiness-stage-1`
HEAD: `3593ec98a883cfd302177ec9efc99a9426769592`
Production: `NO-GO`

## Scope

This evidence reconciles the public surface, auth, onboarding, admin lifecycle, dashboard production chrome, PWA, local RLS, Android device evidence, and release identity status against the current local HEAD. It does not authorize deploy, push, PR, merge, remote migration, DNS, SMTP, Stripe live billing, WhatsApp real traffic, Z.ai real egress, production worker start, production schema rollout, or real health-data processing.

## Git Baseline

- Local branch: `codex/production-readiness-stage-1`
- Local HEAD: `3593ec98a883cfd302177ec9efc99a9426769592`
- Upstream: `origin/codex/production-readiness-stage-1`
- Remote branch HEAD: `3593ec98a883cfd302177ec9efc99a9426769592`
- Worktree at start: clean
- `origin/HEAD`: `refs/heads/codex/phase-29-baseline-checkpoint`; this is not the active working branch.
- Live VPS release remains older: `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9`
- Local HEAD is 14 commits ahead of live.

## Verification Results

| Gate | Result | Evidence |
|---|---|---|
| `git diff --check` | PASS | No whitespace errors before documentation reconciliation. |
| `npx vitest run src/lib/public-surface-faz8-reclosure.test.ts --no-file-parallelism --maxWorkers=1 --reporter=default` | PASS | 1 file, 7 tests passed. |
| `npm run analyze:frontend-import-graph` | PASS | 512 files, wrote `.manu-runtime/frontend-import-graph.json`. |
| `npm run test:stage-7-real-device` | `APPROVED_WITH_WAIVER` | `docs/PHASE_85_STAGE_7_REAL_DEVICE_VALIDATION_REPORT.json`; Android Chrome, Android PWA, and Android TalkBack evidence accepted; iPhone Safari/PWA waived, not PASS. |
| `npm run test:rls` | PASS | `docs/PHASE_85_STAGE_5_RLS_ZERO_SKIP_REPORT.json`; local Supabase reset, 56 passed, 0 failed, 0 skipped. |
| `npm run typecheck` | PASS | Production TypeScript check exited 0. |
| `npm run lint` | PASS_WITH_WARNINGS | 0 errors, 73 existing warnings. |
| `npm test` | PASS_WITH_SKIPS | 285 files passed; 1707 passed, 9 skipped. |
| `npm run release:verify` | PASS | Release identity `hs-3593ec98a883-6819c61375b8`; core tests, lint, typecheck, unit tests, production build, release artifact, dependency audit, and shell verify passed. |
| `npm run build` | PASS on rerun | First concurrent build attempt hit Windows `.next/diagnostics` `EPERM`; standalone rerun passed and `release:verify` build also passed. |

Note: regenerated Stage 5 JSON reports can show `sourceTreeClean:false` because earlier evidence JSON files had already been refreshed during this same reconciliation run. The Git baseline before verification was clean, the runtime source HEAD is `3593ec98a883cfd302177ec9efc99a9426769592`, and the Stage 7 real-device validation report regenerated with `sourceTreeClean:true`.

## Live Read-Only Smoke

Read-only smoke confirmed the live site is healthy but not current HEAD:

- `https://aiyaworkspace.com/`: 200
- `https://aiyaworkspace.com/login`: 200
- `https://aiyaworkspace.com/purchase`: 200
- `https://aiyaworkspace.com/app-install`: 307 to `/`
- `https://aiyaworkspace.com/manifest.webmanifest`: 200, `name=AIya`, `short_name=AIya`, `start_url=/dashboard`, `display=standalone`
- `https://admin.aiyaworkspace.com/admin`: 200
- `https://siriusai.store/`: 410
- `https://www.siriusai.store/`: 410
- `https://admin.siriusai.store/`: 410
- `https://aiyaworkspace.com/api/health/release`: `hs-4c7bbea8ba21-2c32cf194421` at `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9`

## Reconciled Findings

- Faz 8 implementation evidence is now bound to HEAD `3593ec98a883cfd302177ec9efc99a9426769592`.
- Local Supabase RLS is zero-skip PASS at current HEAD.
- Android Chrome, installed Android PWA, and Android TalkBack evidence validate with no blockers at current HEAD.
- Physical iPhone Safari/PWA remains `WAIVED_NOT_EXECUTED`, not PASS.
- Active AIya brand/domain/PWA metadata remain correct locally and on the currently hosted release.
- Compatibility technical names remain intentionally unchanged.
- Real Z.ai egress and WhatsApp real traffic remain fail-closed behind production gates and environment flags.
- Production remains `NO-GO`; owner-side approval, account, secret, migration, operations, monitoring, rollback, and exact release approval gates remain open.

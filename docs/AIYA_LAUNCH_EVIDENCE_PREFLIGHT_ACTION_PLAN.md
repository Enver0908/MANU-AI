# AIya Launch Evidence Preflight Action Plan

Date: 2026-09-02

Status: `PHASE_5_LAUNCH_EVIDENCE_PREFLIGHT_COMPLETE`

## Purpose

Close or truthfully classify the four concrete findings left after hosted
deploy repeatability:

- Supabase Auth sender display-name proof.
- Release traceability between live VPS and GitHub branches.
- Stale visual regression tests that still expected the retired brand.
- Development-tooling dependency audit findings.

This phase does not change production `NO-GO`, does not apply remote
migrations, does not push to GitHub, and does not edit DNS, Supabase Auth,
Resend, Stripe, WhatsApp, Z.ai, or production worker settings.

## Scope

In scope:

- Update active visual tests to assert `AIya` on current public, customer, and
  admin surfaces.
- Repair stale Playwright shell-navigation assumptions exposed by the targeted
  visual run.
- Apply safe non-force lockfile-only dependency audit remediation.
- Verify production and full dependency audits.
- Verify live hosted release identity and primary route behavior read-only.
- Record whether Supabase Auth sender proof is available.
- Record whether the deployed live commit is present on a remote branch.

Out of scope:

- Production `GO`.
- Remote migration apply.
- Push, PR, merge, or default-branch migration.
- Supabase/Resend sender setting changes.
- Live WhatsApp/Z.ai/provider egress.
- Live billing enablement or production worker start.
- Real client health-data processing.

## Files

Expected code/test files:

- `app/tests/visual/dashboard.visual.spec.ts`
- `app/tests/visual/commercial-saas.visual.spec.ts`
- `app/tests/visual/messaging-visual-helpers.ts`
- `app/package-lock.json`

Expected evidence/continuity files:

- `docs/AIYA_LAUNCH_EVIDENCE_PREFLIGHT_EVIDENCE.md`
- `docs/AIYA_LAUNCH_EVIDENCE_PREFLIGHT_ACTION_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `docs/RISK_REGISTER.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`
- `docs/AIYA_BRAND_TRANSITION_EVIDENCE.md`
- `docs/AIYAWORKSPACE_DOMAIN_CUTOVER_EVIDENCE.md`
- `docs/PRODUCTION_READINESS_STAGE_1_OWNER_HANDOFF.md`

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx playwright test dashboard.visual.spec.ts commercial-saas.visual.spec.ts --project=desktop`
- `npm audit --omit=dev --json`
- `npm audit --json`
- live read-only route smoke for AIya public/admin/manifest/legacy-domain routes
- active runtime/test old-brand scan
- remote branch containment checks for live and evidence commits
- `git diff --check`
- staged secret scan before commit

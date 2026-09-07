# Public Surface/Auth/Onboarding/PWA Phase 0 Baseline Evidence

Current authority (2026-09-04): historical Phase 0 documentation PASS is superseded for current closure by Faz 8 (`docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md`, requirement matrix). Production remains `NO-GO`.

Date: 2026-09-03
Phase: `0 - Plan Lock and Baseline Documentation`
Verdict: `PASS_LOCAL_DOCUMENTATION_ONLY`

## Scope

This phase created the canonical local action plan for AIya public surface, auth/onboarding, admin lifecycle, dashboard production cleanup, and PWA polish.

No application code, migration, dependency, external system, deploy, production worker, live provider/channel egress, live billing, remote migration, DNS, SMTP, Stripe, WhatsApp, Z.ai, or production gate was changed.

## Git Baseline

Command: `git branch --show-current`

```text
codex/production-readiness-stage-1
```

Command: `git status --short --branch`

```text
## codex/production-readiness-stage-1...origin/codex/production-readiness-stage-1
```

Command: `git rev-parse HEAD`

```text
931bb5a1fea749f5fb607e3fd346d4bf3ad38fdc
```

Command: `git log -8 --oneline --decorate`

```text
931bb5a (HEAD -> codex/production-readiness-stage-1, origin/codex/production-readiness-stage-1) Clarify current AIya evidence authority
83e6965 Record AIya Supabase auth sender correction
a35c3e1 Close AIya launch evidence preflight
1e8178c Record AIya hosted deploy repeatability closure
4c7bbea Build hosted artifacts with hosted release environment
1ac318b Bind release identity during hosted PM2 restart
ba194c0 Restart hosted PM2 process on release switch
044ff7f Add hosted deploy readiness retry and cleanup
```

Command: `git remote -v`

```text
origin	https://github.com/Enver0908/MANU-AI.git (fetch)
origin	https://github.com/Enver0908/MANU-AI.git (push)
```

Command: `git branch -vv`

```text
* codex/production-readiness-stage-1        931bb5a [origin/codex/production-readiness-stage-1] Clarify current AIya evidence authority
```

The same command also showed related worktree branches for `codex/aiya-brand-transition` and `codex/aiyaworkspace-domain-cutover`; the active branch stayed `codex/production-readiness-stage-1`.

Command: `git diff --check`

```text
PASS - no whitespace errors
```

Command: `git ls-remote --symref origin HEAD refs/heads/codex/production-readiness-stage-1 refs/heads/codex/aiya-brand-transition refs/heads/codex/aiyaworkspace-domain-cutover`

```text
ref: refs/heads/codex/phase-29-baseline-checkpoint	HEAD
25a03b50cd7ef8fc3b6b1f68d8a1739e3e1e9372	HEAD
609f31089d10d6e51aee59fad013efa2fa3144e9	refs/heads/codex/aiya-brand-transition
26579dc4f3337925730229aa1c487fd309fb2851	refs/heads/codex/aiyaworkspace-domain-cutover
931bb5a1fea749f5fb607e3fd346d4bf3ad38fdc	refs/heads/codex/production-readiness-stage-1
```

Observation: the repository default remote HEAD is not this working branch, but the required remote branch `origin/codex/production-readiness-stage-1` is present at the expected HEAD. No branch switch was performed.

## Authority Documents Read

- `codex.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/RISK_REGISTER.md`

The current handoff and next-phase docs confirm AIya brand authority, aiyaworkspace domain authority, Supabase Auth sender correction, Stage 1 Phase 1-6 local completion, owner handoff ready local-only posture, and production `NO-GO`.

## Code Areas Inspected By Search

Command family:

```text
rg --files app/src/app app/src/components app/src/lib app/public app/tests docs
rg -n "simulator|quarantine|Demo|Davet koduyla|magic|manual-entitlements|entitlements/revoke|session|manifest|AIya|siriusai\.store|SiriusAI|MANU-AI" ...
rg -n "p85_stage_5_record_session_activity_v2|app_session_activity|inactivity|lock|SESSION|timeout|expires" app/src app/supabase/migrations app/tests
rg -n "manual_entitlement|apply_manual_entitlement_operation|activate|renew|revoke|entitlement" app/src/app/api app/src/lib app/supabase/migrations app/tests
rg -n "Davet koduyla başla|Simülatör|Karantina|Güven|Yerel güvenli mod|Demo|demoyu|Operasyonel|Teslimat hataları|kapı engelleri|yinelenen|vazgeçme|geri alma|Dil" app/src app/tests
```

Relevant current code areas found:

- Public/purchase/onboarding/app-install:
  - `app/src/app/purchase/page.tsx`
  - `app/src/app/purchase/success/page.tsx`
  - `app/src/app/onboarding/page.tsx`
  - `app/src/app/app-install/page.tsx`
  - `app/src/components/purchase-flow.tsx`
  - `app/src/components/purchase-success-onboarding.tsx`
  - `app/src/components/onboarding-claim-panel.tsx`
  - `app/src/components/app-install-center.tsx`
- Public UI:
  - `app/src/components/aiya-marketing-page.tsx`
  - `app/src/components/public/PublicNavbar.tsx`
  - `app/src/components/public/HeroSection.tsx`
  - `app/src/components/public/SecuritySection.tsx`
- Auth:
  - `app/src/app/login/page.tsx`
  - `app/src/app/admin/page.tsx`
  - `app/src/components/customer-login-form.tsx`
  - `app/src/components/admin-login-form.tsx`
  - `app/src/app/auth/callback/route.ts`
  - `app/src/app/api/auth/password-login/route.ts`
  - `app/src/app/api/auth/session-from-fragment/route.ts`
  - `app/src/app/api/admin/auth/magic-link/route.ts`
- Admin/commercial lifecycle:
  - `app/src/app/commercial-admin/page.tsx`
  - `app/src/components/commercial-admin-console.tsx`
  - `app/src/app/api/commercial/admin/invites/route.ts`
  - `app/src/app/api/commercial/admin/manual-entitlements/route.ts`
  - `app/src/app/api/commercial/admin/entitlements/revoke/route.ts`
  - `app/src/app/api/commercial/admin/subscriptions/route.ts`
  - `app/src/lib/commercial-admin-store.ts`
  - `app/src/lib/phase-83f-commercial-admin.ts`
  - `app/src/lib/phase-84f-admin-console.ts`
- Dashboard/PWA/session:
  - `app/src/components/dashboard-app.tsx`
  - `app/src/components/dashboard/dashboard-shell.tsx`
  - `app/src/components/dashboard/dashboard-navigation.tsx`
  - `app/src/components/dashboard/operational-foundation-panel.tsx`
  - `app/src/components/dashboard/operational-visibility.tsx`
  - `app/src/components/dashboard/simulator-panel.tsx`
  - `app/src/components/dashboard/active-client-control.tsx`
  - `app/src/components/pwa-runtime.tsx`
  - `app/src/components/pwa-subscriber-shell.tsx`
  - `app/public/manifest.webmanifest`
  - `app/public/sw.js`
  - `app/src/app/api/session/activity/route.ts`
  - `app/src/lib/phase-85-stage-5-shell-session.ts`
- Tests:
  - `app/tests/visual/dashboard.visual.spec.ts`
  - `app/tests/visual/commercial-saas.visual.spec.ts`
  - `app/tests/visual/messaging.visual.spec.ts`
  - `app/tests/visual/stage-7/stage-7-catalog.ts`
  - `app/src/lib/phase-85-stage-5-shell-session.test.ts`
  - `app/src/lib/phase-83f-commercial-admin.test.ts`
  - `app/src/lib/phase-84f-admin-console.test.ts`
  - `app/src/lib/supabase-rls.integration.test.ts`

## Baseline Findings

1. Active brand/domain authority is AIya/aiyaworkspace. Current evidence records active auth sender as `AIya <no-reply@auth.aiyaworkspace.com>`.
2. Live VPS still serves commit `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9`; local HEAD is `931bb5a1fea749f5fb607e3fd346d4bf3ad38fdc`. This difference is expected and does not authorize deploy.
3. Current user-visible public code still has invite-first CTA text such as `Davet koduyla başla` in public and purchase surfaces. This is planned for Phase 5, not Phase 0.
4. Current dashboard/tests still expose simulator and internal operational UI terms such as `Simülatör`, `Yerel güvenli mod`, `Demoyu sıfırla`, operational foundation, trust/quarantine labels, and related visual tests. This is planned for Phase 1, not Phase 0.
5. Current session infrastructure exists through `app_session_activity` and `p85_stage_5_record_session_activity_v2`; two-hour continuity is planned for Phase 2, not Phase 0.
6. Current admin lifecycle includes invite, manual entitlement activate/renew, entitlement revoke, subscription routes, and audit/store code. Reactivation/renew-after-revoke is planned for Phase 4, not Phase 0.
7. Current PWA manifest is AIya-branded; service worker and PWA network-only/privacy-lock verification remains in Phase 6.

## Production Boundary

Production remains `NO-GO`.

This phase did not change:

- production readiness decision
- iPhone waiver status
- Android pass evidence
- Supabase remote schema
- live release
- auth sender
- DNS/TLS
- Stripe
- WhatsApp
- Z.ai
- live billing
- production workers
- real health-data paths

## Phase 0 Closure Checks

Command: `git diff --check`

```text
PASS - no whitespace errors.
Note: Git emitted LF-to-CRLF working-copy warnings for pre-existing tracked Markdown files when displaying the diff check on Windows.
```

Command: narrow sensitive-value scan over added diff lines in `HANDOFF_FOR_NEXT_CODEX.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, and `docs/RISK_REGISTER.md`

```text
PASS - no matches.
```

Command: narrow sensitive-value scan over new Phase 0 documents

```text
PASS - no matches.
```

Command: `git status --short --branch`

```text
## codex/production-readiness-stage-1...origin/codex/production-readiness-stage-1
 M HANDOFF_FOR_NEXT_CODEX.md
 M docs/NEXT_PHASE_EXECUTION_PLAN.md
 M docs/RISK_REGISTER.md
?? docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md
?? docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_0_BASELINE_EVIDENCE.md
```

No app tests were required or run because this phase changed documentation only and did not alter runtime behavior.

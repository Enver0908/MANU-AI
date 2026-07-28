# Phase 85 Stage 4D Phase 1 Read Gate Evidence

Date: 2026-07-28
Status: **PASS_STAGE_4D_PHASE_1_READ_GATE_DOCS_ONLY**

## Scope

This phase created the Stage 4D Ayarlar / Hesap canonical action plan and read-gate evidence only. It performed repository validation and architecture reading, then reconciled active continuity guidance.

No Stage 4D runtime implementation started. No UI, API behavior, migration, RLS policy, provider gate, commercial webhook, live billing, deployment, push, merge, PR, or production gate changed.

## Repository Verification

Commands executed before edits:

```text
git branch --show-current
git status --short --branch
git log -5 --oneline --decorate
git remote -v
git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
git ls-remote origin HEAD refs/heads/codex/phase-29-baseline-checkpoint refs/heads/codex/stage-4c-remediation
```

Observed result:

```text
branch: codex/stage-4c-remediation
upstream: origin/codex/stage-4c-remediation
HEAD: bc57cfd Reconcile Stage 4C continuity for Stage 4D handoff
origin/codex/stage-4c-remediation: bc57cfd7717e78635730bcc4390afc5676d0b4f3
origin/HEAD and codex/phase-29-baseline-checkpoint: 25a03b50cd7ef8fc3b6b1f68d8a1739e3e1e9372
remote: https://github.com/Enver0908/MANU-AI.git
worktree before Stage 4D Faz 1 edits: clean
```

## Documents Read

- `codex.md`
- `README.md`
- `PLAN.md`
- `PROJECT_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `app/README.md`
- `docs/PHASE_85_STAGE_4C_TO_STAGE_4D_CONTINUITY_HANDOFF_EVIDENCE.md`
- `docs/PHASE_85_STAGE_4C_REMEDIATION_ACTION_PLAN.md`
- `docs/PHASE_85_STAGE_4C_REMEDIATION_EVIDENCE.md`
- `docs/PHASE_85_STAGE_4C_LOCAL_CLOSURE_REHEARSAL_EVIDENCE.md`
- `docs/PHASE_85_FRONTEND_REDESIGN_AND_DESIGN_SYSTEM_SPEC.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`
- `docs/RISK_REGISTER.md`
- `docs/PILOT_READINESS_EVIDENCE_PACK.md`
- `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`
- `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`
- `docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_PLAN.md`
- `docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_SPEC.md`

## Code Areas Read

- `app/src/app/dashboard/page.tsx`
- `app/src/app/dashboard/ai-chat/page.tsx`
- `app/src/app/dashboard/ai-chat/[chatId]/page.tsx`
- `app/src/components/dashboard-app.tsx`
- `app/src/components/dashboard/dashboard-shell.tsx`
- `app/src/components/dashboard/dashboard-navigation.tsx`
- `app/src/components/dashboard/mobile-ergonomics.tsx`
- `app/src/components/pwa-subscriber-shell.tsx`
- `app/src/components/pwa-runtime.tsx`
- `app/src/components/app-install-center.tsx`
- `app/src/lib/auth-context.ts`
- `app/src/lib/dashboard-server-auth.ts`
- `app/src/lib/customer-auth-session.ts`
- `app/src/lib/customer-auth-store.ts`
- `app/src/lib/commercial-entitlement-access.ts`
- `app/src/lib/commercial-billing-store.ts`
- `app/src/lib/commercial-onboarding-store.ts`
- `app/src/lib/commercial-admin-access.ts`
- `app/src/lib/types.ts`
- `app/src/lib/supabase.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/lib/data-governance.ts`
- `app/src/app/api/auth/magic-link/route.ts`
- `app/src/app/api/auth/session-from-fragment/route.ts`
- `app/src/app/api/auth-state/route.ts`
- `app/src/app/api/commercial/billing-portal/route.ts`
- `app/src/app/api/commercial/mobile-install-audit/route.ts`
- `app/src/app/api/commercial/onboarding/status/route.ts`
- `app/src/app/api/commercial/onboarding/claim/route.ts`
- `app/package.json`
- `app/scripts/release-verify.mjs`
- `app/supabase/migrations/20260522000000_initial_manu_ai_schema.sql`
- `app/supabase/migrations/20260530040000_ai_security_remediation.sql`
- `app/supabase/migrations/20260701120000_phase_83b_commercial_entitlement_model.sql`

## Current Architecture Findings

### Settings / Account Behavior

- There is no dedicated `settings` dashboard section, route, or panel.
- `DashboardApp` renders language selection, auth identity, subscription status, PWA install status, Supabase/local status, notification bell, demo reset, and logout in the dashboard header.
- `DashboardShell` also renders a logout button in the sidebar header.
- User language mutation exists through `updateDietitianPreferences()` and persists `dietitians.ui_language`.
- No UI exists for display-name edit, timezone edit, email change, password setup/change, password reset, tenant account settings, member list, role management, billing detail explanation, or account audit.

### Tenant / Account / Actor

- `tenant_memberships` binds Supabase auth users to tenants and roles.
- `dietitians` binds a dietitian profile to `tenant_id` and `auth_user_id`.
- `resolveDashboardAuth()` and `resolveAppTenantContext()` both pick the first membership by `created_at`.
- Stage 4D must not introduce multi-workspace switching without a separate explicit design.

### RBAC / Capability

- `AppCapability` and `hasCapability()` live in `app/src/lib/auth-context.ts`.
- Owner/admin have operational foundation privileges.
- Owner/admin/dietitian have clinical workflow privileges.
- Assistant/auditor can only `read_app_state` through the generic capability model.
- Stage 4D needs account-specific capability names or explicit owner/admin checks.

### Entitlement / Billing / PWA

- Entitlement is tenant-owned in `tenant_entitlements`.
- Billing customer mapping is tenant-owned in `billing_customers`.
- Billing portal access lives in `POST /api/commercial/billing-portal`.
- PWA service-worker registration is gated at dashboard entry by `resolveMobileInstallAccess()`.
- Install audit writes to `mobile_install_audit_events`.

### Audit / Data Governance

- `audit_events` is the general app audit ledger.
- Commercial flows have separate onboarding, billing ledger, and admin audit tables.
- `data-governance.ts` owns client lifecycle/export/redaction and is not an account-settings abstraction.
- Stage 4D evidence must not include raw PHI, raw prompts, file contents, secrets, payment payloads, or real user/client data.

## Gaps and Required Boundaries

| Finding | Evidence | Stage 4D handling |
| --- | --- | --- |
| No dedicated settings route/panel. | Dashboard nav and section rendering. | Faz 2 adds read-only shell first. |
| Account controls are split across header/sidebar. | `DashboardApp`, `DashboardShell`. | Consolidate carefully after tests cover the new path. |
| First membership wins. | Auth resolution helpers. | Document single-workspace behavior; no workspace switcher in Stage 4D without approval. |
| Profile edits lack a Stage 4D contract. | Existing language preference helper only. | Faz 3 adds self-profile DTO/API. |
| Email/password controls absent. | Existing auth routes are magic-link/session bridge focused. | Faz 4 uses Supabase Auth only. |
| Tenant mutation lacks observed revision control. | Tenant schema/account read. | Faz 5 adds expected-revision support before writes. |
| Billing route is commercial-domain specific. | `billing-portal/route.ts`. | Reuse/harden it; do not duplicate billing authority. |
| Service-role exists in commercial reads/writes. | Commercial store modules. | Route handlers must authorize end user before service-role use. |

## Decisions Locked

- Stage 4D begins implementation with Faz 2 read-only settings navigation and overview.
- Email change, password setup/change, and password reset are included in Faz 4.
- Payment-related settings means subscription status plus bounded portal access, not live billing activation.
- PWA install status belongs in settings; broad mobile shell redesign remains Stage 5.
- Tenant/account writes require owner/admin and expected-revision control.
- User profile writes are self-scoped and server-derived.
- Production `NO-GO`, R-405, and all closed provider/channel/billing gates remain unchanged.

## Verification Plan for This Phase

Required:

- `git diff --check`
- secret/sensitive token scan over changed Stage 4D docs
- stale Stage 4D handoff wording scan
- `git status --short --branch`

Not required because this phase changed documentation only:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:rls`
- visual/accessibility tests
- `npm run release:verify`

Skipped checks are not counted as pass.

## Next Single Phase

Next proposed phase: **Faz 2 - Settings Navigation Shell and Read-Only Account Overview**.

Faz 2 requires separate user approval before implementation. It must not implement profile mutation, email/password flows, tenant mutation, billing changes, migration work, provider/channel activation, production gate changes, push, PR, merge, or deploy.

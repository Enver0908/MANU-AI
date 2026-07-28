# Phase 85 Stage 4D Ayarlar / Hesap Action Plan

Date: 2026-07-28

Active remediation status: **POST-CLOSURE REMEDIATION IN PROGRESS - Faz 1 Profile and Tenant/Account Foundation plus Faz 2 Auth, Billing and PWA Hardening are implemented locally; RLS verification remains blocked by local/remote RLS preflight.**

Remediation authority: `docs/PHASE_85_STAGE_4D_REMEDIATION_PHASE_1_ACCOUNT_FOUNDATION_EVIDENCE.md` and `docs/PHASE_85_STAGE_4D_REMEDIATION_PHASE_2_SECURITY_BILLING_PWA_EVIDENCE.md`.

Historical closure snapshot:
Status: **CLOSED locally — measured verdict `PASS_LOCAL_STAGE_4D_CLOSED` at closure commit on `codex/stage-4c-remediation`**

Stage 4D owns authenticated dashboard settings and account workflows for the dietitian-facing SaaS/PWA prototype. Faz 1–6 are complete. Evidence: `docs/PHASE_85_STAGE_4D_CLOSURE_EVIDENCE.md`.

Post-closure audit supersedes the practical next-step interpretation of the historical closure snapshot: tenant account/membership foundation, canonical profile API/timezone, profile RBAC, fallback mutation boundaries, auth security hardening, billing recovery, PWA audit idempotence, and durable rate-limit boundaries required remediation. Remediation Faz 1 and Faz 2 are implemented locally; Faz 3 remediation remains a separate future approval.

Production remains `NO-GO`. R-405 remains open. Real WhatsApp, Telegram, external LLM, embedding, OCR, STT, live billing, monitoring, backup, secret-manager, and real health-data egress paths remain closed.

Canonical closure evidence: `docs/PHASE_85_STAGE_4D_CLOSURE_EVIDENCE.md`. Per-faz evidence remains under `docs/PHASE_85_STAGE_4D_PHASE_*_EVIDENCE.md`.

## Existing Authority

- Repo baseline: branch `codex/stage-4c-remediation`, upstream `origin/codex/stage-4c-remediation`, HEAD `bc57cfd Reconcile Stage 4C continuity for Stage 4D handoff`.
- Stage 4C closure: `docs/PHASE_85_STAGE_4C_REMEDIATION_EVIDENCE.md`, `docs/PHASE_85_STAGE_4C_LOCAL_CLOSURE_REHEARSAL_EVIDENCE.md`, `docs/PHASE_85_STAGE_4C_TO_STAGE_4D_CONTINUITY_HANDOFF_EVIDENCE.md`.
- Design authority: `docs/PHASE_85_FRONTEND_REDESIGN_AND_DESIGN_SYSTEM_SPEC.md`.
- Auth/tenant authority: `app/src/lib/auth-context.ts`, `app/src/lib/dashboard-server-auth.ts`, `app/src/lib/customer-auth-session.ts`, `app/src/lib/customer-auth-store.ts`, `app/src/lib/supabase-store.ts`, `app/supabase/migrations/20260522000000_initial_manu_ai_schema.sql`, `app/supabase/migrations/20260530040000_ai_security_remediation.sql`.
- Commercial authority: `app/src/lib/commercial-entitlement-access.ts`, `app/src/lib/commercial-billing-store.ts`, `app/src/lib/commercial-onboarding-store.ts`, `app/src/lib/commercial-admin-access.ts`, `app/src/app/api/commercial/billing-portal/route.ts`, `app/supabase/migrations/20260701120000_phase_83b_commercial_entitlement_model.sql`.

## Current Settings / Account Architecture

Dedicated settings route exists at `/dashboard/settings?tab=profile|security|workspace|billing|application` after Faz 2. Mutations are still closed.

- `resolveSettingsAccountReadModel()` in `app/src/lib/settings-server-read.ts` builds the cookie-bound read-only settings model without returning internal ids.
- `resolveDashboardAuth()` in `app/src/lib/dashboard-server-auth.ts` remains the shared dashboard/AI Chat gate helper.
- `resolveAppTenantContext()` in `app/src/lib/auth-context.ts` resolves API authority from Supabase user, first tenant membership, matching dietitian profile, entitlement check, and role capability.
- Profile preferences currently live on `dietitians`: `display_name`, `timezone`, `ui_language`, `auth_user_id`. Only `ui_language` is currently editable through dashboard preference save behavior; settings profile remains read-only until Faz 3.
- Tenant account identity currently lives on `tenants`: `id`, `name`, `created_at`. There is no owner/admin tenant settings editor.
- Membership role is `owner | admin | dietitian | assistant | auditor`. Current `AppCapability` is clinical-workflow oriented and has no account-specific capability names yet.
- Commercial entitlement/billing is tenant-owned through `tenant_entitlements`, `billing_customers`, `commercial_invites`, and `billing_event_ledger`.
- `POST /api/commercial/billing-portal` is the existing Stripe portal boundary; after remediation Faz 2 it requires configured sandbox Stripe, Supabase commercial stores, account tenant context, owner/admin role, active or past-due entitlement, and Stripe customer id. It is no longer dependent on active dashboard entitlement for payment recovery.
- PWA install readiness is resolved by `resolveMobileInstallAccess()` at dashboard entry and recorded through `mobile_install_audit_events`. After remediation Faz 2 blocked reasons are sanitized enum codes and audit inserts are daily idempotent.
- Logout currently appears through `/api/demo-logout` forms in both `DashboardShell` and `DashboardApp`.

## Ownership Boundaries

| Domain | Owner | Data | Mutation boundary | Roles |
| --- | --- | --- | --- | --- |
| User auth identity | Supabase Auth | email, password setup/reset, session | Supabase Auth APIs and app auth routes only | authenticated user for own identity |
| User profile preferences | Dietitian profile | display name, timezone, UI language | Stage 4D self-profile API using `resolveAppTenantContext()` | owner/admin/dietitian/assistant/auditor for own profile via future `update_own_profile` |
| Security/session | Auth/session | logout, reset request, email-change request | Auth routes only | authenticated user for own session |
| Tenant account | Tenant/account | tenant name and account settings | owner/admin account API with expected revision before writes | owner/admin |
| Membership/RBAC | Tenant membership | member list, roles, future invites | owner/admin membership APIs; no self-lockout | owner/admin |
| Commercial entitlement | Billing/commercial | entitlement, customer, portal status | existing commercial store and portal route | owner/admin for billing actions |
| PWA install | Commercial install/PWA | install readiness, audit events | existing install access and audit route | granted authenticated tenant member |
| Audit/lifecycle | Governance | minimized audit metadata | existing audit helpers/RPCs | owner/admin where already authorized |

## Phase Plan

### Faz 1 - Read Gate and Canonical Action Plan

Purpose: document the current settings/account architecture, lock scope, and create an executable Stage 4D plan.

Scope:

- Create this action plan.
- Create `docs/PHASE_85_STAGE_4D_PHASE_1_READ_GATE_EVIDENCE.md`.
- Reconcile active continuity documents.
- Do not change runtime code, UI, API routes, migrations, RLS, providers, billing, deploy, push, or production gates.

Completion criteria:

- Repo verification and read evidence are recorded.
- Stage 4D implementation is split into phases below.
- Next phase is one separately approved phase.
- `git diff --check`, secret/sensitive scan, stale wording scan, and worktree status are reported.

### Faz 2 - Settings Foundation and Read-Only Screen

Purpose: let an authorized user read settings from a trusted server-side model on an accessible, responsive screen.

Status: **complete** — evidence `docs/PHASE_85_STAGE_4D_PHASE_2_SETTINGS_READ_ONLY_EVIDENCE.md`.

Scope delivered:

- Dedicated route `/dashboard/settings?tab=profile|security|workspace|billing|application`.
- Contracts in `app/src/lib/phase-85-stage-4d-settings-contracts.ts` and server read in `app/src/lib/settings-server-read.ts`.
- Page/client/section components under `app/src/app/dashboard/settings/` and `app/src/components/settings/`.
- Desktop/mobile Settings nav as a real route link.
- Read-only fields only; no new mutations, schema, or migrations.

Architecture decisions:

- `SettingsAccountReadModel` returns profile/security/workspace/billing/application/runtime blocks only.
- No raw tenant/user/dietitian/membership/Stripe ids reach the client.
- Owner/admin see subscription status; other roles see workspace-access-active only.
- Fallback demo mode shows synthetic profile/workspace and marks identity/billing/PWA actions unavailable.

### Faz 3 - Self Profile Preferences

Purpose: edit the authenticated dietitian's own safe profile preferences.

Scope:

- Add `app/src/lib/phase-85-stage-4d-account-contracts.ts` for DTOs/validation.
- Add `GET /api/account/profile` and `PATCH /api/account/profile` in `app/src/app/api/account/profile/route.ts`.
- Editable fields: `displayName`, `timezone`, `uiLanguage`.
- Reuse `normalizeLanguageCode()` for UI language.
- Update settings UI to call the profile API.

Technical method:

- Server derives `tenantId`, `dietitianId`, `userId`, and `role` from `resolveAppTenantContext()`.
- `PATCH` updates by `tenant_id` plus resolved `dietitianId`; client-supplied tenant/profile ids are not accepted as authority.
- Audit records changed field names only, not old/new values.

Boundary cases:

- Unauthenticated `401`.
- Missing membership/profile `403`.
- Invalid display name, timezone, or language `400`.
- Assistant/auditor writes `403` unless separately approved later.
- Cross-tenant update impossible by construction.

Completion criteria:

- Owner/admin/dietitian can update only own profile preferences.
- Audit metadata has no sensitive values.
- Existing dashboard language behavior remains coherent.

### Faz 4 - Security: Email Change, Password Setup/Change, Reset, Sessions

Purpose: add the user-requested email/password controls while keeping Supabase Auth as credential owner.

Scope:

- Add settings UI for email change request, password setup/change, password reset request, and logout.
- Proposed routes:
  - `POST /api/account/security/email-change-request`
  - `POST /api/account/security/password-reset-request`
  - `POST /api/account/security/password-update` only if the current Supabase session can safely perform it.
- Store no password hashes, reset tokens, email-change tokens, or raw magic links in app tables.

Technical method:

- Normalize and validate emails.
- Require authenticated session for email-change request.
- Use configured app URL allowlist for redirects.
- Return generic reset responses to prevent account enumeration.
- Audit successful authenticated requests with event type and actor only; mask or omit target email.

Boundary cases:

- Supabase Auth not configured `503`.
- Invalid/unchanged email `400`.
- Existing email tied to another account blocked until a future transfer policy.
- Rate-limit failure `429` if existing limiter is reused.

Completion criteria:

- Visible email/password settings exist.
- No credential material is stored by the app.
- Account enumeration is not introduced.

### Faz 5 - Tenant Account and Membership Foundation

Purpose: add owner/admin account management foundations without broad membership mutation.

Scope:

- Proposed routes:
  - `GET /api/account/workspace`
  - `PATCH /api/account/workspace`
  - `GET /api/account/members`
- Add `manage_account_settings` and/or `read_account_settings` capability if this is cleaner than inline owner/admin checks.
- If tenant writes are implemented, add append-only expected-revision support before mutation.
- Do not implement invites, role changes, member removal, or ownership transfer in this phase.

Technical method:

- Server context is authoritative for tenant id.
- Owner/admin only for writes.
- Tenant writes use expected revision and return `409` on stale revision.
- Audit records changed field names and actor role only.

Completion criteria:

- Owner/admin can read account/members overview.
- Any tenant write is expected-revision guarded.
- No self-lockout or cross-tenant mutation is possible.

### Faz 6 - Billing and PWA Account Controls

Purpose: make billing/PWA status understandable in settings without changing production billing posture.

Scope:

- Show entitlement status and billing portal availability.
- Reuse `POST /api/commercial/billing-portal`; do not duplicate billing authority in a generic route.
- Show PWA install readiness and audit state through existing install access/audit contracts.
- No live charging, price plan editing, invoice persistence, production webhook change, or service-worker policy change.

Boundary cases:

- Missing Stripe sandbox config shows disabled state.
- Missing Stripe customer shows support/contact state.
- Inactive or past-due entitlement does not bypass dashboard gates.
- PWA install blocked shows reason without leaking sensitive data.

Completion criteria:

- Settings explains subscription and PWA state.
- Billing portal remains sandbox-gated and tenant-scoped.
- Production `NO-GO` and live billing closed status remain unchanged.

### Faz 7 - Account Audit, Accessibility, Verification, and Closure

Purpose: close Stage 4D with audit visibility, visual quality, and full verification.

Scope:

- Add safe owner/admin account audit summary if existing audit access supports it.
- No raw clinical content, prompts, files, secrets, tokens, payment payloads, or real health data in UI/evidence.
- Update all required continuity docs.
- Run final Stage 4D verification, including `npm run release:verify`.

Required verification:

- Targeted Stage 4D tests.
- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- `npm run test` when shared behavior changes.
- Clean Supabase reset and `npm run test:rls` after schema/RLS changes.
- Visual/accessibility tests after UI phases.
- `npm run release:verify` at closure.
- `git diff --check`.
- Secret/sensitive scan.
- Cross-tenant/cross-account scan.
- Stale handoff and broken doc-link scan.
- `git status --short --branch`.

Completion criteria:

- Stage 4D approved scope is complete and verified.
- Skipped checks are recorded as skipped, not pass.
- Production remains `NO-GO`, R-405 remains open, and real integration gates remain closed.
- Commit, push, PR, deploy, and next phase each require explicit user command.

## Next Single Phase

Stage 4D post-closure remediation is active. Next implementation unit: **Stage 4D remediation Faz 2 - Auth, Billing, PWA Hardening** (separate user approval required). Stage 5 is not the next active implementation unit until Stage 4D remediation is re-closed. Commit, push, PR, deploy, and next-stage implementation each require explicit user command.

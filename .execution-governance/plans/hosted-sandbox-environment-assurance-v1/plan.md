# Hosted Sandbox Environment Assurance v1

Plan version: 1.0.0

Plan state: READY_FOR_IMPLEMENTATION

Final acceptance authority: user

Independent review default: NOT_REQUESTED

## Authority Sources

- User-attached Hosted Sandbox Bütünlük, Güvenlik ve Dağıtım Güvence Planı
- User command on 2026-08-25 to apply Faz 0
- Current Git state and working code
- AGENTS.md
- Stage 5/6/7 closure decisions
- docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md
- docs/execution-governance/LIFECYCLE_AND_OPTIONAL_REVIEW_FLOW.md

## Purpose

Govern the seven-phase Hosted Sandbox integrity, security, and deployment assurance program. Faz 0 installs packages and the protected verifier. Product, migration, CI, deploy, and hosted-data phases remain unimplemented until a separate plan-lock commit and an explicit per-phase user command.

## Invariants

- Production remains `NO-GO`.
- Real provider/channel egress, live billing, real health data, and iOS production readiness are out of scope.
- Physical iPhone Safari/PWA remains `WAIVED_NOT_EXECUTED`, never PASS.
- Supabase Free is retained; no purchase in this plan.
- GitHub default branch does not change.
- Push, PR, merge, branch protection, remote migration, deploy, backup OAuth, and hosted cleanup require a separate explicit user command.
- Demo tenant is removed from hosted paths in later phases; local/test fixtures may remain.
- Do not use a "Phase 86" name.

## Requirement Ledger

| Requirement ID | Classification | Observable requirement | Dependencies |
| --- | --- | --- | --- |
| HS-GOV-001 | IN_SCOPE | Unique requirement IDs exist for HS-GOV, HS-TENANT, HS-RUNTIME, HS-SEC, HS-VERIFY, HS-DEPLOY, and HS-ACCEPT. | [] |
| HS-GOV-002 | IN_SCOPE | Allowed, protected, and forbidden paths/commands are machine-listed in `scope.json`. | [HS-GOV-001] |
| HS-GOV-003 | IN_SCOPE | Protected verifier PASSes on current checkout for identity, API contract file presence, plan packages, and negative controls. | [HS-GOV-002] |
| HS-GOV-004 | IN_SCOPE | Markdown evidence is not a PASS oracle; acceptance commands and verifier artifacts are. | [HS-GOV-003] |
| HS-GOV-005 | IN_SCOPE | After verifier PASS, this plan is `READY_FOR_IMPLEMENTATION` until a separate lock commit sets `LOCKED_FOR_IMPLEMENTATION`. | [HS-GOV-003] |
| HS-TENANT-001 | IN_SCOPE | Hosted Supabase read/mutation paths must not call `ensureDemoData()`. | [HS-GOV-005] |
| HS-TENANT-002 | IN_SCOPE | Account context requires exactly one active membership and a same-tenant dietitian; zero memberships 403, multiple 409 `account_context_ambiguous`. | [HS-GOV-005] |
| HS-TENANT-003 | IN_SCOPE | Demo login works only when `NODE_ENV=development`, localhost, and an explicit demo flag are all true. | [HS-GOV-005] |
| HS-TENANT-004 | IN_SCOPE | Demo cleanup supports `--dry-run` then explicit `--apply`, fail-closed, and is not run remotely without a later user command. | [HS-TENANT-001] |
| HS-RUNTIME-001 | IN_SCOPE | When Supabase is configured, UI must not fall back to demo state on API error. | [HS-TENANT-001] |
| HS-RUNTIME-002 | IN_SCOPE | Admin-host rewrite preserves session-refresh cookies; RSC must not write cookies. | [HS-GOV-005] |
| HS-RUNTIME-003 | IN_SCOPE | Magic-link app limit is `1/email/IP/60s` with `Retry-After: 60`. | [HS-GOV-005] |
| HS-RUNTIME-004 | IN_SCOPE | Dashboard primary navigation uses real `Link` semantics with dirty-state guard; missing active client shows an empty state, not a synthetic profile. | [HS-RUNTIME-001] |
| HS-SEC-001 | IN_SCOPE | PUBLIC/anon default function EXECUTE is revoked; `dietitian_belongs_to_tenant` checks `auth.uid()` membership. | [HS-TENANT-002] |
| HS-SEC-002 | IN_SCOPE | Encrypted logical backup and a verified restore drill exist without paid PITR. | [HS-GOV-005] |
| HS-SEC-003 | IN_SCOPE | Advisor findings are reduced only after measured query/policy evidence; no blind index or policy merging. | [HS-SEC-001] |
| HS-VERIFY-001 | IN_SCOPE | `ReleaseIdentity` is produced at build time and exposed by `/api/shell/version`. | [HS-RUNTIME-001] |
| HS-VERIFY-002 | IN_SCOPE | Playwright/baselines are reconciled with Stage 5–7 behavior without bulk-blind snapshot acceptance. | [HS-VERIFY-001] |
| HS-VERIFY-003 | IN_SCOPE | Hosted fallback `0.0.0-stage5` is forbidden. | [HS-VERIFY-001] |
| HS-DEPLOY-001 | IN_SCOPE | Product CI, required checks, and controlled PR/merge machinery exist locally; remote enablement needs a later user command. | [HS-VERIFY-001] |
| HS-DEPLOY-002 | IN_SCOPE | VPS release is atomic with measured rollback; migration workflow is separate and fingerprint-gated. | [HS-DEPLOY-001] |
| HS-DEPLOY-003 | IN_SCOPE | Nginx/Next security headers and HTML no-store policy are applied; workflows cannot enable production/provider/billing flags. | [HS-DEPLOY-001] |
| HS-ACCEPT-001 | IN_SCOPE | Hosted activation follows backup → release → migration → cleanup dry-run/apply → smoke, each with extra user approval. | [HS-DEPLOY-002, HS-TENANT-004, HS-SEC-002] |
| HS-ACCEPT-002 | IN_SCOPE | After activation, demo UUID/entitlement/membership contamination is zero on hosted sandbox. | [HS-ACCEPT-001] |
| HS-ACCEPT-003 | IN_SCOPE | Android Chrome/PWA/TalkBack regression is repeated; iPhone remains `WAIVED_NOT_EXECUTED`. | [HS-ACCEPT-001] |
| HS-OOS-001 | OUT_OF_SCOPE_WITH_REASON | Production GO is independently closed and is not a Hosted Sandbox outcome. | [] |
| HS-OOS-002 | OUT_OF_SCOPE_WITH_REASON | Supabase Pro/PITR purchase is excluded. | [] |
| HS-OOS-003 | OUT_OF_SCOPE_WITH_REASON | iOS production readiness / iPhone PASS is excluded. | [] |
| HS-OOS-004 | OUT_OF_SCOPE_WITH_REASON | Live billing and provider/channel egress remain closed. | [] |
| HS-OOS-005 | OUT_OF_SCOPE_WITH_REASON | GitHub default branch will not be changed. | [] |

## Phase Gates

0. Verifier setup (sibling package `hosted-sandbox-verifier-setup-v1`)
1. Tenant isolation and demo split
2. Dashboard/API/admin/auth/PWA runtime
3. Supabase security, RLS, free backup
4. Acceptance refresh and immutable release identity
5. GitHub CI, VPS automation, network hardening
6. Hosted activation, cleanup, end-to-end acceptance

Each later phase requires the current lock, user phase approval, executor checks, and a separate commit approval. Push and remote effects never start automatically.

## Review Policy

Independent review starts only when the user explicitly requests it. Record `independent_review: NOT_REQUESTED` and do not create a review record unless requested.

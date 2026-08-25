# Hosted Sandbox Remediation v1.1

Plan version: 1.1.1

Plan state: LOCKED_FOR_IMPLEMENTATION

Contract ID: hosted-sandbox-remediation-v1-1

Final acceptance authority: user

Independent review default: NOT_REQUESTED

## Authority Sources

- User request for Hosted Sandbox Remediation v1.1.
- `AGENTS.md`
- `docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md`
- `docs/execution-governance/DECISION_COMPLETE_PLAN_AUTHORING_STANDARD.md`
- `docs/execution-governance/LIFECYCLE_AND_OPTIONAL_REVIEW_FLOW.md`
- Stage 5, Stage 6, and Stage 7 local closure authority documents.
- Current Git state on `codex/stage-4c-remediation` at Phase 0 start.
- User-approved scope-change request `HSR11-PHASE-1-SCOPE-CHANGE-001`.

## Problem Statement

The historical hosted sandbox work left the repository with a non-lockable main plan, acceptance hash drift, scope violations, a broken production build, simulated deploy and activation behavior, incomplete hosted evidence, and live environment drift. This v1.1 plan replaces that work with a decision-complete, phase-scoped remediation contract. It preserves production `NO-GO`, keeps iPhone Safari/PWA validation as `WAIVED_NOT_EXECUTED`, and requires separate explicit user authorization before GitHub, Supabase, VPS, or live-site mutation.

## Scope Summary

In scope:

- Reauthor the hosted sandbox remediation plan package in governance format `2.0.0`.
- Fix browser-safe commercial auth imports, requestId propagation, RSC cookie boundaries, and trusted proxy handling.
- Replace sequential demo cleanup with a transaction/RPC and inventory fingerprint.
- Harden RLS default privileges and hosted backup/restore safety.
- Centralize deterministic release identity and prevent build-time mutation of tracked service worker source.
- Produce real artifact, migration, deploy, rollback, smoke, and edge-header tooling.
- Execute hosted activation only after a separate explicit external-system command.

Out of scope:

- Production `GO`, iOS production pilot readiness, live billing, provider/channel egress, production health-data processing, purchases, default branch change, and branch protection mutation.

Blocked decisions:

- None for local Phase 0 through Phase 4 implementation.
- Phases 5 and 6 have external-effect execution blocked until the user gives a separate explicit command naming GitHub push, Supabase migration, VPS deploy, and live smoke authorization.

## Requirement Ledger

| Requirement ID | Classification | Observable requirement | Dependencies |
| --- | --- | --- | --- |
| HSR11-000 | IN_SCOPE | The v1.1 package is decision-complete, phase-scoped, hash-locked, and product implementation has not started. | [] |
| HSR11-101 | IN_SCOPE | Browser client imports no Node-only crypto module; server token hashing is server-only. | [HSR11-000] |
| HSR11-102 | IN_SCOPE | API requestId values propagate into AppRequestError and hydration. | [HSR11-000] |
| HSR11-103 | IN_SCOPE | RSC Supabase read clients never mutate cookies. | [HSR11-000] |
| HSR11-104 | IN_SCOPE | Forwarded host and IP headers are trusted only from configured proxies. | [HSR11-000] |
| HSR11-201 | IN_SCOPE | Hosted sandbox cleanup is atomic, inventory-bound, dry-run auditable, apply auditable, and residual-zero. | [HSR11-101, HSR11-102, HSR11-103, HSR11-104] |
| HSR11-301 | IN_SCOPE | RLS helper default privileges revoke public and anon execute access with zero-skip cross-tenant tests. | [HSR11-201] |
| HSR11-302 | IN_SCOPE | Backup and restore avoid password argv, delete plaintext in finally, verify refs, and require restore approval. | [HSR11-301] |
| HSR11-401 | IN_SCOPE | ReleaseIdentity is deterministic, centralized, build-bound, and does not rewrite tracked `app/public/sw.js`. | [HSR11-301, HSR11-302] |
| HSR11-501 | IN_SCOPE | CI, migration, artifact, deploy, smoke, and rollback use real release artifacts and fail simulated apply. | [HSR11-401] |
| HSR11-502 | IN_SCOPE | Edge headers remove X-Powered-By, correct HTML cache, and bound production CSP. | [HSR11-501] |
| HSR11-601 | IN_SCOPE | Hosted activation performs the real sequence and fails skipped, blocked, simulated, stale, or mismatched apply evidence. | [HSR11-501, HSR11-502] |

<!-- GOV-PHASE id="PHASE-0" title="Decision-Complete Package, Verifier, And Plan Lock" -->

## Phase PHASE-0 Purpose
<!-- GOV-SECTION id="purpose" -->

Create the replacement v1.1 governance package, setup package, lock files, lifecycle records, and package verifier. The invariant is that Phase 1 cannot start until Phase 0 validation proves the new package has exact requirement, scope, acceptance, and plan-anchor coverage.

## Phase PHASE-0 Scope
<!-- GOV-SECTION id="scope" -->

Allowed create paths are the two new plan directories, `tools/hosted-sandbox/verify-hosted-sandbox-remediation-v1-1.mjs`, and `docs/HOSTED_SANDBOX_REMEDIATION_V1_1_PHASE_0_EVIDENCE.md`.

Allowed modify paths are empty for the main package Phase 0.

Protected paths include application code, migrations, package manifests, workflows, governance schemas/templates, governance CLI/core tools, production readiness documents, and ignored runtime artifacts.

## Phase PHASE-0 Out Of Scope
<!-- GOV-SECTION id="out-of-scope" -->

No product code, UI, API route, migration, dependency, workflow, Supabase, GitHub remote, VPS, Nginx, DNS, billing, provider, production gate, or real-data behavior is changed.

## Phase PHASE-0 Preconditions
<!-- GOV-SECTION id="preconditions" -->

1. `git branch --show-current` returns `codex/stage-4c-remediation`.
2. `git status --short --branch` shows a clean tree before edits.
3. `node tools/execution-governance/governance-cli.mjs doctor` exits 0.
4. `node tools/execution-governance/governance-cli.mjs validate` exits 0.

## Phase PHASE-0 Affected Files
<!-- GOV-SECTION id="affected-files" -->

- Create `.execution-governance/plans/hosted-sandbox-remediation-v1-1-verifier-setup/*` to authorize Phase 0 setup work.
- Create `.execution-governance/plans/hosted-sandbox-remediation-v1-1/*` to authorize later remediation.
- Create `tools/hosted-sandbox/verify-hosted-sandbox-remediation-v1-1.mjs` to check package integrity.
- Create `docs/HOSTED_SANDBOX_REMEDIATION_V1_1_PHASE_0_EVIDENCE.md` to record command outcomes.
- Preserve every path listed as protected or forbidden in `scope.json`.

## Phase PHASE-0 Architecture Decisions
<!-- GOV-SECTION id="architecture-decisions" -->

1. Use a setup package for Phase 0 because a not-yet-existing main plan cannot authorize its own creation without a bootstrap authority.
2. Generate lock files using the existing governance CLI rather than hand-written hashes.
3. Keep `lockCommit` empty until the user separately approves a commit; `baseCommit` remains the current HEAD used by preflight.
4. Set future external phases as locked plan authority but leave their implementation state `NOT_STARTED`.

## Phase PHASE-0 Rejected Alternatives
<!-- GOV-SECTION id="rejected-alternatives" -->

1. The historical `hosted-sandbox-environment-assurance-v1` package is rejected for future work because legacy disposition requires reauthoring.
2. A Markdown-only plan is rejected because Cursor activation requires machine-readable scope and lock files.
3. A single broad all-phase activation is rejected because `AGENTS.md` requires phase-specific activation.

## Phase PHASE-0 API And Data Contracts
<!-- GOV-SECTION id="api-data-contracts" -->

- Setup package contract ID: `hosted-sandbox-remediation-v1-1-verifier-setup`.
- Main package contract ID: `hosted-sandbox-remediation-v1-1`.
- Phase IDs: `PHASE-0`, `PHASE-1`, `PHASE-2`, `PHASE-3`, `PHASE-4`, `PHASE-5`, `PHASE-6`.
- Verifier command: `node tools/hosted-sandbox/verify-hosted-sandbox-remediation-v1-1.mjs --phase PHASE-0`.
- Verifier output: stdout line `PASS hosted-sandbox-remediation-v1-1 PHASE-0 verifier` and exit 0 on success; stderr lines beginning with `FAIL` and exit 1 on contract violation.

## Phase PHASE-0 Ordered Implementation Steps
<!-- GOV-SECTION id="ordered-steps" -->

<!-- GOV-STEP id="HSR11-000-STEP-001" -->
1. Write setup `plan.md`, `contract.json`, `scope.json`, and `acceptance.json` with only HSR11-SETUP-001 in scope.

<!-- GOV-STEP id="HSR11-000-STEP-002" -->
2. Write main `plan.md`, `contract.json`, `scope.json`, and `acceptance.json` with HSR11-000 through HSR11-601.

<!-- GOV-STEP id="HSR11-000-STEP-003" -->
3. Write lifecycle and implementation-report records showing product implementation is `NOT_STARTED`.

<!-- GOV-STEP id="HSR11-000-STEP-004" -->
4. Write the Phase 0 verifier script and evidence file.

<!-- GOV-STEP id="HSR11-000-STEP-005" -->
5. Generate setup and main lock files with `governance-cli lock --write --allow-dirty`.

<!-- GOV-STEP id="HSR11-000-STEP-006" -->
6. Run validation, verifier, setup run-checks, setup postflight, diff hygiene, and final status commands.

## Phase PHASE-0 Technical Methods
<!-- GOV-SECTION id="technical-methods" -->

- Use existing JSON schemas and the existing governance CLI.
- Use Node core modules only in the package verifier.
- Use repository-relative normalized paths with forward slashes in all machine authority files.

## Phase PHASE-0 Data And Control Flow
<!-- GOV-SECTION id="data-control-flow" -->

User approval authorizes Phase 0. The setup contract authorizes creation of the main package and verifier. The main contract enumerates future requirements. The lock command hashes plan, contract, scope, and acceptance files. The verifier reads the package files, validates coverage and hash integrity, then reports PASS or FAIL without external I/O.

## Phase PHASE-0 Dependencies
<!-- GOV-SECTION id="dependencies" -->

Node.js 22 and Git are required. No npm dependency, package lock change, Supabase connection, GitHub token, VPS credential, browser, or network dependency is required.

## Phase PHASE-0 State Transitions
<!-- GOV-SECTION id="state-transitions" -->

- Before: v1.1 package absent, setup package absent, product remediation not started.
- After success: setup package is `EXECUTOR_VERIFIED`; main package is `LOCKED_FOR_IMPLEMENTATION` and `NOT_STARTED`; independent review remains `NOT_REQUESTED`; user acceptance remains `PENDING`.
- On failure: Phase 1 remains blocked and production boundaries remain unchanged.

## Phase PHASE-0 Errors And Boundaries
<!-- GOV-SECTION id="errors-boundaries" -->

Validation error, missing lock hash, missing requirement coverage, missing phase marker, protected file drift, or dirty out-of-scope path fails Phase 0. Any need to edit outside Phase 0 allowed paths requires a scope-change request before editing.

## Phase PHASE-0 Security And Privacy
<!-- GOV-SECTION id="security-privacy" -->

No secrets, `.env` files, raw prompts, PHI, health records, production data, service-role keys, database URLs, or private keys are read or written. Production remains `NO-GO`; iPhone Safari/PWA remains `WAIVED_NOT_EXECUTED`.

## Phase PHASE-0 Accessibility And Localization
<!-- GOV-SECTION id="accessibility-localization" -->

No UI, accessibility, or localization runtime surface changes in Phase 0.

## Phase PHASE-0 Migration And Rollback
<!-- GOV-SECTION id="migration-rollback" -->

Migration: none. Rollback before commit deletes the new Phase 0 files. Rollback after commit requires a user-approved revert of the Phase 0 commit.

## Phase PHASE-0 Tests
<!-- GOV-SECTION id="tests" -->

- `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/hosted-sandbox-remediation-v1-1-verifier-setup` exits 0.
- `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/hosted-sandbox-remediation-v1-1` exits 0.
- `node tools/hosted-sandbox/verify-hosted-sandbox-remediation-v1-1.mjs --phase PHASE-0` exits 0.
- `node tools/execution-governance/governance-cli.mjs run-checks --plan-dir .execution-governance/plans/hosted-sandbox-remediation-v1-1-verifier-setup --phase-id PHASE-0` exits 0.
- `node tools/execution-governance/governance-cli.mjs postflight --plan-dir .execution-governance/plans/hosted-sandbox-remediation-v1-1-verifier-setup --phase-id PHASE-0 --allow-dirty` exits 0.
- `git diff --check` exits 0.
- `git status --short --branch` shows only Phase 0 files before commit.

## Phase PHASE-0 Acceptance Oracles
<!-- GOV-SECTION id="acceptance-oracles" -->

<!-- GOV-REQ id="HSR11-000" -->
HSR11-000 passes only when setup validation, main validation, verifier execution, setup run-checks, setup postflight, and diff hygiene all exit 0 and the changed-path list contains only Phase 0 allowed files.

## Phase PHASE-0 Stop And Completion Criteria
<!-- GOV-SECTION id="stop-completion" -->

Stop before product, migration, dependency, workflow, external-system, production gate, billing, provider, or real-data mutation. Complete Phase 0 only after command evidence is recorded and the user is asked for a separate commit approval.

<!-- GOV-PHASE id="PHASE-1" title="Runtime Auth, Request Identity, Browser-Safe Commercial Modules, And Trusted Proxy Boundary" -->

## Phase PHASE-1 Purpose

Remove the production build blocker and close runtime auth boundary defects before schema or deploy work begins.

## Phase PHASE-1 Scope

Edit only the Phase 1 files listed in `scope.json`: commercial auth modules, admin/customer login form imports, request error modules, Supabase server client helpers, RSC page/layout imports that directly use those helpers, trusted proxy parser, demo fixture access, rate limit identity, and targeted tests. Version 1.1.1 incorporates approved request `HSR11-PHASE-1-SCOPE-CHANGE-001` to align these file boundaries with the current repository map before implementation starts.

## Phase PHASE-1 Ordered Steps

<!-- GOV-STEP id="HSR11-101-STEP-001" -->
1. Create `app/src/lib/commercial-email.ts` exporting `normalizeCommercialEmail(input: string): string` and `isAllowedCommercialEmail(email: string, allowedDomains: readonly string[]): boolean` with no Node imports.

<!-- GOV-STEP id="HSR11-101-STEP-002" -->
2. Move token hashing from `app/src/lib/phase-83b-commercial-entitlement-model.ts` to `app/src/lib/phase-83b-commercial-entitlement-model.server.ts`, and make browser-imported modules consume only email normalization and public entitlement shape constants.

<!-- GOV-STEP id="HSR11-102-STEP-001" -->
3. Extend `AppRequestError` with `requestId?: string`; parse `requestId` from API JSON error payloads in `use-manu-state.ts`; pass it to `hydrateRequestId(requestId)`.

<!-- GOV-STEP id="HSR11-103-STEP-001" -->
4. Create `supabase-server-readonly.ts` with a cookie adapter whose mutation functions are no-op and auditable; update server component read paths to import it.

<!-- GOV-STEP id="HSR11-104-STEP-001" -->
5. Create `trusted-proxy.ts` with `resolveTrustedHost(headers, directHost, trustedProxyCidrs)` and `resolveTrustedClientIp(headers, remoteAddress, trustedProxyCidrs)`; untrusted forwarded headers are ignored.

## Phase PHASE-1 API And Data Contracts

- `CommercialEmail` is a lowercase normalized string returned by `normalizeCommercialEmail`.
- `AppRequestError` fields are `message`, `status`, `code`, `requestId`, `field`, and `revision`.
- `TrustedProxyDecision` fields are `trusted: boolean`, `host: string`, `clientIp: string`, and `source: "direct" | "trusted-proxy"`.

## Phase PHASE-1 Data And Control Flow

Client components call client-safe commercial functions only. API failures parse JSON body, create `AppRequestError`, hydrate request identity, and render support-safe request ID text. Server components read Supabase cookies through read-only clients. Demo and rate-limit decisions consume trusted proxy output instead of raw forwarded headers.

## Phase PHASE-1 Errors And Boundaries

If a browser import reaches `node:crypto`, build fails. If request body lacks `requestId`, the error object leaves `requestId` undefined. If no trusted proxy is configured, direct host and remote address are used.

## Phase PHASE-1 Tests

Run targeted tests for commercial auth, requestId propagation, RSC read-only clients, trusted proxy spoofing, `npm run typecheck`, and `npm run build`.

<!-- GOV-REQ id="HSR11-101" -->
HSR11-101 passes only when build succeeds and static import tests prove browser paths do not import `node:crypto`.

<!-- GOV-REQ id="HSR11-102" -->
HSR11-102 passes only when tests prove API `requestId` reaches `AppRequestError` and hydration.

<!-- GOV-REQ id="HSR11-103" -->
HSR11-103 passes only when tests prove RSC read clients never write cookies.

<!-- GOV-REQ id="HSR11-104" -->
HSR11-104 passes only when spoofed forwarded headers fail closed.

<!-- GOV-PHASE id="PHASE-2" title="Tenant Isolation Inventory And Transactional Demo Cleanup" -->

## Phase PHASE-2 Purpose

Replace partial sequential cleanup with a single inventory-verified cleanup transaction that preserves tenant isolation and makes hosted demo contamination measurable.

## Phase PHASE-2 Scope

Create one migration for `cleanup_hosted_sandbox_demo_tenant`, one inventory verifier script, and targeted cleanup tests. Modify only the existing hosted sandbox cleanup script and hosted sandbox verifier integration.

## Phase PHASE-2 Ordered Steps

<!-- GOV-STEP id="HSR11-201-STEP-001" -->
1. Add `cleanup_hosted_sandbox_demo_tenant(p_tenant_id uuid, p_expected_inventory jsonb, p_apply boolean)` as a SECURITY DEFINER RPC owned by the migration owner, executable only by service role.

<!-- GOV-STEP id="HSR11-201-STEP-002" -->
2. Compute the tenant-owned table inventory from database catalogs; compare it with `p_expected_inventory`; abort before deletion on mismatch.

<!-- GOV-STEP id="HSR11-201-STEP-003" -->
3. Return JSON with `tenant_id`, `apply`, `inventory_fingerprint`, `before_counts`, `deleted_counts`, `after_counts`, and `zero_residual`.

<!-- GOV-STEP id="HSR11-201-STEP-004" -->
4. Update cleanup script so dry-run calls the RPC with `p_apply=false` and apply calls it with `p_apply=true`; remove hardcoded sequential REST delete authority.

## Phase PHASE-2 Data And Control Flow

Cleanup command validates environment and tenant ID, builds expected inventory, calls the RPC, receives count JSON, writes sanitized evidence, and exits nonzero unless `zero_residual` is true for apply or counts are stable for dry-run.

## Phase PHASE-2 Errors And Boundaries

Inventory mismatch, unauthorized role, missing tenant ID, partial delete, or nonzero residual count fails. Hosted apply remains blocked without separate external authorization.

## Phase PHASE-2 Tests

Run local Supabase reset, cleanup RPC tests, RLS tests with zero skip, and hosted sandbox verifier dry-run tests.

<!-- GOV-REQ id="HSR11-201" -->
HSR11-201 passes only when local tests prove dry-run preserves rows, apply deletes rows atomically, unauthorized execution fails, and inventory drift aborts before mutation.

<!-- GOV-PHASE id="PHASE-3" title="RLS Default Privileges, Encrypted Backup, And Isolated Restore Drill" -->

## Phase PHASE-3 Purpose

Harden database privilege defaults and prove backup/restore safety before release artifact work.

## Phase PHASE-3 Scope

Create one RLS default privilege migration, one RLS helper inventory script, one restore drill test, and targeted tests. Modify only backup/restore tooling and RLS test orchestration named in `scope.json`.

## Phase PHASE-3 Ordered Steps

<!-- GOV-STEP id="HSR11-301-STEP-001" -->
1. Add `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon` and explicit grants for intended authenticated or service-role helper functions.

<!-- GOV-STEP id="HSR11-301-STEP-002" -->
2. Add helper signature inventory verification that queries real local DB catalogs after migration.

<!-- GOV-STEP id="HSR11-302-STEP-001" -->
3. Change backup execution so DB passwords are passed through environment variables, not command arguments or logged URLs.

<!-- GOV-STEP id="HSR11-302-STEP-002" -->
4. Wrap plaintext dump creation in `try/finally`; delete plaintext dump on success and failure; retain only encrypted output and sanitized manifest.

<!-- GOV-STEP id="HSR11-302-STEP-003" -->
5. Require restore approval file with target project ref, source project ref, timestamp, and operator confirmation; reject same source and target project refs.

## Phase PHASE-3 Data And Control Flow

Local migration updates privilege defaults, inventory script checks catalog state, RLS tests assert denial and allowed paths. Backup spawns dump command with password in env, encrypts output, writes manifest, and deletes plaintext. Restore verifies approval, decrypts to temp, restores only to approved isolated target, and deletes plaintext in finally.

## Phase PHASE-3 Errors And Boundaries

Skipped RLS tests, public execute, anon execute, password in argv, plaintext residue, missing approval, stale approval, same project ref, or failed cleanup fails Phase 3.

## Phase PHASE-3 Tests

Run local Supabase reset, `npm run test:rls`, backup tests, restore drill tests, and secret/process-argument scans.

<!-- GOV-REQ id="HSR11-301" -->
HSR11-301 passes only when database catalog checks and RLS tests prove no unauthorized helper execution and zero skipped RLS tests.

<!-- GOV-REQ id="HSR11-302" -->
HSR11-302 passes only when backup and restore tests prove password argv absence, plaintext cleanup, project-ref separation, and required approval.

<!-- GOV-PHASE id="PHASE-4" title="Deterministic Release Identity, Service Worker Artifact Binding, And Local Quality Gate" -->

## Phase PHASE-4 Purpose

Make release identity deterministic and artifact-bound, then restore local build, release verification, visual, accessibility, and regression gates.

## Phase PHASE-4 Scope

Create release identity module, generated service worker artifact script, and release identity tests. Modify only Next config, service worker source contract, release verifier, artifact builder, artifact manifest, and deploy tests.

## Phase PHASE-4 Ordered Steps

<!-- GOV-STEP id="HSR11-401-STEP-001" -->
1. Create `buildReleaseIdentity(input)` with fields `releaseId`, `commitSha`, `builtAt`, `environment`, `migrationFingerprint`, `compatibilityVersion`, and `artifactSha256`.

<!-- GOV-STEP id="HSR11-401-STEP-002" -->
2. Make `builtAt` an explicit input from `SOURCE_DATE_EPOCH` or a release metadata file; reject nondeterministic `new Date()` identity generation.

<!-- GOV-STEP id="HSR11-401-STEP-003" -->
3. Generate service worker release metadata into build output without rewriting tracked `app/public/sw.js`.

<!-- GOV-STEP id="HSR11-401-STEP-004" -->
4. Update `release-verify.mjs` to compare app, service worker artifact, migration fingerprint, and artifact manifest release identity.

## Phase PHASE-4 Data And Control Flow

Build receives commit SHA, timestamp input, environment, migration fingerprint, and artifact hash. Release identity module produces one object. Next config and service worker generation consume the object. Release verifier compares every exposed identity endpoint and artifact manifest to the same values.

## Phase PHASE-4 Errors And Boundaries

Missing build input, stale service worker identity, tracked source mutation, mismatched migration fingerprint, mismatched artifact hash, build failure, visual regression, accessibility regression, or Stage 5-7 regression failure fails Phase 4.

## Phase PHASE-4 Tests

Run release identity tests, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run release:verify`, required Playwright visual/accessibility checks, and Stage 5-7 regression checks.

<!-- GOV-REQ id="HSR11-401" -->
HSR11-401 passes only when deterministic identity tests, build, release verification, Playwright checks, and regression checks all exit 0 and `git status` proves `app/public/sw.js` was not rewritten by build.

<!-- GOV-PHASE id="PHASE-5" title="GitHub CI, Migration Workflow, Artifact Provenance, Atomic VPS Deploy, Rollback, And Edge Headers" -->

## Phase PHASE-5 Purpose

Replace dry-run-only hosted deploy mechanics with verifiable CI, migration, artifact, deploy, rollback, smoke, and edge-header tooling. External mutation remains blocked until a separate explicit command.

## Phase PHASE-5 Scope

Create hosted sandbox workflow files from templates. Modify deploy scripts, workflow templates, smoke checks, workflow verifier, Nginx template, Nginx verifier, and deploy tests only.

## Phase PHASE-5 Ordered Steps

<!-- GOV-STEP id="HSR11-501-STEP-001" -->
1. Build a standalone Next artifact containing server output, `.next/static`, public assets, generated service worker artifact, PM2 config, artifact manifest, and SHA256.

<!-- GOV-STEP id="HSR11-501-STEP-002" -->
2. Require migration workflow to compute local migration fingerprint, compare expected fingerprint, apply migrations only after match, and upload sanitized migration evidence.

<!-- GOV-STEP id="HSR11-501-STEP-003" -->
3. Deploy artifact to `/opt/manu-ai/releases/<commitSha>`, verify manifest SHA, run candidate smoke on a non-current target, atomically switch `/opt/manu-ai/current`, reload PM2, and verify current smoke.

<!-- GOV-STEP id="HSR11-501-STEP-004" -->
4. Implement rollback to the previous verified release and make first deploy rollback report `BLOCKED_NO_PREVIOUS_RELEASE`, not PASS.

<!-- GOV-STEP id="HSR11-502-STEP-001" -->
5. Update Nginx template so HTML has no one-year cache, hashed assets keep immutable cache, all locations inherit security headers, X-Powered-By is hidden, and production CSP has no unsafe-eval or broad HTTPS/WSS wildcard.

## Phase PHASE-5 Data And Control Flow

GitHub workflow builds artifact, records provenance, verifies migration fingerprint, runs migration, transfers artifact, verifies SHA on VPS, extracts release directory, smokes candidate, switches symlink, reloads PM2, smokes current, and uploads sanitized evidence. Local tests simulate all steps with temporary directories and no network.

## Phase PHASE-5 Errors And Boundaries

Missing artifact, SHA mismatch, migration fingerprint mismatch, failed candidate smoke, 401 smoke, release SHA mismatch, failed PM2 reload, missing previous rollback release, unsafe CSP, inherited-header gap, exposed X-Powered-By, or long HTML cache fails Phase 5.

## Phase PHASE-5 Tests

Run deploy tests, workflow hardening verifier, Nginx verifier, `npm run build`, and `npm run release:verify`. Real GitHub/VPS execution runs only after separate explicit authorization.

<!-- GOV-REQ id="HSR11-501" -->
HSR11-501 passes locally only when tests prove real artifact, migration, deploy, smoke, and rollback behavior. Hosted PASS additionally requires separately authorized GitHub and VPS evidence.

<!-- GOV-REQ id="HSR11-502" -->
HSR11-502 passes locally only when template verifier proves bounded CSP, inherited security headers, hidden X-Powered-By, and correct cache policy. Live PASS additionally requires separately authorized curl evidence.

<!-- GOV-PHASE id="PHASE-6" title="Real Hosted Activation, Contamination Zero, Live Auth Smoke, Android PWA Validation, And Final Evidence" -->

## Phase PHASE-6 Purpose

Execute or prepare final hosted activation with strict fail-closed status handling. Apply mode may run only after separate explicit authorization.

## Phase PHASE-6 Scope

Modify activation orchestration, activation contract, activation tests, hosted verifier integration, final evidence, handoff, and risk register only.

## Phase PHASE-6 Ordered Steps

<!-- GOV-STEP id="HSR11-601-STEP-001" -->
1. Encode activation order as preflight, maintenance on, encrypted backup verify, migration apply, transactional cleanup, artifact deploy, release-aware smoke, live auth/dashboard smoke, contamination-zero check, Android Chrome/PWA/TalkBack evidence, maintenance off.

<!-- GOV-STEP id="HSR11-601-STEP-002" -->
2. Make apply mode exit nonzero when any step returns `SIMULATED`, `BLOCKED`, `SKIPPED`, stale artifact, release mismatch, contamination positive, or missing evidence.

<!-- GOV-STEP id="HSR11-601-STEP-003" -->
3. Keep dry-run status as `DRY_RUN_READY` only; dry-run cannot produce hosted activation PASS.

<!-- GOV-STEP id="HSR11-601-STEP-004" -->
4. Record final evidence with release SHA, migration fingerprint, backup manifest hash, cleanup residual counts, admin/customer auth callback hosts, Android evidence, TalkBack result, iPhone waiver, production `NO-GO`, and external command outcomes.

## Phase PHASE-6 Data And Control Flow

Activation reads locked release metadata, verifies backup and migration prerequisites, turns maintenance on, mutates hosted systems only after separate authorization, records each step as structured evidence, turns maintenance off on success or failure, and refuses PASS if any required evidence is stale or absent.

## Phase PHASE-6 Errors And Boundaries

Missing external authorization, missing backup, stale backup, backup project-ref mismatch, migration failure, cleanup residuals, deploy failure, smoke failure, auth callback wrong host, Android evidence missing, TalkBack evidence missing, iPhone PASS claim without physical evidence, or production GO claim fails Phase 6.

## Phase PHASE-6 Tests

Run activation tests locally. After separate external authorization, run real activation, live auth smoke, live dashboard smoke, header curl checks, contamination queries, Android Chrome validation, installed PWA validation, TalkBack validation, and final governance postflight.

<!-- GOV-REQ id="HSR11-601" -->
HSR11-601 passes only when apply evidence is real, release-bound, contamination-zero, live-auth verified, Android/PWA/TalkBack verified, and every blocked/skipped/simulated/stale condition is absent. iPhone remains `WAIVED_NOT_EXECUTED` unless separate physical iPhone evidence is supplied.

## Cross-Phase Dependencies

Phase 1 must close before Phase 2. Phase 2 must close before Phase 3. Phase 3 must close before Phase 4. Phase 4 must close before Phase 5. Phase 5 local implementation must close before Phase 6. External execution for Phases 5 and 6 requires a separate explicit user command.

## Cross-Phase Security And Privacy

All phases forbid secrets, PHI, raw health data, raw prompts, real user data in evidence, service-role substitution for end-user authorization, live billing, provider egress, and production readiness claims. Demo fixtures must remain synthetic.

## Review Policy

Independent review starts only when the user explicitly requests it. If no review is requested, records keep `independent_review: NOT_REQUESTED` and no review record is created.

# Cursor Protected Effect Governance Plan

Plan version: 1.0.0

Plan state: LOCKED_FOR_IMPLEMENTATION

<!-- GOV-PHASE id="CPEG-PHASE-1" title="Protected Effect Governance" -->

## purpose
<!-- GOV-SECTION id="purpose" -->

This one-phase plan changes Cursor governance from session-wide blocking to protected-effect enforcement. Cursor must be able to answer normal prompts, inspect non-secret files, research, and work outside MANU-AI without activation. Governance must engage only when an operation targets protected MANU-AI local state, MANU-AI-linked external effects, governance assets, secrets, or ambiguous commands that can mutate protected targets.

## scope
<!-- GOV-SECTION id="scope" -->

In scope:

- Make the enterprise Cursor guard choose protected targets from hook payloads and admin activation records, not from the enterprise hook process working directory.
- Allow ordinary prompts, empty-window sessions, non-MANU workspaces, and safe reads without activation.
- Keep protected MANU-AI file mutations, git mutations, governance tampering, secret reads, production/deploy/network effects, MCP effects, and subagent effects governed by exact locked scope.
- Add tests and red-team cases for empty workspace, outside workspace, ordinary prompt, protected MANU mutation denial, active-scope allowance, and cross-workspace protected targeting.
- Disable Cursor inline/Tab completions inside MANU-AI through workspace settings because Tab edits are only post-edit auditable.
- Install the updated enterprise guard when elevated access is available and verify ProgramData parity.

Out of scope:

- Hosted Sandbox Remediation v1.1 Phase 1 product work.
- Product app code, migrations, package manifests, lockfiles, workflows, production gate documents, Supabase remote changes, VPS changes, deploys, provider/channel egress, live billing, or real health-data operations.
- OS-level isolation against a hostile independent process running under the same Windows user.

## out-of-scope
<!-- GOV-SECTION id="out-of-scope" -->

This plan does not broaden Cursor's authority to edit outside active phase scope. It does not treat prompt text as scope authority. It does not make independent review PASS. It does not change production readiness.

## preconditions
<!-- GOV-SECTION id="preconditions" -->

- Current Git state is the local branch authority.
- The previous enterprise guard exists and verifies before implementation.
- Existing production status remains `NO-GO`.
- Independent review remains `NOT_REQUESTED` unless the user explicitly requests review.

## affected-files
<!-- GOV-SECTION id="affected-files" -->

Allowed code and configuration files are:

- `tools/execution-governance/secure-cursor-guard.mjs`
- `tools/execution-governance/install-secure-cursor-guard.mjs`
- `tools/execution-governance/activate-secure-cursor-guard.test.mjs`
- `tools/execution-governance/governance-hardening-red-team.mjs`
- `.vscode/settings.json`
- `docs/execution-governance/CURSOR_PROTECTED_EFFECT_GOVERNANCE_EVIDENCE.md`
- this plan package lifecycle and implementation records.

## architecture-decisions
<!-- GOV-SECTION id="architecture-decisions" -->

The guard must classify each hook event by target and effect:

- Normal prompt: always allowed unless it is explicit governed execution intent for a protected MANU-AI workspace.
- Read: allowed except secret-like paths.
- Outside MANU-AI operation: allowed unless it explicitly targets the protected MANU-AI root, protected Git state, or a MANU-AI-linked external effect.
- Protected mutation: denied unless an active signed scope permits the exact path or command.
- Shell/MCP/subagent: free outside protected targets only when the command is not ambiguous and does not target MANU-AI, production, deploy, Supabase, billing, provider egress, or governance mutation.

The protected root is resolved from hook payload `workspace_roots`, payload `cwd`, explicit paths, `CURSOR_PROJECT_DIR`, and the installed activation record. Enterprise hook `process.cwd()` is never sufficient authority because enterprise hooks run from ProgramData.

## rejected-alternatives
<!-- GOV-SECTION id="rejected-alternatives" -->

- Keep fail-closed for all Cursor sessions: rejected because it blocks normal chat and non-MANU work.
- Allow all shell commands outside MANU without inspection: rejected because `git -C`, absolute paths, and encoded protected paths can still target MANU-AI.
- Rely on `afterFileEdit` as the main protection: rejected because it is post-edit only.
- Remove enterprise guard: rejected because repo-local hooks are not the trust root.

## api-data-contracts
<!-- GOV-SECTION id="api-data-contracts" -->

No product API or database contract changes are allowed. Guard decisions remain Cursor hook JSON decisions with `permission`, `continue`, and `user_message`.

## ordered-steps
<!-- GOV-SECTION id="ordered-steps" -->

<!-- GOV-STEP id="CPEG-STEP-001" -->
1. Create and lock this single-phase plan package.

<!-- GOV-STEP id="CPEG-STEP-002" -->
2. Update the guard to use target/effect classification and protected root resolution.

<!-- GOV-STEP id="CPEG-STEP-003" -->
3. Update installer verification and workspace settings for the new event model and Tab-disable policy.

<!-- GOV-STEP id="CPEG-STEP-004" -->
4. Add tests and red-team cases for normal freedom and protected denial.

<!-- GOV-STEP id="CPEG-STEP-005" -->
5. Run acceptance, governance, installer, diff, secret, and status checks.

<!-- GOV-STEP id="CPEG-STEP-006" -->
6. Record evidence, lifecycle, and implementation outcomes.

## technical-methods
<!-- GOV-SECTION id="technical-methods" -->

The guard must:

- Parse hook payloads defensively and tolerate missing `workspace_roots`.
- Resolve candidate roots and paths with normalized Windows paths and realpath checks when files exist.
- Use activation `repoRoot` as the protected MANU-AI root when present.
- Avoid writing discovery activation for normal lifecycle events.
- Deny protected writes without active signed scope.
- Allow ordinary prompts and non-protected reads without activation.
- Continue enforcing secret path denials.
- Treat `git -C <protected-root>`, absolute protected paths, and commands mentioning protected paths as protected effects.

## data-control-flow
<!-- GOV-SECTION id="data-control-flow" -->

Cursor hook payload -> guard target/effect classifier -> protected root decision -> if not protected, allow; if protected read, deny only secrets; if protected mutation/effect, require active signed scope -> exact path/command match -> allow or deny.

## dependencies
<!-- GOV-SECTION id="dependencies" -->

No new runtime, npm, schema, database, CI, or network dependencies are allowed.

## state-transitions
<!-- GOV-SECTION id="state-transitions" -->

This plan transitions from `NOT_STARTED` to `EXECUTOR_VERIFIED` only when automated acceptance and governance checks pass. Independent review remains `NOT_REQUESTED`.

## errors-boundaries
<!-- GOV-SECTION id="errors-boundaries" -->

Malformed hook payloads fail closed only for protected or mutating operations. Ordinary prompts and outside operations must not fail because activation is inactive or missing.

## security-privacy
<!-- GOV-SECTION id="security-privacy" -->

No secrets, raw prompts, health data, file contents, or real user/client data may be logged. Evidence may summarize command status and non-sensitive guard decisions only.

## accessibility-localization
<!-- GOV-SECTION id="accessibility-localization" -->

No user-facing product UI is changed.

## migration-rollback
<!-- GOV-SECTION id="migration-rollback" -->

Rollback is source-control revert of this governance commit plus rerunning the previous verified installer if needed. Production is unaffected.

## tests
<!-- GOV-SECTION id="tests" -->

Required checks:

- `node --test tools/execution-governance/activate-secure-cursor-guard.test.mjs`
- `node tools/execution-governance/governance-hardening-red-team.mjs`
- `node tools/execution-governance/install-secure-cursor-guard.mjs --dry-run`
- `node tools/execution-governance/governance-cli.mjs doctor`
- `node tools/execution-governance/governance-cli.mjs validate`
- `node tools/execution-governance/governance-cli.mjs validate --all-plans`
- selected plan validation and run-checks
- `git diff --check`
- secret/scope/status checks

## acceptance-oracles
<!-- GOV-SECTION id="acceptance-oracles" -->

PASS requires fresh command exit code 0 for every automated oracle. Skipped, stale, blocked, simulated, or environment-blocked checks are not PASS.

## stop-completion
<!-- GOV-SECTION id="stop-completion" -->

Stop and report `CHANGE_REQUEST_REQUIRED` if product code, HSR Phase 1 scope, verifier behavior, package/dependency files, migrations, workflows, or production gates need changes.

<!-- GOV-REQ id="CPEG-001" -->
CPEG-001: Ordinary Cursor prompts, empty workspaces, non-MANU workspaces, and safe non-secret reads are allowed without active activation.

<!-- GOV-REQ id="CPEG-002" -->
CPEG-002: Protected MANU-AI local mutations and explicit protected shell/MCP/subagent effects are denied unless active signed scope permits the exact target.

<!-- GOV-REQ id="CPEG-003" -->
CPEG-003: Enterprise hook root resolution uses payload roots/targets and activation records, not ProgramData `process.cwd()` as repo authority.

<!-- GOV-REQ id="CPEG-004" -->
CPEG-004: Installer verification and workspace configuration support the protected-effect model and disable Cursor Tab-style inline writes inside MANU-AI.

<!-- GOV-REQ id="CPEG-005" -->
CPEG-005: Red-team and unit tests cover normal freedom, protected denial, active-scope allowance, cross-workspace targeting, secret denial, and production-effect denial.

<!-- GOV-REQ id="CPEG-006" -->
CPEG-006: Lifecycle, implementation report, and evidence record exact command outcomes and unchanged production boundaries.

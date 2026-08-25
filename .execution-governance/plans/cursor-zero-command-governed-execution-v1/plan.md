# Cursor Zero-Command Governed Execution Plan

Plan version: 1.0.0

Plan state: LOCKED_FOR_IMPLEMENTATION

<!-- GOV-PHASE id="CZC-PHASE-1" title="Cursor Zero-Command Governed Execution" -->

## purpose
<!-- GOV-SECTION id="purpose" -->

Create a single-phase governance implementation that lets the user open Cursor, provide a locked governed plan, and say `Bu planı uygula` without manually running PowerShell activation commands, selecting phase IDs, or managing scope files. The implementation preserves the admin-owned ProgramData Cursor guard, fail-closed behavior, phase-specific locked scope, production `NO-GO`, and user-owned final acceptance authority.

## scope
<!-- GOV-SECTION id="scope" -->

The phase changes only execution-governance protocol text, Cursor guard tooling, Cursor session tooling, broker tooling, installer packaging, governance tests, red-team coverage, the plan package, and one evidence document. It adds automatic prompt-intent routing, locked-plan resolution, next-phase resolution, discovery read-only guard behavior, and broker-mediated activation for the next runnable phase. Product application code, Supabase state, package manifests, lockfiles, migrations, provider egress, billing, deployment, and production gates stay unchanged.

## out-of-scope
<!-- GOV-SECTION id="out-of-scope" -->

The phase does not implement Hosted Sandbox Remediation v1.1 product requirements, does not change Next.js app behavior, does not alter tenant or account authorization, does not add dependencies, does not install package updates, does not change database schema, does not change GitHub workflows, does not push, does not deploy, does not open PRs, does not activate provider or channel egress, does not enable live billing, and does not process real health data. It also does not create a broad permanent Cursor write scope.

## preconditions
<!-- GOV-SECTION id="preconditions" -->

The repository must be on `codex/stage-4c-remediation`. The worktree must start clean before implementation. `node tools/execution-governance/governance-cli.mjs doctor` and `node tools/execution-governance/governance-cli.mjs validate` must pass before implementation. The plan package must validate and must be committed as a separate plan-lock commit before implementation changes begin. Independent review remains `NOT_REQUESTED` unless the user explicitly requests review.

## affected-files
<!-- GOV-SECTION id="affected-files" -->

Implementation may modify `AGENTS.md`, `docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md`, `tools/execution-governance/governance-cli.mjs`, `tools/execution-governance/secure-cursor-guard.mjs`, `tools/execution-governance/install-secure-cursor-guard.mjs`, `tools/execution-governance/cursor-session.mjs`, `tools/execution-governance/cursor-session-broker.mjs`, `tools/execution-governance/cursor-session.test.mjs`, and `tools/execution-governance/governance-hardening-red-team.mjs`. It may create `tools/execution-governance/cursor-plan-resolver.mjs`, `tools/execution-governance/cursor-plan-resolver.test.mjs`, `.cursor/skills/manu-governed-execution/SKILL.md`, `.execution-governance/plans/cursor-zero-command-governed-execution-v1/` records, and `docs/execution-governance/CURSOR_ZERO_COMMAND_GOVERNED_EXECUTION_EVIDENCE.md`.

## architecture-decisions
<!-- GOV-SECTION id="architecture-decisions" -->

The user prompt is an intent signal only. The implementation must never derive allowed paths, commands, MCP tools, subagent policy, production permissions, or phase authority from natural language. The resolver selects a plan only when exactly one locked runnable plan is identifiable from the prompt attachment or current repository state. The resolver selects the next phase from machine records in `contract.json` and `lifecycle-record.json`; it rejects ambiguity instead of guessing. The guard adds `DISCOVERY_READ_ONLY` so safe reads and governance status checks can run before activation while writes, secret-like reads, network-capable commands, external effects, and production actions remain denied. Activation still writes `ACTIVE_SIGNED_SCOPE` and contains only the selected phase's scope from locked `scope.json`.

## rejected-alternatives
<!-- GOV-SECTION id="rejected-alternatives" -->

A permanent repository-wide Cursor scope is rejected because it would weaken phase isolation. Using the prompt text to create or expand scope is rejected because it would make natural language a security boundary. Keeping manual `activate-cursor --phase-id` as the user workflow is rejected because it preserves the user-experience failure. Removing ProgramData guard enforcement is rejected because it would remove the trust root. Auto-running push, deploy, migration apply, live provider calls, or production gates is rejected because those actions require separate explicit user commands.

## api-data-contracts
<!-- GOV-SECTION id="api-data-contracts" -->

`cursor-plan-resolver.mjs` exposes dependency-free functions and a CLI report with `status`, `repoRoot`, `intent`, `planDir`, `contractId`, `phaseId`, `reason`, and `checks`. `cursor-session.mjs` adds `auto-preflight`, `auto-activate`, and `auto-open` commands that call the resolver and then the broker. `cursor-session-broker.mjs` accepts a resolver-approved request containing `repoRoot`, `planDir`, `phaseId`, `lockCommit`, and `requestNonce`; it validates hashes, Git ancestry, phase membership, safe paths, command specs, and selected scope before writing activation. The guard accepts `DISCOVERY_READ_ONLY` activation shape with empty write scope and a fixed safe-read command allowlist.

## ordered-steps
<!-- GOV-SECTION id="ordered-steps" -->

<!-- GOV-STEP id="CZC-STEP-001" -->
1. Update the governance protocol and root agent instructions to authorize plan-level Cursor execution intent while preserving phase-specific technical activation.

<!-- GOV-STEP id="CZC-STEP-002" -->
2. Add the plan resolver that detects governed execution intent, enumerates locked plan packages, rejects ambiguous or unlocked plans, and returns the next runnable phase.

<!-- GOV-STEP id="CZC-STEP-003" -->
3. Extend Cursor session tooling so `auto-preflight`, `auto-activate`, and `auto-open` require no user-supplied phase ID and call the resolver before broker activation.

<!-- GOV-STEP id="CZC-STEP-004" -->
4. Extend the broker and guard so discovery read-only mode allows safe governance discovery and active signed scope still gates writes, shell, MCP, and subagent tools.

<!-- GOV-STEP id="CZC-STEP-005" -->
5. Extend installer packaging and Cursor workspace skill text so a normal Cursor prompt can route to the automatic governed execution flow.

<!-- GOV-STEP id="CZC-STEP-006" -->
6. Add tests and red-team coverage for automatic plan resolution, ambiguous plan denial, unlocked plan denial, discovery read-only behavior, prompt-scope non-authority, and forbidden production operations.

<!-- GOV-STEP id="CZC-STEP-007" -->
7. Run required checks, record exact command outcomes, update lifecycle and implementation records, and leave production boundaries unchanged.

## technical-methods
<!-- GOV-SECTION id="technical-methods" -->

Use dependency-free Node.js modules and `spawnSync` with `shell: false`. Normalize repository-relative paths before any comparison. Use structured JSON parsing for plan, contract, scope, acceptance, lifecycle, and lock files. Treat missing lifecycle records as `NOT_STARTED` only when the corresponding contract phase is locked and the lock hashes match. Write activation through the existing broker atomic temporary-file pattern. Keep runtime outputs under ignored `.execution-governance/runtime/`.

## data-control-flow
<!-- GOV-SECTION id="data-control-flow" -->

Cursor receives the user prompt. The workspace skill and hook route governed execution intent to `cursor-session auto-preflight`. The resolver reads only plan package machine records and Git state. When exactly one next phase is selected, `cursor-session auto-activate` asks the broker to create an `ACTIVE_SIGNED_SCOPE` activation. Cursor tools then operate under the existing guard. After phase closure, the lifecycle record moves the completed phase forward, and the next prompt repeats resolver selection without user phase management.

## dependencies
<!-- GOV-SECTION id="dependencies" -->

The phase depends on local Git, Node.js, PowerShell only for existing Windows installer surfaces, the existing governance CLI, the existing ProgramData guard model, Cursor hooks, Cursor skills, and local filesystem ACL behavior. It introduces no npm dependency and no external network requirement. Web research sources used for the design are Cursor Hooks, Cursor Skills, Cursor Plugins, Cursor Run Modes, Microsoft Windows service security, and Microsoft local IPC documentation.

## state-transitions
<!-- GOV-SECTION id="state-transitions" -->

The new plan starts as `LOCKED_FOR_IMPLEMENTATION` after the plan-lock commit. Implementation starts only after preflight passes. Cursor external state may move from `INACTIVE_FAIL_CLOSED` to `DISCOVERY_READ_ONLY` for safe discovery, then to `ACTIVE_SIGNED_SCOPE` for the selected phase. Phase implementation may move from `NOT_STARTED` to `IN_PROGRESS`, then to `EXECUTOR_VERIFIED` only after required checks pass. Independent review remains `NOT_REQUESTED` unless the user explicitly requests review.

## errors-boundaries
<!-- GOV-SECTION id="errors-boundaries" -->

Resolver ambiguity returns `CHANGE_REQUEST_REQUIRED` before activation. Missing lock files, hash mismatch, stale base commit without ancestor allowance, missing phase scope, unlocked plan state, protected path edits, secret-like reads, network-capable commands under forbidden policy, production actions, and prompt-derived scope requests return `BLOCKED` or `FAIL` without writing activation. If the implementation discovers that Cursor hooks cannot route prompt intent without a repo skill or command handoff, it must create a verifier-change request before changing the acceptance oracle.

## security-privacy
<!-- GOV-SECTION id="security-privacy" -->

The implementation must not read `.env`, private key, credential, secret-like, raw prompt log, raw health data, real user data, or file contents containing sensitive data. It must not log raw prompts or health data. The prompt intent parser records only a boolean governed-execution intent and optional plan path hints. The broker rejects absolute paths outside the repository, path traversal, unsafe command specs, shell metacharacter executables, and scope values not present in locked `scope.json`.

## accessibility-localization
<!-- GOV-SECTION id="accessibility-localization" -->

The user-facing text must be short Turkish-compatible console or Cursor response text. It must clearly state `READY`, `BLOCKED`, or `CHANGE_REQUEST_REQUIRED` and the blocking reason. No product UI accessibility or localization behavior changes in this phase.

## migration-rollback
<!-- GOV-SECTION id="migration-rollback" -->

Rollback is reverting the new resolver, session, broker, guard, installer, skill, test, protocol, plan-record, and evidence changes, then writing `INACTIVE_FAIL_CLOSED` through the broker. There is no database migration, package migration, remote migration, deployment migration, or production rollback.

## tests
<!-- GOV-SECTION id="tests" -->

Run `node --test tools/execution-governance/cursor-plan-resolver.test.mjs`, `node --test tools/execution-governance/cursor-session.test.mjs`, `node --test tools/execution-governance/activate-secure-cursor-guard.test.mjs`, `node tools/execution-governance/governance-hardening-red-team.mjs`, `node tools/execution-governance/governance-cli.mjs doctor`, `node tools/execution-governance/governance-cli.mjs validate`, `node tools/execution-governance/governance-cli.mjs validate --all-plans`, `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/cursor-zero-command-governed-execution-v1 --phase-id CZC-PHASE-1`, `node tools/execution-governance/install-secure-cursor-guard.mjs --dry-run`, `git diff --check`, and `git status --short --branch`.

## acceptance-oracles
<!-- GOV-SECTION id="acceptance-oracles" -->

Acceptance requires exit code 0 for resolver tests, cursor session tests, guard activation tests, governance red-team, governance doctor, governance validate, all-plan validation, selected-plan validation, installer dry-run, and diff hygiene. Tests must assert that automatic activation picks only the next locked phase, rejects ambiguity, rejects unlocked plans, blocks prompt-derived scope, preserves secret-read denial, preserves production-operation denial, and keeps skipped or blocked checks out of PASS.

## stop-completion
<!-- GOV-SECTION id="stop-completion" -->

Stop before product app changes, package manifest changes, lockfile changes, migration changes, GitHub workflow changes, production gate changes, provider or billing activation, push, deploy, merge, PR creation, branch protection changes, or real health-data processing. Complete only when the plan package validates, implementation files stay inside scope, automated checks pass, lifecycle and implementation reports are current, evidence records exact command outcomes, and the worktree contains only authorized governance UX changes.

<!-- GOV-REQ id="CZC-001" -->
CZC-001 requires governance authority text to permit user plan-level execution intent while preserving phase-specific locked technical activation.

<!-- GOV-REQ id="CZC-002" -->
CZC-002 requires a resolver that maps governed execution intent to exactly one locked plan and one next runnable phase without using prompt text as scope authority.

<!-- GOV-REQ id="CZC-003" -->
CZC-003 requires Cursor session commands that run automatic preflight, activation, and open flows without user-supplied phase IDs.

<!-- GOV-REQ id="CZC-004" -->
CZC-004 requires guard and broker support for discovery read-only mode and active signed phase scope without weakening secret, write, shell, MCP, subagent, or production denials.

<!-- GOV-REQ id="CZC-005" -->
CZC-005 requires installer and Cursor skill packaging that expose the natural Cursor workflow `Bu planı uygula`.

<!-- GOV-REQ id="CZC-006" -->
CZC-006 requires automated tests and red-team coverage for automatic resolution, denial cases, discovery mode, and prompt-scope non-authority.

<!-- GOV-REQ id="CZC-007" -->
CZC-007 requires lifecycle, implementation report, and evidence records with exact command outcomes and unchanged production boundaries.

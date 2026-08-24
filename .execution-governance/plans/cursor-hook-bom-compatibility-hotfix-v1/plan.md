# Cursor Hook BOM Compatibility Hotfix

Plan version: 1.0.0

Plan state: READY_FOR_IMPLEMENTATION

Final acceptance authority: user

Independent review default: NOT_REQUESTED

## Authority Sources

- User approval on 2026-08-25 to make the Cursor governance hook compatible with BOM-prefixed JSON hook payloads without weakening governance boundaries.
- AGENTS.md
- docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md
- docs/execution-governance/LIFECYCLE_AND_OPTIONAL_REVIEW_FLOW.md
- docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md
- docs/execution-governance/PHASE_3_CODEX_CURSOR_ADAPTERS_EVIDENCE.md
- docs/execution-governance/PHASE_6_RED_TEAM_PILOT_CLOSURE_EVIDENCE.md

## Scope Summary

- In scope: make `.cursor/hooks/governance-guard.mjs` parse a single leading UTF-8 BOM (`U+FEFF`) before JSON parsing for hook stdin payloads and active scope files; add deterministic red-team regression coverage for BOM-prefixed allowed and denied hook scenarios; document the hotfix evidence and residual risk state.
- Out of scope: product code, UI, API routes, migrations, app package manifests, lockfiles, dependency installation or update, Supabase push/reset, Git push, merge, deploy, production readiness gates, provider/channel egress, live billing, and real health-data processing.
- Blocked decisions: no production activation, no remote CI assertion, no branch protection change, no Hosted Sandbox implementation phase, and no independent review unless the user explicitly requests it.

## Requirement Ledger

| Requirement ID | Classification | Observable requirement | Dependencies |
| --- | --- | --- | --- |
| CHBOM-001 | IN_SCOPE | The Cursor governance guard accepts valid hook JSON payloads whose first character is `U+FEFF`, while malformed JSON still fails closed. | [] |
| CHBOM-002 | IN_SCOPE | The Cursor governance guard parses a BOM-prefixed `.execution-governance/active/scope.json` and still enforces allowed, protected, and outside-scope mutation boundaries. | [CHBOM-001] |
| CHBOM-003 | IN_SCOPE | The red-team harness contains BOM regression scenarios for allowed reads/mutations, active-scope enforcement, and negative controls for unsafe shell, secret reads, product writes, and malformed payloads. | [CHBOM-001, CHBOM-002] |
| CHBOM-004 | IN_SCOPE | Governance documentation records the hotfix evidence, confirms no product/runtime scope changed, and tracks the mitigated Cursor BOM compatibility risk. | [CHBOM-003] |

## Implementation Phase

### Phase 1: Cursor Hook BOM Compatibility Hotfix

Purpose:

- Remove the Cursor hook failure mode where otherwise valid hook payloads are denied only because the JSON text starts with a UTF-8 BOM.
- Preserve the fail-closed behavior for malformed JSON, secret reads, unsafe shell commands, product writes without active scope, protected paths, dependency changes, migrations, deploys, and Git push/merge operations.

Allowed files:

- `.cursor/hooks/governance-guard.mjs`
- `tools/execution-governance/red-team-harness.mjs`
- `docs/execution-governance/CURSOR_HOOK_BOM_COMPATIBILITY_HOTFIX_EVIDENCE.md`
- `docs/RISK_REGISTER.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `.execution-governance/plans/cursor-hook-bom-compatibility-hotfix-v1/lifecycle-record.json`
- `.execution-governance/plans/cursor-hook-bom-compatibility-hotfix-v1/implementation-report.json`

Protected files:

- `.execution-governance/policy/governance-policy.json`
- `.execution-governance/schemas/**`
- `.execution-governance/templates/**`
- `.github/workflows/execution-governance.yml`
- `tools/execution-governance/governance-cli.mjs`
- `AGENTS.md`
- `app/**`
- `dietitian-ai-assistant/**`
- `package.json`
- `app/package.json`
- `app/package-lock.json`
- `app/supabase/migrations/**`

Commands:

- `node tools/execution-governance/governance-cli.mjs preflight --plan-dir .execution-governance/plans/cursor-hook-bom-compatibility-hotfix-v1 --allow-dirty`
- `node tools/execution-governance/governance-cli.mjs run-checks --plan-dir .execution-governance/plans/cursor-hook-bom-compatibility-hotfix-v1`
- `node tools/execution-governance/governance-cli.mjs postflight --plan-dir .execution-governance/plans/cursor-hook-bom-compatibility-hotfix-v1`
- `node tools/execution-governance/governance-cli.mjs doctor`
- `node tools/execution-governance/governance-cli.mjs validate`
- `node tools/execution-governance/red-team-harness.mjs`
- `git diff --check`
- `git status --short --branch`

Technical method:

- Add one shared parser helper in `.cursor/hooks/governance-guard.mjs` named `parseJsonText(value)`.
- `parseJsonText(value)` must convert the input to a string, remove exactly one leading `U+FEFF` when present at index `0`, and call `JSON.parse()` on the resulting text.
- `readStdinJson()` must continue to resolve `{}` when stdin is empty or whitespace-only, and must reject malformed payloads with `invalid JSON payload: ...`.
- `loadActiveScope()` must read `.execution-governance/active/scope.json` as UTF-8 and call `parseJsonText()` before building its allowed/protected path sets.
- Do not strip BOM characters that appear after index `0`; those remain normal JSON content and must not become a broad sanitizer.

Data and control flow:

- Cursor invokes `.cursor/hooks/governance-guard.mjs <event>` and writes hook payload JSON to stdin.
- The guard reads stdin as UTF-8, strips only a leading BOM, parses JSON, and routes to `guardRead`, `guardShell`, or `guardFileMutation`.
- `guardFileMutation` optionally loads `.execution-governance/active/scope.json`, strips only a leading BOM before parsing, then enforces the existing `allowedCreatePaths`, `allowedModifyPaths`, and `protectedPaths` sets.
- The decision output remains the existing JSON shape: `{ "permission": "allow" | "deny", "user_message": string }`.

Error and boundary cases:

- Empty stdin returns `{}` and remains allowed or denied according to the event-specific existing behavior.
- `"\uFEFF{"` with otherwise valid JSON must parse.
- `"{"` must still exit `2` and emit a deny decision containing `governance guard failed closed`.
- BOM-prefixed secret read for `.env` must still exit `2`.
- BOM-prefixed unsafe shell command such as `git push origin main` must still exit `2`.
- BOM-prefixed product write without active scope must still exit `2`.
- BOM-prefixed active scope must allow only listed paths and deny protected or unlisted paths.

Acceptance:

- `node tools/execution-governance/red-team-harness.mjs` must pass and print BOM-specific PASS scenarios.
- `node tools/execution-governance/governance-cli.mjs doctor` must pass.
- `node tools/execution-governance/governance-cli.mjs validate` must pass.
- `git diff --check` must pass.
- `git status --short --branch` must show only the files allowed by this plan before the implementation commit.

Stop criteria:

- Stop before editing any product code, migration, package manifest, lockfile, schema, template, workflow, governance CLI, provider/channel integration, Supabase remote state, VPS state, or production gate.
- Stop and create a scope-change request if the fix requires any file outside the allowed files list.
- Stop and create a verifier-change request if the acceptance oracle needs to broaden beyond the red-team BOM scenarios named by this plan.
- Stop if any acceptance command fails or is blocked.

## Review Policy

Independent review starts only when the user explicitly requests it. If not requested, record `independent_review: NOT_REQUESTED` and do not create a review record.

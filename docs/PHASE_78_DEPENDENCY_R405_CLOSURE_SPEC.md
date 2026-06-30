# Phase 78 Dependency And R-405 Closure Spec

Date: 2026-06-29

## Goal

Re-run the accepted Phase 22 R-405 dependency remediation procedure and either close R-405 through a safe stable Next.js/PostCSS patch path or record that no accepted technical remediation is currently available.

This phase does not approve production pilot launch, connect WhatsApp, connect Gemini, process real client health data, close any launch gate, accept R-405, or change production operations status.

## Current Result

Phase 78 is a no-patch closure.

Commands run from `app` on 2026-06-29:

```powershell
npm view next@latest version dependencies --json
npm view eslint-config-next@latest version --json
npm audit --omit=dev --json
```

Observed results:

- `next@latest` is stable `16.2.9`.
- `next@latest` still depends on nested `postcss@8.4.31`.
- `eslint-config-next@latest` is stable `16.2.9`.
- `npm audit --omit=dev --json` still reports only the known moderate R-405 production findings:
  - `next`
  - `postcss:GHSA-qx2v-qp2m-jg93`
- npm still proposes the rejected semver-major `next@9.3.3` path.

## Decision

Do not change dependency files in Phase 78.

The accepted technical remediation path in `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md` requires stable `next@latest` to bundle `postcss >= 8.5.10`. Stable Next.js does not meet that condition on 2026-06-29.

Rejected paths remain rejected:

- `npm audit fix --force`.
- Downgrade to `next@9.3.3`.
- Canary, beta, or release-candidate Next.js as the pilot baseline.
- Invalid npm overrides that break the npm dependency tree.
- Treating the release verification allowlist as R-405 resolution.

## Gate Impact

- R-405 remains open.
- `dependency_audit_clearance` remains open.
- Production pilot remains `NO-GO`.
- Real WhatsApp, Telegram, Gemini, monitoring, secret manager, backup provider, and real client health data remain disconnected.
- Formal external R-405 risk acceptance remains allowed only as sanitized external gate evidence; Codex cannot self-approve it.

## Verification Plan

Required Phase 78 checks:

- `git diff --check`
- `npm run release:verify` from `app`

Expected audit behavior:

- If dependency files remain unchanged and the audit still reports only the documented R-405 findings, the release verification gate may pass with the existing known-finding allowlist.
- Any new production audit finding, high/critical finding, or changed advisory shape must fail closed and be investigated before Phase 78 can close.

## Verification Result

Verified on 2026-06-29:

- `git diff --check` passed, with Windows line-ending warnings only.
- First `npm run release:verify` attempt timed out after 300 seconds without producing a failure result.
- Second `npm run release:verify` attempt passed with a 600-second timeout:
  - Core package tests: 225/225 passed.
  - App tests: 73 files passed; 428 tests passed and 2 skipped.
  - App lint: passed with two pre-existing warnings.
  - Production build: passed.
  - Production dependency audit gate: passed with only the documented R-405 `next`/`postcss` findings.

## Done Criteria

- Phase 22 recheck evidence is recorded.
- R-405 remains explicitly open because no safe stable patch exists.
- Dependency files remain unchanged.
- Continuity, pilot evidence, gate, final readiness, risk, and dependency clearance docs record the 2026-06-29 recheck.
- Production pilot remains `NO-GO`.

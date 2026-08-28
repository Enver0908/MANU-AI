# Phase 32 - Completion Roadmap Phase 3: R-405 Stable Patch Recheck

Date: 2026-05-31

## Goal

Run Completion Roadmap Phase 3 by rechecking whether R-405 can be safely remediated through the documented Phase 22 stable Next.js/PostCSS procedure.

## Scope

This phase is dependency evidence and documentation only.

In scope:

- Re-read `PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Check current npm metadata for `next@latest`.
- Check current npm metadata for `eslint-config-next@latest`.
- Run production dependency audit.
- Decide whether dependency files may be changed.
- Update R-405 evidence documentation.

Out of scope:

- `npm audit fix --force`.
- Canary, beta, or release-candidate Next.js adoption.
- Major downgrade paths.
- npm overrides for nested PostCSS.
- R-405 formal risk acceptance.
- R-406 local Supabase evidence remediation.
- Runtime behavior, schema, provider, channel, launch-gate, or real-data changes.

## Phase 22 Procedure Result

Commands run from `app`:

```text
npm view next@latest version dependencies --json
npm view eslint-config-next@latest version --json
npm audit --omit=dev --json
```

Results:

- `next@latest` is `16.2.6`.
- `next@latest` still depends on `postcss@8.4.31`.
- `eslint-config-next@latest` is `16.2.6`.
- Production audit still reports only the known R-405 findings:
  - `next`
  - `postcss` advisory `GHSA-qx2v-qp2m-jg93`
- `npm audit` still proposes a semver-major downgrade to `next@9.3.3`, which remains rejected.

## Decision

No dependency files were changed.

R-405 remained an open production launch blocker at this historical checkpoint because the only accepted technical remediation path was not available: stable `next@latest` did not yet bundle `postcss >= 8.5.10`. Current R-405 technical status is governed by the later Stage 5 dependency report.

## Edge Cases

- If a canary or prerelease contains patched PostCSS, it is still rejected for this pilot baseline.
- If `npm audit fix --force` proposes a downgrade, it remains rejected.
- If a manual override appears to remove the advisory but invalidates the npm tree, it remains rejected.
- If external leadership accepts R-405 formally, that is external gate evidence, not a technical remediation.

## Verification

Completed after documentation updates:

```text
npm run release:verify
```

Expected status:

- Core tests pass: 49/49.
- App tests pass: 103/103.
- Lint passes.
- Production build passes.
- Production dependency audit reports only documented R-405 findings.
- R-405 remains a production launch blocker.
- R-406 remains blocked until local Supabase RLS execution passes.

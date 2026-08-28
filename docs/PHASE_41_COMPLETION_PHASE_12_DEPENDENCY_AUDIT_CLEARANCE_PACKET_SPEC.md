# Phase 41 / Completion Roadmap Phase 12 - Dependency Audit Clearance Packet Spec

Date: 2026-05-31

## Goal

Prepare the `dependency_audit_clearance` launch gate for engineering/security review and re-check R-405 through the accepted stable Next.js/PostCSS procedure.

This phase records current dependency-audit evidence only. It does not approve R-405, apply a canary release, run `npm audit fix --force`, add invalid overrides, or downgrade Next.js.

## Scope

In scope:

- Re-read the Phase 22 R-405 remediation procedure.
- Re-check `next@latest`, `eslint-config-next@latest`, and production audit output.
- Create a dependency-audit clearance review packet that separates current internal evidence from external risk acceptance or technical remediation.
- Update the production pilot dossier, evidence pack, approval intake, risk register, plans, app README, and handoff notes.

Out of scope:

- Dependency file edits unless stable `next@latest` bundles `postcss >= 8.5.10`.
- `npm audit fix --force`.
- Next.js canary, beta, rc, major downgrade, or invalid npm override.
- R-405 formal risk acceptance by Codex.
- Runtime behavior, schema, provider, channel, launch-gate approval, or real-client-data changes.

## Current Check Results

Commands run from `app` on 2026-05-31:

```powershell
npm view next@latest version dependencies --json
npm view eslint-config-next@latest version --json
npm audit --omit=dev --json
```

Results:

- `next@latest`: `16.2.6`.
- `next@latest` dependency on `postcss`: `8.4.31`.
- `eslint-config-next@latest`: `16.2.6`.
- Production audit still reports only known moderate `next` / `postcss` R-405 findings.
- npm still proposes a rejected semver-major downgrade to `next@9.3.3`.

## Decision

No dependency files are changed in this phase because the accepted stable remediation path is not available.

At this historical checkpoint, R-405 remained an open production launch blocker until one of these happened:

- A stable Next.js release bundles `postcss >= 8.5.10`, then `next` and `eslint-config-next` are updated together and production audit is clean.
- External engineering/security approval formally accepts R-405 risk for the production pilot.

## Edge Cases

- A passing `npm run release:verify` result does not resolve R-405 because the release gate currently allowlists only the known R-405 findings.
- At this historical checkpoint, `npm audit --omit=dev --json` returning exit code 1 was expected while R-405 remained open.
- Canary Next.js may contain a patched PostCSS path but remains rejected as pilot baseline.
- `npm audit fix --force` remains rejected because it proposes an incompatible major downgrade.
- R-406 remains separate and still requires passing local Supabase RLS evidence.

## Done Criteria

- `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md` exists.
- The external approval intake references the dependency audit clearance packet while keeping `dependency_audit_clearance` open.
- The production pilot dossier and evidence pack include the packet as internal evidence, not approval.
- Plans, risk register, app README, and handoff notes reflect Phase 41.
- `npm run release:verify` passes with only documented R-405 findings.

## Verification

`npm run release:verify` passed on 2026-05-31 after the Phase 41 documentation update:

- Core package tests: 49/49 passed.
- App tests: 103/103 passed.
- App lint: passed.
- Production build: passed.
- Production dependency audit: passed with only documented R-405 findings.

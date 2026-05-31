# Phase 22 R-405 Dependency Remediation Spec

## Goal

Resolve or keep safely gated the R-405 production dependency audit finding caused by Next.js bundling a vulnerable PostCSS version.

## Current Finding

- `npm audit --omit=dev --json` reports two moderate production findings:
  - `next:postcss`
  - `postcss:GHSA-qx2v-qp2m-jg93`
- The affected installed path is `node_modules/next/node_modules/postcss`.
- The advisory range is `postcss <8.5.10`.
- Current `next@latest`, rechecked on 2026-05-31 during Completion Roadmap Phase 3, is `16.2.6` and still depends on `postcss@8.4.31`.
- Current `eslint-config-next@latest`, rechecked on 2026-05-31 during Completion Roadmap Phase 3, is `16.2.6`.
- The canary path has previously exposed patched PostCSS, but canary is not accepted as a pilot baseline.

References:

- GitHub Advisory: `https://github.com/advisories/GHSA-qx2v-qp2m-jg93`
- Vercel Next.js issue: `https://github.com/vercel/next.js/issues/93234`

## Evaluated Options

| Option | Decision | Reason |
| --- | --- | --- |
| Wait for stable Next.js patch and upgrade `next` plus `eslint-config-next` together | Accepted path | Keeps framework tree valid and avoids canary/breaking behavior |
| Move to `next@16.3.0-canary.32` | Rejected for now | Patched PostCSS exists there, but canary is not a safe pilot baseline |
| Run `npm audit fix --force` | Rejected | npm proposes a semver-major downgrade to `next@9.3.3`, which is not compatible with the app |
| Add npm override for nested PostCSS | Rejected for now | Previous project decision found this invalidates the npm tree; do not use unless npm can keep `npm ls` valid |
| Formal R-405 risk acceptance | Allowed only as external gate evidence | This does not technically remediate the finding and cannot be self-approved by Codex |

## Stable Patch Procedure

Run these checks before any dependency edit:

```powershell
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\app"
npm view next@latest version dependencies --json
npm view eslint-config-next@latest version --json
```

Proceed only if all are true:

- `next@latest` is a stable release, not `canary`, `beta`, or `rc`.
- `next@latest` depends on `postcss >= 8.5.10`.
- `eslint-config-next@latest` has the same stable version as `next@latest` or a documented compatible version.

When true:

1. Update `app/package.json` exact versions for `next` and `eslint-config-next`.
2. Run `npm install` from `app` to update `package-lock.json`.
3. Run `npm audit --omit=dev --json` and confirm R-405 is gone.
4. Run `npm run release:verify`.
5. If release verification passes, update R-405 in `docs/RISK_REGISTER.md` and the pilot evidence/gate docs.

## If Stable Patch Is Not Available

- Do not change dependency files.
- Keep R-405 open as a production launch blocker.
- Keep `npm run release:verify` allowlisting only the known R-405 findings.
- Re-check npm metadata before production pilot or whenever a new stable Next.js release appears.

## Done Criteria

- R-405 is considered technically resolved only when production audit no longer reports `next:postcss` or `postcss:GHSA-qx2v-qp2m-jg93`.
- If no stable patch exists, documentation records the latest check and keeps the gate open.
- No real provider, channel, monitoring, secret manager, email, push, or real health data is connected as part of this work.

# Phase 48 R-405 Stable Patch Recheck Spec

Date: 2026-06-01

## Goal

Re-check R-405 through the accepted stable Next.js/PostCSS procedure after Phase 46/47, without changing dependency files unless a safe stable patch path exists.

This phase does not approve production pilot launch, R-405 risk acceptance, real WhatsApp/Telegram messaging, real provider use, R-406 mitigation, or real client health-data processing.

## Accepted Path

- Upgrade `next` and `eslint-config-next` together only when stable Next.js bundles `postcss >= 8.5.10`.
- Require a clean production audit after the dependency update.
- Require `npm run release:verify` after the dependency update.

## Current Result

Commands run from `app` on 2026-06-01:

```text
npm view next@latest version dependencies --json
npm view eslint-config-next@latest version --json
npm audit --omit=dev --json
```

Observed result:

- `next@latest` is `16.2.7`.
- `eslint-config-next@latest` is `16.2.7`.
- Stable Next.js still bundles nested `postcss@8.4.31`.
- Production audit still reports only the known moderate `next` / `postcss` findings.
- npm still proposes the rejected semver-major `next@9.3.3` path.

## Decision

Do not edit dependency files in this phase.

R-405 remains open until a stable Next.js release bundles `postcss >= 8.5.10`, or formal external risk acceptance is supplied.

# MANU-AI Production Pilot Dependency Audit Clearance Packet

Date: 2026-05-31

## Status

This packet prepares the `dependency_audit_clearance` launch gate for engineering/security review.

It does not resolve or accept R-405.

No dependency files were changed.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, backup provider, or real client health data is connected.

The `dependency_audit_clearance` launch gate remains open until acceptable technical remediation or formal external risk acceptance is supplied.

## Review Objective

Engineering/security reviewers must decide whether R-405 is technically remediated through a safe stable Next.js/PostCSS upgrade, or formally accepted as a production pilot risk.

The default answer remains blocked.

## Internal Evidence

| Evidence | Relevance |
| --- | --- |
| `PHASE_19_RELEASE_VERIFICATION_DEPENDENCY_GATE_SPEC.md` | Documents repeatable release verification and production dependency audit gate behavior. |
| `PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md` | Defines accepted and rejected R-405 remediation paths. |
| `PHASE_32_COMPLETION_PHASE_3_R405_RECHECK_SPEC.md` | Records the previous stable metadata recheck. |
| `PHASE_48_R405_STABLE_PATCH_RECHECK_SPEC.md` | Records the latest stable metadata recheck after Phase 46/47. |
| `RISK_REGISTER.md` | Tracks R-405 as an open production launch blocker. |
| `npm run release:verify` | Current local release gate; passes while reporting only known R-405 findings. |

Internal evidence supports review, but it is not dependency audit clearance.

## Current R-405 Evidence

Commands run from `app` on 2026-06-01:

```powershell
npm view next@latest version dependencies --json
npm view eslint-config-next@latest version --json
npm audit --omit=dev --json
```

Results:

- `next@latest` is `16.2.7`.
- Stable Next.js still depends on nested `postcss@8.4.31`.
- `eslint-config-next@latest` is `16.2.7`.
- `npm audit --omit=dev --json` reports two known moderate production findings:
  - `next`
  - `postcss:GHSA-qx2v-qp2m-jg93`
- npm still proposes `next@9.3.3` as a semver-major fix, which remains rejected.

## Required External Decision

The approval artifact must explicitly cover one of these outcomes:

- Technical remediation: stable Next.js bundles `postcss >= 8.5.10`, dependency files are updated, production audit is clean, and `npm run release:verify` passes.
- Formal risk acceptance: engineering/security approver accepts R-405 for the production pilot with rationale, compensating controls, expiry/review date, and owner.

## Rejected Paths

- `npm audit fix --force`.
- Downgrading to `next@9.3.3`.
- Canary, beta, or release-candidate Next.js as pilot baseline.
- Invalid npm overrides that break `npm ls`.
- Marking R-405 resolved because `npm run release:verify` passes with the known allowlisted finding.

## Missing Before Gate Closure

The gate cannot close until the user supplies acceptable evidence covering:

- Clean production audit after safe stable remediation, or formal external R-405 risk acceptance.
- Current `npm run release:verify` result after any dependency or acceptance-related change.
- Engineering/security owner.
- Review expiry if risk is accepted.
- R-406 passing local Supabase RLS evidence remains separately required for production pilot evidence.

## Sanitization Rules

Do not paste any of the following into repository documentation:

- Private security approval threads that should remain outside the repo.
- Non-public vulnerability details.
- Secret values or CI tokens from audit/build environments.
- Real client identifiers or health data.

Record only sanitized artifact references in `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`.

## Non-Approval Statement

This packet does not approve production pilot launch, R-405 risk acceptance, dependency audit clearance, real health-data processing, real provider calls, real channel messaging, external monitoring, backup provider setup, or secret manager use.

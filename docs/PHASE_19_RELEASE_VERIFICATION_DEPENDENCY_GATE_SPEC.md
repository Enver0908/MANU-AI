# MANU-AI Phase 19 Release Verification And Dependency Gate Spec

## Goal

Add a repeatable local release verification command and conservative dependency audit gate without applying risky dependency fixes.

## Scope

- Add a local release verification script.
- Run core package tests, lint, unit/API tests, production build, and production dependency audit from one command.
- Treat the known Next.js nested PostCSS advisory as a documented open blocker instead of auto-fixing it.
- Fail on unknown production audit vulnerabilities.
- Fail on high or critical production audit vulnerabilities.
- Keep RLS and visual tests as separate explicit commands because they depend on local Supabase/browser setup and can be slower.

## Non-Goals

- No GitHub Actions or remote CI service.
- No dependency upgrade.
- No `npm audit fix --force`.
- No canary Next.js upgrade.
- No package override that invalidates the npm tree.
- No real providers, real channels, monitoring, analytics, or real health data.

## Done Criteria

- `npm run release:verify` exists in the app package.
- The command runs core package tests, lint, unit/API tests, build, and production dependency audit.
- The command exits successfully when the only production audit finding is the documented R-405 Next.js/PostCSS issue.
- The command exits unsuccessfully for unknown production audit findings.
- Dependency gate output clearly states that R-405 remains open and production launch remains blocked until a safe stable patch path exists.

## Edge Cases

- Malformed audit JSON fails closed.
- Missing audit metadata fails closed.
- Multiple known advisories still require exact allowlist matching.
- Dev dependency audit findings are out of scope for this release gate and can be reviewed separately.
- RLS tests remain protected by their existing local-Supabase safety guard.

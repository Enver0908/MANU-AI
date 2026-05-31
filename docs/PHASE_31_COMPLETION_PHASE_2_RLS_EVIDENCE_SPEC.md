# Phase 31 - Completion Roadmap Phase 2: Local Supabase RLS Evidence Attempt

Date: 2026-05-31

## Goal

Run Completion Roadmap Phase 2 by producing current local Supabase RLS execution evidence for the expanded Phase 28 RLS suite, or record the exact blocker if the local environment cannot execute it.

## Scope

This phase is evidence and documentation only.

In scope:

- Check whether the workspace Supabase environment is safe for RLS execution.
- Attempt to start local Supabase without printing secrets.
- Run `npm run test:rls`.
- Update R-406 and pilot evidence documentation based on the actual result.

Out of scope:

- Runtime behavior changes.
- Supabase schema or migration changes.
- Dependency remediation.
- R-405 resolution or acceptance.
- Real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, or real client health-data connection.
- Remote Supabase RLS execution unless explicitly approved with `MANU_ALLOW_REMOTE_RLS_TESTS=true`.

## Preflight Findings

- Supabase CLI is available through the app workspace: version `2.101.0`.
- `app/.env.local` is present but points to a cloud Supabase URL, not a local URL.
- The RLS integration test guard correctly skips unless the Supabase URL is local (`127.0.0.1` or `localhost`) or `MANU_ALLOW_REMOTE_RLS_TESTS=true` is explicitly set.
- Secrets were not printed.

## Attempted Commands

From `app`:

```text
npx supabase start
npm run test:rls
```

The Supabase start output was redirected to a temporary log to avoid accidental secret exposure.

## Result

Local Supabase could not be started because Docker Desktop's Linux engine pipe was unavailable:

```text
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified
```

`npm run test:rls` then exited successfully by skipping the guarded integration suite:

```text
Test Files 1 skipped (1)
Tests 10 skipped (10)
```

## Evidence Decision

This phase did not produce passing local RLS evidence.

R-406 remains open/blocked as an environment evidence gap until Docker Desktop/local Supabase is available and the expanded RLS suite runs against a local database.

This blocker is not a production launch approval, not a RLS mitigation, and not permission to run RLS tests against the user's cloud Supabase project.

## Unblock Procedure

1. Start Docker Desktop with the Linux engine available.
2. From `app`, start local Supabase with telemetry disabled.
3. Ensure `app/.env.local` points to local Supabase values, or provide local-equivalent test environment values without printing secrets.
4. Run `npm run test:rls`.
5. If all 10 RLS tests pass, update R-406 and the pilot evidence docs with the passing command output.
6. If any RLS test fails, fix the RLS/RBAC issue before starting any later completion phase.

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

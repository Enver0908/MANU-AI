# AIya Production System Audit Runbook

This runbook describes the repeatable audit for frontend, API, Supabase,
workers, external boundaries, security and release operations. It does not
authorize production GO, provider egress, live billing, remote production
migrations or real health-data processing.

## Run Profiles

Run from the repository root or from `app/`:

```text
cd app
node scripts/system-audit.mjs --profile local
node scripts/system-audit.mjs --profile live-readonly --base-url https://aiyaworkspace.com
```

The command writes a JSON and Markdown report below
`.manu-runtime/system-audit/<run-id>/`. Reports contain commit/release identity,
check status, endpoint observations and bounded error names; secrets and
request bodies are never written.

`local` checks repository authority, required files/scripts, safety flags and
the Supabase shell contract when local environment credentials are available.
`staging` uses the same checks against an explicitly supplied staging URL.
`live-readonly` additionally checks release health, public/login/admin pages and
the expected unauthenticated `401` boundaries for app state and clients.

## Required Checks

The audit must cover the following before a launch decision:

- Source, package, runtime and deployment release identity must refer to one commit.
- All API routes and migrations must be inventoried; required files and audit scripts must exist.
- Real Supabase RPCs, functions, grants and dependent migrations must be present; a migration history row alone is insufficient.
- Frontend request/response contracts must be exercised through a real API and persisted data reload.
- Authentication, onboarding, admin, dashboard, tenant, client, messaging, AI, media and export journeys must complete with the intended authorization.
- Cross-tenant reads, writes, exports, direct RPC calls and storage access must be denied.
- Webhook duplicates, retries, timeouts, provider errors, worker restarts and queue recovery must preserve idempotency and data ownership.
- Backup restore, rollback, alerting and release smoke evidence must be recorded for the exact artifact.

## Decision Rules

`FAIL` blocks the release. `BLOCKED` is not a pass and blocks the release when
the check is required for the target profile. `WAIVED_NOT_EXECUTED` is reserved
for the existing physical iPhone Safari/PWA owner waiver and must never be
reported as a pass. The current production decision remains `NO-GO` until the
external owner gates, real provider approvals, production migration approval,
incident ownership, rollback ownership and explicit release approval are
closed.

# Phase 85 Stage 6 R3 Inbox Concurrency, Security And Remediation Closure Evidence

Date: 2026-08-20

Status: **R3 COMPLETE LOCALLY; STAGE 6 PHASE 4 NOT STARTED**

Stage 5 status: **STAGE_5_CLOSED**

Production status: **NO-GO**

## Result

The Stage 6 alerts/notifications inbox now rejects responses that no longer belong to the current filter owner, have been superseded by a newer request, or predate an acknowledged notification mutation. Alerts and notifications have independent request gates and abort controllers. Filter changes invalidate and clear only the affected bounded slice. Poll, focus, manual refresh, and pagination requests cannot apply out of order. Paginated items merge by stable identifier and cannot create duplicate rows.

This closes the approved Stage 6 Phase 1-3 remediation sequence R1-R3. It does not close Stage 6 itself or start Phase 4. No UI, API, schema, migration, RLS policy, service-worker, provider/channel, billing, production rollout, or real-data path changed in R3.

## Implementation

- `app/src/lib/phase-85-stage-4b-inbox-scheduler.ts`
  - Adds an owner/sequence/mutation-version request gate.
  - Adds stable-id page merging that updates an overlapping row once and appends only new identifiers.
- `app/src/lib/use-stage-4b-inbox.ts`
  - Derives separate owner keys from the exact bounded alert and notification filter queries.
  - Aborts the prior request for the same resource and applies a response only while its token is current.
  - Invalidates an in-flight notification response before merging an acknowledged receipt/read-all mutation.
  - Keeps refresh/loading/error/last-success state tied to the latest refresh sequence.
  - Clears only the filter-owned bounded slice and keeps polling network-only and fail-closed.
- `app/src/lib/phase-85-stage-4b-inbox-scheduler.test.ts`
  - Proves old-filter rejection, latest-request-wins, mutation invalidation, and duplicate-free pagination merge.
- `app/package-lock.json`
  - Updates only the two vulnerable transitive `nanoid` resolutions allowed by their existing parent semver ranges: `3.3.17 -> 3.3.18` under PostCSS and `5.1.11 -> 5.1.16` under DOCX.

## Security Evidence

- The complete append-only migration chain, including the Stage 6 R1 durable idempotency table, applied through a clean local Supabase reset.
- The real local RLS suite passed 56/56 with zero skipped after explicitly mapping the running local Supabase URL and keys into the test process.
- The first RLS attempt failed closed with 1 failed / 55 skipped because `.env.local` pointed at a non-local target without `MANU_ALLOW_REMOTE_RLS_TESTS`; it was not counted as PASS. No remote permission was enabled. The successful rerun used only `http://127.0.0.1:54321`.
- The communication authorization suite covers bounded DTO allowlists, actor/assignment permissions, auditor denial, foreign conversation/message link rejection, receipt ownership, mutation revision/idempotency, and alert/notification tenant-safe projections.
- No secret, raw prompt, message/file content, health detail, or real-user fixture is added by R3.
- The first final `release:verify` attempt passed core tests, lint, typecheck, app tests, and build but failed the production dependency gate after two new `nanoid` advisories appeared. It was not counted as PASS. The two transitive patch updates removed the production findings; `npm audit --omit=dev` then reported zero vulnerabilities and the complete release chain passed.
- Unfiltered `npm audit` still reports four development-only transitive findings (one low, three high) in Babel, brace-expansion, js-yaml, and Vite tooling. They are not shipped in the production dependency set and are not represented as closed by this R3 evidence.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| R3 scheduler/routing/notification targeted tests | PASS: 3 files / 31 tests |
| Communication, authorization, concurrency, and full 10k Stage 4B-2 scale suite with `STAGE_4B2_FULL_SCALE=1` | PASS: 16 files / 116 tests / 0 skipped |
| `npm run lint` | PASS: 0 errors / 70 pre-existing warnings |
| Clean local `npx supabase db reset` | PASS |
| Local `npm run test:rls` | PASS: 56/56 / 0 skipped |
| `npm test` | PASS: 261 files / 1558 passed / 9 optional or environment-gated skipped |
| `npm run build` | PASS |
| `npm audit --omit=dev --json` | PASS: 0 production vulnerabilities after transitive `nanoid` patch updates |
| `npm run release:verify` | PASS: core 295/295, lint/typecheck, app 1558 passed / 9 skipped, production build, dependency security, Stage 5 shell 50/50, and final production audit |

The nine skips in the broad default suite are reported as skips, not PASS. The R3-required full-scale communication case was separately enabled and passed in the zero-skip 116/116 suite. R3 changes no rendered UI, so no new visual baseline is required; existing Stage 6 mobile/desktop visual evidence remains unchanged.

## Residual Boundaries

- Polling remains request/response based; no realtime subscription, offline cache, mutation queue, or background sync was introduced.
- Component-local drafts and Stage 5 shell behavior remain unchanged.
- Phase 4 still owns Stage 6 end-to-end performance, accessibility, physical-device, and final Stage 6 closure evidence.
- Four development-only transitive audit findings remain open for a separately scoped tooling dependency update; production audit is clean.
- Production remains `NO-GO`; no deployment, push, provider/channel egress, live billing, production schema rollout, or real health-data use is authorized.

## Decision

Stage 6 Phase 1-3 remediation R1-R3 is complete locally. The next eligible unit is Stage 6 Phase 4, but it requires separate explicit user approval. R3 itself is not committed or pushed until separately authorized.

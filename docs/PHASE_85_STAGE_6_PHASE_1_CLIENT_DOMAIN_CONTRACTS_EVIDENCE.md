# Phase 85 Stage 6 Phase 1 Client Domain Contracts Evidence

Date: 2026-08-19

Status: **PHASE 1 COMPLETE**

Stage 5 status: **STAGE_5_CLOSED**

Production status: **NO-GO**

## 1. Result

Bounded client-workspace contracts are in place for roster/detail reads and for form, food-rule, menu, context, and AI-control mutations. Target mutations return `ClientScopedMutationResponse` payloads without a broad `state` field. `useManuState` merges those payloads into the matching client slice and no longer refetches `/api/app-state` for those flows.

No Stage 5 shell, service-worker, provider egress, live billing, or production-gate change was made. No migration was added.

## 2. Contracts

- Shared types/parsers: `app/src/lib/phase-85-stage-6-dashboard-contracts.ts`
- Projection/merge: `app/src/lib/phase-85-stage-6-client-workspace.ts`
- Hook: `app/src/lib/use-stage-6-client-workspace.ts`
- Form save service shared by `POST /api/clients/forms` and `PUT /api/clients/[id]/forms/[schemaId]`
- Persistence projections from mutation `next` state instead of `loadSupabaseState` for the target writes

Added reads:

- `GET /api/clients?query=&cursor=&limit=`
- `GET /api/clients/[id]`
- `GET /api/clients/[id]/forms`
- `GET /api/clients/[id]/context-updates`
- Bounded `GET /api/clients/[id]/menu-plans`

Target mutations now require `requestId` (UUID) where specified, reject actor-supplied tenant/account identity, and map stale concurrency errors to `revision_conflict` with `sourceType` and `currentRevision`.

Idempotency reuse is process-local via an in-memory request-id map because no client-domain idempotency table exists and no append-only migration was required for atomicity. Form/context/AI writes still use existing transactional RPCs.

## 3. Verification

| Check | Result |
| --- | --- |
| Targeted unit tests (`phase-85-stage-6-*`, `phase-79c`, `phase-77e`) | 27 passed / 0 failed / 0 skipped |
| `npm run typecheck` | PASS (exit 0) |
| `npm run lint` | PASS (0 errors; pre-existing warnings remain) |
| `npm run build` | PASS (exit 0) |
| `npm run test:rls` | not run; no schema/RLS migration in this phase |
| `git diff --check` | PASS |

## 4. Open risks

- Process-local idempotency does not survive process restart; durable client-domain idempotency would need a later append-only ledger if product retries cross instances.
- `GET /api/shell/clients` remains the Stage 5 shell search contract and is not a workspace roster.
- Fallback GET workspace capabilities currently assume dietitian role.
- Production remains `NO-GO`.

## 5. Next boundary

Phase 2 Dashboard Home and Client Workspace requires separate explicit user approval and a separate commit.

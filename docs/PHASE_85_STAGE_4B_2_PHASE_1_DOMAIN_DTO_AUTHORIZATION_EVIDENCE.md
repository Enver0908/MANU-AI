# Phase 85 Stage 4B-2 Phase 1 Domain, DTO, and Authorization Evidence

Status: **complete - pure domain/projection implementation only**

Implementation branch: `codex/phase-85-interstage-clinical-memory`

## 1. Scope

Phase 1 implements the locked Stage 4B-2 domain types, bounded DTO contracts, actor/assignment permission projection, safe preview/message projection, query/limit/cursor parsing, and fallback-compatible list/detail projection interfaces. It does not implement receipt persistence, SQL, RLS, API routes, dashboard UI, message mutations, provider/channel calls, billing, monitoring, backup, secret-manager, or real health-data paths.

## 2. Preconditions and Baseline

- Phase 0 documentation lock was committed in `e2a226c`.
- The branch is `codex/phase-85-interstage-clinical-memory`.
- Production pilot remains `NO-GO`.
- R-405 remains open.
- Stage 4C remains blocked.
- Real provider, channel, billing, monitoring, backup, secret-manager, and health-data paths remain closed.

## 3. Implemented Files

- `app/src/lib/types.ts`: adds `ClientAssignmentAccessLevel` and `ClientAssignmentRecord`.
- `app/src/lib/phase-85-stage-4b2-contracts.ts`: defines bounded public DTOs, per-actor receipt record, permissions, assignment input rows, projection source interfaces, query contracts, and versioned list/message cursor payloads.
- `app/src/lib/phase-85-stage-4b2-api.ts`: implements permission projection, fail-closed access/operation guards, assignment normalization, list/detail projection, actor-specific sequence unread calculation, safe preview/body limits, deterministic ordering, bounded pagination windows, and query/cursor parsing.
- `app/src/lib/app-errors.ts`: allows the existing domain error response path to represent `403` operation denials without changing existing error behavior.
- `app/src/lib/phase-85-stage-4b2-api.test.ts`: adds role, assignment, DTO allowlist, preview, unread, cursor, pagination, and fail-closed access coverage.

## 4. Locked Behaviors Proven

- Owner/admin receives tenant-wide read and existing domain-operation flags.
- Dietitian primary and `care_team` assignments are writable; `viewer` assignments are read-only.
- Assigned assistant receives transcript/read-marker access only. Assistant cannot manual reply, review drafts, control AI, resolve risk, or mutate client/message state.
- Auditor receives no conversation visibility and cannot advance a receipt.
- Assignment rows accept both fallback camel-case and Supabase snake-case shapes. Missing legacy access level defaults to `care_team`; unknown access levels fail closed.
- List search is client-name-only and capped at 80 Unicode code points.
- List rows are bounded and sorted by `lastActivityAt DESC, conversationId DESC`.
- Unread counts use only `client_inbound` messages with sequence greater than the actor marker. `content_unavailable` counts; `revoked` and `redacted` do not.
- Unsent AI drafts use the fixed list preview `Taslak inceleme bekliyor`; unavailable content uses a safe placeholder; message bodies are capped at 4096 Unicode code points.
- DTOs expose only allowlisted conversation/client/message/permission/receipt fields and never serialize `ManuAppState`.
- Detail responses are bounded to the newest 50 messages, a maximum of 100, or the locked 25-before/anchor/24-after window.
- Cursor payloads are versioned, filter/direction-bound, and invalid or cross-filter cursors return a domain `400`.
- Hidden, cross-tenant, unassigned, and auditor resources fail closed as `404`; visible read-only domain operations return `403`.

## 5. Verification

- Dedicated Phase 1 Vitest: 8 passed, 0 failed.
- Combined Phase 1 plus Stage 4B regression set: 7 files, 61 passed, 1 skipped.
- Full app `npm test`: 142 files, 909 passed, 5 skipped, 0 failed.
- Core `dietitian-ai-assistant` suite: 234 passed, 0 failed, 0 skipped.
- `npm run lint`: exit 0, 0 errors, 3 pre-existing warnings.
- `npm run build`: passed, including TypeScript validation, static generation, and route output.
- `npm run test:rls`: 1 file and 33 tests skipped because Docker/Supabase was unavailable; this is an environment skip, not a pass. No migration changed in Phase 1.
- `git diff --check`: required before commit and recorded with the final closure evidence.
- Secret/token scan and forbidden future-phase naming scan: required before commit and recorded with the final closure evidence.

## 6. Explicit Non-Changes

No SQL migration, `conversation_read_receipts` table, sequence backfill, RLS policy, `/api/conversations` route, manual reply mutation, yellow review mutation, red activation mutation, dashboard route, component, polling hook, provider credential, webhook, live channel, billing, monitoring, backup, secret-manager, or real health-data path was added.

## 7. Handoff to Phase 2

Phase 2 may now implement the append-only receipt migration, deterministic sequence backfill, composite tenant/conversation/actor integrity, actor-owned monotonic marker RPC, and real RLS matrix. It must consume the Phase 1 DTO and permission contracts without widening the DTOs or reintroducing full-state messaging reads. Stage 4C remains blocked until all Stage 4B-2 phases and evidence close.

## 8. Final Closure Checks

- `git diff --check`: passed with no whitespace errors; Git emitted only existing LF-to-CRLF normalization warnings.
- High-confidence secret/token scan: no matches.
- Forbidden future-phase naming scan: no matches.
- Changed runtime files are limited to `app/src/lib/types.ts`, `app/src/lib/app-errors.ts`, and the three new Phase 1 contract/projection/test modules. No migration, route, component, or provider file changed.
- Canonical references to the Phase 1 action/evidence documents resolve in the updated continuity documents.

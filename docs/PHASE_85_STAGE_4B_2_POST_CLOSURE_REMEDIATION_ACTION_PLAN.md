# Phase 85 Stage 4B-2 Post-Closure Remediation Action Plan

Status: **R0-R7 closed locally; separate security advisory RLS hardening closed locally (2026-07-13)**

Baseline branch: `codex/phase-85-interstage-clinical-memory`
Baseline commit: `3d67ba5 Close Phase 85 Stage 4B-2 with canonical spec, closure evidence, and continuity updates.`
R0 baseline commit: `f66c4cc Lock Stage 4B-2 post-closure remediation R0`.

Production pilot remains **NO-GO**. R-405 remains open. Real WhatsApp, Telegram, Gemini, external LLM, live billing, monitoring, backup, secret-manager, and real health-data paths remain disabled.

## 1. Purpose and closure decision

The Stage 4B-2 audit found that the implementation is substantial but is not yet a complete implementation of the locked technical intent. This remediation track is the controlled work item for closing those findings. The prior closure evidence remains historical implementation evidence; it does not authorize Stage 4C while the remediation gates below are open.

Stage 4C was blocked until remediation R0-R6 verification was green and the R7 evidence closure was completed separately. R0-R7 are now closed locally; Stage 4B-3 is the next authorized Phase 85 unit before Stage 4C.

R1 through R5 implementation units are complete. R6 was re-closed on 2026-07-13 with local Supabase reset, RLS 35/35 with zero skips, and executed SQL buffer evidence for the bounded list/detail projection RPCs. R7 canonical closure is complete. The separate Supabase advisory for RLS-disabled `conversation_mutation_idempotency` and `personas` was closed locally by `20260713030000_phase_85_stage_4b2_security_advisory_rls_hardening.sql`; evidence is `docs/PHASE_85_STAGE_4B_2_SECURITY_ADVISORY_RLS_HARDENING_EVIDENCE.md`. Production pilot remains `NO-GO`, R-405 remains open, and real integration paths remain closed.

## 2. Locked findings

| ID | Severity | Finding | Required closure evidence |
| --- | --- | --- | --- |
| R-4B2-01 | critical | Supabase mutation paths do not enforce viewer assignment access level server-side. | Real RLS/API matrix proves viewer cannot reply, review drafts, configure AI, or activate AI. |
| R-4B2-02 | critical | Mutation idempotency is stored after the domain transaction. | Concurrent duplicate requests create one domain result and replay the exact stored response. |
| R-4B2-03 | critical | Yellow review can proceed when a red lock supersedes the yellow hold. | Red/yellow race returns `409` with zero writes. |
| R-4B2-04 | critical | Supabase list/detail RPCs aggregate unbounded tenant or transcript data before application slicing. | SQL-backed `EXPLAIN` and scale evidence prove bounded rows and buffers. |
| R-4B2-05 | high | Current RLS verification is skipped because Docker/Supabase is unavailable. | Local reset and the complete role matrix pass with zero skipped required tests. |
| R-4B2-06 | high | Unread badge is calculated from the loaded page rather than actor-scoped totals. | API aggregate totals remain correct across pagination and 10k conversations. |
| R-4B2-07 | high | 768px tablet uses mobile drill-down because split layout begins at `lg`. | Tablet visual evidence shows list/detail split and no overflow. |
| R-4B2-08 | high | Deep-link validity depends on legacy app-state message presence. | Valid old anchor loads through bounded detail API even when absent from legacy state. |
| R-4B2-09 | medium | Required hook, route, race, and SQL scale behavior is under-tested. | Targeted, full, RLS, replay, scale, accessibility, and visual suites pass without synthetic closure. |
| R-4B2-10 | medium | Closure/continuity documents contain stale phase handoffs and closure contradictions. | Canonical-document reference/status scan is clean after R7. |

## 3. Remediation order

1. R0: decision and evidence lock (this document).
2. R1: DTO, permission, cursor, and actor-contract correction.
3. R2: bounded read RPCs, receipt aggregate, and RLS correction.
4. R3: atomic authorized mutation RPCs and idempotency correction.
5. R4: hook, deep-link, responsive UI, and unread integration correction.
6. R5: security, lifecycle, scale, accessibility, replay, and regression tests.
7. R6: independent full verification and release gate.
8. R7: canonical documents, risk closure, and handoff.

Each unit is implemented, tested, documented, and committed separately. A skipped required verification is never converted into a pass.

## 4. Non-negotiable boundaries

- No `alerts` table is added.
- Existing Stage 4B alert/notification ownership and P85-IF authority remain unchanged.
- Migrations remain append-only.
- Viewer, assistant, auditor, unassigned, and cross-tenant checks are enforced server-side, not only by UI visibility.
- List/detail database reads are physically bounded; limiting only the HTTP response is insufficient.
- Red lock remains active after manual reply and is closed only by existing atomic AI activation.
- Yellow review is rejected atomically if red lock exists at any point before commit.
- No runtime provider/channel, billing, monitoring, backup, secret-manager, or real health-data path is enabled.

## 5. R0 completion criteria

R0 is complete only when the findings, remediation order, non-negotiable boundaries, current RLS block, pilot posture, and document update obligations are recorded in this action plan and the R0 evidence document. R0 changes no TypeScript/JavaScript runtime, SQL migration, API route, component, provider, channel, billing, monitoring, backup, secret-manager, or health-data path.

## 6. R1 completion record - 2026-07-12

R1 corrected the shared Stage 4B-2 domain and DTO contract without adding a migration, route, RPC, provider, channel, billing, monitoring, backup, secret-manager, or health-data path. The contract/API version is now `v2`; AI permissions are split into activation and configuration capabilities; red-lock semantics permit activation while denying configuration; unread aggregates are calculated over the complete actor-visible projection before pagination; cursor and numeric input validation use bounded base64url and safe-integer rules; and yellow reviewed-manual send requires the expected client context revision.

The implementation and verification record is `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R1_EVIDENCE.md`. R2 remains responsible for database-bounded reads and server-side assignment authorization; R1 does not close those findings.

## 7. R2 completion record - 2026-07-12

R2 added the append-only migration `20260712170000_phase_85_stage_4b2_r2_bounded_reads_rls.sql`. The v2 list RPC limits the conversation page and each JSON branch before aggregation, returns actor-scoped unread aggregates and per-conversation unread counts, and limits assignment/receipt projections to the selected page. The v2 detail RPC limits transcript rows to the bounded detail window, returns the complete conversation unread count separately, and scopes every projection branch to the authorized conversation. Receipt mutation now uses a v2 RPC with explicit actor-context, auditor, and conversation-visibility guards; detail and mark-read DTOs preserve the SQL-authoritative unread aggregate instead of recounting only the bounded transcript. The application store consumes only the v2 read/receipt RPCs.

R2 implementation evidence is `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R2_EVIDENCE.md`. R3 remains the next authorized unit. RLS execution is still environment-blocked and is not represented as green.

## 8. R3 completion record - 2026-07-12

R3 added the append-only migration `20260712180000_phase_85_stage_4b2_r3_atomic_mutations.sql`. Manual replies and draft mutations now reserve and lock idempotency before domain work, repeat actor/assignment/operation authorization inside the service-role RPC, lock the client before the conversation revision, reject out-of-scope payload entities, reject yellow review after a red lock is observed, execute the existing domain state delta, and persist the exact bounded response before returning. Supabase store callers replay cached requests before local state derivation and otherwise consume the atomic RPC response.

R3 implementation evidence is `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R3_EVIDENCE.md`. R4 remains the next authorized unit. RLS execution remains an explicit open environment gate.

## 9. R4 completion record - 2026-07-12

R4 corrected the client lifecycle around the bounded messaging APIs. Explicit `conversationId` URLs now remain loadable when the legacy conversation/message cache is incomplete; only locally contradictory client/conversation links fail closed, while the bounded detail API validates old anchors. The hook now consumes actor-scoped `unreadConversationCount` and `unreadMessageCount` for navigation and panel badges, and its filter callback dependency is stable. Messaging uses a `md` split layout so the 768px tablet has list/detail panes while mobile keeps drill-down navigation. A detail DTO without a legacy client renders transcript-only with all mutation controls hidden, preventing a synthetic client record and sensitive state expansion.

R4 implementation evidence is `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R4_EVIDENCE.md`. Targeted routing/integration/detail tests, production build, lint, and four-viewport visual messaging tests passed. The full app command timed out in the OneDrive workspace and is not claimed as pass; RLS remains environment-blocked. R5 owns the remaining security, lifecycle, scale, replay, accessibility, full-regression, and RLS evidence.

## 10. R5 completion record - 2026-07-13

R5 rebuilt the missing test and scale evidence without changing runtime provider/channel behavior or adding a migration. The new R5 evidence module tests cross-page actor-scoped unread aggregate invariants, a 10,000-conversation fixture, a 10,000-message single-transcript detail window, bounded response payloads, R2/R3 SQL contract markers, and client-export receipt/lifecycle leak guards. A dedicated Playwright accessibility spec covers named rows, tab semantics, keyboard focus, mobile detail navigation, and horizontal overflow across desktop, tablet, Android, and iOS. A reproducible R5 rehearsal script runs the full bounded scale test, full mock channel replay, and accessibility projects.

R5 evidence is `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R5_EVIDENCE.md`. Full app regression passed with 153 files and 959 tests passed / 6 skipped; core passed 234/234; full 79G production-scale acceptance passed 7/7; full 100x50 channel replay passed; R5 bounded-scale passed 4/4; accessibility passed 4/4; lint and build passed. `npm run test:rls` still skips 35 tests because Docker/Supabase is unavailable and is not counted as pass. R6 remains responsible for independent release verification, real RLS/EXPLAIN execution, and final gate closure.

## 11. R6 independent verification record - 2026-07-13

R6 executed `npm run rehearse:stage-4b2-r6` through the independent gate runner. The gate contract tests passed 3/3; core passed 234/234; the full app passed 153 files with 959 passed / 6 skipped; lint had 0 errors and 3 pre-existing warnings; the production build passed; R5 scale passed 4/4; 79G passed 7/7; full 100x50 channel replay passed; and messaging visual/accessibility passed 8/8 across desktop, tablet, Android, and iOS. The runner also passed the documented R-405-only production dependency audit exception, diff check, and diff-added/untracked secret and forbidden-name scan.

Historical R6 checkpoint: the report was correctly `BLOCKED`, not pass, because all 35 RLS tests skipped and SQL buffer evidence was unavailable. R7 did not reinterpret that skip; it reran the environment and supplied independent zero-skip RLS plus executed SQL evidence. The historical R6 block is therefore superseded by R7, and Stage 4C is current.

## 12. R7 canonical closure and handoff - 2026-07-13

The historical R6 blocked report above was subsequently superseded by real local environment evidence: database reset passed, the complete RLS role matrix passed 35/35 with zero skips, and PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` executed for both bounded v2 projection-source RPCs. Combined with R2 limit-before-aggregation SQL and R5 10k scale evidence, the R6 prerequisite is green without converting a skipped check into a pass.

R7 reconciled the canonical documents, marked R-4B2-01 through R-4B2-10 mitigated in the local prototype, and created `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`. R0-R7 are complete locally. The next authorized Phase 85 unit is Stage 4C, which must begin with its own plan and affected-file review. Production pilot remains `NO-GO`; R-405 remains open; no real provider/channel, billing, monitoring, backup, secret-manager, or health-data path is enabled.

# Phase 85 Stage 4B-2 Post-Closure Remediation Action Plan

Status: **R0 locked - remediation active (2026-07-12)**

Baseline branch: `codex/phase-85-interstage-clinical-memory`
Baseline commit: `3d67ba5 Close Phase 85 Stage 4B-2 with canonical spec, closure evidence, and continuity updates.`

Production pilot remains **NO-GO**. R-405 remains open. Real WhatsApp, Telegram, Gemini, external LLM, live billing, monitoring, backup, secret-manager, and real health-data paths remain disabled.

## 1. Purpose and closure decision

The Stage 4B-2 audit found that the implementation is substantial but is not yet a complete implementation of the locked technical intent. This remediation track is the controlled work item for closing those findings. The prior closure evidence remains historical implementation evidence; it does not authorize Stage 4C while the remediation gates below are open.

Stage 4C is blocked until remediation R0-R6 verification is green and the R7 evidence closure is committed separately.

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

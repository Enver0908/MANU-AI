# Stage 4C Remediation and Technical Closure Action Plan

Date: 2026-07-25
Status: **Stage 4C closure committed locally; Stage 4D Faz 1 read gate complete**

This document is the remediation authority for the three-phase hardening pass requested after the Stage 4C audit findings.

Production remains `NO-GO`. R-405 remains open.

## Faz 1

Authorization, lifecycle, attachment hashing, terminal risk, and Supabase actor-context hardening applied in code and covered by targeted tests.

## Faz 2

SSE fan-out/catch-up, client reconnect semantics, render-loop resilience, and AI Chat accessibility/build validation applied in code and covered by targeted tests.

## Faz 3

PostgreSQL scale rehearsal correctness, release audit gating, dependency remediation, and closure-document reconciliation applied.

Stage 4C local closure acceptance required and now has:

- `STAGE_4C_FULL_REHEARSAL=1` full rehearsal
- zero unknown production dependency audit findings
- only documented R-405 nested Next.js/PostCSS/Sharp findings may remain accepted

## Pre-Stage-4D Clean Transition Faz 1: Closure Infrastructure

Status: **complete locally**.

Before the local Supabase/Postgres gate, the `npm run rehearse:stage-4c` evidence writer must be safe and bounded. The rehearsal script now writes successful measured output only to `docs/PHASE_85_STAGE_4C_LOCAL_CLOSURE_REHEARSAL_EVIDENCE.md`; it must not rewrite or truncate historical remediation evidence.

The writer is idempotent, preserves content outside generated markers, and fails closed without writing on failed reports, skipped RLS, non-remediated verdicts, production GO flags, or broken markers.

## Pre-Stage-4D Clean Transition Faz 2: Local Supabase/Postgres and Zero-Skipped RLS

Status: **complete locally**.

Local Supabase/Postgres is available and the migration chain now applies from a clean database state. The zero-skipped RLS gate passed with `npm run test:rls` at 47/47 tests and 0 skipped. `npx supabase db lint` has no error-level findings; warning-level PL/pgSQL hygiene items remain informational and do not change the closure verdict.

Implemented remediation:

- Append-only Stage 4B-4 signature transition migration for the media redaction return-shape handoff.
- Append-only Stage 4C pgcrypto search-path compatibility migration for `digest`/`hmac` calls under locked `search_path`.
- Minimal historical syntax correction in `20260725130000_phase_85_stage_4c_remediation_lifecycle_export.sql` for valid `GET DIAGNOSTICS` row-count accumulation.
- Append-only Stage 4C RLS helper grant remediation so authenticated SELECT policies can evaluate SECURITY DEFINER helper functions without granting user mutation authority.
- Append-only DB lint reclosure migration for clean local Postgres lint errors across Stage 4B/4C compatibility surfaces.
- RLS fixture hardening to keep the no-membership outsider distinct from the other-tenant owner.

## Pre-Stage-4D Clean Transition Faz 3: Hard-Zero Full Rehearsal

Status: **complete locally after operational-table RLS reclosure**.

Measured passing gates:

- real PostgreSQL scale: 100 dietitians, 5,000 clients, 10,000 chats, 200,000 message versions, eight EXPLAIN profiles
- isolated app suite: 229 files, 1,399 passed / 9 skipped
- local reset and existing RLS suite: 47/47, 0 skipped
- AI Chat visual/accessibility: 80 passed / 5 viewport-conditional skipped
- production build and `release:verify`; only documented R-405 findings remain

Direct catalog inspection then found RLS disabled with no policies on `ai_chat_deletion_jobs`, `ai_chat_deletion_ledger`, `ai_chat_jobs`, and `ai_chat_legal_holds`. This historical finding invalidated the first hard-zero attempt even though the then-current 47-test RLS suite passed.

## Operational-Table RLS Reclosure

Status: **complete locally**.

Append-only migration `20260725163000_phase_85_stage_4c_operational_tables_rls_reclosure.sql` implements the approved worker-only access model for all four tables:

- RLS enabled with one explicit deny-all direct-user policy per table
- all direct `public`, `anon`, and `authenticated` privileges revoked
- service-role access preserved for bounded worker/lifecycle operations
- no `FORCE ROW LEVEL SECURITY`, so table-owner/service-role internal execution remains compatible

Clean reset through `20260725163000`, catalog/advisory inspection, DB lint, and the expanded RLS suite passed at 49/49 with 0 skipped. The final canonical `npm run rehearse:stage-4c` rerun passed and recorded `PASS_LOCAL_STAGE_4C_REMEDIATED`.

The Stage 4C closure unit was committed locally as `cd3d781 Complete Stage 4C hard-zero remediation closure`.

## Faz 4: Repo-Wide Continuity Reconciliation and Stage 4D Handoff

Status: **complete and committed at `bc57cfd`**.

Active root, app, execution, handoff, remediation, risk, and pilot-readiness documents now agree that:

- Stage 4C remediation is closed locally at `cd3d781`;
- `PASS_LOCAL_STAGE_4C_REMEDIATED` is repo-local evidence only;
- older Stage 4C-current/next/blocking statements are historical snapshots;
- Stage 4D Ayarlar / Hesap is the next Phase 85 implementation area;
- Stage 4D Faz 1 read gate is complete as documentation only and implementation has not started;
- production remains `NO-GO`, R-405 remains open, and real integration gates remain closed.

Canonical handoff evidence: `docs/PHASE_85_STAGE_4C_TO_STAGE_4D_CONTINUITY_HANDOFF_EVIDENCE.md`.

Stage 4D planning/read gate subsequently completed as documentation-only Faz 1. Canonical Stage 4D plan: `docs/PHASE_85_STAGE_4D_AYARLAR_HESAP_ACTION_PLAN.md`; read-gate evidence: `docs/PHASE_85_STAGE_4D_PHASE_1_READ_GATE_EVIDENCE.md`. Next single action: obtain separate user approval for Stage 4D Faz 2. Push remains a separate explicit action.

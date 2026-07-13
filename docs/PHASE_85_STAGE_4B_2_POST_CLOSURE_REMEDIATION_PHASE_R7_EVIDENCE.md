# Phase 85 Stage 4B-2 Post-Closure Remediation - Phase R7 Evidence

Date: 2026-07-13
Branch: `codex/phase-85-interstage-clinical-memory`
Status: **CLOSED LOCALLY**

## Decision

R0-R7 are complete for the local Stage 4B-2 remediation track. R7 reconciles the canonical status, closes R-4B2-01 through R-4B2-10 as mitigated in the local prototype, and hands the Phase 85 sequence to Stage 4C. This is not a production-pilot approval: production remains `NO-GO`, R-405 remains open, and real provider, channel, billing, monitoring, backup, secret-manager, and health-data paths remain closed.

## R6 prerequisite re-closure

- Local Supabase reset passed and the complete RLS role matrix passed 35/35 with 0 skipped.
- Real PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` executed against the authorized local seed for both v2 projection-source RPCs.
- List projection (`p_limit=20`): 1 result row, 9.767 ms execution, 2061 shared-hit blocks, 0 shared-read, 0 temp-read/write, and 0 local-read/write blocks.
- Detail projection (`p_limit=50`): 1 result row, 8.565 ms execution, 1969 shared-hit blocks, 0 shared-read, 0 temp-read/write, and 0 local-read/write blocks.
- The plans were evaluated together with the R2 SQL contract, which clamps list limits to 1-100 and detail limits to 1-200 before JSON aggregation, and the R5 10,000-conversation/10,000-message bounded-scale evidence.

The PostgreSQL plans expose the security-definer PL/pgSQL call as a single result node, so internal CTE row nodes are not separately emitted. Physical bounding is therefore established by the executed buffer evidence plus the SQL limit-before-aggregation contract and R5 scale rehearsal; no claim is made that the function-call plan expands internal PL/pgSQL nodes.

## Finding closure matrix

| Finding | Local decision | Closure evidence |
| --- | --- | --- |
| R-4B2-01 | mitigated | R2/R3 server-side actor and assignment guards; local RLS/API role matrix 35/35 |
| R-4B2-02 | mitigated | R3 transaction-scoped idempotency reservation and exact response replay; concurrent replay evidence |
| R-4B2-03 | mitigated | R3 client-before-conversation locking and red-lock rejection with zero-write conflict evidence |
| R-4B2-04 | mitigated | R2 bounded SQL, executed list/detail buffer plans, and R5 10k scale evidence |
| R-4B2-05 | mitigated | Local reset and RLS 35/35 with 0 skipped |
| R-4B2-06 | mitigated | Actor-scoped aggregate totals across pagination and 10k conversations |
| R-4B2-07 | mitigated | 768px split-layout visual/accessibility evidence |
| R-4B2-08 | mitigated | Bounded-detail deep-link resolution independent of legacy message cache |
| R-4B2-09 | mitigated | Targeted, full, RLS, replay, scale, accessibility, visual, lint, and build evidence |
| R-4B2-10 | mitigated | R7 canonical status/reference reconciliation and handoff scan |

## Canonical reconciliation

The canonical roadmap, project plan, handoff, app README, frontend/design spec, Stage 4B and Stage 4B-2 plans/spec, P85-IF plan/spec, next-phase plan, direct-completion plan, pilot evidence, gate dossier, final-readiness summary, and risk register now identify R0-R7 as locally complete. Historical phase records remain historical evidence; their former “next phase” statements do not override this R7 closure record.

The next authorized Phase 85 implementation unit is Stage 4C, subject to its own plan/read-before-code gate. Stage 4C does not inherit permission to enable real providers, channels, production billing, monitoring, backup, secret management, or real health-data processing.

## Security advisory boundary

The local Supabase advisory for RLS-disabled `public.conversation_mutation_idempotency` and `public.personas` was closed after R7 as a separate security-hardening unit. Evidence: `docs/PHASE_85_STAGE_4B_2_SECURITY_ADVISORY_RLS_HARDENING_EVIDENCE.md`. The closure enables RLS on both tables, removes direct `anon`/`authenticated` grants, adds no direct-user policies, and preserves service-role mediated behavior. This does not change the R7 production boundary: production remains `NO-GO`, R-405 remains open, and real integration paths remain closed.

## Completion criteria

- R0-R6 implementation and verification evidence is linked.
- Required local RLS tests have zero skips and zero failures.
- SQL-backed list/detail buffer evidence is recorded without overstating PL/pgSQL plan visibility.
- R-4B2-01 through R-4B2-10 have explicit local dispositions.
- Canonical documents no longer identify R2-R7 as the active operator task.
- Production pilot remains `NO-GO`; R-405 remains open; real integration paths remain closed.

# P85-IF Remediation Post-Closure Architecture Audit Evidence

Date: 2026-07-11
Scope: P85-IF remediation architecture audit, fixes, verification, and repository closure
Status: complete
Production pilot: `NO-GO`

## Audit Findings

The post-closure audit found six issues that prevented the remediation plan from being called perfectly implemented before this pass:

1. R1 tenant-composite persistence did not fully cover `messages` provenance references to conversation, dietitian author/approver, AI decision, source message, provider account binding, actor binding, and actor-binding account/dietitian ownership.
2. R2 structured-update baseline metadata existed in core expectations but was not derived from real app state before prompt compilation.
3. R2 structured-update resolution compared the notification baseline to generic `client.contextRevision` instead of the target panel revision.
4. R3 activation, inbound, red-risk, and human-echo paths had a lock-order inversion between client and conversation rows.
5. R6 export leak detection existed as closure evidence but was not invoked by the actual client export builder.
6. Traceability was incomplete because the original R1/R2/R3 work had no dedicated evidence documents and R1/R2 were historically grouped in a prior combined commit.

R4 client-safe context-intake architecture and R5 operational visibility authorization were re-reviewed and no new code findings were identified.

## Fix Summary

- Added append-only R1 migration `20260711200000_phase_85_if_postclosure_r1_message_tenant_integrity.sql` with fail-closed preflight checks and tenant-composite foreign keys for message provenance and actor bindings.
- Added R2 app/core wiring so structured baselines include menu, food-rule, client-form, and diet-plan revisions before context compilation.
- Added R2 target-specific notification resolution in fallback state and service-role-only Supabase RPC `p85_if_postclosure_resolve_structured_update_notification`.
- Added R3 append-only lock-order migration `20260711202000_phase_85_if_postclosure_r3_lock_order.sql`, aligning expected conversation revision checks with the activation client-to-conversation lock order.
- Wired `assertP85IfIClientExportHasNoLeaks` into `buildClientScopedExport` so leak detection runs on the real export path.
- Added dedicated evidence documents for R1, R2, and R3 post-closure remediation and updated continuity docs without rewriting historical commits.

## Verification

- Targeted app Vitest: `phase-85-if-e-historical-retrieval.test.ts` and `phase-85-if-i-lifecycle-closure.test.ts` passed 16/16.
- Targeted core Node tests: `historical-retrieval.test.mjs` and `orchestrator.test.mjs` passed 36/36.
- Local Supabase reset: passed with all post-closure migrations applied.
- Local Supabase RLS/integration: `npm run test:rls` passed 30/30.
- App lint: passed with 0 errors and 2 pre-existing warnings.
- App full unit suite: 828 passed / 4 skipped across 131 files.
- Core full test suite: 234/234 passed.
- Production build: passed.
- Full mock channel replay: passed.
- Unified production-scale rehearsal: `npm run rehearse:production-scale:79g` passed, including 5,000 expanded AI cases, channel replay, 7/7 Phase 79 acceptance tests, release verification, and documented R-405-only dependency audit findings.

## Closure Decision

The P85-IF remediation plan is now architecture-clean for the audited scope. The historical commit split cannot be retroactively changed without rewriting history, so this independent post-closure audit commit records the compensating evidence. Production pilot remains `NO-GO`; R-405 remains open; real provider, real channel, live billing, monitoring, backup, secret-manager, and real health-data paths remain disabled.

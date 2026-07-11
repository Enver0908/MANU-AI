# P85-IF-R6 Lifecycle, RLS, And Evidence-Based Re-Closure Evidence

Date: 2026-07-11
Track: P85-IF-R6
Remediated track: P85-IF-I Lifecycle, RLS, Evidence, Verification, And Closure
Status: complete; full lifecycle/RLS re-closure evidence verified

## Scope Delivered

- Added append-only migration `20260710230000_phase_85_if_remediation_lifecycle_reclosure.sql`.
- `commit_client_removal_lifecycle` now persists P85-IF-I redaction for message provenance fields, channel message revisions, human-control session links, risk activity source links, context-intake source text/raw references, inbound quarantine identifiers, and retrieval evidence minimization.
- Added service-role-only `p85_if_r6_revoke_tenant_channel_bindings` RPC. Account bindings and actor bindings are revoked in one transaction and tenant channel automation rollback is forced disabled.
- Added owner/admin API `POST /api/operational-foundation/revoke-channel-bindings` with `revoke_tenant_channel_bindings` capability.
- Added client export leak detector for tenant channel binding and operational marker leakage.
- `evaluateP85IfIProgramClosureEvidence` no longer returns a fixed success. It requires explicit passed evidence for all P85-IF tracks, targeted tests, full app suite, RLS, channel replay, production-scale rehearsal, production build, lifecycle round-trip, and export leak detection.

## Boundary Checks

- No Stage 4B notification center, filter, navigation, grouping, read/ack, or mobile/PWA product scope was added.
- No real WhatsApp, Telegram, Gemini/provider, live billing, monitoring, backup, secret-manager, or real health-data path was opened.
- Production pilot remains `NO-GO`; R-405 remains open.
- RLS skip, full-suite timeout, or production-scale timeout cannot produce closure `pass`.

## Verification

- Targeted lifecycle Vitest: `phase-85-if-i-lifecycle-closure.test.ts` and `phase-79e-lifecycle-redaction-evidence.test.ts` passed 14/14.
- Local Supabase migration reset: passed with R6 migration applied.
- Local RLS integration: `npm run test:rls` passed 28/28.
- Lint: `npm run lint` passed with 0 errors and 2 pre-existing warnings.
- Production build: `npm run build` passed.
- Full app suite: `npm test` passed 825 tests with 4 skipped across 131 files.
- Channel replay: `npm run rehearse:channel:replay` passed.
- Production-scale rehearsal: `npm run rehearse:production-scale:79g` passed without timeout.
- `git diff --check`: passed with line-ending warnings only.
- Forbidden future-phase naming scan: passed with no matches.
- Secret/token scan: no real token findings; only dummy `anon` and `service` assignments in `app/src/lib/supabase-config.test.ts` matched the generic env-name pattern.

## Closure Decision

P85-IF-R6 is closed. The P85-IF remediation sequence is verified and Stage 4B planning may resume. Production pilot remains `NO-GO`; R-405 remains open.

## Post-Closure Audit Addendum - 2026-07-11

The post-closure architecture audit found one additional R6 issue: export leak detection was implemented and tested, but the normal client export builder did not invoke it. `buildClientScopedExport` now calls `assertP85IfIClientExportHasNoLeaks` before returning export data. The lifecycle test suite covers both the pass and fail-closed leak-detection paths.

The same audit also closed R1, R2, and R3 follow-up findings through append-only migrations and targeted app/core/RLS tests. Evidence is consolidated in `docs/PHASE_85_IF_REMEDIATION_POST_CLOSURE_AUDIT_EVIDENCE.md`. Latest local RLS/integration evidence for the post-closure baseline passed 30/30.

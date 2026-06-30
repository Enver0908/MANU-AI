# Phase 79: Production-Scale Hardening And Full 100x50 Rehearsal

Date: 2026-06-29
Status: Phase 79A–79I complete.
Production pilot: NO-GO.
R-405: Open.
R-406: Phase 50/52 local baseline mitigated; current migration/RLS re-run pending when local Supabase is unavailable.

## Goal

Harden production-scale read paths, bounded internal copilot loaders, scoped client create/patch, lifecycle redaction evidence, and current RLS evidence; then run a unified full 100 dietitian x 50 client (5,000 client) synthetic rehearsal with hard-zero safety gates — all without real roster data, real client health data, real WhatsApp/Gemini/provider connections, monitoring, secret manager, launch-gate closure, or production GO.

Phase 79 does not resolve R-405. External approvals remain Phase 80. Production pilot remains `NO-GO` through Phase 79 completion.

Phase 79I is a remediation closure layer for the four post-review gaps found after Phase 79A-79H: notification window scope filtering, Supabase create/patch post-mutation broad reloads, dashboard windowed runtime overclaim, and full rehearsal test narrowing.

## PRD

After Phase 78 confirmed R-405 remains open with no safe stable patch path, Phase 79 became the direct-pilot completion step before external launch-gate closure (Phase 80).

Phase 69 established synthetic 100x50 scale fixtures and pagination contract design. Phase 53 classified broad read paths. Phase 77X expanded AI quality rehearsal at 100x50 with hard-zero gates. Phase 77AG added mock channel replay at direct-pilot scale. Phase 77AH closed the WhatsApp mock/gated adapter track.

Phase 79 closes the gap between contract design and runtime hardening:

- Windowed dashboard reads without breaking existing `/api/app-state` consumers.
- Scoped client create/patch without broad `loadSupabaseState` dependency.
- Bounded internal copilot tool loaders.
- Transactional removal/anonymization redaction evidence.
- Current RLS/migration evidence pass when local Supabase is available.
- Unified acceptance chain binding AI rehearsal, channel replay, production-scale tests, and `release:verify`.

## Non-Goals

- Real 100-dietitian roster or 5,000 real clients.
- Real WhatsApp, Telegram, Gemini, monitoring, secret manager, or backup provider connections.
- Production pilot GO or launch-gate closure.
- R-405 remediation or formal risk acceptance.
- UI rewrite beyond contract-safe scoped reload helpers.
- Hard-delete or production lifecycle enablement.

## Hard-Zero Acceptance Contract

All Phase 79 unified rehearsal and closure evidence must report zero for every metric below. Any non-zero value blocks Phase 79 closure.

| Metric | Contract |
| --- | --- |
| `unsafe_green_count` | Green client-facing sends must not bypass food-rule, clinical, or scope boundaries |
| `yellow_red_client_send_count` | Yellow/red held or classified clients must not receive client-facing AI sends |
| `duplicate_client_send_count` | Duplicate provider/inbound events must not create new client-facing sends |
| `unknown_identity_provider_call_count` | Unknown or ambiguous channel identities must not reach provider decisions |
| `source_unsupported_green_count` | Green sends must not proceed without approved source authority |
| `claim_outside_manifest_count` | Rendered client text must not violate claim-manifest grounding |
| `removed_client_operational_access_count` | Removed or anonymized clients must not reach simulator, channel, copilot, or dashboard operational paths |

Existing Phase 77X measured thresholds (for example `style_soft_mismatch_rate <= 0.35`) remain in force but are not hard-zero gates unless explicitly listed above.

## Sanitized Launch Placeholder Manifest

Phase 79 must not request real user-supplied launch documents. External launch inputs are represented as sanitized placeholders until Phase 80.

| Launch artifact | Status |
| --- | --- |
| 100 dietitian roster plan | missing |
| 5,000 client launch structure | missing |
| Client qualification plan | missing |
| Rollback owner | missing |
| Launch date target | missing |
| Pilot communication plan | missing |

Operational health and evidence aggregates may count missing placeholders but must not invent or request real roster/client data in-repo.

## Sub-Phases

Phase 79 must not be implemented in a single command. The decision-complete sub-phase order is fixed.

### Phase 79A — Master PRD / Tech Spec And Acceptance Contract

Goal: create this spec with decision-complete sub-phases, hard-zero metrics, documentation scope, and sanitized launch placeholder manifest.

Exit criteria:

- This spec is complete.
- No runtime behavior changes.
- `git diff --check` passes.
- Targeted docs consistency check passes against Phase 78 baseline and `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`.

Status: complete on 2026-06-29.

### Phase 79B — Dashboard Windowed Read Contract Runtime

Goal: add bounded/windowed read helpers without breaking the existing full `ManuAppState` API shape expected by the UI.

In scope:

- Supabase windowed read payload helper replacing tenant-wide full snapshot for production scale:
  - client list cursor + limit cap
  - selected client detail scoped reload
  - timeline/message window
  - handoff window
  - notification window
  - audit/event aggregate-only window
- Fallback/local path using the same contract with the synthetic 100x50 fixture.
- Existing `/api/app-state` remains unchanged.
- Read contract status updates:
  - `dashboard_state_snapshot` gains Phase 79 windowed runtime evidence.
  - demo reset and legal/admin broad reads remain intentional broad.

Tests:

- cursor cap and invalid cursor fail-closed
- hidden/removed client leak absent
- selected client scope: no raw messages outside selection
- aggregate health payload excludes raw phone/message/prompt/secret data

### Phase 79C — Scoped Client Create And Client Patch Runtime

Goal: surgically reduce broad `loadSupabaseState` dependency in `createSupabaseClientRecord` and `patchSupabaseClientRecord`.

In scope:

- API response shape preserved for UI via full state merge-safe return or hook-level scoped mutation merge helper; both paths must not be left half-implemented in one sub-phase.
- Client create: direct insert bundle, tenant/dietitian assignment, scoped client/conversation reload, duplicate phone validation preserved.
- Client patch: client-id scoped loader; context revision / AI-control audit behavior preserved; red lock, menu summary lock, phone uniqueness unchanged.

Tests:

- duplicate phone conflict
- AI control audit event
- removed client patch fail
- unrelated client messages not loaded/returned
- dashboard hook state consistency

### Phase 79D — Bounded Internal Copilot Tool Loaders

Goal: replace broad state in `runSupabaseInternalCopilotMessage` with tool-specific bounded scoped state.

Limits:

- recent messages max 20
- handoffs max 10
- AI decisions max 10
- forms latest/scoped
- source refs minimized

Constraints:

- Copilot remains read-only; no mutation, raw SQL, or real provider egress.
- Ambiguous/not found/unsupported behavior preserved.
- Assistant/auditor copilot chat remains blocked.

Tests:

- visible client resolve
- hidden/removed client blocked
- no raw hidden state leak
- bounded source refs
- audit/tool-call records tenant/dietitian scoped

### Phase 79E — Client Removal / Anonymization Transactional Evidence

Goal: clarify and evidence the removal/anonymization path under one production-scale contract.

In scope:

- Verified redaction evidence across:
  - client profile identity
  - channel identities
  - conversation memories
  - messages/drafts
  - form responses
  - context updates
  - update proposals
  - food-rule profiles
  - menu plans
  - AI decisions
  - handoffs/notifications
  - channel deliveries
  - audit minimization

Constraints:

- No real hard-delete or production lifecycle enablement.

Tests:

- removed client cannot enter simulator/channel/copilot paths
- channel delivery records removed
- conversation memory cleared
- food/menu/profile raw data redacted
- evidence aggregate-only without raw health data

### Phase 79F — Current RLS / Migration Evidence Pass

Goal: record current RLS evidence when local Supabase is available.

Rules:

- If local Supabase exists: run `npm run test:rls` and record results in Phase 79 evidence.
- If local Supabase is unavailable: sub-phase does not fail; record `current migration/RLS re-run pending`.
- R-406 narrative:
  - Phase 50/52 baseline local RLS mitigation remains valid.
  - Postconditions after Phase 76N and Phase 77AA–77AI require current re-run when local Supabase is available.

Minimum RLS scope:

- `channel_deliveries`
- `channel_adapter_rollback_controls`
- `inbound_quarantines`
- internal copilot records
- client removal/anonymization related rows
- assistant/viewer/auditor boundaries

Production GO remains prohibited.

### Phase 79G — Unified Full 100x50 Production-Scale Rehearsal

Goal: bind existing and new acceptance commands into one Phase 79 closure chain.

Acceptance chain:

- `npm run rehearse:ai:expanded`
- `npm run rehearse:channel:replay`
- Phase 79 production-scale acceptance tests
- `npm run release:verify`

Aggregate metrics:

- AI quality 5,000 case status
- channel replay 5,000 client status
- direct pilot scale readiness
- rollback evidence
- lifecycle removed-client evidence
- ops placeholder missing evidence count

Rules:

- Normal unit tests may skip heavy full replay; the dedicated acceptance command must run full scale.
- Any hard-zero metric failure blocks Phase 79 closure.

### Phase 79H — Evidence, Risk, Gate And Continuity Closure

Goal: update continuity, pilot, gate, risk, and final readiness docs when Phase 79B–79G succeed.

Minimum continuity updates:

- `HANDOFF_FOR_NEXT_CODEX.md`
- `PLAN.md`
- `PROJECT_PLAN.md`
- `README.md`
- `app/README.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`
- `docs/PILOT_READINESS_EVIDENCE_PACK.md`
- `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`
- `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`
- this spec
- `docs/RISK_REGISTER.md` when risk narrative changes

Risk narrative updates:

- R-411 scale risk: stronger mitigated/partially mitigated narrative after runtime hardening.
- R-115 broad read risk: updated after Phase 79B–79D runtime work.
- R-105/R-106 lifecycle scope: updated after Phase 79E evidence.
- R-406: current re-run result or explicit pending status.
- R-405: remains open.

Production pilot status in all docs: `NO-GO`.

## Added API / Type Surfaces

Sub-phases 79B–79G added aggregate evidence types:

- `Phase79ProductionScaleReadiness`
- `Phase79WindowedReadEvidence`
- `Phase79LifecycleRedactionEvidence`
- `Phase79UnifiedRehearsalMetrics`

Operational health aggregate-only fields:

- `phase79ProductionScaleStatus`
- `phase79HardZeroFailureCount`
- `phase79WindowedReadReady`
- `phase79LifecycleReady`
- `phase79CurrentRlsEvidenceStatus`
- `phase79ProductionScaleReady`

Supabase read contract status enum extensions for Phase 79 runtime states.

No public real-provider or real-channel interface may open in Phase 79.

## Test Plan

Per sub-phase:

- targeted tests for the sub-phase scope
- `git diff --check`

Phase 79 closure (79H):

```text
cd app && npm test
cd app && npm run rehearse:ai:expanded
cd app && npm run rehearse:channel:replay
cd app && npm run release:verify
cd app && npm run test:rls   # only when local Supabase is available
```

Expected final state:

- all local/mock acceptance tests pass
- production dependency audit reports only known R-405 findings
- full 100x50 AI/channel rehearsal hard-zero pass
- production pilot remains `NO-GO`

## Assumptions

- Phase 79 uses synthetic fixtures only; no real roster or client data.
- External approvals defer to Phase 80.
- UI non-breakage outranks broad-read cleanup speed.
- R-405 is not resolved in Phase 79.
- R-406 extends only when a current local Supabase RLS run exists; otherwise pending.

## Phase 79A Verification

Verified on 2026-06-29:

- Created this master spec with decision-complete sub-phases 79A–79H.
- Fixed hard-zero acceptance metrics and sanitized launch placeholder manifest.
- No runtime code, migration, or dependency changes in Phase 79A.

Required checks:

- `git diff --check`
- targeted docs consistency against Phase 78 closure, direct 100 dietitian plan Phase 79 section, and existing hard-zero metric naming in Phase 77X/77AG/77Y.

## Phase 79A Done Criteria

- Master spec complete with sub-phases, hard-zero contract, placeholder manifest, and planned type/evidence surfaces documented.
- No runtime behavior changed.
- `git diff --check` passes.
- Targeted docs consistency check passes.
- Production pilot remains `NO-GO`; R-405 remains open; R-406 pending narrative preserved.

## Phase 79B Verification

Verified on 2026-06-29:

- Added `app/src/lib/phase-79b-windowed-read-contracts.ts` with windowed read helpers: `windowClientList`, `windowClientDetail`, `windowTimeline`, `windowHandoffs`, `windowNotifications`, `windowAuditAggregate`, `evaluatePhase79bWindowedReadEvidence`, and `buildPhase79bWindowedReadHealthSignal`.
- Added `app/src/lib/phase-79b-windowed-read-contracts.test.ts` with 20 targeted tests covering cursor pagination, limit capping, invalid cursor fail-closed, removed/anonymized client leak prevention, scoped timeline (no raw bodies), handoff/notification windowing, aggregate-only audit (no raw phone/secret/prompt), evidence evaluation, and health signal production.
- Updated `app/src/lib/supabase-read-contracts.ts`: added `phase79_windowed_runtime` status; upgraded `dashboard_state_snapshot` to `phase79_windowed_runtime`.
- Updated `app/src/lib/supabase-read-contracts.test.ts`: added Phase 79 windowed runtime assertion; adjusted Phase 69 contract test.
- Updated `app/src/lib/direct-pilot-scale-readiness.ts`: readiness evaluator now accepts `phase79_windowed_runtime` as a valid status for required contracts.
- Updated `app/src/lib/operational-health.ts`: added `phase79WindowedReadVersion`, `phase79WindowedReadStatus`, `phase79WindowedReadReady`, and `phase79WindowedReadFailures` aggregate fields.
- Existing `/api/app-state` route unchanged.
- `git diff --check` passed (CRLF warnings only).
- `npm test` from `app`: 74 files passed; 449 tests passed, 2 skipped.

## Phase 79B Done Criteria

- Windowed read helpers for client list (cursor+limit), client detail (scoped), timeline (message window), handoffs, notifications, and audit (aggregate-only) are implemented and tested.
- Removed/anonymized clients are excluded from all windowed reads.
- Raw message bodies, phone numbers, secrets, and prompts are excluded from windowed/aggregate payloads.
- Invalid cursor and over-limit requests fail closed.
- Fallback/local path uses synthetic fixture via `paginateDirectPilotItems`.
- `dashboard_state_snapshot` read contract upgraded to `phase79_windowed_runtime`.
- Operational health exposes Phase 79B aggregate fields.
- `/api/app-state` route remains unchanged.
- All tests pass; `git diff --check` passes.
- Production pilot remains `NO-GO`; R-405 remains open; R-406 pending narrative preserved.

## Phase 79C Verification

Verified on 2026-06-29:

- Added `app/src/lib/phase-79c-scoped-client-mutation.ts` with scoped validation state builders, merge-safe mutation helpers, and evidence evaluation.
- Added `app/src/lib/phase-79c-scoped-client-mutation.test.ts` with 7 targeted tests covering duplicate phone conflict, AI control patch merge with audit event, removed client patch fail, unrelated message exclusion, and dashboard state consistency.
- Updated `createSupabaseClientRecord` and `patchSupabaseClientRecord` in `supabase-store.ts` to use `loadSupabaseClientCreateContext` and `loadSupabaseClientPatchContext` instead of broad pre-mutation `loadSupabaseState`.
- Updated fallback `/api/clients` and `/api/clients/[id]` routes to use scoped validation plus merge helpers.
- Upgraded `client_create_scaffold` and `client_ai_control_patch` read contracts to `phase79_windowed_runtime`.
- Added operational-health Phase 79C aggregate fields.
- `git diff --check` passed (CRLF warnings only).
- `npm test` from `app`: 75 files passed; 456 tests passed, 2 skipped.

## Phase 79C Done Criteria

- Scoped create/patch validation replaces broad pre-mutation `loadSupabaseState`.
- Duplicate phone validation, AI-control audit behavior, red lock, menu summary lock, and phone uniqueness preserved.
- Removed client patch fails closed.
- Patch validation state excludes unrelated client messages.
- Merge helpers preserve full `ManuAppState` shape for dashboard hook compatibility.
- Read contracts upgraded for client create and patch paths.
- All tests pass; `git diff --check` passes.
- Production pilot remains `NO-GO`; R-405 remains open; R-406 pending narrative preserved.

## Phase 79D Verification

Verified on 2026-06-29:

- Added `app/src/lib/phase-79d-bounded-internal-copilot-loaders.ts` with bounded tool state assembly, source ref minimization, merge helper, and evidence evaluation.
- Added `app/src/lib/phase-79d-bounded-internal-copilot-loaders.test.ts` with 7 targeted tests.
- Updated `runSupabaseInternalCopilotMessage` to use `loadSupabaseInternalCopilotBoundedContext` instead of broad pre-mutation `loadSupabaseState`.
- Added `loadSupabaseInternalCopilotClientData` with limits: messages 20, handoffs 10, AI decisions 10, form responses 10.
- Updated fallback internal copilot route to use bounded tool state plus merge helper.
- Exported `extractClientQuery` from `internal-copilot.ts` for bounded loader reuse.
- Upgraded `internal_copilot_tools` read contract to `phase79_windowed_runtime`.
- Added operational-health Phase 79D aggregate fields.
- `git diff --check` passed (CRLF warnings only).
- `npm test` from `app`: 76 files passed; 463 tests passed, 2 skipped.

## Phase 79D Done Criteria

- Internal copilot uses tool-specific bounded scoped state instead of broad pre-mutation tenant snapshot.
- Limits enforced: recent messages max 20, handoffs max 10, AI decisions max 10, forms latest/scoped.
- Copilot remains read-only; assistant/auditor chat remains blocked via existing RBAC.
- Visible client resolve, removed/hidden client blocking, bounded source refs, and tenant/dietitian scoped records verified.
- Read contract upgraded for internal copilot tools.
- All tests pass; `git diff --check` passes.
- Production pilot remains `NO-GO`; R-405 remains open; R-406 pending narrative preserved.

## Phase 79E Verification

Verified on 2026-06-29:

- Added `app/src/lib/phase-79e-lifecycle-redaction-evidence.ts` with unified lifecycle redaction contract, domain checklist, operational path blocking verification, and aggregate-only evidence evaluation.
- Added `app/src/lib/phase-79e-lifecycle-redaction-evidence.test.ts` with 6 targeted tests.
- Updated `anonymizeClientDataInState` and `removeClientDataInState` in `app-state-store.ts` to route through `applyPhase79LifecycleRedactionContract`.
- Added operational-health Phase 79E aggregate fields: `phase79LifecycleReady`, `phase79LifecycleRedactionStatus`, `phase79LifecycleDomainCoverageCount`.
- Updated read-contract narratives for `client_anonymization_redaction` and `client_removal_lifecycle` with Phase 79E evidence contract notes (status remains `intentional_broad_read` until legal/RPC approval).
- Domain coverage verified: client profile identity, channel identities, conversation memories, messages/drafts, form responses, context updates, update proposals, food-rule profiles, menu plans, AI decisions, handoffs/notifications, channel deliveries, audit minimization.
- Removed client blocked from simulator, copilot resolve, and patch validation paths; channel deliveries removed; conversation memory cleared; food/menu/profile raw data redacted.
- Evidence aggregate-only without raw health data in health payload.
- No real hard-delete or production lifecycle enablement.
- `git diff --check` passed (CRLF warnings only).
- `npm test` from `app`: 77 files passed; 469 tests passed, 2 skipped.

## Phase 79E Done Criteria

- Removal/anonymization path clarified under one Phase 79E evidence contract wrapping Phase 74 transactional redaction.
- Verified redaction evidence across all 13 lifecycle domains listed in scope.
- Removed client cannot enter simulator/copilot operational paths; channel delivery records removed.
- Conversation memory cleared; food/menu/profile raw data redacted.
- Evidence aggregate-only; no raw health data in operational health payload.
- Read contract narratives updated; broad-read status preserved until legal/RPC migration.
- All tests pass; `git diff --check` passes.
- Production pilot remains `NO-GO`; R-405 remains open; R-406 pending narrative preserved.

## Phase 79F Verification

Verified on 2026-06-29:

- Added `app/src/lib/phase-79f-current-rls-evidence.ts` with local Supabase availability detection, minimum RLS scope manifest, vitest result parsing, optional `runPhase79fCurrentRlsEvidencePass`, and R-406 narrative helpers.
- Added `app/src/lib/phase-79f-current-rls-evidence.test.ts` with 9 targeted tests.
- Added operational-health Phase 79F aggregate fields: `phase79CurrentRlsEvidenceStatus`, `phase79CurrentRlsEvidenceReady`, `phase79R406CurrentReRunStatus`.
- Minimum RLS scope manifest covers: `channel_deliveries`, `channel_adapter_rollback_controls`, `inbound_quarantines`, internal copilot records, client removal/anonymization rows (`data_requests`), assistant/viewer/auditor boundaries.
- `npm run test:rls` executed locally: integration suite skipped (20 tests) because local Supabase env is unavailable; evidence recorded as `pending` with `current migration/RLS re-run pending`.
- R-406 narrative preserved: Phase 50/52 baseline local RLS mitigation remains valid; current re-run pending when local Supabase unavailable.
- Production GO remains prohibited.
- `git diff --check` passed (CRLF warnings only).
- `npm test` from `app`: 78 files passed; 478 tests passed, 2 skipped.

## Phase 79F Done Criteria

- Current RLS/migration evidence pass module records pass, fail, or pending without failing the sub-phase when local Supabase is unavailable.
- Minimum RLS scope manifest mapped to `supabase-rls.integration.test.ts` coverage.
- R-406 narrative distinguishes baseline mitigation from current re-run status.
- Operational health exposes aggregate-only RLS evidence fields.
- All tests pass; `git diff --check` passes.
- Production pilot remains `NO-GO`; R-405 remains open; R-406 pending narrative preserved when local Supabase unavailable.

## Phase 79G Verification

Verified on 2026-06-29:

- Added `app/src/lib/phase-79g-unified-production-scale-rehearsal.ts` with unified aggregate metrics, seven-metric hard-zero contract, Phase 79B–79F runtime evidence checks, sample/full rehearsal runners, and evidence-pack serialization.
- Added `app/src/lib/phase-79g-unified-production-scale-rehearsal.test.ts` with 7 targeted tests (5 sample + 2 full-scale skipped unless `PHASE_79G_FULL_REHEARSAL=1`).
- Added `app/scripts/rehearse-production-scale-79g.mjs` acceptance chain:
  - `npm run rehearse:ai:expanded`
  - `npm run rehearse:channel:replay`
  - Phase 79 production-scale acceptance test (full unified rehearsal)
  - `npm run release:verify`
- Added npm script `rehearse:production-scale:79g`.
- Added operational-health Phase 79G aggregate fields: `phase79ProductionScaleStatus`, `phase79HardZeroFailureCount`, `phase79OpsPlaceholderMissingEvidenceCount`.
- Aggregate metrics cover AI 5,000-case status, channel replay 5,000-client status, direct pilot scale readiness, rollback evidence, lifecycle removed-client evidence, and ops placeholder missing evidence count.
- Normal unit tests skip full unified replay; acceptance command runs full scale via env flag.
- Production GO remains prohibited; R-405 remains open.
- `git diff --check` passed (CRLF warnings only).
- `npm test` from `app`: 79 files passed; 489 tests passed, 4 skipped after Phase 79I remediation.

## Phase 79G Done Criteria

- Unified acceptance chain binds expanded AI rehearsal, channel replay, Phase 79 production-scale tests, and release verification.
- Hard-zero metrics aggregated across AI and channel rehearsals; any non-zero blocks unified status.
- Sample rehearsal passes in normal unit tests; full 100x50 rehearsal gated behind dedicated acceptance command.
- Operational health exposes aggregate-only production-scale fields.
- All tests pass; `git diff --check` passes.
- Production pilot remains `NO-GO`; R-405 remains open.

## Phase 79H Verification

Verified on 2026-06-29:

- Updated continuity docs:
  - `HANDOFF_FOR_NEXT_CODEX.md`
  - `PLAN.md`
  - `PROJECT_PLAN.md`
  - `README.md`
  - `app/README.md`
  - `docs/NEXT_PHASE_EXECUTION_PLAN.md`
  - `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`
  - `docs/PILOT_READINESS_EVIDENCE_PACK.md`
  - `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`
  - `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`
  - `docs/RISK_REGISTER.md`
  - this spec
- Risk narrative updates:
  - R-411 now records Phase 79 runtime hardening and full 100x50 unified rehearsal evidence.
  - R-115 now records Phase 79B–79D windowed/scoped/bounded runtime work.
  - R-105/R-106 now record Phase 79E lifecycle redaction evidence and Phase 79F RLS scope mapping.
  - R-406 now distinguishes Phase 50/52 baseline mitigation from current post-76N/77AA-77AI/79 re-run pending when local Supabase is unavailable.
  - R-405 remains open.
- Full closure command passed: `npm run rehearse:production-scale:79g`.
- Closure command evidence:
  - Expanded AI quality rehearsal: 5,000 cases passed; hard-zero counters at 0.
  - Full mock channel replay rehearsal: passed.
  - Phase 79 production-scale full acceptance tests: passed.
  - `npm run release:verify`: core tests 225/225; app tests 489 passed and 4 skipped across 79 files; production build passed; production dependency audit reports only documented R-405 findings.
- Production pilot remains `NO-GO`; all launch gates remain open; no real WhatsApp/Gemini/provider/monitoring/secret-manager/real client data path was connected.

## Phase 79H Done Criteria

- Continuity, pilot evidence, gate, final readiness, roadmap, and risk docs updated to Phase 79 closure.
- R-411, R-115, R-105/R-106, R-406, and R-405 narratives are consistent.
- Full Phase 79 production-scale acceptance chain passes.
- Production pilot remains `NO-GO`; R-405 remains open; Phase 80 external gate closure is next.

## Phase 79I Remediation Verification

Verified on 2026-06-29:

- Notification windows are now fail-closed against visible entity families used by scoped dashboard state. Removed/anonymized client notifications, removed handoff/client notifications, and unknown notification entity types are excluded from windowed dashboard notification payloads.
- `/api/app-state` keeps the legacy full `ManuAppState` response for backward compatibility, while `/api/app-state?view=windowed` exposes the production-scale windowed dashboard runtime. Supabase-backed `view=windowed` uses `loadSupabaseWindowedDashboardPayload` instead of `loadSupabaseState`.
- `createSupabaseClientRecord` and `patchSupabaseClientRecord` no longer return post-mutation `loadSupabaseState(context)`. They return scoped create/patch mutation payloads, and `useManuState` merges those payloads into the existing browser state.
- Phase 79G full rehearsal coverage now checks the correct `100 x 50 = 5,000` expanded AI target constants, and `app/scripts/rehearse-production-scale-79g.mjs` runs the full Phase 79G test file with `PHASE_79G_FULL_REHEARSAL=1` instead of narrowing to one test title.
- `app/src/lib/supabase-read-contracts.ts` now records the real windowed runtime path and removes stale post-mutation reload wording from client create/patch contracts.
- Targeted verification passed: Phase 79B/79C/79D/79E/79F/79G plus `supabase-read-contracts` tests: 7 files passed, 65 tests passed, 2 skipped.
- `npm run lint` passed with two pre-existing warnings.
- `npm test` passed with 79 files, 489 tests passed, and 4 skipped.
- `npm run build` passed.
- `npm run rehearse:production-scale:79g` passed; release verification inside the chain passed with core tests 225/225 and app tests 489 passed / 4 skipped across 79 files.

## Phase 79I Done Criteria

- The four post-review Phase 79 gaps are closed in code, tests, and contract docs.
- Legacy `/api/app-state` remains backward-compatible; production-scale dashboard evidence is tied to `/api/app-state?view=windowed`.
- Client create/patch production-scale contract has no post-mutation broad state reload.
- Full 79G acceptance coverage is no longer narrowed to a single test.
- Production pilot remains `NO-GO`; R-405 remains open; current RLS re-run remains pending when local Supabase is unavailable.

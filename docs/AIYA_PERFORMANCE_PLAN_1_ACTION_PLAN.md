# AIya Performans Plani 1 - Gecerli Olcum ve Kok Neden Kanitlama

## CANONICAL REVISION - plan1-final-v3 - 2026-09-17

This is the only active Plan 1 execution contract. The user authorized the
overengineering review and plan revision on 2026-09-17. It supersedes v2,
including its stage-order and diagnostic-validity rules, and conflicting
Plan 1 execution directions in the umbrella plan and continuation documents.
The superseded text below is historical, even where it says "current" or
"only active". No historical measurement is reclassified by this revision.

### Current state and scope

Authoritative execution worktree: `C:\Users\Dell\OneDrive\Masaüstü\MANU-AI`,
branch `codex/production-readiness-stage-1`, HEAD
`a2b1e0908b29ece40c797aa9c0a5dda0bbb6513a`, with preserved pre-existing dirty
changes. The former `38c0` directory is empty and is not an execution source;
`43d7` and `605d` are historical detached copies. The missing v3 source files
were recovered from snapshot commit
`e52d7b48a234dbf5e83f6ff836cc7c7640b97e3d` and reconciled under
`docs/WORKTREE_RECONCILIATION_20260918T163307Z_EVIDENCE.json`. This source
recovery changes file availability and provenance only; historical
measurements, findings, and acceptance decisions are not reclassified.

Phases 1-3 and stages 4.1-4.3 retain their historical completed records.
The current-identity v3 local observation and reconciliation stage 4.4 is
complete. Stage 4.7 coverage and finding reconciliation is complete with the
scoped result `DIAGNOSIS_BLOCKED`, 5.1 hypothesis ordering is complete as
`HYPOTHESES_PRE_REGISTERED`, and 5.2 is complete as a provisional single-
variable experiment result, Phase 5.3 is complete as
`LAYER_ATTRIBUTION_INCONCLUSIVE`, and Phase 5.4 is complete as
`COMPLETE / SAFETY_BEHAVIOR_CHECKS_COMPLETE`. The H-5.1-002 candidate loop in
Phase 5.5 is complete as `COMPLETE / INCONCLUSIVE`, and H-5.1-003 is now
complete as `COMPLETE / REPEATABLE_PROVISIONAL_EFFECT`. Phase 5.6 is complete
as `COMPLETE / FINDING_DISPOSITIONS_REVIEWED`: `PERF-F2-001`, `PERF-F2-002`,
and `PERF-F2-003` are `INCONCLUSIVE`, while `PERF-F12-001` and
`PERF-F12-002` are `OPEN_BLOCKED`. Phase 5.7 is complete as
`COMPLETE / DIAGNOSIS_BLOCKED`; Plan 1 is closed for this scoped diagnosis and
zero findings are eligible for Plan 2. The local runtime RLS boundary is
verified, but no runtime fix or Plan 2 entry is authorized.
The earlier documentation-only 4.5/4.6 scope decision is preserved as a
historical decision record in
`docs/AIYA_PERFORMANCE_PLAN_1_V3_PHASE_4_5_4_6_SCOPE_EVIDENCE.json`. The user
explicitly reopened both environments on 2026-09-17 after the physical device
became available; the new environment observations are recorded separately
below. The v2 local run
`aiya-performance-plan1-phase4-4-local-20260916T232938491Z-c7e89cae-3ff5-4595-ac8f-ed5c3ff9923d`
remains `BLOCKED / LOCAL_INVALID_SAMPLES`, 13 valid and 5 invalid under
its original validator. Those counts do not certify v3 timing semantics.
The v3 harness adaptation and targeted capture checks are complete. The first
v3 local J1 probe is recorded separately at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase4-4-local-v3-20260917T073613059Z-e2c3495a-ed74-4eb5-9982-f842efe3c1b8_EVIDENCE.json`
as `IN_PROGRESS / LOCAL_CAPTURE_PROBE_COMPLETE`, with 1/1 observation-valid
and 1/1 successful functional probe. Stages 4.4.1 and 4.4.2 are PASS;
4.4.3 and 4.4.4 are complete in the scoped normal-observation run below. No
causal proof, accepted runtime fix, or Plan 1 completion exists.

The current-identity v3 local observation run is recorded at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase4-4-local-v3-20260917T122335537Z-874d0bea-3ff7-4a24-a5d4-6778c44eef1a_EVIDENCE.json`
as `IN_PROGRESS / LOCAL_OBSERVATIONS_RECONCILED`: 9/9 observations are valid
and 6/9 are successful functional samples. J1 and J2 are 6/6 successful; all
three J3 traces validly record the first More target as abandoned after the
Dashboard navigation while the second target becomes ready. The 4.4.4
reconciliation passed trace integrity, anchored timing, failure-boundary
consistency, and request-lifecycle retention. Performance remains
`NOT_EVALUABLE` and no root-cause or causal claim follows from this run.

The explicitly reopened 4.5/4.6 environment run is recorded at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase4-5-4-6-v3-20260917T121116968Z-2ec41db5-f1df-4ace-8a20-b71a41f259c2_ENVIRONMENT_EVIDENCE.json`
as `COMPLETE / ENVIRONMENT_OBSERVATIONS_CAPTURED`. Hosted, Android Chrome,
and installed Android PWA each have 9/9 observation-valid units; overall
27/27 observations are valid and 17/27 are valid functional samples. Hosted
has 8 successful and 1 incomplete outcome; Android Chrome has 3 successful,
5 failed, and 1 incomplete outcome; the PWA has 6 successful and 3 failed
outcomes. These are diagnostic observations, not official performance
acceptance samples, and no runtime fix or causal result is accepted.

A subsequent retry
`aiya-performance-plan1-phase4-5-4-6-v3-20260917T123931810Z-9b3ff41f-266d-4878-b6ea-9f686f8a90dd`
was started only to verify a behavior-neutral lint cleanup. It ended
`BLOCKED / ENVIRONMENT_OBSERVATIONS_BLOCKED` when later Android Chrome units
became harness-invalid and the PWA unit deadline was reached. Its changed
runner identity is preserved as a separate failed record and is not combined
with the completed environment run. The cleanup was restored to the completed
run's runner identity; the blocked retry does not reclassify the compatible
27/27 observation result.

The corrected 4.7 coverage, finding, environment, and evidence
reconciliation is recorded at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase4-7-reconciliation-v3-20260917T130007581Z-b5e2fa96-bdfd-4535-833d-71169d3982cf_PHASE_4_7_RECONCILIATION_EVIDENCE.json`
as `COMPLETE / DIAGNOSIS_BLOCKED`. It reconciles 36/36 observation-valid
units and 23 valid functional samples across local desktop, hosted, Android
Chrome, and installed Android PWA. Functional outcomes are 23 successful,
5 incomplete, and 8 failed. Every J1 observation maps to `PERF-F2-001`, every
J2 observation to `PERF-F2-002`, and every J3 observation to `PERF-F2-003`;
`PERF-F12-001` and `PERF-F12-002` were not exercised by these journeys and all
five finding dispositions remain unchanged. All required environment outcomes,
observation mappings, manifest checks, redaction checks, and source identity
checks passed. No accepted common-layer delay with a known timing boundary was
established, so performance remains `NOT_EVALUABLE` and no root cause or fix is
claimed. The first 4.7 attempt
`aiya-performance-plan1-phase4-7-reconciliation-v3-20260917T125836248Z-5d5ef2a2-34c3-43ad-b3cb-e7c37ce0f9b9`
is preserved as a separate identity-invalid record because its environment
test source was omitted from the declared input list; it is not the authority
for the current result.

Phase 5.1 hypothesis ordering is recorded at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-1-hypothesis-ordering-v3-20260917T131152166Z-9ddcc5f6-1e16-4ced-83e0-8d028cf17d6f_PHASE_5_1_HYPOTHESIS_EVIDENCE.json`
as `COMPLETE / HYPOTHESES_PRE_REGISTERED`. The register orders four
provisional candidates: `H-5.1-001` shared shell/app-state hydration fan-out,
`H-5.1-002` background polling overlap, `H-5.1-003` dashboard bundle/import/
render work, and `H-5.1-004` warm AI Chat auth/store/readiness. H-5.1-001 has
provisional effect evidence and H-5.1-002 has now been measured as
`INCONCLUSIVE`; H-5.1-003 has now produced a repeatable provisional effect and
the next governed step is 5.6; the AI Chat candidate remains deferred because
it was not exercised by J1-J3. The ordering is still provisional; no candidate
is a confirmed cause or optimization target. The first required 5.2 trace was
`H-5.1-001` and captured route,
shell-bootstrap, app-state, hydration, and target-ready timing before any
runtime change was proposed or accepted.

Phase 5.2 is recorded separately at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-2-single-variable-experiment-v3-20260917T134123969Z-21e8c635-0129-4a48-aca8-45831367a057_PHASE_5_2_SINGLE_VARIABLE_EVIDENCE.json`
as `COMPLETE / REPEATABLE_PROVISIONAL_EFFECT`. The local desktop experiment
used one trace-only variable, `shared_read_start_policy`: A starts app-state
hydration independently and B gates its first trigger on shell bootstrap.
All 9/9 traces were observation-valid across three matched A-before -> B ->
A-after cycles. B was slower at the route-commit-to-target-ready boundary in
all three cycles by 28.5 ms, 292.5 ms, and 89 ms respectively. This is a
repeatable provisional effect for H-5.1-001, not a confirmed cause, official
baseline, accepted optimization, or finding-disposition change. The required
read bodies and client boundaries were present; the ancillary request tracker
also recorded a body-finish deadline on unrelated requests, which remains a
separate diagnostic limitation. The first invalid 5.2 run is preserved and
excluded because its trusted-click observation was lost across document
navigation. The checkpoint reconciliation reads 27 events with a valid hash
chain and ends at `run.status`.

Phase 5.3 is recorded separately at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-3-layer-attribution-v3-20260917T190703732Z-380aeab1-c2ff-4dd5-a42c-54988706de3b_PHASE_5_3_LAYER_ATTRIBUTION_EVIDENCE.json`
as `COMPLETE / LAYER_ATTRIBUTION_INCONCLUSIVE`. The analysis-only stage
reused all 9/9 valid Phase 5.2 traces across three matched cycles and started
no measurement, runtime variable, or checkpoint. App-state store/route and
downstream hydration/readiness show provisional co-variation, but no exact
layer cause is confirmed. DNS/TLS and service-worker paths were not exercised;
auth was observed but not separated, capability/RLS and release identity were
held constant, the response-body path was not dominant, JSON was a small
co-variation, and the unrelated request-tracker timeout remains an ancillary
limitation. Finding dispositions and production `NO-GO` are unchanged. The
next stage was 5.4 applicable safety and behavior checks.

Phase 5.4 is recorded separately at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-4-safety-behavior-v3-20260917T192500000Z-7e539b27-1e6f-4c7c-91ac-1e5d6cf83ca4_PHASE_5_4_SAFETY_BEHAVIOR_EVIDENCE.json`
as `COMPLETE / SAFETY_BEHAVIOR_CHECKS_COMPLETE`. The safe local matrix passed
21/21 focused files and 164/164 tests; auth/session, tenant/capability,
freshness/late-response, mutation revision/conflict/idempotency, and
offline/privacy/reconnect checks passed. The real local cross-user/RLS
integration boundary also passed: 1/1 file and 56/56 tests at
`127.0.0.1:54321`, with no failed or skipped tests. The runner now executes
that boundary reproducibly using process-only local credentials. No
measurement, runtime fix, checkpoint, database reset, migration, provider
traffic, or finding-disposition change occurred before Phase 5.5.

Phase 5.5 H-5.1-002 candidate loop is recorded separately at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-5-candidate-loop-v3-20260918T075150094Z-57b04620-bf53-4c9b-a368-aadc829272b2_EVIDENCE.json`
as `COMPLETE / INCONCLUSIVE`. The trace-only
`foreground_polling_policy` variable was tested in three matched local
desktop A-before -> B -> A-after cycles. All 9/9 traces were observation-valid;
the cycle directions were `B_SLOWER`, `B_FASTER`, and `B_SLOWER`, so no
repeatable direction or causal result was established. B navigation-window
pause/cancel behavior was observed in all three cycles, but that observation
does not establish a product cause or accepted optimization. The runner kept
the raw lifecycle body-capture timeout as a diagnostic field while deriving
trace validity from the relevant successful requests. Four earlier invalid or
interrupted attempts remain preserved under separate identities and are
excluded from the result. The checkpoint has 26 events, a valid hash chain,
and ends at `run.status`; no finding disposition changed, no official baseline
started, and no runtime fix was accepted. Plan 2 remains locked.
The active plan and handoff pointers were reconciled after the run as
documentation-only changes. The evidence retains the measurement-time source
identity; the resulting active-plan hash difference does not rewrite or
invalidate the nine captured traces.

Phase 5.5 H-5.1-003 candidate loop is recorded separately at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-5-candidate-loop-v3-20260918T094941316Z-2e94ad8b-d576-4fa5-9bc0-ddf5c62f673d_EVIDENCE.json`
as `COMPLETE / REPEATABLE_PROVISIONAL_EFFECT`. The trace-only
`target_panel_loading` variable compared the current eager MessagingPanel
with a separately built dynamic split across three matched local desktop
A-before -> B -> A-after cycles. All 9/9 traces were observation-valid, the
dynamic import and panel mount were observed in every B trace, and B was
slower at route-commit to target-ready by `+842 ms`, `+297 ms`, and `+356 ms`.
The effect is provisional diagnostic evidence only: `noCauseConfirmed` remains
true, no exact application root cause or accepted runtime fix follows, and no
finding disposition or official baseline changed. The first same-candidate run
is preserved as `COMPLETE / INCONCLUSIVE` because its B build still mounted
the eager wrapper; the second is preserved as `BLOCKED` with 6/9 valid traces
after the corrected dynamic build exposed the runner boundary issue. Neither
is merged into the latest result. The latest checkpoint has 26 events and a
valid hash chain; the next exact action is the separately governed 5.6 finding
disposition review. Production remains `NO-GO` and Plan 2 remains locked.
The H-5.1-003 evidence likewise retains the measurement-time source identity;
the post-run active-plan reconciliation is documentation-only and does not
rewrite or invalidate its nine traces. At the time of that run, the next exact
action was the separately governed 5.6 review; that review is now recorded
below.

Phase 5.6 is recorded at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-6-finding-disposition-review-v3-20260918T123600Z-aae55ab8-db06-40b5-9d56-8c2de6bbb5e7_EVIDENCE.json`
as `COMPLETE / FINDING_DISPOSITIONS_REVIEWED`. The review used the current
4.7, 5.1, 5.2, 5.3, 5.4, H-5.1-002, and H-5.1-003 evidence without starting a
new measurement or checkpoint. `PERF-F2-001`, `PERF-F2-002`, and
`PERF-F2-003` remain `INCONCLUSIVE`: the provisional effects were measured,
but no exact current code/function cause or limited contributor was isolated.
`PERF-F12-001` and `PERF-F12-002` are `OPEN_BLOCKED` because the required
authenticated AI Chat readiness evidence is unavailable. All five
`phase1Status` values remain preserved, no finding is eligible for Plan 2, and
production remains `NO-GO`. The completed Phase 5.7 closure is recorded below
as `DIAGNOSIS_BLOCKED`.

Phase 5.7 is recorded at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-7-plan1-closure-v3-20260918T125452Z-f5305ee2-b35b-43c5-91df-42f313d0da29_EVIDENCE.json`
as `COMPLETE / DIAGNOSIS_BLOCKED`. Plan 1 is closed for this scoped diagnosis.
The prioritized Plan 2 input contains five entries, but
`eligibleFindingIds=[]`; no limited runtime change is authorized. Closure is
blocked by the two `OPEN_BLOCKED` AI Chat findings and the three
`INCONCLUSIVE` general findings. A separately authorized diagnostic
continuation for the reported general desktop interaction delay is required
before any further causal claim. It must localize shared application layers
before an AI Chat-specific branch is considered. Production remains `NO-GO`.

Plan 1 diagnoses general desktop slowness and prepares evidence for Plan 2.
Plan 2 implements accepted fixes; Plan 3 verifies the resulting candidate.
Production remains `NO-GO`. Preserve real user auth/RLS, tenant isolation,
atomic/idempotent mutations, append-only migrations, and PWA privacy-lock.
Use existing synthetic fixtures and authorized test environments. No real
health data, provider/Z.ai or WhatsApp traffic, live billing, production
workers, offline health-data cache, or mutation queue is authorized.
Deploy, migration, dependency/secret changes, paid resources, commit, push,
PR, and merge still require their separate explicit authorization.

### Review decisions

| Reviewed requirement | Decision for v3 | Reason |
| --- | --- | --- |
| 4.1 identity lock and 4.2 reference separation | Keep existing records; recheck only inputs needed by the next unit | Dirty runtime changes make attribution necessary; repeating the whole inventory for every probe adds no causal evidence |
| 4.3/4.4 every action and read must succeed for any useful trace | Split observation validity, functional result, and speed result | A correctly observed failure is evidence for diagnosis |
| 4.4 fixed 18-unit normal/diagnostic sweep as a stage gate | Inspect one correct journey first; expand only after capture is trustworthy | Repeating an incorrect timer or selector reproduces a measurement defect |
| 4.5/4.6 must finish before any local causal investigation | Gate each investigation on its actual inputs | A missing phone does not prevent a desktop hypothesis test |
| 4.7 always require a common-layer delay | Permit scoped and not-reproduced outcomes | The complaint must guide the search, not force a predetermined cause |
| 5.2 three A-B-A cycles before useful exploration | Allow one exploratory cycle; retain repeated evidence for confirmation | Discovery and confirmation serve different purposes |
| 5.3/5.4 inspect every layer and every safety case for every probe | Trace the suspected boundary; expand checks according to touched behavior | A selector correction and an auth/store experiment have different risks |
| Restart all downstream work on any identity change | Record the change and invalidate only dependent units | Documentation-only edits do not invalidate a runtime trace |
| Full document/build ceremony for every small step | Checkpoint each unit; reconcile documents at meaningful stops and closure | Durable progress does not require duplicate narrative after each command |

The official nine-scenario x 20-valid-sample contract and 28-attempt limit
are unchanged. They belong to formal acceptance, not exploratory diagnosis.
No historical failed, stale, skipped, interrupted, simulated, or blocked
record becomes PASS. The five finding dispositions are assigned only by the
separately recorded 5.6 review; later stages must not infer a stronger
disposition from a budget failure or a provisional candidate effect.

### Execution dependencies

Use the following dependencies instead of an unconditional numeric barrier:

- 4.1/4.2 identities -> 4.3 capture semantics -> 4.4 local observation.
- A trustworthy local observation -> 5.1 hypothesis -> 5.2 experiment ->
  5.3 attribution and 5.4 applicable safety checks.
- 4.5 hosted and 4.6 device comparisons are required when the hypothesis or
  intended claim includes those environments; otherwise record them as
  deferred with a reason. Deferred is never PASS.
- 4.7 reconciles coverage and diagnostic outcomes. 5.6 assigns dispositions;
  5.7 closes the scoped Plan 1 result and prepares the Plan 2 input.

A failed prerequisite blocks only its dependent work. A broken capture path
blocks conclusions from that path, while code inspection, capture repair,
and independent observations may continue. Do not promote phase completion
until its declared required work and evidence checks are complete.

### 4.3/4.4 - Correct capture, then local diagnosis

Reuse the existing runner and checkpoint store. Adapt their v2 descriptors
and validators before executing a v3 run; the document alone does not make
the current runner compliant.

1. Prepare a real synthetic owner session and ready client workspace.
   For J1, finish roster/client selection before measurement. Start the
   two-second interval at the trusted Forms click, then send Nutrition even
   if Forms is still loading. Keep J2 Clients -> Messages and J3 More ->
   Dashboard as independent broad-interaction checks.
2. Record planned dispatch, actual trusted click, actual route transition,
   target readiness, and relevant request lifecycle. Do not label a
   post-ready URL check as route-commit time. If the first click never occurs,
   record capture/action failure; never invent the timer anchor.
3. Give every started relevant request a terminal observation: completed,
   failed, aborted, or pending at the bounded observation deadline. Record
   whether an abandoned panel unmounted. Do not require a departed panel to
   become visible again. Cancellation is expected only when observed and
   consistent with the screen lifecycle, not merely because a timeout arose.
4. Verify capture with one local J1 observation and focused checks for timer
   anchoring, visible selectors, navigation-away, slow response, and genuine
   target failure. Keep panel-mounted and data-ready boundaries distinct.
   A successful click API return alone does not prove target acceptance.
5. Once capture is trustworthy, collect three normal observations for each
   J1-J3 journey. Review failures immediately. Add diagnostic observations
   only for an unresolved boundary; collect enough matched valid traces for
   any later confirmation claim. Do not repeat unaffected journeys after a
   narrowly scoped capture correction unless their inputs changed.
6. Record missing/failed requests and intended navigation preference writes
   explicitly. A preloaded Messages read must be linked to its observed
   authenticated load and data-ready state, not omitted simply to pass a
   required-read check. Successful required reads still require 2xx and
   body completion. Unexpected mutation remains a behavior failure.

Keep three independent result fields:

| Field | Meaning |
| --- | --- |
| observationValidity | VALID when action identity and the claimed boundary/outcome are reliably observed; otherwise INVALID with the missing evidence |
| functionalOutcome | SUCCESS, FAILURE, or INCOMPLETE, including abandoned first action and target action outcomes separately |
| performanceOutcome | WITHIN_BUDGET, OVER_BUDGET, or NOT_EVALUABLE; state which boundary was measured |

A timed-out user operation may have a valid failure trace but cannot be a
successful functional sample or an official baseline sample. Missing
telemetry remains invalid for claims needing it. An observation-window end
does not prove where the runtime stalled. Auth/network errors remain visible
outcomes, never slow-success samples or hidden retries. Keep all attempts,
including slow and interrupted ones.

Local diagnosis may end as `LOCAL_OBSERVATIONS_READY`,
`NOT_REPRODUCED_IN_DIAGNOSTIC_SCOPE`, or `DIAGNOSIS_BLOCKED`, with exact
coverage and remaining gaps. Do not wait for all user operations to succeed
before investigating their correctly observed failures.

### 4.5/4.6/4.7 - Proportionate environment coverage

Use hosted comparison for a local/hosted discrepancy or a hosted-specific
claim. Use physical Android/PWA comparison for a device, service-worker,
responsive-layout, or cross-environment claim. Record required, deferred,
and blocked environments with reasons before the relevant experiment.
An unavailable required environment limits that claim; independent desktop
diagnosis may continue. Do not claim cross-environment acceptance from local
evidence. Keep the historical Android 17/28 result incomplete.

At 4.7 reconcile journeys, affected shared or feature-specific layers,
finding IDs, environment coverage, and evidence integrity. Close the scoped
diagnosis as `WEB_DIAGNOSIS_READY`,
`NOT_REPRODUCED_IN_DIAGNOSTIC_SCOPE`, or `DIAGNOSIS_BLOCKED`.
No confirmed cause is required for an honest not-reproduced/blocked outcome.

The prior 4.5/4.6 claim-scope decision is retained for auditability but was
superseded for execution by the user's explicit reopening on 2026-09-17. The
new hosted/device observations are diagnostic environment coverage, not
environment acceptance, official baseline data, or cross-environment causal
evidence.

### 5.1-5.5 - Candidate investigation and confirmation

Order candidates by measured contribution and user impact. For one candidate,
record the mechanism, exact file/function, one variable, expected boundary,
controls, applicable safety checks, and rollback in the existing run notes.
An exploratory A -> B -> A cycle may begin after a trustworthy relevant
observation; it does not require three pre-existing successful journeys or
completion of unrelated environment comparisons.

Keep account, fixture, runtime inputs, browser, network/cache mode, and route
order matched. Record separate artifact identities when the experiment
necessarily changes a build; hold all unrelated build inputs constant.
Runtime experiments remain explicit, reversible, single-variable probes,
not accepted fixes. Test state-provider persistence and single-flight
hydration separately before a combined experiment.

An exploratory result is provisional. `CAUSE_CONFIRMED` still requires
at least three matching valid traces, exact file/function attribution, and
a repeatable controlled single-variable result, including return-to-A
evidence. Use three matched A -> B -> A cycles for confirmation, with at
most five attempted cycles for that candidate/protocol. Keep failures and
inconclusive results visible; never create fresh runs to evade the limit.
A changed hypothesis must explain what new evidence justifies another test.

Expand tracing only where attribution remains ambiguous. Check affected
behavior before interpreting a speedup: auth/state/store changes require
tenant/session/role, freshness, late-response, and mutation-conflict checks;
PWA changes require offline/privacy/reconnect checks. Faster results obtained
by skipping required data or security are behavior failures. Stop unchanged
repetition when it yields no new information; record INCONCLUSIVE or a
specific blocker and investigate the next supported candidate.

### 5.6/5.7 - Dispositions and Plan 2 handoff

Use the existing finding IDs and dispositions: CAUSE_CONFIRMED,
CONTRIBUTING_FACTOR_CONFIRMED, MEASUREMENT_GAP_RESOLVED, NOT_REPRODUCED,
INCONCLUSIVE, or OPEN_BLOCKED. Measurement repair alone does not justify
runtime remediation. A contributor needs repeated measured evidence and
must state its limited attribution.

Produce Plan 2 input containing affected journeys/environments, exact
evidence, effect, proposed limited change, risks, regression checks, rollback,
and unresolved dependencies. Close Plan 1 as ROOT_CAUSE_EVIDENCE_READY,
NO_RUNTIME_CAUSE_CONFIRMED, or DIAGNOSIS_BLOCKED according to the evidence.
A limited desktop result cannot close deferred device or production gates.

### Evidence, resume, and verification

Use existing checkpoint tools; do not add another orchestration framework.
Before measurement, use a separate v3 identity and declare the output:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_<runId>_EVIDENCE.json` (safe filename runId).
Include parent run references and plan revision. Preserve every v2 evidence
file and manifest; do not overwrite them with v3 results or silently migrate
their validity counts.

Checkpoint each completed diagnostic observation/experiment boundary.
Unfinished units stay incomplete. Reuse unaffected work only with verified
inputs and outputs; explain invalidated units on source/harness/fixture/
artifact changes. Never merge measurements across incompatible identities.
Documentation-only changes require a revision note, not a new runtime sweep.
Keep official nine-scenario round atomicity and attempt accounting unchanged.

Evidence contains identities, actions/outcomes, relevant boundary timings,
finding links, limits, and next action. Exclude credentials, cookies, tokens,
raw bodies/prompts, clinical data, and device serials. The latest evidence
is the result authority; HANDOFF and NEXT_PHASE hold short pointers.
At stage completion, blocked stop, or session handoff, reconcile those
pointers and actual changed risks. Edit this contract only when scope,
acceptance, or its current-state note changes; do not duplicate every sample.

For code changes run focused tests plus required typecheck/lint/build.
Broaden safety/regression coverage according to the changed behavior.
For documentation-only revisions verify authority, links, historical-evidence
preservation, consistency, and git diff --check/status; runtime tests/build
do not validate prose and need not be rerun.

### Immediate continuation

The 4.3/4.4 harness now anchors the two-second interval to the trusted Forms
click, records observed route events, represents navigation-away and target
failure separately, and keeps observation validity independent of successful
sample validity. The scheduler and focused capture checks passed, followed by
the current-identity local run and its 4.4.4 reconciliation. The local run
has 9/9 observation-valid units and 6/9 valid functional samples. The user
then explicitly reopened 4.5/4.6; the separate environment run completed
27/27 observation-valid units across hosted, Android Chrome, and installed
Android PWA, with 17/27 valid functional samples. The corrected 4.7
reconciliation is complete as `DIAGNOSIS_BLOCKED`. Performance remains
`NOT_EVALUABLE`; these are diagnostic observations, not official acceptance
or a root-cause result. Phase 5.1 is complete as
`HYPOTHESES_PRE_REGISTERED`, and the separately authorized 5.2 experiment is
complete as `REPEATABLE_PROVISIONAL_EFFECT`; Phase 5.3 is complete as
`LAYER_ATTRIBUTION_INCONCLUSIVE`; Phase 5.4 is complete as
`SAFETY_BEHAVIOR_CHECKS_COMPLETE`, including 56/56 local runtime RLS tests;
and the H-5.1-002 loop in Phase 5.5 is complete as `INCONCLUSIVE`; H-5.1-003
is complete as `REPEATABLE_PROVISIONAL_EFFECT` without confirming a cause or
accepting a runtime fix. The 5.6 disposition review and 5.7 closure remain
authoritative as `COMPLETE / DIAGNOSIS_BLOCKED`; the separately authorized
shared-runtime localization below is diagnostic-only. No runtime fix, Plan 2
entry, or finding-disposition change follows from the earlier provisional
effects, safety checks, or the localization result.

The separately authorized first three shared-runtime localization stages are
now complete. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-localization-v1-20260920T160215Z-7f672bcb-8f49-4b20-bc11-c26c578f7021_EVIDENCE.json`.
The local runner verified that its test server used Docker Supabase at
`127.0.0.1:54321`; hosted Supabase latency and external provider latency were
not measured. The run completed 12/12 observation-valid units and 3/3
successful selected J1 diagnostic units. The required
`food-rule-profile` read and the following readiness/React interval are the
current diagnostic boundary, with response-header latency
`312/320/395` ms, route timing `295.65/302.13/375.75` ms, and
body-finish-to-ready `129/163/144` ms. The three records each retained
`53` total and `24` API requests.

This is a localization result, not a root-cause result: the DB sampler saw two
lock-wait/blocked-activity samples before the second trusted event and none in
the second-action window; no official baseline, finding disposition, runtime
fix, Plan 2 entry, or production decision changed. The next exact action is a
separately governed single-variable A-B-A experiment around either read
scheduling or post-response state/commit scheduling, never both together.

### Shared-runtime dirty-registration commit-ownership continuation - 2026-09-20

The separately authorized local Docker A-B-A continuation is recorded at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-dirty-registration-ab-a-20260920T193800Z-57dc30c0-54ee-45a7-b69b-7cedb280df42_EVIDENCE.json`.
It tested one process-scoped variable only:
`NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY`. Legacy A retains
`input.onSave` function identity in the first
`useShellDirtyRegistration` effect dependency; stable B uses `saveRef`; A2
restored legacy. The source hashes, fixture, auth, route, request tracking,
profiler instrumentation, and local Supabase target were held constant.

Profiler ownership reversed sharply in all three observed repetitions:
`shell-provider` A1 `2270/2187/2216`, B `37/34/37`, A2 `2082/2081/1892`;
`dashboard-shell` A1 `2269/2186/2215`, B `36/33/36`, A2 `2081/2080/1891`.
This is strong contributing-mechanism evidence for a dirty-registration loop
that repeatedly re-enters the shared shell. It is not yet an exact root-cause
claim because B J1 repetition 1 failed the required forms read and is
`validSample=false`; only 2/3 selected B J1 diagnostic repetitions are valid
and successful. The runner aggregate's 12/12 `observationValidity` count is
intentional structural-trace validity, separate from the stricter full-success
`validSample` gate; a later retry does not erase an earlier failed required
request. This is not a harness contradiction.

The valid B second-action values were `404` and `922` ms, so speed did not
improve repeatably. A1/A2 valid traces retained the `53` total / `24` API /
`3` document fan-out. Stable remains a process-scoped diagnostic candidate,
not a default behavior or accepted fix. Phase 5.7 closure remains
`COMPLETE / DIAGNOSIS_BLOCKED`, all finding dispositions and Plan 2 eligibility
remain unchanged, and production remains `NO-GO`. The validity-boundary
recheck is recorded below; stable remains process-scoped and unaccepted.

### Validity-boundary recheck - 2026-09-20

The separately recorded recheck is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-dirty-registration-validity-recheck-20260920T213200Z-47b48402-c132-4a97-a121-8339aeec8666_EVIDENCE.json`.
The source measurement run is
`aiya-performance-plan1-shared-runtime-diagnostic-v3-20260920T200138105Z-49fb2c79-a39a-49bc-a567-d66663c6a0b0` and the recheck evidence SHA-256 is
`3BA9B66C45277B14F80658FFF049F904AE4855CBF15AE32B98830C2FCCFC4EF3`.
It recorded `12/12 observationValidity`, `6/12 validSample`, and `6/12`
functional successes. Normal J1 was `0/3` valid because each repetition had
an earlier failed matching `/api/clients/:clientId/forms` attempt followed by
a later complete `200`; the required-read rule correctly did not promote the
retry. J2 was selected for diagnostics and was `3/3` valid, so no new J1
profiler evidence was added. The prior "validity contradiction" wording is
superseded by the intentional structural-versus-functional validity split.

This completes the validity clarification, not the performance diagnosis.
The global freeze remains unresolved; the next exact action is to isolate the
aborted first forms request or obtain a separately authorized controlled J1
confirmation, then measure remaining request fan-out and auth/RSC cost.

### Forms abort lifecycle correlation - 2026-09-21

The new continuation evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-forms-abort-lifecycle-correlation-20260921T003915496Z-9e7a44a9-ff04-4778-ab50-46118ca2e6c2_EVIDENCE.json`
with SHA-256
`FCFA4C955375A92442FE16E23887C974CB26E5E25C6CFC0C7A9823BC546324D5`.
The current source run is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-diagnostic-v3-20260921T001812103Z-92ab01f4-7c6e-476c-8de3-00f5c3562e38_SHARED_RUNTIME_DIAGNOSTIC_EVIDENCE.json`
with SHA-256
`DC5EF27612AB83B8B6E875584EC429F1056EBC513711959B265F18437C98B6FD`.

Trace-only lifecycle instrumentation correlated the first Forms request's
bounded `net::ERR_ABORTED` with `useStage6ClientWorkspace` effect cleanup and
its `AbortController.abort()` in `2/3` current diagnostic J1 repetitions.
Current normal J1 was `3/3` successful with no first-Forms abort; current
diagnostic J1 was `2/3` abort/incomplete and `1/3` successful. The earlier
normal run had a first-Forms abort in `3/3`; current diagnostic J1 also had an
aborted Forms RSC request in `3/3`.

This is a localized cancellation mechanism candidate, not a confirmed global
freeze cause. The frequency is variable and the upstream route/history or
state transition that triggers cleanup remains unmeasured. No fix, disposition,
Plan 2 entry, or production decision changes. The exact next action is
sanitized route/history transition capture around the Forms click, then one
reversible single-variable J1 confirmation with that transition isolated.

### Current J1 active-client preference route correlation - 2026-09-21

The supplemental analysis evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-active-client-preference-route-correlation-20260921T085203Z-862ac27d-4543-486f-b1eb-f7d6f6fbce9a_EVIDENCE.json`
with SHA-256
`1FCF1B8F549D1F8190E35B7DE864F57A284EE07A04F8849FFEADF66C1F30EBE7`.
The corrected single-variable run is
`aiya-performance-plan1-j1-active-client-preference-confirmation-v1-20260921T084521559Z-7190e356-128a-4c48-b31e-dd8dc2f081ee`
with evidence SHA-256
`4F44B41C6C27F951F39703D554E020643C37BE367FFAEDABF7BEB9AC4DD4CA7F`.

The corrected run has 9/9 observation-valid repetitions and 6/9 valid
functional samples: A1 `1/3`, B `2/3`, and A2 `3/3`. B's exact
`activeClientId` preference gate passed `3/3`, but B still had a post-Forms
summary route and a required Forms-request abort in `1/3`; the corresponding
counts were A1 `2/3` and A2 `0/3`. Waiting for that response is insufficient,
so the controlled A-B-A result is `INCONCLUSIVE`. It narrows the candidate to
the Stage 6 active-client activation/navigation boundary, but does not prove
the global freeze cause.

The first two protocol attempts remain separate invalid/excluded records. No
finding disposition changed, no runtime fix was accepted, Plan 2 remains
locked, and production remains `NO-GO`. The trace-only
`preference_intent_timing_and_completion` capture is complete; the corrected
correlation result is recorded below. It did not identify a stable
abort-producing transition, so another reversible single-variable J1
confirmation is not authorized.

### Current J1 preference intent timing correlation - 2026-09-21

The supplemental analysis evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-preference-intent-timing-correlation-20260921T122539Z-9f2c7d11-2c35-4a54-9f0a-6d4f7f8d9c21_EVIDENCE.json`
with SHA-256
`C79D40F49BEECEED3D63B64D5DE2FA076070BB11A87E40DE97FBEF4675E84180`.
It is based on the corrected measurement run
`aiya-performance-plan1-j1-preference-intent-timing-v1-20260921T121916766Z-f12d3401-7014-4de4-a5ec-4845ae3599f2`
with evidence SHA-256
`10771A9CE351910B9AC6C3A3A9D6C5C438E445FD99265A7629BD51FFEA540F76`.

The run retained 3/3 observation-valid and 3/3 valid functional samples. All
three preference PATCHes were allowlisted `activeClientId` intents and
completed with HTTP 200, body completion, and settlement. Stage 6 cleanup
followed settlement by 32 ms, 28 ms, and 41 ms. Route ordering was one
strictly-before, one-at-settlement, and one-after; all three required Forms
requests completed with HTTP 200 and none aborted. The first two attempts are
preserved and excluded because lifecycle collection was absent in the first
and the initial analysis read the wrong lifecycle channel in the second.

This is a normal-path timing correlation, not causal proof of the global
freeze and not evidence for a runtime fix. No finding disposition changed,
Plan 2 remains unauthorized, and production remains `NO-GO`. The read-only
comparison with the valid abort-producing lifecycle traces is recorded below.
A conditional J1 confirmation requires a stable abort-producing transition and
separate authorization.

### Current J1 preference-intent to Forms-abort comparison - 2026-09-21

The supplemental comparison evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-preference-intent-vs-forms-abort-comparison-20260921T123323Z-4b8e1a23-7d41-4c6f-9a52-1e3f7b8c6d90_EVIDENCE.json`
with SHA-256
`E6A6363B64CEBFFED0BD21E059249521690A62C576728957BC14C6AAC6560838`.

The clean normal run measured activeClientId preference settlement before
Stage 6 cleanup in 3/3 samples, with cleanup 28-41 ms later and no Forms
abort. The previously-valid abort lifecycle evidence measured Forms effect
cleanup followed by `load_aborted` in 2/2 aborting repetitions 7-10 ms later,
but did not capture preference timing in those same samples. Therefore the
preference-to-abort link remains a measurement gap, not a causal finding.

The existing Forms cleanup-to-abort boundary remains a contributing candidate;
the global freeze remains unresolved. No disposition changed, Plan 2 remains
locked, and production remains `NO-GO`. The matched diagnostic capture is
complete; its result is recorded below. No duplicate preference-only
confirmation is authorized.

### Current matched J1 preference-intent and Forms-abort capture - 2026-09-21

The matched-run analysis evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-preference-intent-abort-matched-analysis-20260921T124727Z-9c4e2b71-6a8d-4f53-b102-7e9c3d5a8f24_EVIDENCE.json`
with SHA-256
`5A10F87B4B0A80B2C424370D489FF795DE8097A498B202DD5D33848C21A28373`.
The measurement evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-preference-intent-abort-matched-v1-20260921T124313022Z-ccf40f62-de85-4c5f-8b1b-2fec306e04b3_EVIDENCE.json`
with SHA-256
`7A8221FA03912A76EA7D16D0DAB0DBBFCE05BADF0432149AA5B0F2A224381C1D`.

The run retained 3/3 observation-valid and 3/3 valid functional samples. All
three preference PATCHes were allowlisted `activeClientId` intents and
completed with HTTP 200/body completion/settlement. Stage 6 cleanup followed
settlement by 39 ms, 24 ms, and 53 ms. All required Forms requests completed
with HTTP 200; abort was `0/3`.

The same-trace capture boundary is valid, but the historical abort was not
reproduced. The preference-to-abort link and global freeze remain unproven. The
next eligible diagnostic is trigger isolation for a reproducible route/state
transition that produces the historical Forms abort; a duplicate matched run
requires separate authorization.

### Current J1 Stage 6 route-state trigger isolation - 2026-09-21

The route-state-complete measurement evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-stage6-trigger-isolation-v1-20260921T131319461Z-fe4a8d23-adf5-40cc-b731-0c512f76cb81_EVIDENCE.json`
with SHA-256
`204E7892DC010E3EC0E0ED4C7432B90303D287E961850AE71296A9FF7A041925`.
The analysis evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-stage6-trigger-isolation-analysis-20260921T131935Z-e026a6cf-2f81-4bdd-82c2-c0dfefb19c31_EVIDENCE.json`
with SHA-256
`8FA31BE6AC891A97D2FE41FDDA8FA5560C9A6CA089319BAD907107C0359BB070`.

The capture retained 3/3 observation-valid and 3/3 successful functional J1
samples, with complete route-state capture in 3/3 and Forms abort in `0/3`.
All current setup sequences were `summary -> forms -> nutrition`. In the
historical lifecycle evidence, both aborting repetitions contained an extra
`summary -> forms -> summary -> forms -> nutrition` sequence; the non-aborting
repetition did not. This is a candidate association only: historical records
lack the new route-state fields, the current run reproduced no abort, and no
single-variable speed or causal confirmation was performed. Performance
remains `NOT_EVALUABLE`; finding disposition, Plan 2 eligibility, runtime-fix
acceptance, and production `NO-GO` are unchanged.

The next eligible work is a separately authorized, reversible, single-variable
confirmation of only the extra summary re-entry boundary. Report functional
outcome and second-action speed separately, and do not repeat the same matched
run automatically.

### Current J1 summary-reentry settlement confirmation - 2026-09-21

The controlled A1 -> B -> A2 measurement evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-summary-reentry-settlement-confirmation-v1-20260921T134112924Z-a9f02392-5f1a-4359-861c-f94bebba8d58_EVIDENCE.json`
with SHA-256
`EA0DA0728A8BDFAF39F3C21FD76FB9679051266BD1F81E0C200F55641DEB3C33`.
The analysis evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-summary-reentry-settlement-confirmation-analysis-20260921T134721Z-e9c0f0c1-7b7d-4c6a-9d54-2f0a1e8b6c3d_EVIDENCE.json`
with SHA-256
`E832AE24BEF0FB4823672E886C98E6D51A64C3301E09DD595A74ACFD4A0FFEAC`.

This separately authorized confirmation changed one harness variable only:
group B waited for the initial client-selection `summary` request to settle
before Forms dispatch; A1 and A2 retained existing timing. The B gate passed
in 3/3 samples, each settling as `request_failed`. All 9/9 samples were
observation-valid and functionally successful. Post-Forms summary re-entry was
`0/3` in A1, B, and A2; Forms request and lifecycle aborts were `0/3` in every
group.

The historical boundary was not reproduced, so the confirmation is
`INCONCLUSIVE`. Second-action tails were captured separately but remain
`NOT_EVALUABLE` for performance acceptance. Finding disposition, Plan 2
eligibility, runtime-fix acceptance, and production `NO-GO` are unchanged. Do
not repeat this same settlement-gated run automatically; global diagnosis
remains blocked.

### Current shared-runtime auth/fan-out/React commit overlap analysis - 2026-09-21

Analysis evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-auth-fanout-commit-overlap-v1-20260921T141433347Z-5146b711-7709-41be-a5a7-c606ead3922c_EVIDENCE.json`
with SHA-256
`27E93792B03C46BF873D34D803A552016CE0D8AADC363D85BAA00DE0340FD40F`.
Analysis runner:
`app/scripts/performance-plan-1-shared-runtime-auth-fanout-commit-overlap.mjs`
with SHA-256
`DD9AB4ABADD3E84DFFED670259E3BE3EBBE45BE13D84D7EB1087C99843E4D715`.
The focused pure tests passed 2/2.

This was analysis-only over the completed local-normal shared-runtime
measurement. No browser rerun, runtime behavior change, official measurement,
or causal experiment occurred. Current app runtime hashes matched the source
evidence 15/15. In 3/3 valid functional J1 traces, first-to-second trusted
interaction fan-out was 7/10/10 API and 9/13/13 RSC requests. The second-action
window was 2/2/2 API plus 1/1/1 RSC in every trace, with distinct React commit
waves 44/40/29 and second-action tails 443/511/422 ms.

Status is `COMPLETE` with outcome
`AUTH_FANOUT_COMMIT_OVERLAP_OBSERVED_AUTH_COVERAGE_INCOMPLETE_GLOBAL_FREEZE_UNRESOLVED`.
Available auth Server-Timing covered only 2/3/4 API requests
(28.6%/30%/40%). Most API routes and all RSC/document auth paths lacked timing;
auth-span placement is an explicitly labeled duration-based inference. The
result observes fan-out and commit-wave overlap, but does not prove a complete
per-API auth chain or causality. Phase 5.7 closure, finding disposition, Plan 2
eligibility, runtime-fix acceptance, and production `NO-GO` remain unchanged.

Next exact diagnostic: with separate authorization, add diagnostic-only timing
to the uninstrumented shared API routes and one bounded server-side marker for
dashboard RSC auth, then run one current-source J1 capture. Do not alter auth
behavior and do not count this analysis as an official acceptance run.

### Current shared-runtime auth coverage capture - 2026-09-21

The separately authorized capture is recorded in
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-shared-runtime-auth-coverage-v1-20260921T153517537Z-2e376ebf-fde3-4868-96bc-6413fcd0a6e5_EVIDENCE.json`
with SHA-256
`A343FF1BD61B423705DCB478DA46E35F5605B6093FFEE3056468F05D323A4968`.
The runner is
`app/scripts/performance-plan-1-j1-shared-runtime-auth-coverage.mjs` with
SHA-256
`49511444070D76970661E82D78AF4CA4E07409A3C3569FC44B812643E20A45A9`.

One current-source J1 trace completed with `VALID` observation,
`SUCCESS` functional outcome, `validSample=true`, and `officialSample=false`.
The browser capture itself completed in the checkpoint; the evidence was
reconstructed from that checkpoint after serialization metadata and identifier
redaction corrections, with no second browser run. Preflight was `PASS` on
local Docker Supabase at `127.0.0.1:54321`.

The trace recorded 24 API requests and 15 timed API responses. Expected route
coverage was conversations `1/2`, alerts `2/2`, notifications `2/2`, shell
preferences `1/1`, client Forms `1/1`, and client detail `0/1` because the
client-detail request aborted before a response. Two bounded RSC server auth
markers were observed for layout and page. The capture outcome is
`COMPLETE / SHARED_API_AUTH_COVERAGE_PARTIAL_RSC_MARKER_OBSERVED`.

This is a measurement-boundary improvement only. It does not prove complete
per-request auth cost, causality, repeatability, or the global freeze cause.
Phase 5.7 closure, finding dispositions, Plan 2 eligibility, runtime-fix
acceptance, and production `NO-GO` remain unchanged. The next exact action is
to review the single trace and the aborted client-detail boundary; a repeat
requires separate authorization.

### Current J1 client-detail abort boundary correlation - 2026-09-21

The read-only analysis evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-client-detail-abort-boundary-analysis-v1-20260921T160221659Z_EVIDENCE.json`
with SHA-256
`6310254DBEFF751530AFABD8C210C4C6136A37B0DDC8AA1BBAF0CDB84D65CB19`.
The analysis runner is
`app/scripts/performance-plan-1-j1-client-detail-abort-boundary-analysis.mjs`
with SHA-256
`C81A7B656A6F7D6479C609922996D097BB988A0A85AE95D19ECF66FA222F9397`.

The analysis reused the completed `1/1` valid functional J1 trace. No browser
rerun, server start, runtime change, official sample, or causal experiment
occurred. The target client-detail GET had no response timing. The same
trace's sanitized route history was selected client, summary, Forms, then
Nutrition; the Stage 6 lifecycle showed summary cleanup, Forms setup, and
summary load abort during the summary-to-Forms domain switch. The source hook
contains the corresponding `AbortController` cleanup and domain-dependent
reload.

Outcome:
`COMPLETE / CLIENT_DETAIL_ABORT_CORRELATED_WITH_STAGE6_DOMAIN_SWITCH_CLEANUP`.
This is a client-side cancellation correlation, not a confirmed defect or
global-freeze cause. It explains the missing response timing but does not
measure server continuation after browser cancellation. Phase 5.7 closure,
finding dispositions, Plan 2 eligibility, runtime-fix acceptance, and
production `NO-GO` remain unchanged. Do not repeat automatically; any
server-completion marker requires separate authorization.

### Current J1 second-action timeline alignment - 2026-09-21

The read-only timeline evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-second-action-timeline-analysis-v1-20260921T170813873Z_EVIDENCE.json`
with SHA-256
`B04435F498184EC20A0DEF0A68985CB6CF96894BB7FD25264B7918C829C9F447`.
The analysis runner is
`app/scripts/performance-plan-1-j1-second-action-timeline-analysis.mjs` with
SHA-256
`A5D899A94D9FD41C04439EB43D0D2545CD1FDE5089EB493E5A65C261FBBF2BE3`.
Its focused pure tests passed `2/2`.

This analysis consumed the completed auth-coverage checkpoint only. It did
not rerun the browser, start a server, change runtime behavior, begin an
official sample, or run a causal experiment. The source trace was `1/1`
valid and functionally successful. The second trusted interaction took
`1,045 ms` to ready: `585 ms` to the required response header, `593 ms` to
the required body boundary, and `452 ms` from body completion to ready. The
window contained three overlapping requests: two API requests and one RSC
request. The required food-rule-profile read exposed `auth_total=341.36 ms`,
`store=167.49 ms`, and `route=542.99 ms`; concurrent shell bootstrap exposed
`auth_total=338.36 ms`, `rate_limit=101.7 ms`, and `route=560.94 ms`.

Two shell context-state commits and Stage 6 lifecycle events were observed in
the body-to-ready tail. No React profiler commit event was present in the
window or full trace, and no long task occurred inside the window; the first
`60 ms` long task began `38.1 ms` after ready. The request-summary and action
timing boundaries also retain `22 ms` request-start and `7 ms` completion
differences, which are reported rather than silently merged.

Outcome:
`COMPLETE / NETWORK_SERVER_FIRST_WITH_CONTEXT_TAIL_MAIN_THREAD_CAUSE_UNRESOLVED`.
The single trace places the largest directly bounded segment before response
body completion and narrows the next comparison to required-read/server
scheduling versus post-response state/commit scheduling. It does not confirm
the global-freeze root cause, convert context commits into a React render
claim, change any finding disposition, authorize Plan 2, accept a runtime
fix, or change production `NO-GO`. The next separately authorized action must
hold request fan-out and the other boundary constant; the two variables must
not be combined.

### Current J1 post-response commit ownership A-B-A candidate - 2026-09-21

The separately authorized current-source local Docker diagnostic evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-post-response-commit-ownership-ab-a-v1-20260921T185539646Z-b4ef5bf1-8927-4107-af0d-a6867406050b_EVIDENCE.json`
with SHA-256
`153C70F8254DCB474B94F1F82211880009F70840219E9D342AE91A87973B3CCA`.
The runner is
`app/scripts/performance-plan-1-j1-post-response-commit-ownership-ab-a.mjs`
with SHA-256
`AE1F95FAB8AF66570018D37EA5FCA37A1E0266FBA36B99E609A9A4612B76B52A`;
its focused tests passed `2/2` and the test-file SHA-256 is
`6706FDC898CB2951150E9D263D34D4B1B0B3E73DB515CFAFB60D0532DCDD4D41`.

Only the process-scoped `shell_dirty_registration_policy` variable changed:
A1 used the legacy registration dependency, B used the stable `saveRef`
dependency, and A2 restored legacy. The J1 journey, synthetic owner fixture,
real auth/RLS/store path, request contract, required-read gate, local
Supabase target, and 2,000 ms second-action boundary were held constant. The
run attempted `9/9` traces, completed with 37 checkpoint events and a valid
hash chain, and retained three PASS DB sampler summaries. No official sample,
runtime default, migration, or production action was started.

A1 and A2 were `3/3` valid functional. B was observation-valid `3/3`, but only
`2/3` was functionally valid: B repetition 3 failed the first-action
`/api/clients/:clientId/forms` required-read completion and was excluded without
retry promotion. In the two fully valid paired repetitions, B shell/dashboard
commit counts were `35/34` versus A1 `1986/1851` and A2 `2020/2908`. This is a
strong post-response commit-ownership signal, but the strict three-valid-record
gate was not met. Request fan-out was invariant in only one paired repetition
(`53/53/53`); repetition 2 was `53/56/56`. B was also slower at the user-facing
trusted-click-to-ready boundary (`966/931 ms` versus A1 `527/607 ms` and A2
`1048/522 ms` in the fully valid repetitions), so no speed improvement was
observed.

Outcome is
`COMPLETE / POST_RESPONSE_COMMIT_OWNERSHIP_SIGNAL_OBSERVED_VALIDITY_OR_FANOUT_BOUNDARY_OPEN`.
The commit signal remains a diagnostic contributor candidate, not a confirmed
global-freeze cause or accepted fix. The first runner attempt is preserved as
a separate invalid record because it passed an unsupported trace-variant label;
its `9/9` harness-invalid traces are excluded. Phase 5.7 remains
`COMPLETE / DIAGNOSIS_BLOCKED`, all finding dispositions and Plan 2 eligibility
remain unchanged, and production remains `NO-GO`. Do not repeat this same
A-B-A automatically. Before any separately authorized continuation, isolate
the B required-read/fan-out validity boundary and keep request fan-out as a
control.

### Current J1 post-response commit fan-out/validity analysis - 2026-09-22

The read-only analysis evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-post-response-commit-fanout-validity-analysis-v1-20260921T224944702Z_EVIDENCE.json`
with SHA-256
`8D2F46DFBD478C350EE254135DF6A2A0AD8D416CDB5FB6B21F17CA5C9F891D8D`.
The analysis runner is
`app/scripts/performance-plan-1-j1-post-response-commit-fanout-validity-analysis.mjs`
with SHA-256
`F5BC8EE21C6D5E6DA56C25059F68906A8218190501FFC87C2AC8AABA91100473`;
its focused tests passed `3/3` and the test-file SHA-256 is
`D3CC74E2735EF8DDABDEEF8F907A708E8DDED079421D03884BFEE6C08CA622D1`.

This was analysis-only: it reused the completed 37-event A-B-A checkpoint,
did not start a browser or server, and made no runtime change. It found that
B repetition 3 has two matching Forms records. The first received HTTP 200
headers but was body-incomplete and failed with a browser abort; the second
completed with HTTP 200. The required-read validator uses every matching
record, so the later success does not promote the repetition. The same trace
has `60` total / `31` API requests versus `53` / `24` in both matched legacy
rows; the seven additional API requests are two bootstrap, one client-summary,
one Forms, one alerts, one notifications, and one conversations request.
Stage 6 also recorded two Forms setup/start cycles, one Forms load abort, and
one Forms success in that trace.

Outcome is
`COMPLETE / B_REQUIRED_READ_ABORT_AND_FANOUT_CONFOUND_OBSERVED_COMMIT_COMPARISON_OPEN`.
The B group remains `2/3` eligible functional, fan-out is invariant in only
`1/2` fully eligible matched repetitions, and the strict three-valid-record
causal gate remains unmet. This explains why the prior commit signal cannot be
promoted to causal evidence; it does not identify the global-freeze root cause,
accept a runtime fix, change any disposition, authorize Plan 2, or change
production `NO-GO`. Do not repeat the same A-B-A. The next exact diagnostic is
a distinct capture that keeps the dirty-registration variable while enforcing
one completed Forms read and a predeclared request-route fan-out envelope.

## Historical Content - plan1-final-v2 (Superseded by plan1-final-v3)

## Superseded revision - plan1-final-v2 - 2026-09-16

This section is the only active Plan 1 execution contract. The earlier
content in this file is retained as historical evidence and is superseded by
this revision. An implementer must follow this revision's phase and stage
order, identity rules, evidence rules, and closure criteria. The current
execution resumes at Phase 4.4 after completed 4.1 identity lock, 4.2
reference separation, and 4.3 diagnostic harness readiness; Phases 1-3 are
inherited after revalidation.

### Purpose and boundaries

Plan 1 measures AIya's general slowness and freezing with real authenticated
sessions, separates the delay by layer, proves or rejects candidate causes,
and produces a prioritized input for Plan 2. Plan 2 is not started by this
document. Production remains `NO-GO`.

The existing local Supabase target, existing synthetic fixtures, existing
approved test VPS, existing physical Android target, and existing measurement
tools are the only permitted environments. No production deploy, production
migration, provider or channel traffic, billing, worker, real health data,
new paid resource, secret rotation, or dependency change is part of Plan 1.
Commit, push, PR, merge, and deployment are outside this plan.

### Non-negotiable execution contract

1. Execute phases and stages in numeric order. A stage is complete only when
   every listed action, output, and verification postcondition is recorded.
2. Do not begin a later stage after `FAILED`, `BLOCKED`, or `STALE`. Record the
   blocker and resume the same stage or an explicitly linked continuation.
3. A phase closes only when its stage ledger, evidence integrity, required
   tests, and document reconciliation pass. Passing tests alone never closes a
   phase.
4. An interrupted work unit is not a valid measurement. Use the shared
   checkpoint store and atomic event boundaries; never recreate or overwrite
   an earlier run to hide interruption.
5. Diagnostic and causal probes are not official baseline samples. The locked
   official contract remains nine scenarios, 20 valid samples per scenario,
   and at most 28 attempts for each official profile.
6. A valid sample requires the real user action, expected route, task-specific
   ready state, all required authenticated reads with `2xx` and body-finish,
   no forbidden mutation, no fallback/demo session, and complete timing data.
7. Auth/network failure, timeout, missing selector, missing required read,
   budget failure, and rendering delay are different result classes. None may
   be discarded or converted into a pass by retrying.
8. No runtime performance change is accepted as a Plan 1 fix. A runtime
   change may be tested only as an explicitly labeled, reversible causal
   experiment and must be transferred to Plan 2 with its evidence.

### Inherited completed work

Phase 1 is inherited from
`docs/AIYA_PERFORMANCE_PLAN_1_EVIDENCE.json` with
`COMPLETE / NO_RUNTIME_CAUSE_CONFIRMED`. Phase 2 is inherited from
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json` with
`COMPLETE / HARNESS_READY_WITH_NEGATIVE_CONTROLS`. Phase 3 is inherited from
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json` with
`COMPLETE / SYNTHETIC_AUTH_STORE_READY`.

The inherited records are not silently rewritten. Their source, fixture,
schema, and hash identities are checked in Phase 4.1. The current canonical
old Phase 4 run remains historical evidence:
`aiya-performance-plan1-phase4-20260915T195604720Z-497a3200-ada3-445d-a2d0-059cb0886940`,
`BLOCKED / PERFORMANCE_BLOCKED`, with two of four environments valid. Its
Android and PWA gaps remain visible and are not converted to PASS.

## Phase 4 - General freeze diagnosis and valid reproduction

Phase 4 determines whether the user's broad interaction problem can be
reproduced on the computer and which shared layers account for the delay. It
does not assume that a single button or AI Chat feature is the cause.

### 4.1 - Plan, worktree, and identity lock

This is the first active stage and must be completed before any new
measurement or experiment.

- Record the exact worktree path, detached/attached branch state, HEAD, remote
  tracking state, recent log, remotes, branch table, remote symbolic HEAD,
  tracked modifications, untracked files, and `git diff --check` result.
- Treat the current dirty tree as an input. Do not reset, revert, stash, delete,
  or overwrite any existing change. Classify every known Phase 4 harness,
  checkpoint, evidence, migration, diagnostic, and runtime change as
  pre-existing until Phase 4.2 assigns it to a reference or experiment.
- Lock `plan1-final-v2`, the worktree path, source HEAD, source status
  snapshot, and the identity of the following files: Phase 2 harness, Phase 4
  harness/tests, readiness contract/tests, package manifests, Next config,
  service worker, web manifest, Phase 3 fixture evidence, Phase 4 migration,
  auth/store/UI entrypoints, and shared checkpoint tools.
- Exclude `.manu-runtime/**`, `app/node_modules/**`, `app/.next/**`, temporary
  render files, credentials, cookies, tokens, raw request/response bodies,
  prompts, clinical data, and device serials from evidence identity values.
- Record customer/admin live release identity and approved test-VPS identity
  as environment references. Do not treat their commit equality as proof that
  source, artifact, fixture, harness, and migration are equal.
- Record that no Phase 4.2 reference snapshot, official baseline, or causal
  experiment has been created by this stage.

The stage closes with a redacted
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_1_EVIDENCE.json` whose status is
`COMPLETE / IDENTITY_LOCKED`, all inherited evidence references are present,
all identity files have hashes, the worktree inventory is complete, and the
next action is exactly 4.2.

### 4.2 - Historical evidence review and reference separation

Read the inherited evidence and the five finding records. For each finding,
record observation, affected surface, missing proof, reproduction journey,
and required closure evidence. Preserve the existing runtime changes, then
create an ignored reference snapshot that differs only by removing the
state-provider/hydration experiment identified in 4.1. If that separation
cannot be produced without changing unrelated files, stop the stage and record
the incompatibility. Do not measure until the reference and current variant
identities are explicit.

#### Phase 4.2 status - 2026-09-16

Phase 4.2 is `COMPLETE / REFERENCE_SEPARATED` in
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_2_EVIDENCE.json`. The ignored reference
snapshot contains the current source and pre-existing runtime, harness,
migration, diagnostic, and checkpoint changes, except for the three explicitly
identified state-provider/hydration experiment files restored to the locked
HEAD. The comparison contains exactly those three runtime mismatches and zero
unrelated mismatches. Historical Phase 4 evidence remains separate and the
old `BLOCKED / PERFORMANCE_BLOCKED` result was not rewritten. No official
baseline, causal experiment, or runtime fix was started in 4.2; the next
eligible stage is 4.3.

### 4.3 - General interaction diagnosis harness

Use the shared checkpoint store and an ordered descriptor for a separate
diagnostic run. Keep normal profiler-off and diagnostic profiler-on modes
distinct. Add three journeys that represent broad slowness:

- J1: open a client workspace, select Forms, wait two seconds, then select
  Nutrition.
- J2: open Dashboard, select Clients, wait two seconds, then select Messages.
- J3: open Dashboard, select More, wait two seconds, then return to Dashboard.

The second action is sent after the fixed two-second interval even when the
first transition is still pending. Record planned action time, dispatch time,
trusted event time, route commit, required request start, response header,
response body finish, parse/render completion, ready-state time, and whether
the second action was accepted. Do not auto-retry a missing click in a
diagnostic journey.

#### Phase 4.3 status - 2026-09-16

Phase 4.3 is `COMPLETE / GENERAL_DIAGNOSTIC_HARNESS_READY` in
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_3_EVIDENCE.json`. The separate
diagnostic harness uses the shared checkpoint store and an ordered
`aiya-performance-plan1-phase4-diagnostic` descriptor. It defines J1, J2,
and J3 with the fixed two-second second-action dispatch, trusted-event,
route, required-request, response-header, body-finish, parse/render, ready,
and second-action-acceptance fields. Normal mode keeps profiler and server
timing off; diagnostic mode enables them. A missing click is recorded once
as a failure and is never retried. No diagnostic journey, official baseline,
or causal experiment was run while preparing this harness. The next eligible
stage is exactly 4.4.

### 4.4 - Local authenticated reproduction

Run J1-J3 with the normal owner account on the existing local normal fixture.
Use the real password session and normal RLS/API path. Collect three normal
repetitions and three trace repetitions per journey. Record overlapping
requests, request count, request status, body size, auth/session timing,
server/store timing, browser parse/render timing, long tasks, and the exact
failure boundary. Run the same journeys against the small fixture only when
4.3 identifies data volume as a candidate variable.

#### Phase 4.4 status - 2026-09-16

Phase 4.4 was started with the separate local runner and checkpoint
`aiya-performance-plan1-phase4-4-local-20260916T204215189Z-371389ea-10c1-4ec4-9858-cc933c1961c9`.
The contract and capture tests passed, but the local app at
`http://127.0.0.1:3136` and local Supabase at `http://127.0.0.1:54321` were
unreachable during the authenticated-input preflight, and the process
environment did not contain the synthetic account inputs. The result is
`BLOCKED / LOCAL_INPUT_BLOCKED`, with zero of 18 planned diagnostic units
started and zero official samples. Credential values were not recorded. The
runner records the real password/RLS requirement, keeps the normal and
diagnostic modes separate, and resumes the same checkpoint after the local
inputs and existing credential configuration are restored. No small-fixture
run, official nine-scenario baseline, causal experiment, hosted/device run,
or runtime fix was started.

#### Phase 4.4 continuation status - 2026-09-17

The local inputs were restored without recording their values. The first
post-preflight run exposed a harness-only responsive-navigation selector bug:
the selector chose a hidden medium-rail copy before the visible shell link.
The selector was corrected to target visible layout copies, and the request
body-finish wait was bounded so an interrupted unit cannot remain live
indefinitely or become valid. Earlier runs remain separate checkpoint
history; historical Phase 4 evidence was not rewritten.

The latest identified local run is
`aiya-performance-plan1-phase4-4-local-20260916T232938491Z-c7e89cae-3ff5-4595-ac8f-ed5c3ff9923d`.
It attempted all 18 diagnostic units and recorded `13` valid and `5`
invalid samples. J2 now reflects the actual preload path: the inbox list is
loaded during authenticated dashboard hydration, and this journey does not
click a conversation detail. J1 records the shell preference PATCH as an
expected navigation mutation and still requires its successful 2xx/body
finish; other mutations remain forbidden.

All five invalid samples are J1 Forms-to-Nutrition repetitions. Their
boundaries are incomplete Forms reads or a missing Nutrition ready/click
boundary under the fixed two-second second action. All J2 and J3 normal and
diagnostic repetitions are valid, so the result is
`BLOCKED / LOCAL_INVALID_SAMPLES`, not a general application root-cause
claim. The stage ledger leaves 4.4.2 and 4.4.3 blocked and 4.4.4 not started.
Phase 4.5, Android/PWA work, the official nine-scenario baseline, causal
experiments, and runtime remediation remain out of scope. The next eligible
stage is still 4.4, and production remains `NO-GO`.

### 4.5 - Computer hosted comparison

Run the same journeys on the owner-PC hosted test account with the same route
order and action interval. Keep the hosted environment identity separate from
local identity. Missing hosted input, failed login, wrong origin, or incomplete
required read blocks the stage; it is not a slow sample.

### 4.6 - Android and installed PWA diagnostic comparison

After the web journeys are captured, use the authorized physical Android
Chrome and independently launched installed PWA targets for short diagnostic
repetitions. Record connection, target, browser/PWA mode, and the same journey
boundaries. A device disconnect, missing target, or incomplete authenticated
path is `OPEN_BLOCKED`; it does not become an application root cause. The
existing official Android 17/28 result remains incomplete evidence.

### 4.7 - Phase 4 closure

Map every observation to one of `PERF-F2-001`, `PERF-F2-002`, `PERF-F2-003`,
`PERF-F12-001`, or `PERF-F12-002`, or create a new explicitly named candidate.
The web diagnosis is ready only when at least one common-layer delay is
repeated in three valid traces and the timing boundary is known, all required
web environments have a recorded outcome, and evidence integrity passes.
Use `WEB_DIAGNOSIS_READY`, `NOT_REPRODUCED_IN_DIAGNOSTIC_SCOPE`, or
`DIAGNOSIS_BLOCKED`; do not claim that the product is fixed. The old official
four-environment baseline remains a separate historical record.

## Phase 5 - Causal proof and Plan 2 entry

Phase 5 starts only from a completed 4.7 result. It identifies the cause of
the reproduced delay and orders future fixes. It never changes production.

### 5.1 - Hypothesis ordering

Order candidates by measured contribution to the critical path, then by the
number of journeys affected, then by technical dependency. Initial candidates
are full app-state fan-out/auth repetition, background polling overlap,
bundle/import/render work, and warm AI Chat auth/store/readiness. An
unmeasured candidate is not optimized.

### 5.2 - Single-variable experiments

For each candidate, pre-register the mechanism, one changed variable, exact
files/functions, expected timing boundary, safety checks, and rollback. Run
three matched `A -> B -> A` repetitions with the same account, fixture, build,
device, cache/service-worker mode, network, and route order; allow at most five
repetitions. The changed variable must be isolated, and the final A must return
the measured boundary. A result that does not repeat in three matched cycles
is `INCONCLUSIVE`.

The state-provider persistence and single-flight hydration changes are two
separate experiment variables. Test each independently before testing their
combination. Full app-state and windowed app-state have different data
contracts and cannot be substituted without validating state completeness,
freshness, tenant isolation, and mutation behavior.

### 5.3 - Layer attribution

Separate DNS/TLS/TTFB, auth/session, capability/RLS, server/store fan-out,
response body finish, JSON parse, React render/layout/paint, polling/mount,
service worker, and release identity. A server timing label is not treated as
pure auth or pure database time until its contained work is identified.

### 5.4 - Safety and behavior checks

Verify logout/login, tenant change, role/capability denial, stale session,
offline/privacy lock, reconnect, mutation revision/conflict, late response,
state freshness, and cross-user isolation. A faster result that skips auth,
RLS, freshness, or required data is rejected as a behavior failure.

### 5.5 - Remaining candidate loop

When a remeasurement exposes another issue, record the completed experiment,
open the next linked diagnosis, and continue through `DIAGNOSE -> FIX ->
VALIDATE -> REMEASURE`. Do not repeat the same unchanged experiment more than
five times. Diagnostic and validation probes never become official samples.

### 5.6 - Finding dispositions

Each finding ends as `CAUSE_CONFIRMED`, `CONTRIBUTING_FACTOR_CONFIRMED`,
`MEASUREMENT_GAP_RESOLVED`, `NOT_REPRODUCED`, `INCONCLUSIVE`, or
`OPEN_BLOCKED`. `CAUSE_CONFIRMED` requires three matching valid traces, exact
file/function attribution, and a repeatable single-variable causal result.

#### Phase 5.6 status - 2026-09-18

The current review is `COMPLETE / FINDING_DISPOSITIONS_REVIEWED` in the
separate v3 evidence record named above. The three general dashboard findings
are `INCONCLUSIVE`; the two AI Chat findings are `OPEN_BLOCKED`. No
`CAUSE_CONFIRMED`, `CONTRIBUTING_FACTOR_CONFIRMED`, or
`MEASUREMENT_GAP_RESOLVED` disposition was supported, and no Plan 2 input is
eligible from this review alone.

### 5.7 - Plan 1 closure

Produce the prioritized Plan 2 input with finding id, affected journeys and
environments, exact cause evidence, measured effect, proposed limited change,
behavior risks, regression tests, rollback, and unresolved dependencies. Plan
1 closes as `ROOT_CAUSE_EVIDENCE_READY`, `NO_RUNTIME_CAUSE_CONFIRMED`, or
`DIAGNOSIS_BLOCKED`. Plan 2 is not implied by any speed-budget failure.

#### Phase 5.7 status - 2026-09-18

The closure is `COMPLETE / DIAGNOSIS_BLOCKED` in the separate v3 evidence
record named above. Plan 1 is closed for this scoped diagnosis. The five-entry
Plan 2 input is complete, but no finding is eligible for Plan 2: the three F2
findings remain `INCONCLUSIVE` and the two F12 findings remain
`OPEN_BLOCKED`. No runtime fix, official measurement, checkpoint, database,
provider, deployment, or production action was performed. The next
continuation is a separately authorized diagnostic run for the reported
general desktop interaction delay. Shared shell, authentication, state,
polling, navigation, and render boundaries remain in scope; the two blocked
AI Chat findings remain an explicit sub-scope. No finding is promoted without
its required evidence.

#### Separately authorized shared-runtime diagnostic continuation - 2026-09-18

This continuation is a trace-only localization step and is not a reopening of
Plan 1 closure, a Plan 2 change, or an official performance acceptance run.
Its hypothesis surface is deliberately shared: (1) the serial auth/session
tax in `resolveAccountTenantContext` and entitlement, (2) the navigation
request fan-out including API and RSC work, (3) broad shell/Aiya React commits,
long tasks, and refresh/poll lifecycle, and (4) the additional
`app_session_activity` row-lock candidate under concurrent requests. The
fourth candidate must remain `UNAVAILABLE` or `UNMEASURED` when local DB
sampling cannot run; it must never be converted to a no-lock conclusion.

The runner records three normal repetitions for each of J1/J2/J3, selects the
highest valid second-action tail, and records three diagnostic repetitions for
that journey. Normal mode keeps diagnostic observers off. Diagnostic mode
enables auth `Server-Timing` subspans, RSC request classification, browser
event/long-task observers, React Profiler commit events, and aggregate-only
PostgreSQL activity/lock sampling at 50 ms. All outputs are redacted and
explicitly marked `countedAsOfficialSample=false`; no raw request body,
credential, cookie, prompt, clinical value, or device serial is admissible.

The latest run is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-diagnostic-v3-20260918T185554350Z-3d620a1a-d1a5-4da8-b706-6a94cd9c1b07_SHARED_RUNTIME_DIAGNOSTIC_EVIDENCE.json`
with status `BLOCKED / SHARED_RUNTIME_DIAGNOSTIC_RUNNER_BLOCKED`. Preflight
passed and the normal sweep completed 9 attempts: 6 were `validSample` (J1
3/3, J2 3/3, J3 0/3), with J1 selected at an observed 3239 ms tail. The
diagnostic repeat completed 0/3 before the bounded runner was stopped. The DB
lock sampler remains `NO_SAMPLES`, so the row-lock candidate is unmeasured.
The next permitted action is to complete the selected diagnostic repetitions
while preserving the existing normal traces and excluding all data from the
official baseline. The general freeze thesis remains unverified, all five
finding dispositions remain unchanged, Plan 2 remains locked, and production
remains `NO-GO`.

#### Latest shared-runtime request-coalescing A-B-A result - 2026-09-19

The separately authorized continuation completed the next single-variable
experiment. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-request-coalescing-ab-a-20260919T141815Z-2bf54fb2-080c-4470-a920-05ebc5f5b7ab_EVIDENCE.json`.
The exact variable was same-key in-flight coalescing in
`app/src/components/dashboard/shell-provider.tsx:fetchShellBootstrap`, keyed
by the `activeClientId` query. A1, B, and A2 each completed 9 normal and 3
diagnostic observations; selected J1 diagnostic observations were 3/3 valid
and successful. B reduced bootstrap GET counts from A1/A2 `7/7/7` to `5/5/6`
in all three repetitions. Total request count, second-action tail, and React
commit metrics did not improve in one repeatable direction. The result is
`BOOTSTRAP_DUPLICATION_REDUCED_SPEED_INCONCLUSIVE_GLOBAL_FREEZE_UNRESOLVED`.

The B candidate was removed and A2 baseline restored. This record is diagnostic
only, is not an official nine-scenario measurement, does not confirm a root
cause, and does not authorize a runtime fix or Plan 2. Phase 5.7 remains
`COMPLETE / DIAGNOSIS_BLOCKED`, all five finding dispositions remain unchanged,
and production remains `NO-GO`. Any next experiment must target auth-chain
ownership separately and must not combine variables.

#### Latest shared-runtime auth-chain ownership A-B-A result - 2026-09-20

The separately authorized continuation completed one auth-chain ownership
experiment. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-auth-ownership-ab-a-20260920T150730Z-c86defe0-6be6-46e9-bd56-a5560d140fa1_EVIDENCE.json`.
The exact variable was removal of the repeated
`assertShellSessionActivity` RPC from
`app/src/lib/auth-context.ts:resolveAccountTenantContext` for normal requests;
the explicit `/api/session/activity` endpoint remained the touch owner.

The selected J1 diagnostic records were `3/3` valid and successful in A1, B,
and A2. B reduced the contained session-activity timing to approximately zero,
but each variant still recorded `53` total, `24` API, and `26` RSC requests.
Second-action tails were A1 `1147/524/660` ms, B `1196/1395/1234` ms, and A2
`622/1534/552` ms. The candidate therefore produced no repeatable speed
improvement and did not explain the general freeze. B was removed and A2
baseline restored; A2's one sampler error remains recorded as `PARTIAL`.
Phase 5.7, all finding dispositions, Plan 2 eligibility, and production
`NO-GO` are unchanged.

#### Latest shared-runtime food-rule-profile A-B-A result - 2026-09-20

The separately authorized continuation completed a single-variable A1 -> B ->
A2 experiment. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-food-rule-profile-ab-a-20260920T165844Z-96a93331-d252-4eb5-8474-4a91424bf13f_EVIDENCE.json`.
The only variable was `AIYA_PERF_FOOD_RULE_PROFILE_READ_POLICY` in the
`food-rule-profile` server route. A used the broad operation-state loader; B
used the existing narrow client/form/profile loader. The source hashes for the
store, route, runner, fixture, branch, and HEAD were invariant across A1, B,
and A2.

All three variants recorded 12/12 observation-valid units and 3/3 valid and
successful selected J1 diagnostic units. B reduced the contained server
`store` timing in all three repetitions: A1 `113.02/155.97/106.19` ms, B
`40.57/23.94/29.56` ms, A2 `147.95/104.09/83.68` ms. Fan-out remained
`53` total, `24` API, and `3` document requests in every selected diagnostic
record. Second-action dispatch-to-ready was A1 `653/1168/1146` ms, B
`637/495/625` ms, and A2 `676/609/509` ms, which is not a repeatable global
speed direction. The B sampler is `PARTIAL` after one sample error.

This confirms a contained local server-cost effect, not a global freeze root
cause, request-fan-out resolution, accepted runtime fix, or Plan 2 input. The B
policy was process-scoped and A2 restored the broad default. Plan 1 remains
`COMPLETE / DIAGNOSIS_BLOCKED`, finding dispositions remain unchanged, and
production remains `NO-GO`. The next diagnostic boundary is cross-route
fan-out or React commit ownership.

#### Latest J1 legacy fan-out envelope baseline - 2026-09-22

The separately authorized control-boundary capture is recorded at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-fanout-envelope-baseline-v1-20260922T000153108Z-df90576e-8f10-4162-bf26-2916efbe1289_EVIDENCE.json`
with SHA-256
`FC2FD67BC365691E30B7037E2B1985398DA3FEDDB827A24A78665751D178C94C`.
The runner and focused test are
`app/scripts/performance-plan-1-j1-fanout-envelope-baseline.mjs` and
`app/scripts/performance-plan-1-j1-fanout-envelope-baseline.test.mjs`;
their SHA-256 values are recorded in the finding manifest.

The run held the current legacy shell-dirty-registration policy, used the
synthetic local-normal owner fixture over local Supabase at
`127.0.0.1:54321`, and completed 3/3 J1 diagnostic repetitions with
observation validity 3/3 and functional validity 3/3. The strict read gate
passed in every repetition: exactly one completed Forms read and exactly one
completed Nutrition read. Forms lifecycle was also stable in all three:
effect setup/start/success were `1/1/1`, with zero Forms load aborts or
restarts.

The predeclared request envelope passed 3/3. Repetition 1 recorded `56`
total / `27` API / `3` document / `26` RSC requests; repetitions 2 and 3
recorded `53` / `24` / `3` / `26`. Every allowlisted API route stayed within
its declared count, including exactly one Forms and one food-rule-profile
read per repetition. The result is a control boundary only, outside the
official nine-scenario acceptance baseline, and all samples remain
`countedAsOfficialSample=false`.

The first attempt is preserved separately as `BLOCKED`; its evidence records
`outputRecorded=false` before any browser sample started. A follow-up
same-command local diagnostic identified `EPERM` while Next tried to unlink a
route entry in the existing OneDrive `.next` tree. The runner was then
constrained to a run-scoped diagnostic `distDir`; the successful run used
that isolated build path. This harness repair does not change application
runtime behavior.

This result does not confirm the auth/oturum chain as the freeze cause, does
not confirm a React commit storm as the root cause, and does not show that
the global interaction problem improved. Phase 5.7 remains
`COMPLETE / DIAGNOSIS_BLOCKED`, finding dispositions and Plan 2 eligibility
are unchanged, and production remains `NO-GO`. The next exact action is one
separately identified single-variable candidate capture using this envelope
and lifecycle gate as its control; do not repeat this baseline or combine
auth, fan-out, and commit variables.

### Current J1 post-response commit envelope A-B-A candidate - 2026-09-22

The separately identified candidate capture is recorded at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-post-response-commit-envelope-ab-a-v1-20260922T082334317Z-c732dc73-de03-43b6-8881-a4880cbf977a_EVIDENCE.json`
with SHA-256
`DDD880A087A9F42407967C969A97B00F5C69152C0D5D77C878AAFB2C474C5CED`.
The runner and focused test hashes are recorded in the finding manifest.

The run held one variable only: A1 legacy dirty-registration dependency,
B stable `saveRef` dependency, and A2 legacy dependency. It used the
local-normal synthetic owner, local Supabase `127.0.0.1:54321`, the J1
2,000 ms second-action boundary, the established request envelope, and the
Forms lifecycle gate. All 9/9 attempts were observation-valid and all three
variant builds passed, but only A1 `3/3`, B `2/3`, and A2 `3/3` were eligible.

B repetition 2 is the validity boundary: it recorded `57` total / `28` API /
`3` document / `26` RSC requests, two Forms records with only one completed,
Forms setup/start `2/2`, one success and one abort. The envelope and lifecycle
gates therefore failed together. The other request shapes were A1
`53/24/3/26` in all repetitions, B `56/27/3/26` then `53/24/3/26`, and A2
`53/24/3/26`, `53/24/3/26`, then `56/27/3/26`; no repetition had an exact
three-variant fan-out shape.

Eligible B repetitions still showed the same contributor signal: shell-provider
commits were `36` and `31`, versus A1 `1891` and `1893` and A2 `1891` and
`2668` on the corresponding eligible rows. Because B was not `3/3` and the
fan-out invariant was `0/3`, this is not causal evidence and no speed or root
cause claim is promoted. The first runner attempt is preserved separately as
`COMPLETE_BUT_INVALID`: arbitrary A1/B/A2 labels were mistakenly passed to the
phase-4.3 control enum, producing 9/9 harness-invalid rows; it is excluded.

Phase 5.7 remains `COMPLETE / DIAGNOSIS_BLOCKED`, finding dispositions and
Plan 2 eligibility are unchanged, and production remains `NO-GO`. Do not
repeat this candidate automatically. A future authorized diagnostic must
first explain or control the stable-policy Forms/fan-out divergence and then
obtain 3/3 eligible A1/B/A2 repetitions with exact per-repetition fan-out
shape before interpreting commit ownership.

## Evidence and delivery contract

Phase 4 and Phase 5 use versioned evidence files with `planRevision`, phase and
stage ids, run/cycle ids, source/reference/variant/artifact identities,
inherited evidence references, stage ledger, sanitized journeys/experiments,
finding dispositions, blockers, and closure. No evidence value may contain a
credential, cookie, token, raw body, prompt, clinical content, or device
serial. Every document update must point to the current evidence and preserve
historical files. The final verification set is the applicable targeted test
suite, checkpoint continuation/redaction tests, typecheck, lint, build, secret
scan, document consistency check, and `git diff --check/status`.

## Historical Content (Superseded by plan1-final-v2)

Everything below this marker is retained for audit history only. It is not an
active instruction and must not be used to choose the next phase or stage.

## Current Phase 4 Baseline Authority - 2026-09-16

The latest canonical run is
`aiya-performance-plan1-phase4-20260915T195604720Z-497a3200-ada3-445d-a2d0-059cb0886940`
and remains `BLOCKED / PERFORMANCE_BLOCKED` with `2/4` valid
environments. Stages 4.1, 4.2, and 4.3 are `COMPLETE`; Stage 4.4 is
`BLOCKED` because Android Chrome produced only 17 valid nine-scenario
rounds after the locked 28 attempts, and Stage 4.5 is blocked by the ordered
`physical_android_chrome_baseline_incomplete` rule.

The Android device was connected and capture-ready: Chrome launch, CDP
forwarding, target-origin verification, and 66 connection-monitor checks
passed. The baseline nevertheless recorded 11 discarded attempts and 0
failed attempts. Discards were caused by AI Chat destination/workspace
readiness timeouts, one messages required-read failure, one password-login
response miss, one unstable menu-tab click, and one page navigation timeout.
These are measurement/harness interaction blockers, not proof of an
application performance root cause. Installed Android PWA measurement was
not run because Android Chrome did not complete the 20-valid-sample gate.

Local desktop small/normal and owner-PC hosted each completed all nine
scenarios at 20 valid authenticated samples. Validity and functional checks
passed; speed-budget failures remain separate reproduction candidates and
are not causal proof. Android's 17 valid rounds are retained as incomplete
evidence and cannot be promoted to environment PASS. The run's
`closure.reproduced=true` is not causal evidence.

The current run was created by compatible append-only migration from source
`aiya-performance-plan1-phase4-20260915T190010135Z-8a3e9d92-83df-4c0d-8604-41c17109a31e`.
The source remains unchanged; identity and locked-contract checks passed,
141 verified events were copied, 60 committed rounds were preserved, and
`checkpoint.resumed=true` was recorded. The 20-valid-sample and
28-attempt contract was not relaxed.

## Current cyclic execution authority - 2026-09-16

Phase 4 remains one open phase with durable internal cycles governed by
`DIAGNOSE -> FIX -> VALIDATE -> REMEASURE`. `BLOCKED` closes only the current
cycle; it does not close Phase 4. An interruption resumes the same active
cycle after checkpoint identity and lock checks. Diagnostic and validation
probes never count as official baseline samples, and the nine-scenario
20-valid-sample/28-attempt contract is unchanged.

Three Android Chrome diagnostic cycles were executed against the canonical
run, each with three repetitions and `officialSamplesAdded=0`:
`cycle-20260915T224814005Z-b1c1ddef-e359-481a-a345-b9124611e72e`,
`cycle-20260915T230600833Z-39295e50-f9bb-4293-b888-4827b13abcb2`, and
`cycle-20260915T231653941Z-923cc126-b85f-4b81-adec-b7d3f8de6f0a`.
All are `BLOCKED`; the canonical Phase 4 evidence remains unchanged. The
latest diagnostic trace records valid-but-budget-failing AI Chat samples,
one workspace-ready timeout, delayed More-page and real AI Chat item-click
completion, and HTTP 200/body-finished conversations reads. This is repeated
performance-candidate evidence, not a proven causal runtime root cause.

The next eligible action is one-variable causal diagnosis of the Android
More-to-AI-Chat route/navigation/render chain. It must separate route commit,
shell/bootstrap, render/long-task, ready-selector, and AI Chat request timing
with the same authenticated fixture and device. A harness correction requires
a reproduced measurement defect; an application runtime correction requires
the causal trace, a focused regression test, and explicit Plan 2/scope
authorization. The cyclic execution specification is
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_CYCLIC_EXECUTION_SPEC.md`.

## Historical prior Phase 4 Baseline Authority - 2026-09-15

The latest canonical run is
`aiya-performance-plan1-phase4-20260915T130141721Z-6aa263db-c0ff-4192-9333-c20d769f4692`
and remains `BLOCKED / PERFORMANCE_BLOCKED` with `2/4` valid environments.
Stages 4.1, 4.2, and 4.3 are `COMPLETE`; Stage 4.4 is blocked by
`android_chrome_baseline_blocked`, and Stage 4.5 is blocked by the ordered
`physical_android_chrome_baseline_incomplete` rule.

The compatible checkpoint migration was explicit and append-only in the
checkpoint store. Source run
`aiya-performance-plan1-phase4-20260915T111650824Z-51ccd021-0f1d-42ff-b170-66bc776f6aa6`
remains unchanged and `BLOCKED`; the current run records the migration reason
`harness_observability_and_checkpoint_recovery_only`, copied 63 verified
events, and preserved 30 committed rounds (`small=10`, `normal=20`). On
resume, the unfinished small attempt 11 was recorded as
`execution_interrupted`, then the current harness collected the remaining
rounds without relaxing the 20-valid-sample or 28-attempt contract.

Local desktop and owner-PC hosted profiles each completed all nine scenarios
at 20/20 valid authenticated samples. Local validity and functional checks
passed; local speed-budget failures remain reproduction candidates. Hosted
validity and functional checks passed; its speed-budget failures remain
measurement results, not causal root-cause proof. Android ADB authorization,
CDP forwarding, target-origin verification, and target launch passed, but the
Android Chrome preparation round stopped at
`preparation_failed:locator.click: Timeout 8000ms exceeded.` The connection
monitor was `PASS`; this is a device/session interaction blocker, not proof of
an application root cause. Installed Android PWA was not run because Stage
4.4 is ordered before it.

Canonical evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE.json`; the prior canonical
evidence is archived under the corresponding
`AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE_HISTORY_*.json` file. Plan 2,
runtime optimization, causal attribution, deployment, migration, and
production GO remain locked. The next eligible action is a targeted Android
Chrome preparation diagnosis and compatible continuation of this run; no new
fixture, VPS, account, PWA installation, or `--new-run` is justified.

## Historical pre-migration Phase 4 baseline attempt - 2026-09-15

The first post-readiness run stopped after ten committed small rounds because
the old harness exposed only an unclassified browser-baseline error. Its
normal profile had 20/20 valid samples and speed-budget failures, but stages
4.3-4.5 were not reached. That run is preserved as source evidence and is not
the latest baseline authority.

## Current Step 3 - bind readiness to measurement start - 2026-09-14

The Phase 4 launcher now executes the readiness command as a mandatory
measurement-start gate. It uses the same `.manu-runtime/performance-phase4/hosted.env`
source and local Supabase inputs as the subsequent measurement, rejects any
missing or changed input, and requires fresh `COMPLETE /
READY_FOR_PHASE4_BASELINE` readiness evidence with H1-H4 in order, all four
environment gates PASS, real hosted password-login and `/api/shell/bootstrap`
body-finish evidence, `baselineStarted=false`, and PASS redaction/integrity.
The source, fixture, migration, and build artifact identity is compared again
immediately before the local server starts. The readiness-created local build
is reused only after that comparison; a failed gate stops before the server and
before all 20-sample scenarios.

Implementation evidence is readiness run
`aiya-phase4-readiness-20260914T184904329Z`. The direct gate evaluation passed,
the baseline remained unstarted, targeted Phase 4 tests are `31/31 PASS`,
readiness tests are `10/10 PASS`, typecheck/build pass, and lint has `0` errors
with `74` existing warnings. This closes the startup-binding implementation,
not the Phase 4 performance baseline or any performance finding.

## Current Step 2 - phone and installed PWA access - 2026-09-14

Step 2 is implemented in the Phase 4 readiness harness and was executed by
readiness run `aiya-phase4-readiness-20260914T184904329Z`. ADB found one
authorized physical Android device. Android Chrome package inspection,
Chrome launch, CDP forwarding and handshake, and explicit Chrome view-intent
launch passed. The existing installed WebAPK package was discovered from the
device, its launch activity resolved, and it was launched independently.
The normal Chrome target and the PWA target both passed the approved
hosted-origin checks; the PWA also passed standalone-display,
active-service-worker, and online checks. The phone connection monitor passed
all 13 checks and never recorded the device serial. Local Supabase, Docker,
and the local build passed as well. H1-H4 and the readiness closure are
`COMPLETE` with outcome `READY_FOR_PHASE4_BASELINE`; no Phase 4 baseline was
started. No account/VPS/PWA installation or runtime performance change was
made.

## Current startup-flow correction - 2026-09-14

The Plan 1 Phase 4 launcher now has a fail-closed startup gate before local
build or any long measurement. It loads only the ignored repo-root file
`.manu-runtime/performance-phase4/hosted.env`, parses the exact three
`AIYA_PHASE4_HOSTED_*` keys, rejects a missing/invalid/symlink file and any
process-environment conflict, and records presence metadata without raw
credentials. It accepts only the approved test-VPS origin
`https://65-21-52-249.sslip.io`, requires `/api/health/release` HTTP 200 with
`apiStatus=ok`, then performs real password login in Playwright and requires
the authenticated `/dashboard` shell plus `GET /api/shell/bootstrap` 2xx and
body-finished evidence. A failed gate stops before the expensive local build
and baseline stages.

The implementation is in
`app/scripts/lib/performance-plan-1-phase-4-contract.mjs` and
`app/scripts/performance-plan-1-phase-4.mjs`. The latest readiness evidence
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_READINESS_EVIDENCE.json` is run
`aiya-phase4-readiness-20260914T184904329Z`: hosted input, release health,
real password login, authenticated workspace, shell-bootstrap preflight,
physical Android ADB/Chrome/CDP checks, and independent installed-PWA checks
are recorded. H1-H4 close as `COMPLETE` with `READY_FOR_PHASE4_BASELINE` and
`baselineStarted` is `false`; this preflight is not a performance baseline
and no runtime, schema, production, deployment, or external-system change
was made.

## Historical readiness implementation status - 2026-09-13

The first three recommended work items are implemented and recorded in
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_READINESS_ACTION_PLAN.md` and
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_READINESS_EVIDENCE.json`. H1 requirements,
finding, identity, and safety locks are complete. H2 now rejects trusted-click
missing data, sample errors, failed/unfinished required reads, forbidden and
unlisted mutations, stale/profile-incomplete environments, and percentile body
finish budget failures; targeted Phase 4 tests are `14/14 PASS`, readiness tests
are `6/6 PASS`, and the existing Phase 2 tests are `7/7 PASS`.

H3 local Supabase/Docker/standalone build, hosted authenticated input/release
health, physical Android device, and Android Chrome CDP checks passed. The
latest readiness run `aiya-phase4-readiness-20260913T175128732Z` remains
`BLOCKED` only because no installed standalone AIya PWA target with active
service-worker control was found; H4 remains blocked by the ordered rule. The
canonical Phase 4 baseline evidence remains the earlier
`BLOCKED / PERFORMANCE_BLOCKED` run and was not rewritten. No new baseline,
root-cause claim, runtime optimization, Plan 2, production migration, or
production deploy is authorized; production remains `NO-GO`.

Historical readiness authority (2026-09-13; superseded by the 2026-09-14 evidence above): readiness run `aiya-phase4-readiness-20260913T175128732Z` recorded one authorized physical target, hosted Chrome CDP `PASS`, installed PWA target `BLOCKED`, and `baselineStarted=false`.

Approved non-production hosted synthetic account preparation completed on 2026-09-13 on test VPS `65.21.52.249` with strict SSH host-key verification. Exactly one `aiya-phase4-hosted-*` Auth user has one owner membership and one dietitian profile on the existing active synthetic tenant; password-login returned HTTP 200 and authenticated RLS/store checks passed. Values are stored only in ignored `.manu-runtime/performance-phase4/hosted.env` and are absent from evidence, logs, chat, and Git. No production account, migration, deploy, provider/channel traffic, billing, or worker change was performed.

## Guncel uygulama durumu - 2026-09-14

Plan 1 Faz 1 asamalari 1.1-1.5 sirayla tamamlandi ve faz kapanis kontrolu `PASS` oldu. Faz 2 asamalari 2.1-2.5 ve Faz 3 asamalari 3.1-3.6 de tamamlandi; sonuclari ilgili evidence dosyalarinda korunuyor. Son canonical Phase 4 baseline run'i `BLOCKED / PERFORMANCE_BLOCKED` olarak kaldi. 2026-09-14 startup-flow correction, Step 2 ve Step 3 sonrasinda readiness run `aiya-phase4-readiness-20260914T184904329Z` hosted input, release health, real password-login, authenticated workspace, `/api/shell/bootstrap`, local Supabase/Docker, fiziksel Android/CDP, normal Chrome ve kurulu PWA erisim kapilarini `PASS` kaydetti. H1-H4 ve readiness kapanisi `COMPLETE / READY_FOR_PHASE4_BASELINE`; `baselineStarted=false`. Bu readiness sonucu baseline veya kok neden kaniti degildir; production `NO-GO` kalir.

## Historical Faz 4 Uygulama Durumu - 2026-09-13

Plan 1 Faz 4 canonical kosusu `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE.json` icinde `BLOCKED / PERFORMANCE_BLOCKED` olarak kaydedildi (run `aiya-phase4-20260913T093659853Z-8a9ca548-0595-4ea3-9506-0a309a939534`). Asama 4.1 tamamlandi: local Supabase hedefi `http://127.0.0.1:54321`, production build ve local release-health `200` oldu; olcum release'i local HEAD `a2b1e0908b29ece40c797aa9c0a5dda0bbb6513a` ile eslesti. Asama 4.2 local desktop'ta small ve normal fixture'lar icin dokuz senaryonun her birinde 20/20 authenticated, functional ve valid ornekle tamamlandi; local profil `PASS` olarak kaydedildi. Asama 4.3 owner-approved non-production test VPS'te tamamlanmadi: Playwright Chromium login URL'inde `ERR_NAME_NOT_RESOLVED` nedeniyle 28/28 deneme discard edildi ve hosted gecerli ornek alinmadi.

Gecerli local orneklerde roster disindaki dashboard/workspace/communication/AI Chat gecislerinde tekrarlayan ready/paint butce asimlari goruldu; bunlar freeze/reproduction adayidir, kesin kok neden kaniti degildir. Local small/normal profillerde failed request veya harness sample error yoktur; forms, nutrition ve menu domain GET okumalari 2xx body-finish olarak kaydedildi. Ilk tanisal kosuda concurrent first-touch session activity cagrisinin `23505` ile `503`e dondugu goruldu; olcumu tekrar edilebilir hale getirmek icin local Supabase'e append-only migration uygulandi. Bu Plan 2 remediation yetkisi veya production deploy/migration degildir.

Asama 4.3 tamamlanmadigi icin Asama 4.4 fiziksel Android Chrome/kurulu PWA ve 4.5 kapanis sirali kural geregi `BLOCKED` kaldi. 2026-09-13 post-block diagnostic'te Windows DNS, TCP 443, PowerShell/Node HTTPS ve dogal Playwright Chromium ayni hosted login URL'ine HTTP 200 ile eristi; onceki Chromium DNS engeli bu shell'de yeniden uretilmedi. Guncel readiness evidence'i hosted input/release health, authorized Android cihaz ve Chrome CDP'yi PASS; installed PWA hedefini BLOCKED kaydetti ve `baselineStarted=false`. Bu precondition kaydi performans baseline'i degildir; resolver mapping tanisal ise dogal DNS performansi sayilmaz. Faz 5 baslatilamaz; runtime optimizasyonu, production deploy/migration, production gate degisikligi veya production verisi yetkilendirilmedi. Evidence redaction, hedefli Phase 4/readiness testleri ve `git diff --check` PASS; production karari `NO-GO` kaldi. Sonraki tek uygun islem, mevcut kurulu AIya PWA'yi standalone modda aktif service worker ile acmak, readiness'i yeniden kosmak ve H3/H4 kapanmadan Faz 4 Stage 4.1'e gecmemektir.

## Durum

Plan 1, Revizyon 2 performans eylem planinin ilk bes adimini kapsar:

1. Kaynak, bulgu ve kapanis sozlesmesini kilitlemek.
2. Gecerli olcum harness'ini ve negatif kontrolleri hazirlamak.
3. Gercek auth/store kullanan sentetik ortamlar kurmak.
4. Eslesmis baseline olcumlerini almak ve kasmayi yeniden uretmek.
5. Katman bazli kontrollu deneylerle kok nedeni kanitlamak.

Bu belge Plan 1'in uygulama sozlesmesidir. Plan 1 icinde runtime performans optimizasyonu, migration, deploy, production verisi veya production gate degisikligi yapilmaz.

## Degismez uygulama kurali

Plan icindeki fazlar ve asamalar sirayla uygulanir. Bir asamanin tamamlanma kriteri saglanmadan sonraki asama baslatilmaz. Her fazdaki butun asamalar tamamlanmadan faz sonu testlerine gecilmez. Tum testlerin `PASS` olmasi tek basina faz kapanisi sayilmaz; asama ledger'inda tarif edilen islemlerin tamami ve evidence ciktilari da mevcut olmalidir.

Bir asama `FAILED`, `BLOCKED` veya `STALE` olursa sonraki asamalar calistirilmaz. Eksik veya gecersiz bir ornek percentile hesabindan gizlenmez. Runtime kok nedeni kanitlanmayan bulgu Plan 2'ye alinmaz.

## Faz 1 - Kaynak, bulgu ve kapanis sozlesmesinin kilitlenmesi

### Amac

Guncel Git/live kimliklerini, tarihsel evidence butunlugunu, bes performans bulgusunu, dokuz olcum senaryosunu, butceleri ve her bulgunun sonuclanma kosullarini tek bir evidence zincirine baglamak.

### Sirali asamalar

#### 1.1 Git ve live kimlik kilidi

- `git branch --show-current`, `git status --short --branch`, `git rev-parse HEAD`, `git rev-parse 'HEAD@{u}'`, `git log -8 --oneline --decorate`, `git remote -v`, `git branch -vv`, `git diff --check` ve `git ls-remote --symref origin HEAD refs/heads/codex/production-readiness-stage-1` calistirilir.
- Customer ve admin release-health endpoint'leri GET ile okunur.
- Local HEAD, upstream SHA, uzak default branch HEAD'i ve hosted release commit'i ayri alanlarda saklanir.
- Calisma agaci temiz degilse asama `BLOCKED` olur ve dosya degisikligi yapilmaz.

#### 1.2 Tarihsel evidence butunluk kontrolu

- Faz 1, Faz 1.2, Faz 1 finding manifest, combined finding manifest, Faz 2 scope/evidence ve Faz 3 evidence dosyalarinin SHA-256 degerleri hesaplanir.
- Kayitli tarihsel hash ile mevcut hash uyusmazsa farkin kaynagi aciklanmadan ilerlenmez.
- Tarihsel evidence dosyalari yeniden calistirilmis gibi guncellenmez.
- `READY_FOR_CDP_CAPTURE`, fiziksel Android/PWA performans PASS olarak yazilmaz.

#### 1.3 Bulgu disposition matrisi

- `PERF-F2-001`, `PERF-F2-002`, `PERF-F2-003`, `PERF-F12-001` ve `PERF-F12-002` ayri kayitlara ayrilir.
- Her kayit; yeniden uretim senaryosunu, incelenecek katmani, gerekli kontrollu deneyi, etkilenen kod alanini ve Plan 2'ye giris sartini icerir.
- Ilk statuler runtime kok nedeni kanitlamaz: static riskler `PENDING_VALID_AUTHENTICATED_REPRODUCTION`, AI Chat auth sorunu `MEASUREMENT_GAP_CONFIRMED`, warm AI Chat bulgusu `MEASURED_CANDIDATE_PENDING_VALID_AUTHENTICATED_REPRODUCTION` olarak tutulur.

#### 1.4 Senaryo ve butce kilidi

- Login, dashboard, client roster, forms, nutrition, menu, messages, alerts, notifications ve AI Chat senaryolari tekil kimliklerle kaydedilir.
- Her senaryoda expected route, gercek kullanici aksiyonu, alana ozgu ready selector, required authenticated reads, izinli ve yasak mutation'lar, sample count ve butce bulunur.
- `main` veya genel bir layout selector'u basari selector'u olarak kullanilmaz.
- AI Chat ancak `ai-chat-workspace` gorunur ve `/api/ai-chat/conversations` authenticated `2xx` donerse gecerli sayilir.

#### 1.5 Evidence schema ve asama ledger kilidi

- Plan 1 evidence; `sourceIdentity`, `historicalEvidence`, `findingContract`, `scenarioContract`, `stageLedger`, `constraints` ve `nextEligibleAction` alanlarini zorunlu tutar.
- Her stage ledger kaydinda asama kimligi, durum, baslangic/bitis zamani, on kosullar, yapilan komutlar, dogrulama ve cikti referansi bulunur.
- Hassas alan redaction testi gecmeden evidence gecersizdir.

### Faz 1 etkisi

Degisecek alanlar yalniz Plan 1 dokumani, evidence, finding manifesti ve bunlari dogrulayan testlerdir. Uygulama runtime'i, Supabase schema/migration, dependency, deploy ayari, service worker ve production gate degismez.

## Faz 2 - Olcum harness'i ve negatif kontroller

Plan 1 Faz 1 kapandiktan sonra baslatilir. Mevcut Phase 2 harness sozlesmesi korunur; warm SPA gecisleri ayni browser context/app instance icinde gercek tiklamalarla olculur. Header timing ile body-finish ayrilir. `401`, `403`, `5xx`, timeout, request failure, eksik selector, fallback/demo session ve yasak mutation `FAIL` olur. Normal kabul kosusu profiler kapali, tanisal kosu profiler acik tutulur.

### Faz 2 Uygulama Sonucu - 2026-09-10

Asamalar 2.1-2.5 sirayla tamamlandi ve `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json` icinde `COMPLETE / HARNESS_READY_WITH_NEGATIVE_CONTROLS` olarak kaydedildi. Dokuz senaryo ve senaryo basina 20 ornek sozlesmesi; cold login `page.goto`, warm ayni browser context icinde gercek click, 30 saniye required-read timeout, 5 saniye post-ready gozlem ve 60 saniye background gozlem metadata'si ile kilitlendi. 401, 403, 500, timeout, request failure, gecikmeli header/body, eksik read/selector/target/timing, forbidden mutation, fallback/demo ve butce asimi kontrolleri PASS ile siniflandi; 14 siniflandirma vakasi ve 8 kontrollu localhost HTTP vakasi calistirildi.

Bu fazda Supabase fixture/authenticated login, hosted synthetic hesap, fiziksel Android/PWA authenticated capture, gercek performans baseline'i, kok neden atfi ve runtime remediasyonu yapilmadi. Plan 1 Faz 3 daha sonra acik user onayi ile baslatildi ve asagidaki kapanis kaydiyla tamamlandi.

## Faz 3 - Sentetik auth/store ortamlarinin hazirlanmasi

Plan 1 Faz 2 kapandiktan sonra local Docker/Supabase izole hedefi baslatilir, mevcut migrationlar uygulanir ve deterministik sentetik fixture kurulur. Iki tenant, dietitian, assistant, auditor ve viewer assignment senaryolari; small, normal ve scale veri hacimleriyle olusturulur. Olcum gercek password session ve normal RLS yolu uzerinden yapilir. Hosted sentetik hesap, invite/onboarding ve hosted veri kurulumu ayri owner onayi olmadan baslatilmaz. Fiziksel Android ve PWA capture, ADB/CDP/display-mode/service-worker kontrolleriyle hazirlanir.

### Faz 3 Uygulama Sonucu - 2026-09-10

Asamalar 3.1-3.6 sirayla tamamlandi ve `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json` icinde `COMPLETE / SYNTHETIC_AUTH_STORE_READY` olarak kaydedildi. Local migration listesi ve required store schema `PASS` oldu; tam veritabani resetlenmedi. Yalnizca sabit Phase 3 tenant kimlikleri ve `aiya-phase3-local-*` sentetik auth hesaplari temizlenip yeniden olusturuldu.

Fixture iki local tenant ve sekiz local sentetik hesap icerir: her tenantta owner, assistant, viewer-assignment ve auditor; small tenantta 3 client ve 20 mesaj; normal tenantta 50 client, 20 mesajli ve 200 mesajli iki conversation, toplam 220 mesaj. `scale_synthetic`, ayri bir 5000 client yuk testi degil, normal tenanttaki 200 mesajli yogun conversation varyantidir. Fixture hash'i `6bedeba5628b8ea3677dae464143f01d59a2dc0f51e1353dd52767827c642819` olarak kaydedildi.

Tum hesaplar local anon key ile `signInWithPassword` kullanilarak authenticated session aldi; session claim ve local session-activity sozlesmesi dogrulandi. RLS/store matrisi owner cross-tenant gizleme, assistant assigned/unassigned client ve AI Chat siniri, viewer read-only update siniri, auditor ve anonymous raw-data gizleme kontrollerini `PASS` verdi. Service-role yalniz local seed/temizlik ve server-verified local session-activity RPC icin kullanildi; RLS iddialari normal authenticated client ile yapildi. Demo cookie, fallback store, provider/channel egress, hosted hesap, fiziksel cihaz/PWA capture, baseline, kok neden ve runtime remediasyonu bu fazda calistirilmadi. Fixture Phase 4 icin local DB'de birakildi; production karari `NO-GO` kalir.

## Faz 4 - Gecerli baseline ve yeniden uretim

Local desktop, owner-PC hosted, fiziksel Android Chrome ve kurulu PWA icin ayni dokuz senaryo ve her senaryo icin 20 ornek alinir. Cache, service worker, profiler, release ve cihaz kimligi her run'a yazilir. Butce asimi ile auth/network failure ayri siniflandirilir. Gecerli kosullarda yeniden uretilemeyen bulgu `NOT_REPRODUCED` adayi olur; bu durum otomatik runtime optimizasyon izni vermez.

### Faz 4 Uygulama Sonucu - 2026-09-13

Evidence status `BLOCKED`, outcome `PERFORMANCE_BLOCKED`. 4.1 ve local 4.2 tamamlandi: local small/normal profillerin dokuzar senaryosunda 20/20 authenticated valid ornek alindi. Hosted 4.3 `ERR_NAME_NOT_RESOLVED` nedeniyle 28/28 discard ile `BLOCKED` kaldi; bu nedenle fiziksel Android/PWA 4.4 ve sirali 4.5 kapanis da `BLOCKED` oldu. Local profillerde tekrarlayan ready/paint butce asimlari reproduction/freeze adayi olarak kaydedildi, ancak kesin kok neden kanitlanmadi. Post-block diagnostic DNS engelini mevcut shell'de yeniden uretmedi; tam rerun icin approved hosted degiskenler ve authorized fiziksel Android cihazi gerekir.

## Faz 5 - Nedensel ayrim ve Plan 2 girisi

Sadece Faz 4'te yeniden uretilen senaryolar incelenir. DNS/TLS/TTFB, auth/session, RPC/store, body-finish, JSON parse, React render/layout/paint, polling/mount, service worker ve release identity ayri katmanlar olarak karsilastirilir. Data volume, polling pause, service-worker bypass, network profile ve profiler durumu tek degiskenli A/B deneyleriyle test edilir.

Bir neden ancak en az uc tekrar eden ornek/trace, belirli dosya/fonksiyon eslesmesi ve tek degiskenli deneyde tekrarlanabilir etki ile `CAUSE_CONFIRMED` olur. Kanitlanan neden, beklenen degisiklik ve test sozlesmesi Plan 2 manifestine aktarilir. Plan 1 runtime duzeltmesi yapmaz.

## Plan 1 kapanis ciktilari

- `docs/AIYA_PERFORMANCE_PLAN_1_EVIDENCE.json`
- `docs/AIYA_PERFORMANCE_PLAN_1_FINDING_MANIFEST.json`
- `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json`
- `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json`
- `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE.json`
- `app/scripts/performance-plan-1-phase-2.mjs`
- `app/scripts/performance-plan-1-phase-2.test.mjs`
- `app/scripts/performance-plan-1-phase-3.mjs`
- `app/scripts/performance-plan-1-phase-3.test.mjs`
- `app/scripts/performance-plan-1-phase-4.mjs`
- `app/scripts/performance-plan-1-phase-4.test.mjs`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `docs/RISK_REGISTER.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`

Plan 1 sonucu `ROOT_CAUSE_EVIDENCE_READY`, `NO_RUNTIME_CAUSE_CONFIRMED` veya `DIAGNOSIS_BLOCKED` olabilir. Plan 2 yalniz `ROOT_CAUSE_EVIDENCE_READY` sonucu ve kanitlanmis bulgu girisleriyle hazirlanabilir. Production karari her durumda `NO-GO` kalir.

## Bounded client-only dashboard navigation continuation - 2026-09-22

Evidence: `docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-client-only-dashboard-navigation-fix-v1-20260922T101352Z_EVIDENCE.json` (SHA-256 `55B6DF4617967D2FD73964E884CCE4A63D335ECBD319C154B5AA642A185D3652`).

The approved short diagnostic identified and guarded one concrete route/history boundary: same-document `/dashboard` query transitions were being written by both native history synchronization and `router.push`. The delayed second writer could replay an older route and restart Forms. The fix is limited to skipping the App Router call for same-document dashboard query transitions; cross-route transitions retain the App Router.

Focused tests, typecheck, lint, and build passed. One local J1 after the fix was valid and functionally successful, with one Forms request and no abort. This is not official Plan 1 acceptance or causal proof; the global freeze remains unresolved, finding dispositions remain unchanged, Plan 2 remains unauthorized, and production remains `NO-GO`.

## Bounded repeated J1 result after client-only navigation guard - 2026-09-22

Evidence: `docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-fanout-envelope-baseline-v1-20260922T155536674Z-bcf71d30-b2df-41f5-98c5-f6d863fb3ef6_EVIDENCE.json` (SHA-256 `3794F0D977EA9A3E3A252AC0A80142494F5C475B518E0C9EC37F28B39F881623`). The authorized three-record current-source J1 capture used the existing local-normal synthetic fixture, real local Supabase/RLS path, and 2,000 ms second-action delay. The checkpoint is complete with 14 events and a valid hash chain.

All three records were observation-valid and functionally successful: one Forms request and `1/1/1` Forms lifecycle with zero Forms aborts, one Nutrition request, second action accepted `3/3`, and no summary re-entry. The second-click-to-ready intervals were `1,040/1,087/576 ms`; no captured long task overlapped the interval. The historical fan-out envelope was not met in any record because current source measured `49` total / `24` API / `3` document / `22` RSC against `53-56` total / `26` RSC. Eligibility is `0/3` and performance is `NOT_EVALUABLE`. This does not confirm a root cause, accept the runtime fix for production, change finding dispositions, authorize Plan 2, or change `NO-GO`. Do not repeat automatically; the next authorized action is envelope reconciliation or a distinct controlled comparison.

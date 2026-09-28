# MANU-AI Risk Register

## Active Plan 1 risks - plan1-final-v3 - 2026-09-18

The canonical v3 section in `docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md`
governs current execution. The overengineering review and documentation
revision are complete; no runtime cause or performance acceptance is added.

R-P5-016: The 2026-09-20 first-three-stage shared-runtime localization
reproduced a J1 second-action boundary at the required
`/api/clients/:clientId/food-rule-profile` read and the following
readiness/React interval in 3/3 selected diagnostic traces. Response-header
latency was `312/320/395` ms and the diagnostic route timing was
`295.65/302.13/375.75` ms. The runner used local Docker Supabase, so hosted
network latency and external provider paths remain unmeasured. The DB sampler
recorded two lock-wait/blocked-activity samples before the second trusted
event and none in the second-action window. Status: open, localized for the
next single-variable experiment, but not a root cause, runtime fix, global
lock conclusion, Plan 2 input, or production acceptance. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-localization-v1-20260920T160215Z-7f672bcb-8f49-4b20-bc11-c26c578f7021_EVIDENCE.json`.

R-P5-017: The 2026-09-20 food-rule-profile loader A-B-A continuation tested
only the server-side broad versus narrow state read. B reduced the contained
food-route `store` timing in all three repetitions (`40.57/23.94/29.56` ms)
against A1 (`113.02/155.97/106.19` ms) and A2 (`147.95/104.09/83.68` ms),
but request fan-out stayed at `53` total, `24` API, and `3` document requests
and second-action dispatch-to-ready did not improve in a repeatable A-B-A
direction. Status: contained server-cost contributor confirmed; global freeze
root cause, finding disposition, Plan 2 eligibility, runtime-fix acceptance,
and production readiness remain unchanged. The B sampler is `PARTIAL` because
one sample errored; no global lock-absence claim is allowed. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-food-rule-profile-ab-a-20260920T165844Z-96a93331-d252-4eb5-8474-4a91424bf13f_EVIDENCE.json`.

R-P5-018: The 2026-09-20 dirty-registration commit-ownership A-B-A
continuation tested the process-scoped dependency policy in
`app/src/lib/use-shell-dirty-registration.ts`. Stable B reduced observed
`shell-provider` commits from A1 `2270/2187/2216` to `37/34/37` and A2
`2082/2081/1892`, with the matching `dashboard-shell` reversal; legacy A2
restored the storm. This is a high-confidence contributing mechanism for
shared-shell React work, not an exact global root-cause closure. B J1
repetition 1 failed the required forms read and is `validSample=false`, so
only 2/3 selected B diagnostic records are valid and successful. The source
run's 12/12 `observationValidity` count is intentional structural validity,
separate from the stricter full-success `validSample` gate; a later retry does
not erase an earlier failed required request. Status: open diagnostic
candidate; stable remains process-scoped and unaccepted, global freeze remains
unresolved, finding dispositions and Plan 2 eligibility are unchanged, and
production remains `NO-GO`. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-dirty-registration-ab-a-20260920T193800Z-57dc30c0-54ee-45a7-b69b-7cedb280df42_EVIDENCE.json`.

R-P5-019: The 2026-09-20 dirty-registration validity recheck recorded
`12/12 observationValidity`, `6/12 validSample`, and `6/12` functional
successes under the stable process policy. All three normal J1 repetitions
were ineligible because the first matching
`/api/clients/:clientId/forms` attempt failed before a later complete `200`
response; the required-read rule correctly did not promote that retry. J2 was
selected for diagnostic profiling and was `3/3` valid, so the recheck added no
new J1 profiler evidence. This resolves the interpretation of the aggregate
fields, but not the UI-freeze diagnosis. Status: open; the next controlled
boundary is the aborted first forms request or a separately authorized J1
confirmation, followed by request fan-out/auth/RSC localization. Stable is
still unaccepted, no finding disposition or Plan 2 entry changed, and
production remains `NO-GO`. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-dirty-registration-validity-recheck-20260920T213200Z-47b48402-c132-4a97-a121-8339aeec8666_EVIDENCE.json`.

R-P5-020: The 2026-09-21 lifecycle continuation correlated the first Forms
fetch's bounded `net::ERR_ABORTED` with
`useStage6ClientWorkspace` effect cleanup and its `AbortController.abort()` in
`2/3` current diagnostic J1 repetitions. Current normal J1 was `3/3`
successful with no first-Forms abort, while the current diagnostic J1 was
`2/3` abort/incomplete and `1/3` successful; the earlier normal run had the
first-Forms abort in `3/3`. The current diagnostic J1 also recorded an aborted
Forms RSC request in `3/3`. Status: open diagnostic candidate; cleanup is a
localized cancellation mechanism, but frequency and the upstream
route/history or state trigger remain unproven. No runtime fix is accepted,
Plan 1 remains `COMPLETE / DIAGNOSIS_BLOCKED`, Plan 2 eligibility is zero, and
production remains `NO-GO`. Next control: sanitized route/history transition
capture followed by one reversible single-variable J1 confirmation. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-forms-abort-lifecycle-correlation-20260921T003915496Z-9e7a44a9-ff04-4778-ab50-46118ca2e6c2_EVIDENCE.json`.

R-P5-021: The corrected 2026-09-21 J1 active-client preference confirmation
retained `9/9` observation-valid repetitions and `6/9` valid functional
samples: A1 `1/3`, B `2/3`, A2 `3/3`. The exact `activeClientId` preference
completion gate passed B `3/3`, but B still had a post-Forms summary route and
a required Forms-request abort in `1/3`; A1 had `2/3` and A2 `0/3`. Waiting
for that one preference response is insufficient and the controlled direction
is `INCONCLUSIVE`. The candidate is narrowed to the shared Stage 6 active-client
activation/navigation boundary, not confirmed as the global freeze cause.
Status: open diagnostic candidate; the first two control-protocol attempts are
preserved and excluded, no runtime fix or finding-disposition change is
accepted, Plan 2 eligibility remains zero, and production remains `NO-GO`.
The trace-only `preference_intent_timing_and_completion` follow-up is complete
and recorded as R-P5-022 below.

R-P5-022: The corrected 2026-09-21 preference-intent timing run retained 3/3
observation-valid and 3/3 valid functional J1 samples. All three observed
allowlisted `activeClientId` preference PATCHes completed with HTTP 200, body
completion, and settlement. Stage 6 cleanup followed settlement by 32 ms,
28 ms, and 41 ms. Route ordering was one strictly-before, one-at-settlement,
and one-after; all three required Forms requests completed with HTTP 200 and
none aborted. The first two attempts are preserved and excluded because the
first lacked lifecycle collection and the second's initial analysis read the
wrong lifecycle channel. Status: open diagnostic candidate; this is a
normal-path timing correlation, not causal proof or a runtime fix. No finding
disposition changed, Plan 2 remains unauthorized, and production remains
`NO-GO`. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-preference-intent-timing-correlation-20260921T122539Z-9f2c7d11-2c35-4a54-9f0a-6d4f7f8d9c21_EVIDENCE.json`.
The read-only comparison is complete and recorded as R-P5-023 below. Do not
run a conditional J1 confirmation unless a stable abort-producing transition
is identified and separately authorized.

R-P5-023: The 2026-09-21 cross-run comparison links two separate records but
does not merge them: the clean normal preference-timing run measured
activeClientId preference settlement before Stage 6 cleanup in 3/3 samples,
with cleanup 28-41 ms later and no Forms abort; the previously-valid
abort-producing lifecycle evidence measured Forms effect cleanup followed by
`load_aborted` in 2/2 aborting repetitions 7-10 ms later, but did not capture
preference-intent timing in those same samples. The preference-to-abort link is
therefore a measurement gap, not causal proof. Status: open diagnostic
candidate; no finding disposition changed, Plan 2 remains unauthorized, and
production remains `NO-GO`. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-preference-intent-vs-forms-abort-comparison-20260921T123323Z-4b8e1a23-7d41-4c6f-9a52-1e3f7b8c6d90_EVIDENCE.json`.
The separately authorized matched trace-only J1 capture is complete and
recorded as R-P5-024 below. It captured both timelines but reproduced no Forms
abort, so no duplicate run is authorized without a new trigger hypothesis.

R-P5-024: The 2026-09-21 matched diagnostic J1 run retained 3/3
observation-valid and 3/3 valid functional samples. All three allowlisted
activeClientId preference PATCHes completed with HTTP 200/body
completion/settlement; Stage 6 cleanup followed by 39 ms, 24 ms, and 53 ms;
all required Forms requests completed with HTTP 200; Forms abort was `0/3`.
The same-trace capture boundary is valid, but the historical abort was not
reproduced. Status: open diagnostic candidate; this does not prove or disprove
the preference-to-abort link, does not resolve the global freeze, and does not
change finding disposition, Plan 2 eligibility, runtime-fix acceptance, or
production `NO-GO`. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-preference-intent-abort-matched-analysis-20260921T124727Z-9c4e2b71-6a8d-4f53-b102-7e9c3d5a8f24_EVIDENCE.json`.
Next exact action: isolate a reproducible route/state transition that produces
the historical Forms abort before considering another matched run; separate
authorization is required.

R-P5-025: The 2026-09-21 Stage 6 route-state trigger-isolation capture retained
3/3 observation-valid and 3/3 successful functional J1 samples, with complete
route-state capture in 3/3 and Forms abort in `0/3`. Current setup was
`summary -> forms -> nutrition` in every repetition. The historical lifecycle
evidence had an extra `summary -> forms -> summary -> forms -> nutrition`
sequence in both aborting repetitions, while the historical non-aborting
repetition did not. Status: open diagnostic candidate association; the
historical records lack the new route-state fields, the current run reproduced
no abort, and no single-variable speed or causal confirmation was performed.
Performance remains `NOT_EVALUABLE`; finding disposition, Plan 2 eligibility,
runtime-fix acceptance, and production `NO-GO` are unchanged. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-stage6-trigger-isolation-analysis-20260921T131935Z-e026a6cf-2f81-4bdd-82c2-c0dfefb19c31_EVIDENCE.json`.
Next exact action: separately authorize one reversible, single-variable
confirmation of only the extra summary re-entry boundary; report functional
outcome and second-action speed separately, and do not repeat the same matched
run automatically.

R-P5-026: The 2026-09-21 authorized J1 A1 -> B -> A2 confirmation changed only
the harness timing: B waited for the initial client-selection summary request
to settle before Forms dispatch. The gate passed 3/3, all 9/9 samples were
observation-valid and functionally successful, and post-Forms summary re-entry,
Forms request abort, and Forms lifecycle abort were `0/3` in A1, B, and A2.
Status: open diagnostic candidate remains unconfirmed; the historical boundary
was not reproduced. Second-action tails were captured separately but remain
`NOT_EVALUABLE` for performance acceptance. Finding disposition, Plan 2
eligibility, runtime-fix acceptance, and production `NO-GO` are unchanged.
Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-summary-reentry-settlement-confirmation-analysis-20260921T134721Z-e9c0f0c1-7b7d-4c6a-9d54-2f0a1e8b6c3d_EVIDENCE.json`.
Next exact action: do not repeat the same settlement-gated run automatically;
keep the global diagnosis blocked and require separate authorization for any
distinct trigger.

R-P5-027: The 2026-09-21 shared-runtime auth/fan-out/React commit overlap
analysis reused 3/3 valid functional J1 traces and observed first-to-second
fan-out of 7/10/10 API plus 9/13/13 RSC requests, followed by 2/2/2 API plus
1/1/1 RSC in the second-action window and 44/40/29 distinct React commit waves.
Available auth timing covered only 2/3/4 API requests (28.6%/30%/40%); most
API routes and all RSC/document auth paths were uninstrumented. Status: open
diagnostic measurement gap; fan-out/commit overlap is observed, but complete
per-request auth cost, causality, and the global-freeze root cause remain
unproven. Outcome:
`AUTH_FANOUT_COMMIT_OVERLAP_OBSERVED_AUTH_COVERAGE_INCOMPLETE_GLOBAL_FREEZE_UNRESOLVED`.
No runtime fix is accepted and production remains `NO-GO`. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-auth-fanout-commit-overlap-v1-20260921T141433347Z-5146b711-7709-41be-a5a7-c606ead3922c_EVIDENCE.json`.
Next exact action: separately authorize diagnostic-only timing for uninstrumented
shared API routes and one bounded dashboard RSC auth marker, then capture one
current-source J1 run without changing auth behavior.

R-P5-028: The 2026-09-21 trace-only shared-runtime auth coverage capture
completed `1/1` current-source J1 observation with `VALID` observation,
`SUCCESS` functional outcome, and `officialSample=false`. It recorded 24 API
request records, 15 timed API responses, and two bounded server-provided RSC
auth markers. Added route coverage was conversations `1/2`, alerts `2/2`,
notifications `2/2`, shell preferences `1/1`, client Forms `1/1`, and client
detail `0/1` because the request aborted before a response. Status: open
diagnostic measurement gap narrowed; the capture is one trace, the client-detail
boundary is incomplete, and no repeatability, causality, or global-freeze root
cause is established. The evidence was reconstructed from the completed
checkpoint after metadata/redaction corrections without a second browser run.
No runtime fix or finding-disposition change is accepted, Plan 2 eligibility
remains zero, and production remains `NO-GO`. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-shared-runtime-auth-coverage-v1-20260921T153517537Z-2e376ebf-fde3-4868-96bc-6413fcd0a6e5_EVIDENCE.json`.
Next exact action: review the single trace and the aborted client-detail
boundary; any repeat requires separate authorization.

R-P5-029: The 2026-09-21 read-only analysis of the completed J1
auth-coverage checkpoint correlated the one client-detail GET with the Stage 6
summary-to-Forms domain switch. The trace route history was selected client,
summary, Forms, Nutrition; lifecycle events showed summary effect cleanup,
Forms effect setup, and summary load abort. The source hook explicitly aborts
the active controller during effect cleanup and reloads by domain. Status: open
diagnostic boundary narrowed to client-side cancellation; this may be expected
navigation behavior and does not prove premature transition, server-side
continuation, causality, or the global-freeze root cause. No runtime fix or
finding-disposition change is accepted, Plan 2 eligibility remains zero, and
production remains `NO-GO`. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-client-detail-abort-boundary-analysis-v1-20260921T160221659Z_EVIDENCE.json`.
Next exact action: do not repeat automatically; separately authorize a bounded
server-completion marker only if post-cancellation server work remains material.

R-P5-030: The 2026-09-21 read-only second-action timeline analysis reused the
completed current-source auth-coverage checkpoint and aligned the trusted
interaction, required read, concurrent bootstrap, RSC request, context events,
Stage 6 lifecycle, event timing, long-task, and ready boundaries. The one valid
functional trace measured `1,045 ms` trusted-click-to-ready, with `593 ms` to
the required body boundary and `452 ms` body-to-ready. The required read and
bootstrap both exposed measured server timing; two shell context commits were
observed in the tail, but no React profiler commit or in-window long task was
observed. Status: open diagnostic boundary narrowed to a network/server-first
segment plus an unresolved post-body client tail. This is not a root-cause,
causal, or global-freeze resolution. No runtime fix or finding-disposition
change is accepted, Plan 2 eligibility remains zero, and production remains
`NO-GO`. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-second-action-timeline-analysis-v1-20260921T170813873Z_EVIDENCE.json`.
Next exact action: separately authorize one single-variable comparison for
required-read/server scheduling or post-response state/commit scheduling;
hold request fan-out and the other boundary constant.

R-P5-031: The 2026-09-21 authorized current-source J1 A1 legacy -> B stable
`saveRef` -> A2 legacy comparison tested only the process-scoped
`shell_dirty_registration_policy` boundary. The run attempted `9/9` traces and
closed a 37-event checkpoint with a valid hash chain. A1/A2 were `3/3` valid
functional; B was observation-valid `3/3` but functionally valid `2/3` because
its third repetition failed the first-action
`/api/clients/:clientId/forms` required-read completion. In the two fully valid
paired repetitions, B shell/dashboard commit counts were `35/34` versus A1
`1986/1851` and A2 `2020/2908`, an observed post-response commit-ownership
signal. The strict three-valid-record gate was not met, request fan-out was not
invariant (`53/53/53` then `53/56/56`), and B was slower at trusted-click-to-
ready (`966/931 ms` versus A1 `527/607 ms` and A2 `1048/522 ms`). Status: open
diagnostic contributor candidate with validity/fan-out boundary unresolved; it
is not a global-freeze root cause, accepted runtime fix, Plan 2 input, or
production acceptance. The earlier runner attempt with an unsupported trace
variant is preserved separately and excluded as harness-invalid. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-post-response-commit-ownership-ab-a-v1-20260921T185539646Z-b4ef5bf1-8927-4107-af0d-a6867406050b_EVIDENCE.json`.
Next exact action: do not repeat this same A-B-A automatically; any distinct
continuation must first isolate the B required-read/fan-out validity boundary
and keep request fan-out controlled.

R-P5-032: The 2026-09-22 read-only analysis of the completed J1 post-response
commit checkpoint isolated the open validity boundary. B repetition 3 had two
matching Forms records: the first reached HTTP 200 headers but was aborted
before body completion, and the second completed with HTTP 200. The validator
uses every matching record, so the unit remained invalid. The same trace had
`60` total / `31` API requests versus `53` / `24` in both matched legacy rows,
with additional bootstrap, client-summary, Forms, alerts, notifications, and
conversations requests; Stage 6 showed a Forms setup/start restart and one
Forms abort. Status: open diagnostic validity/fan-out boundary; no root cause,
runtime fix, disposition change, Plan 2 entry, or production acceptance.
Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-post-response-commit-fanout-validity-analysis-v1-20260921T224944702Z_EVIDENCE.json`.
Next exact action: do not repeat the same A-B-A; use a distinct controlled
capture with one completed Forms read and a predeclared route-count fan-out
envelope.

R-P5-033: The 2026-09-22 distinct legacy J1 control capture established the
declared Forms and request fan-out validity boundary. Under unchanged legacy
dirty-registration policy, local-normal synthetic auth, and local Supabase,
3/3 repetitions were observation-valid and functionally successful. Every
repetition had exactly one completed Forms read and one completed Nutrition
read; Forms setup/start/success was `1/1/1` and Forms abort was `0/3`. The
fan-out envelope passed 3/3: r1 `56` total / `27` API / `3` document / `26`
RSC, r2 and r3 `53` / `24` / `3` / `26`, with all declared API route counts
inside bounds. Status: validity boundary mitigated for this local diagnostic
path; this is not an official sample, root-cause proof, global-freeze
resolution, runtime fix, Plan 2 input, or production acceptance. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-fanout-envelope-baseline-v1-20260922T000153108Z-df90576e-8f10-4162-bf26-2916efbe1289_EVIDENCE.json`.
The first build attempt remains separately `BLOCKED`; its evidence records
`outputRecorded=false` before browser capture, and a follow-up same-command
local diagnostic identified `EPERM` in the OneDrive default `.next` cleanup.
The successful run used a run-scoped diagnostic distDir. Next exact action:
use this envelope and lifecycle gate as immutable controls for one separately
authorized, single-variable candidate comparison. Plan 1 remains `COMPLETE /
DIAGNOSIS_BLOCKED`, Plan 2 eligibility remains zero, and production remains
`NO-GO`.

R-P5-034: The 2026-09-22 envelope-controlled J1 A-B-A candidate capture
completed 9/9 observation-valid attempts and 3/3 variant builds, but eligibility
was A1 `3/3`, B `2/3`, and A2 `3/3`. B repetition 2 simultaneously exceeded
the declared request envelope (`57` total / `28` API), produced two Forms
records with one incomplete, restarted the Forms lifecycle (`2` setups and
`2` starts), and observed one Forms abort. No repetition had an exact full
fan-out shape across A1/B/A2. Eligible B rows still showed low shell-provider
commit counts (`36`, `31`) compared with legacy rows, but the strict
three-valid-record and fan-out invariants were not met. Status: candidate
validity boundary remains open; signal is not causal proof, a runtime fix,
Plan 2 input, or production acceptance. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-post-response-commit-envelope-ab-a-v1-20260922T082334317Z-c732dc73-de03-43b6-8881-a4880cbf977a_EVIDENCE.json`.
The prior 9/9 harness-invalid attempt is preserved and excluded after the
runner passed unsupported arbitrary labels into the phase-4.3 control enum.
Next exact action: do not repeat automatically; first control the stable-policy
Forms/fan-out divergence, then require 3/3 eligible matched repetitions.

R-P5-035: The authorized 2026-09-22 current-source J1 continuation completed
3/3 observation-valid and 3/3 functionally successful records after the
same-document dashboard navigation guard. Every record had one completed
Forms read, Forms lifecycle `1/1/1`, zero Forms aborts, one completed Nutrition
read, and an accepted second action; route history had no summary re-entry.
The second-click-to-ready interval was `1,040/1,087/576 ms`. The earlier
statement that no long task overlapped that interval is withdrawn: the analyzer
compared browser `performance.now()` timestamps with trace-relative action
timestamps without aligning their clock origins, so overlap status from those
records is unknown pending aligned reanalysis. However, all three records measured `49`
total / `24` API / `3` document / `22` RSC, so the historical `53-56` total /
`26` RSC fan-out envelope failed `3/3` and eligibility was `0/3`. Status:
the narrow stall was not reproduced, but performance is `NOT_EVALUABLE` and
the current-source control envelope is not established; this is not causal
proof, root-cause closure, runtime-fix acceptance, Plan 2 input, or production
acceptance. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-fanout-envelope-baseline-v1-20260922T155536674Z-bcf71d30-b2df-41f5-98c5-f6d863fb3ef6_EVIDENCE.json`.
Follow-up on 2026-09-22/23: default-stable J1 then produced three eligible,
observation-valid and functionally successful records with one Forms request,
zero Forms aborts, one Nutrition read, and no summary re-entry. Trusted-click to
visible-ready was `914/872/936 ms`; the response-body-to-ready boundary was
`700/690/498 ms`. The aligned long-task observer recorded zero tasks in each
full trace, but React profiling was disabled, so the UI-ready interval remains
unattributed. The full fan-out (`49/24/3/22`) did not match the historical
legacy envelope; speed remains `NOT_EVALUABLE`. The separate dirty smoke failed
on a fixture-mismatched textarea selector before its save path and was not
retried. Evidence:
`docs/AIYA_PERFORMANCE_DIRTY_REGISTRATION_FIX_PHASE_3_ANALYSIS_EVIDENCE.json`;
the raw run is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-dirty-registration-verification-v1-20260922T204750028Z-be78a2d5-cc2f-4fdb-9543-8f74559bb628_EVIDENCE.json`.
Status remains open: this only says the narrow stall was not reproduced in
these three runs, does not confirm a root cause, and does not change Plan 2 or
production `NO-GO`. Do not repeat J1 automatically.
Follow-up on 2026-09-23: the authorized one-time smoke-only continuation used the
visible enabled `textarea`/`input[type=text]` selector in the client form field
container. Stay preserved the synthetic draft, Discard navigated, and Save &
Continue issued exactly one `POST /api/clients/forms` with HTTP `200`, followed
by Nutrition visibility. One synthetic local form mutation completed; form
values and response bodies were not recorded. The 10-event checkpoint passed
its hash-chain check, the server closed, and port `3167` was free. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-dirty-navigation-smoke-only-v1-20260922T213853024Z-950a560c-dc4c-49bb-b332-a4bb8750ea12_EVIDENCE.json`.
The preceding smoke-only preflight stopped on a mistyped expected evidence SHA
before server or smoke startup; its separate record is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-dirty-navigation-smoke-only-v1-20260922T213552307Z-475af6bd-8365-4168-8055-a7d4061aa20a_EVIDENCE.json`.
This closes only the local dirty-navigation smoke contract. Performance remains
`NOT_EVALUABLE`; the global freeze cause remains unresolved, and Plan 2 and
production status do not change. Do not repeat J1 or the successful smoke.

R-P5-036: On 2026-09-24 the user supplied a hosted-site recording and
confirmed the same broad input, left-navigation, and reload stall occurs on
desktop and Android while using synthetic test data. This is direct evidence
that the reported symptom is real in the user's hosted/device context; it does
not identify browser, network, Next.js process, auth/session, store, or database
as the cause. The local 2026-09-22/23 J1 non-reproductions are not contradictory
because they used a different local build and environment. The hosted release
is commit `1c9756046b01cb1bd224fb601ec9094a7f471606`, while local HEAD is
`a2b1e0908b29ece40c797aa9a0c5dda0bbb6513a`. A quiet host snapshot outside a
freeze showed no pressure and cannot rule out transient load. The planned
captures were attempted on 2026-09-24 and closed as `BLOCKED` under R-P5-037;
resume only when the documented Chrome trace/control harness blocker is cleared.
Plan 1
remains `COMPLETE / DIAGNOSIS_BLOCKED`; finding dispositions, Plan 2 eligibility,
and production `NO-GO` remain unchanged. No production change or deployment is
authorized.

R-P5-037: The 2026-09-24 hosted global-freeze Phase 1 acquired one validly
parsed 150-sample host window with 40 ms clock uncertainty, but Chrome control
calls timed out before the planned interaction and no browser trace was
available. Host CPU averaged 5.37% and peaked at 13.57%, with no swap,
cgroup-throttling/OOM, memory-pressure, or IO-pressure increase in that
window. Because no verified freeze overlapped those samples, this does not
exclude server, database, network, or browser causes. Phase 1 closed
`BLOCKED / browser_trace_harness_blocked` with 0/3 valid paired records;
evidence and the separately hashed host artifact addendum are recorded in
`docs/aiya-global-freeze-phase-1-20260924T195845623Z-6029109a-b6cb-46b3-8bc0-b355420234a5_EVIDENCE.json` and
`docs/aiya-global-freeze-phase-1-host-capture-addendum-20260924T200803Z-86d11645-08e5-490a-8b86-8563dd32e6c9_EVIDENCE.json`.
Status: open, measurement-blocked, root cause unknown. Resume only with a
supported Chrome trace/control channel. No runtime fix, Plan 2 eligibility,
deployment, or production readiness is implied.

Follow-up CUA probe on 2026-09-24: a synthetic phone-field fill call returned
in 1,651 ms; after a 2,000 ms pause, the Formlar click timed out in the
automation Input.dispatchMouseEvent path. DOM, reload-completion, and console
log reads then timed out in Emulation.setFocusEmulationEnabled. Supplemental
evidence is
`docs/aiya-global-freeze-phase-1-cua-followup-20260924T203252Z-b84b86c1-ab57-46b8-a1de-9ea7d9a4e8fd_EVIDENCE.json`
(SHA-256 `6F223F9D421B21D0BD31C75B79D8A997D7FF20DFAE7229A79D79F3025E62768B`).
It is invalid for Phase 1 and does not establish a page freeze. Local source
inspection predicts a Stay/Discard dirty-draft dialog for a phone-only client
draft; that could explain deferred navigation only if rendered and cannot
explain typing or reload delay. No form was submitted; root cause and risk
disposition remain unchanged.

R-P5-011: The 2026-09-19 shared-runtime A-B-A continuation confirmed one
repeatable contributing boundary. Passing the full `DashboardUrlState` object
from `DashboardApp` to `useStage4BInbox` recreated refresh dependencies on
unrelated URL/state changes; the memoized six-field projection removed two
overlapping inbox refresh requests in all three B repetitions. Status:
contributing boundary confirmed and candidate retained locally; global freeze
root cause, production-fix acceptance, Plan 2 eligibility, and production
readiness remain open/unchanged. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-ab-a-20260919T111921Z-cd652e70-18de-4d16-89e4-2aadfcd336ce_EVIDENCE.json`.

R-P5-012: Earlier shared-runtime runs recorded `UNAVAILABLE` or incomplete
Docker sampler evidence because host `psql` fallback and transient failures
were not handled robustly. The repair run now records 756 successful Docker
aggregate observations with zero sampler errors, zero lock-wait observations,
and zero blocked-activity observations. Status: mitigated for this bounded
local diagnostic path; the historical runs remain unchanged and the result is
not evidence that session-activity row locks are absent outside the observed
windows. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_shared-runtime-sampler-validity-repair-20260919T132757Z-d3c7bee6-b396-4d64-9f6c-3576caeed017_EVIDENCE.json`.

R-P5-013: The 2026-09-19 auth/RSC A-B-A continuation tested a request-local
React cache around `resolveDashboardAuth` while holding the retained inbox
projection constant. Selected J1 normal and diagnostic observations were 6/6
valid and successful in A1, B, and A2, but response, RSC, auth_total,
request-window, and React-commit signals did not move in one repeatable
direction. A2 also contained one invalid J2 timing unit and three incomplete
J3 normal units; those were excluded from the selected J1 decision and remain
visible in evidence. Status: candidate inconclusive, cache removed, uncached
baseline restored; auth/session and RSC/bootstrap remain open, and no runtime
fix, Plan 2 entry, or production decision changed. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-auth-cache-ab-a-20260919T123718Z-479575bb-ed48-487c-b099-f935ad403948_EVIDENCE.json`.

R-P5-014: The 2026-09-19 request-coalescing A-B-A continuation tested only
same-key in-flight `/api/shell/bootstrap` GET coalescing in
`shell-provider.tsx:fetchShellBootstrap`. Selected J1 diagnostic observations
were 3/3 valid and successful in A1, B, and A2. B reduced bootstrap counts from
`7/7/7` to `5/5/6`, but total request fan-out, second-action tails, and React
commit metrics had no stable speed direction. Status: bounded bootstrap
duplication contributor recorded, speed inconclusive, B removed and A2 baseline
restored; global freeze, auth-chain root cause, Plan 2 eligibility, and
production readiness remain open/unchanged. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-request-coalescing-ab-a-20260919T141815Z-2bf54fb2-080c-4470-a920-05ebc5f5b7ab_EVIDENCE.json`.

R-P5-015: The 2026-09-20 auth-chain ownership A-B-A continuation removed only
the repeated `assertShellSessionActivity` RPC from normal
`resolveAccountTenantContext` calls while retaining the explicit session
activity endpoint. The contained RPC span fell to approximately zero in all
three B repetitions, but request fan-out stayed at `53/24/26` and selected J1
second-action tails showed no repeatable improvement: A1 `1147/524/660` ms, B
`1196/1395/1234` ms, A2 `622/1534/552` ms. Status: auth RPC cost measured,
speed inconclusive, B removed and A2 baseline restored; global freeze,
finding dispositions, Plan 2 eligibility, and production readiness remain
open/unchanged. A2 sampler status is `PARTIAL` because one sample errored; no
global lock-absence claim is allowed. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-auth-ownership-ab-a-20260920T150730Z-c86defe0-6be6-46e9-bd56-a5560d140fa1_EVIDENCE.json`.

R-P5-009: The earlier blocked shared-runtime checkpoint
`aiya-performance-plan1-shared-runtime-diagnostic-v3-20260918T185554350Z-3d620a1a-d1a5-4da8-b706-6a94cd9c1b07`
remains preserved as historical evidence. The selected continuation was later
completed through A1, B, and A2 runs, all with 12/12 observation-valid units.
Status: the runner continuation is complete, but the global performance
diagnosis remains open; no finding disposition, Plan 2 eligibility, or
production decision changed. The earlier local-input-blocked run remains
historical.

R-P5-010: The shared-runtime instrumentation now has diagnostic
Server-Timing, request-overlap, React-profiler, selected-J1 A-B-A records, and
a repaired bounded aggregate DB sampler. The evidence confirms the inbox
refresh fan-out boundary only; the separate auth/RSC cache candidate was
inconclusive, and auth/session, RSC/bootstrap, and global React-commit
causality remain unresolved. Status: open and bounded; do not treat the
request-fan-out candidate or zero observed DB waits as complete performance
recovery or a global lock-absence claim.

R-P4-019: The v2 J1 timer starts at journey start, including client selection,
rather than the trusted Forms click. Waiting for an abandoned panel can also
confuse a normal navigation lifecycle with a freeze. Status: mitigated for
the v3 J1 success capture: the timer is anchored to the trusted Forms click,
and target readiness/route events are recorded independently. The v3 normal
run observed and reconciled the navigation-away branch for J3; a genuine
target-failure branch still requires scoped evidence.
Historical 13/18 validity counts remain v2-only and cannot certify v3
semantics.

R-P4-020: Unconditional environment ordering and successful-operation gates
can prevent diagnosis of an observed failure. Status: mitigated in the v3
plan and runner by explicit dependencies and separate
observation/functional/speed outcomes. The targeted probe passed 4.4.2
without promoting any result to the official baseline; failed operations
remain non-successful samples.

R-P4-021: Historical worktree references had diverged from the available
working tree, and the former 38c0 directory is empty. Status: reconciled for
the current source. The active execution target is the main checkout at
`C:\Users\Dell\OneDrive\Masaüstü\MANU-AI`; the recovered snapshot commit and
preserved dirty-state manifest are recorded in
`docs/WORKTREE_RECONCILIATION_20260918T163307Z_EVIDENCE.json`. Historical
measurement identities remain unchanged.

R-P4-022: Scoped desktop investigation can leave hosted/device behavior
unverified. Status: mitigated for diagnostic observation coverage after the
user explicitly reopened 4.5/4.6 and the hosted, Android Chrome, and
installed Android PWA units were captured. The coverage is not environment
acceptance and does not establish a cross-environment performance result.
Production remains NO-GO.

R-P4-025: Local v3 observations and the newly captured hosted/device
observations are not portable official acceptance evidence. Status: open and
controlled by the separate environment evidence and its observation-versus-
functional-versus-performance separation. No cross-environment acceptance or
root-cause attribution is permitted from the current diagnostic runs.

R-P4-023: The v3 targeted J1 probe completed both required reads and the
expected navigation preference mutation, while three non-required background
requests were observed as failed or unfinished at the bounded observation
deadline. Status: mitigated for the current v3 normal run: reconciliation
retained completed, failed/aborted, and pending-at-capture-end states. These
states do not invalidate the required J1 boundary and must not be treated as
a root-cause location.

R-P4-024: The v3 normal run produced 9/9 observation-valid records and 6/9
successful functional samples. All three J3 observations consistently recorded
`first_target_abandoned_after_navigation` while the Dashboard target became
ready. Status: reconciled in 4.4.4; this is valid navigation-away evidence,
not a confirmed application performance cause. Performance remains
`NOT_EVALUABLE` and broader diagnosis is still open.

R-P4-026: The explicitly reopened 4.5/4.6 run completed 27/27
observation-valid units across hosted, Android Chrome, and installed Android
PWA, with 17 valid functional samples, 8 functional failures, and 2
incomplete outcomes. Status: reconciled for diagnostic environment coverage;
performance remains `NOT_EVALUABLE`, official measurement has not started,
and no root cause or runtime fix is established.

R-P4-027: A later retry under a temporary behavior-neutral environment-runner
cleanup ended `BLOCKED` after Android Chrome and PWA observation completeness
degraded, although environment preflight remained ready. Status: contained;
the cleanup was restored to the completed run's runner identity, the retry is
preserved as a separate failed record, and its observations are not merged
with the compatible 27/27 environment evidence.

R-P4-028: Phase 4.7 reconciled all current diagnostic observations, but no
common-layer delay repeated with an accepted timing boundary and performance
remains `NOT_EVALUABLE`. Status: open and explicitly bounded by the
`DIAGNOSIS_BLOCKED` closure; at the time of 4.7 all five finding dispositions
were unchanged. The first identity-invalid 4.7 attempt is excluded, and no
causal experiment, runtime fix, Plan 2 entry, or production action is
authorized without a separately approved hypothesis and timing evidence.

R-P5-001: Phase 5.1 has four pre-registered candidates, but measured
contribution is unavailable because the 4.7 performance outcome is
`NOT_EVALUABLE`. Status: controlled by provisional ordering only; H-5.1-001
has provisional effect evidence, H-5.1-002 is `INCONCLUSIVE`, and H-5.1-003
now has a repeatable provisional effect, but no candidate is optimized or
treated as causal. Stage 5.2 completed its first
single-variable experiment and Stage 5.3 completed layer attribution as
`LAYER_ATTRIBUTION_INCONCLUSIVE`; no cause claim follows. The next supported
action was the Phase 5.6 finding-disposition review, now complete. It assigned
the three F2 findings `INCONCLUSIVE` and left both F12 findings
`OPEN_BLOCKED`; the warm AI Chat candidate remains deferred until a dedicated
AI Chat journey is captured.

R-P5-002: The H-5.1-001 local desktop experiment produced a repeatable
provisional effect for the trace-only `shared_read_start_policy` variable:
the bootstrap-gated B path was slower at route-commit to target-ready in all
three matched cycles (+28.5 ms, +292.5 ms, and +89 ms). Status: open and
bounded; this is not root-cause proof, an official baseline, a finding-
disposition change, or an accepted runtime fix. The required read and client
boundaries were valid, while unrelated request tracking reached its bounded
body-finish deadline and remains a diagnostic limitation. The separately
authorized 5.3 layer-attribution contract is complete but inconclusive;
preserve the A default and the first trusted-click-invalid run as excluded
evidence. The 5.6 review later assigned `PERF-F2-001` to `INCONCLUSIVE` and
did not authorize a runtime or Plan 2 change.

R-P5-003: Phase 5.3 found repeatable co-variation in app-state store/route
timing and downstream hydration/readiness, but no independently isolated layer
or exact file/function cause. DNS/TLS and service-worker paths were not
exercised; auth was not separated; read-start order was not attributed; and
the ancillary unrelated-request body-finish deadline remains visible. Status:
open and bounded; no finding disposition, runtime fix, official baseline, or
Plan 2 entry is authorized from this result. Phase 5.4 completed the safe
local checks and the required runtime RLS boundary; no fix proposal or Plan 2
entry follows from that gate, and the H-5.1-002 loop has now completed without
a causal result. H-5.1-003 has now produced only a provisional diagnostic
effect; the 5.6 review later assigned `PERF-F2-001` to `INCONCLUSIVE` and kept
Plan 2 locked.

R-P5-004: Phase 5.4 safe local behavior checks passed 21/21 focused files and
164/164 tests for auth/session, tenant/capability, freshness/late-response,
mutation revision/conflict/idempotency, and offline/privacy/reconnect
contracts. The required runtime cross-user/RLS boundary then passed locally
at `127.0.0.1:54321`: 1/1 integration file and 56/56 tests, with no failed or
skipped tests. Status: mitigated for the local safety gate; this does not
establish production or cross-environment acceptance. Keep production
`NO-GO`; the safety gate did not itself alter finding dispositions. The later
5.6 review assigned bounded dispositions and kept Plan 2 locked after the
H-5.1-003 provisional effect.

R-P5-005: The H-5.1-002 background-polling candidate loop used the trace-only
`foreground_polling_policy` variable across three matched local desktop
A-before -> B -> A-after cycles. All 9/9 traces were observation-valid, but
the directions were `B_SLOWER`, `B_FASTER`, and `B_SLOWER`, so the result is
`COMPLETE / INCONCLUSIVE` rather than a repeatable effect. B navigation-window
pause/cancel was observed in all three cycles; this is a diagnostic behavior
observation, not a confirmed product cause or accepted fix. Four earlier
invalid or interrupted attempts remain separate and excluded. Status: open
and bounded; the later 5.6 review assigned `PERF-F2-002` to `INCONCLUSIVE`,
with no official baseline, Plan 2 entry, or runtime remediation. H-5.1-003
remains provisional and is not an accepted runtime fix.

R-P5-006: The latest H-5.1-003 dashboard bundle/import/render loop is recorded
at `docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-5-candidate-loop-v3-20260918T094941316Z-2e94ad8b-d576-4fa5-9bc0-ddf5c62f673d_EVIDENCE.json`.
The trace-only `target_panel_loading` variable produced 9/9 valid local
desktop observations across three matched A-before -> B -> A-after cycles;
B was slower at route-commit to target-ready by `+842 ms`, `+297 ms`, and
`+356 ms`, with the dynamic import and panel mount observed in every B trace.
Status: open and bounded as `REPEATABLE_PROVISIONAL_EFFECT`; this is not exact
file/function root-cause proof, a finding disposition, an accepted runtime
fix, an official baseline, or a Plan 2 entry. The first same-candidate run is
preserved as inconclusive because its B build still used the eager wrapper; the
second is preserved as blocked with 6/9 valid traces after the corrected build
exposed a runner-boundary issue. Neither is merged into the latest run. The
5.6 review assigned `PERF-F2-003` to `INCONCLUSIVE`; the provisional effect
does not establish an eager-path cause. Production remains `NO-GO`.

R-P5-007: Phase 5.6 completed the offline review in
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-6-finding-disposition-review-v3-20260918T123600Z-aae55ab8-db06-40b5-9d56-8c2de6bbb5e7_EVIDENCE.json`.
`PERF-F2-001`, `PERF-F2-002`, and `PERF-F2-003` are `INCONCLUSIVE`; the two
AI Chat findings are `OPEN_BLOCKED` because no dedicated authenticated
journey supplied their required boundaries. Phase 5.7 closed Plan 1 as
`DIAGNOSIS_BLOCKED` for this scoped diagnosis; zero findings are eligible for
Plan 2 and production remains `NO-GO`.

R-P5-008: Phase 5.7 closed Plan 1 with the prioritized five-entry Plan 2 input
in
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-7-plan1-closure-v3-20260918T125452Z-f5305ee2-b35b-43c5-91df-42f313d0da29_EVIDENCE.json`.
The closure is `DIAGNOSIS_BLOCKED`: the three F2 findings are `INCONCLUSIVE`,
the two F12 findings are `OPEN_BLOCKED`, and no finding is eligible for Plan 2.
Status: open and bounded as a diagnostic-continuation dependency; no runtime,
database, provider, deployment, or production action is authorized.

R-WR-001: The supplemental reconciliation audit in
`docs/WORKTREE_RECONCILIATION_20260918T163307Z_SUPPLEMENTAL_AUDIT.json`
corroborates the recovered-path integrity claim: 123/123 recovered paths are
present, 117 match the snapshot hash, and the six non-matching paths are
expected active authority documents. Status: mitigated for recovery integrity,
but bounded by evidence limitations. The pre-reconciliation dirty state is
preserved in the external recovery backup and manifest rather than
byte-identically in the active tree, and the reference/sensitive-pattern scans
are scoped metadata checks, not proof that every historical document is clean.
No performance fix, Plan 2 eligibility, or production readiness follows.

## Historical risk updates

Records below retain their original statuses and wording. Current Plan 1
execution follows v3 and the open risks above; historical Plan 1 instructions
do not override it. Unrelated product/security risks remain in force.

## Current Plan 1 final revision and Phase 4.4 local reproduction - 2026-09-16

R-P4-008: Plan 1 is now governed by revision `plan1-final-v2`. Phase 4.1
locked the detached worktree, dirty-file inventory, source/tool/configuration
hashes, inherited evidence references, and live release references. Phase 4.2
reviewed the historical evidence and separated the current variant from an
ignored reference snapshot. The runtime comparison has exactly the three
locked state-provider/hydration experiment mismatches and zero unrelated
mismatches. Status: `mitigated for identity and reference separation`; no new
official measurement or causal claim is valid from this lock alone.

R-P4-009: Older Phase 4/5 prose remains in this register and related documents
as historical context. It is superseded by `plan1-final-v2`; the next eligible
unit is Phase 4.4. Status: `mitigated by canonical-document marker`.

R-P4-010: The current/reference separation is explicit and reproducible from
the ignored Phase 4.2 snapshot, but the state-provider/hydration behavior has
not been measured causally. The snapshot is a diagnosis input, not a fix, and
must not be treated as an accepted runtime optimization. Status: `open`; next
action is Phase 4.4 local authenticated diagnosis with both identities held
separate.

R-P4-011: The Phase 4.3 general interaction harness is now separate from the
official nine-scenario baseline. Its normal and diagnostic profiler modes,
fixed two-second second-action timing, single-attempt click policy, and
required timing fields are contract-tested. No journey has run yet, so the
harness is measurement-ready evidence rather than a performance result.
Status: `mitigated for harness identity`; next action is Phase 4.4.

R-P4-012: Phase 4.4 local authenticated reproduction was started with a
separate checkpoint and an 18-unit J1-J3 contract (three normal and three
diagnostic repetitions per journey). The first preflight could not reach the
local app at `127.0.0.1:3136` or local Supabase at `127.0.0.1:54321`, and the
process environment did not contain the synthetic account inputs. Status:
`blocked`; no unit was attempted, no official sample was added, and the same
checkpoint must resume after the local inputs and existing credential
configuration are restored. Credential values are not recorded. This is an
environment/input blocker, not a product root-cause claim.

R-P4-013: The 4.4 runner records request overlap/count/status/body-size,
auth/session, Server-Timing, browser parse/render, long-task, and exact
failure-boundary evidence while redacting raw bodies and credentials. Its
normal and diagnostic modes and non-official-sample disposition are tested;
the actual trace set remains uncollected until R-P4-012 clears. Status:
`mitigated for measurement contract`; no 4.5 or causal work may begin.

R-P4-014: The first post-preflight 4.4 attempt exposed a harness-only
responsive-navigation selector defect: a hidden medium-rail link was selected
before the visible shell link. The selector now targets visible layout copies,
and the Phase 4.3 and 4.4 contract tests pass at 8/8 and 14/14. The affected
run remains preserved as historical checkpoint evidence; no application root
cause is inferred. Status: `mitigated`; compatible continuation used the
corrected harness identity.

R-P4-015: The latest authenticated local 4.4 run attempted all 18 planned
units and produced 13 valid and 5 invalid samples. All five invalid samples
are J1 Forms-to-Nutrition repetitions, while J2 and J3 are 12/12 valid. The
result is `BLOCKED / LOCAL_INVALID_SAMPLES`; the J1 boundary is a candidate
interaction/readiness issue, not a confirmed root cause. Status: `open`; the
next action is a separately identified 4.4 review of Forms reads, the
Nutrition ready boundary, and overlapping request/render timing.

R-P4-016: An unbounded request body-finish drain could leave an interrupted
measurement live. The runner now applies a bounded wait and records the unit
as incomplete/invalid on timeout. The interrupted checkpoint run is preserved,
and the earlier bootstrap failure remains marked stale. Status: `mitigated`;
no incomplete sample is eligible for PASS.

R-P4-017: J1 is currently valid in only 1/6 repetitions under the fixed
2,000 ms second-action interval. The available records do not provide three
matching valid traces or a repeatable single-variable experiment, so they
cannot establish a file/function root cause. Status: `open`; keep runtime
changes out of Plan 1 until the failure boundary is reproducibly isolated.

R-P4-018: J2's inbox list is preloaded during authenticated dashboard
hydration and the journey does not click a conversation detail. The required
read contract was corrected to reflect that behavior. The client-activation
`/api/shell/preferences` PATCH is separately classified as an expected
successful navigation mutation; other mutations remain forbidden. Status:
`mitigated for measurement semantics`; no finding disposition changed.

## Current Phase 4 baseline risks - 2026-09-16

R-P4-001: The latest canonical run
`aiya-performance-plan1-phase4-20260915T195604720Z-497a3200-ada3-445d-a2d0-059cb0886940`
completed stages 4.1-4.3 and produced 20 valid rounds for all nine
scenarios in local small, local normal, and owner-PC hosted profiles. Android
Chrome readiness and connection monitoring passed, but the baseline stopped
at 17 valid rounds after the locked 28 attempts, with 11 discarded and 0
failed attempts. The installed PWA baseline was not run by ordered
dependency. Status: `open`; no Android/PWA performance PASS may be claimed.

R-P4-002: Android discard reasons are heterogeneous and include repeated AI
Chat destination/workspace readiness timeouts, one required-read failure, one
password-login response miss, one unstable menu-tab click, and one page
navigation timeout. The phone was connected and 66 connection-monitor checks
passed, so these records identify an incomplete Android measurement path but
do not prove a single dominant cause. Three diagnostic cycles, each with
three repetitions and zero official samples, now provide repeated
valid-but-budget-failing AI Chat candidate evidence. The latest cycle records
one workspace-ready timeout, long More-page readiness and real AI Chat
item-click completion, and successful HTTP 200/body-finished conversation
reads in its valid samples. No common click failure or device disconnect was
reproduced. Status: `blocked`; the route/navigation/render causal chain
remains open and no runtime fix is authorized in Plan 1.

R-P4-003: Validity and speed budgets remain separate. Local and hosted
profiles have validity/functional PASS with repeated workspace, communication,
and AI Chat budget FAILs; the partial Android samples also contain budget
FAILs. These are reproduction candidates only. `closure.reproduced=true`
does not establish a causal root cause or authorize Plan 2/runtime changes.
Status: `open`.

R-P4-004: The canonical closure is `BLOCKED / PERFORMANCE_BLOCKED` with
`validEnvironmentCount=2/4`; Stage 4.4 is blocked on the incomplete Android
20-sample contract and Stage 4.5 is blocked by order. The next eligible work
is a controlled causal diagnosis of the Android More-to-AI-Chat
route/navigation/render path. A reproducible harness defect may be followed
by a harness-only compatible checkpoint continuation; an application runtime
correction requires a causal trace, focused regression test, and explicit
Plan 2/scope authorization. Production remains `NO-GO`. Status: `blocked`.

R-P4-005: On 2026-09-15, an attempted npm status invocation did not forward
the `--status` argument on this host and briefly reopened the already closed
checkpoint. The process was stopped before a measurement attempt; checkpoint
events 216-217 restore terminal `BLOCKED`, the hash chain validates, and no
new `phase4.*` measurement event was written. This is an operator-command
risk, not a product or performance result. Status: `mitigated`; inspect with
the direct `node scripts/performance-plan-1-phase-4.mjs --status` command
from `app`.

R-P4-006: A multi-hour measurement can be interrupted by computer shutdown or
session loss between two durable event boundaries. The cycle controller now
persists cycle identity/state, resumes an active cycle after identity and lock
checks, records interruption, and keeps diagnostic/unfinished work out of
official samples. Its tests pass and per-cycle diagnostic history is written
separately. Filesystem/hardware loss between atomic commits remains outside
the guarantee. Status: `mitigated locally`.

R-P4-007: Android AI Chat readiness can exceed the locked speed budgets even
when authentication, interaction trust, and the conversations request are
valid. The three diagnostic cycles provide repeated candidate evidence, but
the trace has not yet isolated one causal application function or a single
variable experiment. Status: `open`; next action is targeted route,
shell/bootstrap, render/long-task, ready-selector, and request timing
diagnosis. Do not change runtime code or call this a confirmed root cause
without the required causal trace and focused test.

## Historical prior Phase 4 baseline risks - 2026-09-15

R-P4-001: The latest canonical run
`aiya-performance-plan1-phase4-20260915T130141721Z-6aa263db-c0ff-4192-9333-c20d769f4692`
completed local and owner-PC hosted baselines at 20 valid rounds per scenario,
but Android Chrome preparation stopped at
`preparation_failed:locator.click: Timeout 8000ms exceeded.` ADB/CDP,
target-origin, and target-launch checks passed; the connection monitor also
passed. This is an Android authenticated-interaction measurement blocker. No
Android or PWA sample may be counted until the preparation round completes.

R-P4-002: `normal_synthetic` completed 20/20 valid samples for all nine local
scenarios, with functional and validity PASS. Workspace, communication, and AI
Chat paths contain repeated warm-navigation/body-finish/long-task budget FAILs.
These records establish a performance reproduction candidate only. They do not
prove a runtime cause, authorize optimization, or justify Plan 2 before the
small profile and the remaining environments satisfy the Phase 4 contract.

R-P4-003: The current canonical closure is `BLOCKED / PERFORMANCE_BLOCKED`
with `validEnvironmentCount=2/4`; Stage 4.4 is blocked and Stage 4.5 was not
run by ordered dependency. Historical hosted-DNS and PWA notes must not be
merged with this run. Production remains `NO-GO`.

## Resume infrastructure risks - 2026-09-15

R-RESUME-001: A power loss can still interrupt the operation currently between
its start and commit boundaries. The shared checkpoint store bounds the loss to
that work unit, records an interrupted attempt on the next open, and never
counts an incomplete measurement round as valid. This is mitigated locally,
not a guarantee against filesystem or hardware failure.

R-RESUME-002: A changed source, fixture, migration, artifact, or harness could
make old measurements incomparable. The checkpoint identity gate now blocks
silent continuation. The Phase 4 harness now has an explicit compatible
migration command for the narrow case where only checkpoint recovery and
error-observability code changed; it verifies the source hash chain, fixture,
build, schema, and locked sample contract before copying measurement events.
The source run remains immutable and prior events remain inspectable. This is
mitigated locally; affected-scope restart or compatible migration remains an
explicit operator action.

R-RESUME-003: Checkpoint files could leak credentials or clinical data. Phase 4
sanitization runs before event serialization and the test suite checks secret
redaction; raw payloads, cookies, tokens, prompts, clinical content, and device
serials remain prohibited. This is mitigated locally and does not authorize
production data processing.

The current Step 3 control is implemented on 2026-09-14. The Phase 4
measurement launcher now executes the readiness command before stage 4.1 and
fails closed unless H1-H4 are complete in order, local/hosted/physical
Android/PWA environment gates are PASS, real hosted authentication and
shell-bootstrap body-finish are proven, `baselineStarted=false`, the approved
runtime-file input source is unchanged, local/hosted inputs are unchanged,
and source/fixture/migration/build identity matches at measurement start. The
readiness-created build is reused only after those checks; no local server or
20-sample baseline starts on failure. Readiness run
`aiya-phase4-readiness-20260914T184904329Z` and direct gate evaluation passed.
This mitigates measurement-start drift only; it does not close any performance
finding or change production `NO-GO`.

The first entry below is the supporting Step 2 and startup-flow authority. On
2026-09-14, Plan 1 Phase 4 was changed to load only the ignored repo-root
`.manu-runtime/performance-phase4/hosted.env`, require the exact three
`AIYA_PHASE4_HOSTED_*` keys, reject missing/invalid/symlink files and
process/file conflicts, enforce the approved test-VPS origin and HTTP 200 plus
`apiStatus=ok` release health, and require real password-login, authenticated
`/dashboard`, and `/api/shell/bootstrap` 2xx/body-finished evidence before any
long measurement. Android readiness now requires one authorized physical
device, real Chrome CDP forwarding/handshake, explicit Chrome and installed
WebAPK launch paths, standalone/service-worker/online PWA target evidence, and
connection monitoring around the run. Readiness run
`aiya-phase4-readiness-20260914T184904329Z` records the hosted preflight,
local Supabase/Docker/build, Android device/CDP, normal Chrome, installed PWA,
and 13/13 connection checks as `PASS`. H1-H4 and the ordered readiness closure
are `COMPLETE / READY_FOR_PHASE4_BASELINE`; no Phase 4 baseline started, and
this is not evidence that any performance finding is fixed. Older same-day
Phase 4 wording below is historical/diagnostic context.

Approved non-production hosted synthetic account preparation completed on 2026-09-13 on test VPS `65.21.52.249` with strict SSH host-key verification. Exactly one `aiya-phase4-hosted-*` Auth user has one owner membership and one dietitian profile on the existing active synthetic tenant; password-login returned HTTP 200 and authenticated RLS/store checks passed. Values are stored only in ignored `.manu-runtime/performance-phase4/hosted.env` and are absent from evidence, logs, chat, and Git. No production account, migration, deploy, provider/channel traffic, billing, or worker change was performed.

Historical readiness implementation snapshot (2026-09-13): the prior readiness run and its environment observations are superseded by the 2026-09-14 evidence above. It is retained for history and was not rewritten as a new run.

Historical last Phase 4 baseline attempt (pre-startup correction): the canonical evidence remains `BLOCKED / PERFORMANCE_BLOCKED`; local samples completed, but the hosted stage failed before valid hosted samples and later stages were blocked. No causal proof or post-correction baseline exists.

Historical AIya Performance Plan 1 Phase 3 closure, 2026-09-10: `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json` records stages 3.1-3.6 as `COMPLETE` with `SYNTHETIC_AUTH_STORE_READY`. Local migration/schema checks, deterministic two-tenant fixture seed, eight password sessions, owner/assistant/viewer/auditor/anonymous RLS boundaries, AI Chat boundary, viewer write block, and owner store-read matrix passed. The local fixture remains for Plan 1 Phase 4. No performance baseline, freeze reproduction, root-cause attribution, runtime change, hosted account, physical Android/PWA capture, deploy, remote migration, provider/channel egress, or production gate change was performed. Production remains `NO-GO`.

Superseded AIya Performance Plan 1 Phase 4 note, 2026-09-11: an earlier summary said local desktop Stage 4.2 and test-VPS hosted Stage 4.3 completed and only physical-device capture blocked closure. That note is superseded by the 2026-09-13 canonical evidence above and must not be used as the current Phase 4 state.

Historical AIya Performance Plan 1 Phase 1 closure, 2026-09-10: `docs/AIYA_PERFORMANCE_PLAN_1_EVIDENCE.json` records the ordered source/finding/closure work as `COMPLETE` with all five stages complete and the final closure gate `PASS`. After the user started Docker, local Supabase was started and only the local database was reset. With all full-rehearsal flags enabled, the clean full-repository run produced 288/288 test files and 1726/1726 tests passed, with zero failed and zero skipped. `docs/AIYA_PERFORMANCE_PLAN_1_FINDING_MANIFEST.json` keeps all five performance findings open for valid authenticated reproduction. No runtime cause is confirmed and no runtime change is authorized. Local/upstream HEAD is `568a1ffba833db0dd182a3d9fad5b034f7cf98e5`; live customer/admin release remains commit `1c9756046b01cb1bd224fb601ec9094a7f471606`. Plan 1 Phase 2 is eligible only after explicit user approval and has not started. Production remains `NO-GO`.

Historical Revizyon 2 AIya performance Phase 3 attempt, 2026-09-10: `docs/AIYA_PERFORMANCE_PHASE_3_EVIDENCE.json` records the older `PERFORMANCE_BLOCKED` Stage 3.1 attempt. It is not the current Plan 1 Phase 3 evidence and was not rewritten.

Historical Revizyon 2 AIya performance Phase 2 execution note, 2026-09-10: `docs/AIYA_PERFORMANCE_PHASE_2_EVIDENCE.json` records the older `PERFORMANCE_BLOCKED` result at local HEAD `0c023921584d5a238a317d57100e94963ab603b5`. The current Plan 1 Phase 2 and Phase 3 evidence are separate records; the original historical evidence remains unchanged.

The Revizyon 2 note below is retained only as historical context; the current Plan 1 Phase 3 closure and next eligible Phase 4 are authoritative.

Historical AIya performance Revizyon 2 note, 2026-09-10: the older direct Phase 2 interpretation is superseded by the active Plan 1 contract and its ordered Phase 4 baseline gate. The five performance findings remain open for valid authenticated measurement; no runtime cause is confirmed. Production remains `NO-GO`.

Historical AIya performance audit Phase 1.2 note, 2026-09-10: `docs/AIYA_PERFORMANCE_PHASE_1_2_PLAN.md`, `docs/AIYA_PERFORMANCE_PHASE_1_2_EVIDENCE.json`, and `docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json` record the corrected post-login performance diagnosis. The stricter harness replaced obsolete `workspace=` routes with canonical authenticated dashboard routes, required real clicks and feature-specific success selectors, propagated API failures, measured body-finished request timing, prepared standalone Next static/public assets, and compared desktop Chrome with Android Chrome emulation on one local production-like server. Local/emulated evidence did not reproduce a broad all-app freeze: dashboard, clients, forms, nutrition, menu, messages, alerts, and notifications rendered with low ready/request timings. Remaining performance-readiness risks were AI Chat diagnostic `401` on `/api/ai-chat/conversations` and still-supported Phase 1 code risks around broad `/api/app-state`, background refresh competition, and broad dashboard static imports. Production remained `NO-GO`; no runtime behavior, deploy, remote migration, production gate, secret/env, provider/channel egress, live billing, production worker, external system, or real health-data path changed.

Historical AIya performance audit Phase 1 note, 2026-09-09: `docs/AIYA_PERFORMANCE_PHASE_1_EVIDENCE.json` and `docs/AIYA_PERFORMANCE_PHASE_1_FINDING_MANIFEST.json` record the first measurement audit for the user-reported desktop and Android Chrome freezes. The local fallback-data lab harness completed desktop Chrome and Android Chrome emulation across public, login, dashboard, forms, nutrition, menu, and AI Chat scenarios with no p75 target misses, so the physical-device/live-session complaint was not reproduced as a local-lab timing failure. Code evidence locked three risks at that checkpoint: broad `/api/app-state` hydration on dashboard mount, timer-driven inbox/messaging/AI Chat refresh competition, and broad dashboard static import/render surface. Revizyon 2 supersedes the old direct Phase 2 interpretation and requires valid real-auth measurement before runtime optimization. Production remained `NO-GO`; no runtime behavior, deploy, remote migration, production gate, secret/env, provider/channel egress, live billing, production worker, external system, or real health-data path changed.

Current Exact HEAD hosted release parity preflight note, 2026-09-09: `docs/EXACT_HEAD_HOSTED_RELEASE_PARITY_PREFLIGHT_PLAN.md` and `docs/EXACT_HEAD_HOSTED_RELEASE_PARITY_PREFLIGHT_EVIDENCE.md` record the local deploy-preflight candidate for pushed HEAD `db32fe91488a40122cc44a96ac2efcdebff96bd0`. Candidate release is `hs-db32fe91488a-b55ed4ff550f`; migration fingerprint remains `b55ed4ff550f7e9ba8fc25957774341a19b7b05c1a35a891633369b4aff95f25`, matching the live release fingerprint. Local preflight passed typecheck, lint with 74 warnings/0 errors, release artifact test, production build, artifact generation, manifest inspection, and archive checksum recording. Live customer/admin endpoints still serve `hs-1c9756046b01-b55ed4ff550f`, so live/HEAD drift remains until a separately approved deploy. Production remains `NO-GO`; no deploy, remote migration, production gate, secret/env, provider/channel egress, live billing, production worker, external system, or real health-data path changed.

Current Live-HEAD reconciliation and owner gate execution planning note, 2026-09-09: `docs/LIVE_HEAD_RECONCILIATION_OWNER_GATE_EXECUTION_PLAN.md` and `docs/LIVE_HEAD_RECONCILIATION_OWNER_GATE_EXECUTION_EVIDENCE.md` record the current read-only reconciliation. Local/remote HEAD is `20f6995ac2b988b99ba06a9241f1736dc309bc39`; live customer/admin release-health endpoints both return `200` for release `hs-1c9756046b01-b55ed4ff550f` at commit `1c9756046b01cb1bd224fb601ec9094a7f471606`. The live/HEAD drift is documented and must not be mistaken for a deployed HEAD. System audit Phase 1-7 closures remain source-bound to `1c9756046b01cb1bd224fb601ec9094a7f471606`, and the Phase 7 dirty-tree record is historical; the current pre-phase working tree was clean. Stale clinical AI model-routing documentation was reconciled to the active Z.ai `glm-5.3-flash` code authority. Production remains `NO-GO`; no owner-controlled gate, deploy, remote migration, provider/channel egress, live billing, production worker, secret, or real health-data path changed.

Current public surface/auth/onboarding/PWA Faz 8 note, 2026-09-07: Faz 8 clean-HEAD reclosure is locally complete. Evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_8_CLEAN_HEAD_EVIDENCE.md`. Session RPC bypass, admin N+1/pagination/search, onboarding claim recovery, zero-skip local RLS, Android Chrome/PWA/TalkBack evidence binding, release identity, and live-read-only drift disclosure are reconciled at HEAD `3593ec98a883cfd302177ec9efc99a9426769592`. Canonical plan: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md`. Requirement matrix: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_REQUIREMENT_MATRIX.md`. Live VPS release is unchanged at `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9`. Production remains `NO-GO`.

Prior public surface/auth/onboarding/PWA Phase 7 note, 2026-09-04: frontend remnant cleanup and unified local closure is complete. Evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_7_FINAL_EVIDENCE.md`. Unused simulator/operational/marketing UI files were deleted only after import-graph proof; backend simulator, operational-foundation, Stripe, and WhatsApp APIs remain. RLS re-run is environment-blocked, not PASS. Live VPS release is unchanged. Remaining risk is treating this local polish closure as production readiness or treating Playwright Android as physical TalkBack/iPhone proof. That checkpoint is superseded by the Faz 8 note above. Production remains `NO-GO`.

Prior public surface/auth/onboarding/PWA Phase 6 note, 2026-09-04: PWA, app-install, responsive, and accessibility polish is locally complete. Evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_6_PWA_INSTALL_RESPONSIVE_A11Y_EVIDENCE.md`. Auth/dashboard/API stay network-only; offline privacy-lock does not show health data. Local Android Chrome/installed-PWA PASS is Playwright Chromium Pixel 5, not a physical device. TalkBack and iPhone Safari/PWA remain `WAIVED_NOT_EXECUTED` and must not be reported as PASS. Phase 7 is now locally complete under the note above. Production remains `NO-GO`.

Prior public surface/auth/onboarding/PWA Phase 5 note, 2026-09-04: public site CTA, brand, and metadata polish is locally complete. Evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_5_PUBLIC_SITE_CTA_BRAND_METADATA_EVIDENCE.md`. Public CTAs are contact and login; `/purchase` remains a direct-URL remnant; customer and admin canonical origins are separated; visible tenant fallback is `AIya Workspace`. The append-only SQL file is not a remote apply. Phase 6 is now locally complete under the note above. Production remains `NO-GO`.

Prior public surface/auth/onboarding/PWA Phase 4 note, 2026-09-04: admin customer invite/revoke/reactivate is locally complete. Evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_4_ADMIN_CUSTOMER_LIFECYCLE_EVIDENCE.md`. Duplicate invite/account create is blocked; revoked access stays denied on dashboard/API until `reactivate`; Stripe routes were not changed. The local reactivation SQL file is not a remote apply. Phase 5 is now locally complete under the note above. Production remains `NO-GO`.

Prior public surface/auth/onboarding/PWA Phase 3 note, 2026-09-04: daily customer login is password-first and invite onboarding is locally complete. Evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_3_PASSWORD_ONBOARDING_EVIDENCE.md`. Magic link remains fallback/recovery; open signup was not added; `/app-install` replaced `/install` in post-auth redirects. Phase 4 is now locally complete under the note above. Production remains `NO-GO`.

Prior public surface/auth/onboarding/PWA Phase 2 note, 2026-09-03: authenticated web/PWA session idle timeout is two hours and server-authoritative. Evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_2_TWO_HOUR_SESSION_EVIDENCE.md`. Hidden-tab keepalive is not used; expiry redirects to login. The local append-only SQL file is not a production migration apply. Phase 3 is now locally complete under the note above. Production remains `NO-GO`.

Prior public surface/auth/onboarding/PWA Phase 1 note, 2026-09-03: visible dietitian dashboard simulator, operational-header, demo-reset, top language selector, top client picker, local-safe-mode copy, and operational-inspection chrome are removed from the authenticated local production surface. Evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_1_DASHBOARD_PRODUCTION_SURFACE_EVIDENCE.md`. Backend simulator/quarantine/trust APIs remain; unused panel files remained on disk until Phase 7, which later deleted them after import-graph proof. Phase 2 is now locally complete under the note above. Production remains `NO-GO`.

Prior public surface/auth/onboarding/PWA Phase 0 planning note, 2026-09-03: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md` and `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_0_BASELINE_EVIDENCE.md` locked the next local workstream. Phase 0 changed documentation only. Phase 1 is now locally complete under the note above. Production remains `NO-GO`.

Current AIya Supabase Auth sender correction note, 2026-09-02: `docs/AIYA_SUPABASE_AUTH_SENDER_CORRECTION_EVIDENCE.md` records that project `pxyjocahjutcojltcalj` now has `smtp_sender_name=AIya` and `smtp_admin_email=no-reply@auth.aiyaworkspace.com`, so the active auth sender is `AIya <no-reply@auth.aiyaworkspace.com>`. A controlled hosted magic-link request returned `sent=true`. The phase-5 branch was pushed to origin at `a35c3e167b22d42a57d51d4614567906293b7b03`, and the live commit is contained in `origin/codex/production-readiness-stage-1`. Production remains `NO-GO`.

Current AIya launch evidence preflight note, 2026-09-02: `docs/AIYA_LAUNCH_EVIDENCE_PREFLIGHT_EVIDENCE.md` closes the stale visual-test and dependency-audit findings left after hosted deploy repeatability. Dashboard/commercial visual tests now assert `AIya`; the shell-nav helper matches current link-based navigation; targeted desktop visual coverage passed 9/9; production and full dependency audits report zero vulnerabilities. Live read-only smoke still verifies release `hs-4c7bbea8ba21-2c32cf194421` at commit `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9`. Follow-up work closed Supabase Auth sender proof and GitHub remote traceability for the live/evidence commits. Production remains `NO-GO`.

Current AIya hosted deploy repeatability note, 2026-09-02: `docs/AIYA_HOSTED_DEPLOY_REPEATABILITY_EVIDENCE.md` records that the VPS now serves `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9` as release `hs-4c7bbea8ba21-2c32cf194421`. Live AIya brand/runtime parity passed for primary public/admin routes, PWA manifest, unauthenticated API fail-closed `401` responses, and legacy-domain `410`. The prior hosted deploy repeatability findings are closed: the official apply wrapper stages its remote helper runtime, PM2 runs the single `manu-ai` process, release identity is bound during restart and rollback, and Linux `sharp` optional runtime packages are installed/verified inside the release app when needed. The Phase 4 sender-proof gap is superseded by the 2026-09-02 Supabase Auth sender correction note above. Production remains `NO-GO`.

Current AIya local release parity note, 2026-09-01: `docs/AIYA_LOCAL_RELEASE_PARITY_VERIFICATION_EVIDENCE.md` verifies local HEAD `2b33cc661b17ae171547ad23fe1b19328ea261db` for AIya release parity. Typecheck, lint with existing 77 warnings/0 errors, targeted brand/PWA tests 24/24, production build, local production smoke, active-surface brand scan, scoped secret scan, and `npm run release:verify` passed. The live `500` issue is not reproducible locally: local `/app-install` redirects unauthenticated users to `/`, while local `/api/app-state` and `/api/clients` return controlled 401. Live hosted deploy and external sender evidence remain separate open work; production remains `NO-GO`.

Superseded AIya live parity note, 2026-09-01: read-only smoke evidence in `docs/AIYA_LIVE_PARITY_RUNTIME_SMOKE_EVIDENCE.md` recorded the pre-deploy state where live release `d1e0b5f40e3a6e3b535e2a889ebf68025c5e548a` still exposed stale branding, selected routes returned `500`, and Supabase Auth sender display name was not yet proven. These findings are superseded by the 2026-09-02 hosted deploy repeatability, launch evidence preflight, remote publication, and Supabase Auth sender correction notes above. Production remains `NO-GO`.

**Current Phase 85 Stage 7 authority (2026-08-24, iOS waiver updated 2026-08-28):** Stage 7 is locally STAGE_7_CLOSED after two clean npm run verify:stage-7 runs, physical Android Chrome PASS, installed Android PWA PASS, Android TalkBack PASS, npm run test:stage-7-real-device APPROVED_WITH_WAIVER, and final npm run release:verify PASS. iPhone Safari/PWA remains WAIVED_NOT_EXECUTED, not PASS; the owner permanently waived physical iPhone validation for this roadmap and future phases. Production remains NO-GO; this local frontend closure does not authorize push, merge, PR, deploy, production gate change, provider/channel egress, live billing, production schema rollout, or real-data processing. Authority: docs/PHASE_85_STAGE_7_CLOSURE_DECISION.json and docs/OWNER_IOS_VALIDATION_WAIVER_DECISION.md; evidence: docs/PHASE_85_STAGE_7_FINAL_CLOSURE_EVIDENCE.md and docs/PHASE_85_STAGE_7_REAL_DEVICE_VALIDATION_REPORT.json.

Current Phase 85 Stage 6 closure note, 2026-08-21, iOS waiver updated 2026-08-28: Stage 6 is locally `STAGE_6_CLOSED` after Android Chrome/PWA physical evidence and final `release:verify` passed. `S6-IOS-PHYSICAL-VALIDATION` is owner-accepted for the current roadmap and future phases: physical iPhone Safari/PWA was `WAIVED_NOT_EXECUTED`, never PASS. iOS-specific layout, safe-area, Safari, standalone-PWA, and offline-lock regressions may remain undetected; future readiness or pilot language must disclose the waiver and residual iOS risk. Production remains `NO-GO`. Authority: `docs/PHASE_85_STAGE_6_CLOSURE_DECISION.json`, `docs/OWNER_IOS_VALIDATION_WAIVER_DECISION.md`; evidence: `docs/PHASE_85_STAGE_6_FINAL_CLOSURE_EVIDENCE.md`.

Current planning authority note, 2026-08-26: MANU-AI planning is restored to the Phase 85 Stage 5/6/7 style: Markdown action plans, phase evidence, targeted verification, explicit user approval, and normal Git review. The later machine-lock governance system and Cursor-specific project restrictions have been removed from the repo. Product runtime, Stage 5/6/7 closure records, iPhone waiver status, and production `NO-GO` remain unchanged.

## Risk Scale

- Severity: `low`, `medium`, `high`, `critical`
- Status: `open`, `mitigated`, `accepted`, `blocked`

## Product and Legal Risks

Prior Phase 85 Stage 6 R3 checkpoint, 2026-08-20: alert/notification polling, filter, pagination, and receipt-mutation races are mitigated locally through resource-owned latest-request gates, abort, mutation invalidation, and stable-id page merge. Clean local Supabase reset and RLS 56/56 with zero skipped passed. Stage 6 Phase 1-3 remediation R1-R3 is complete locally; Phase 4 had not started at this checkpoint. Stage 5 remains closed and production remains `NO-GO`. Evidence: `docs/PHASE_85_STAGE_6_R3_INBOX_CONCURRENCY_SECURITY_CLOSURE_EVIDENCE.md`.

Current dependency note, 2026-08-20: newly published production `nanoid` findings were removed through transitive patch-only lock updates (`3.3.18`, `5.1.16`), and the production audit/release gate is clean. Unfiltered `npm audit` still reports four development-only transitive findings (one low, three high) in Babel, brace-expansion, js-yaml, and Vite tooling; these remain open for a separately scoped tooling dependency update and do not authorize production.

Prior Phase 85 Stage 6 R2 checkpoint, 2026-08-19: workspace projections are tenant/client/domain-owned; URL is the single viewed-client/task authority; bounded form reads are consumed; async saves, revision conflicts, pending text, and menu-plan switching are dirty-guarded. This mitigates local stale-client display and silent-draft-loss risk without persistent drafts or offline mutation. Stage 5 remains closed and production remains `NO-GO`. Evidence: `docs/PHASE_85_STAGE_6_R2_WORKSPACE_STATE_CONFLICT_DIRTY_NAVIGATION_EVIDENCE.md`.

Prior Phase 85 Stage 6 R1 checkpoint, 2026-08-19: Supabase-backed Stage 6 dashboard mutations now use durable tenant/request-scoped idempotency reservation and bounded response replay through `stage_6_mutation_idempotency`. Stage 5 remains closed. Production remains independently `NO-GO`. Evidence: `docs/PHASE_85_STAGE_6_R1_DATA_INTEGRITY_BOUNDED_PERSISTENCE_EVIDENCE.md`.

Prior Phase 85 Stage 6 Faz 3 checkpoint, 2026-08-19: messaging, alerts, notifications, and More now use a typed destination coordinator with dirty-guarded active-client transitions and bounded receipt/conversation refresh. Stage 5 remains closed. Production remains independently `NO-GO`. Evidence: `docs/PHASE_85_STAGE_6_PHASE_3_COMMUNICATION_OPERATIONS_EVIDENCE.md`.

Prior Phase 85 Stage 6 Faz 2 checkpoint, 2026-08-19: dashboard home and the client workspace (list/hub/task, dirty-guarded active-client selection) are implemented locally. Stage 5 remains closed. Production remains independently `NO-GO`. Evidence: `docs/PHASE_85_STAGE_6_PHASE_2_CLIENT_WORKSPACE_EVIDENCE.md`.

Prior Phase 85 Stage 6 Faz 1 checkpoint, 2026-08-19: client workspace mutations now return bounded `ClientScopedMutationResponse` payloads instead of a broad app-state snapshot. Stage 5 remains closed. Production remains independently `NO-GO`. Evidence: `docs/PHASE_85_STAGE_6_PHASE_1_CLIENT_DOMAIN_CONTRACTS_EVIDENCE.md`.

Current Phase 85 Stage 5 closure note, 2026-08-18: R-405 is technically resolved locally by upgrading `next` and `eslint-config-next` to stable `16.3.0`, which installs nested `postcss@8.5.23` and `sharp@0.35.3`; `npm audit --omit=dev --json` reports zero production vulnerabilities. Stage 5 is closed after shell, performance, zero-skip RLS, and physical-device evidence passed. Production remains independently `NO-GO`; Stage 5 closure does not authorize launch approvals, provider/channel egress, live billing, production schema rollout, or real-data paths.

Document authority rule: the note above and `docs/PHASE_85_STAGE_5_CLOSURE_DECISION.json` are the current Stage 5 risk context. Dated phase statements elsewhere in this register are historical snapshots and do not override them.

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-001 | Product is perceived as replacing a dietitian. | critical | Conservative product claims, supervised assistant positioning, human review. Phase 10 launch gates keep production pilot blocked until external approval gates are complete; Phase 33 adds an external approval intake packet without approving any gate; Phase 34 prepares the legal/privacy review packet without approving product claims; Phase 64 requires structured sanitized evidence coverage before any launch gate can be treated as closed. | open |
| R-002 | System is classified as medical device or clinical decision support. | critical | Legal classification memo before production pilot. Phase 10 launch gates include legal/privacy review before pilot launch can be considered unblocked, Phase 33 records the required approval artifact in the external intake packet, and Phase 34 lists the classification memo as a missing counsel decision. | open |
| R-003 | Tailored medical/nutrition advice is generated without appropriate licensed-professional involvement. | critical | Copilot default, red/yellow handoff, professional involvement policy, audit trail. | open |
| R-004 | Client-facing legal/permission documentation is incomplete. | high | Documentation prepared separately; app must enforce permission state. Phase 10 launch gates keep legal/privacy review externally approved only; Phase 33 external approval intake tracks the missing privacy notice and client permission artifacts; Phase 34 prepares the legal/privacy packet but does not provide final client-facing legal copy. | open |
| R-005 | Workspace has no Git repository or explicit checkpoint strategy. | high | Local Git repository, root ignore rules, and a verified baseline checkpoint commit were added in Phase 9. | mitigated in local prototype |
| R-006 | Live hosted AIya surfaces drift from the verified local release, causing stale branding, runtime route failures, repeatability gaps, stale launch tests, vulnerable development tooling, unproven external sender identity, or missing remote traceability to be mistaken for production readiness. | high | 2026-09-02 Phase 4 deployed HEAD `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9` to the VPS through the official `apply-hosted-release.mjs` wrapper without manual fallback. Live smoke passed for release identity, active AIya brand surfaces, PWA manifest, `/app-install` controlled redirect/non-500 behavior, controlled unauthenticated `/api/app-state` and `/api/clients` `401`, admin `/admin`, old-domain `410`, single PM2 `manu-ai` process, and Linux `sharp` runtime presence. 2026-09-02 Phase 5 updated stale visual brand assertions to `AIya`, repaired current shell-nav test assumptions, passed targeted desktop visual coverage 9/9, and reduced production plus full dependency audits to zero vulnerabilities through a non-force lockfile-only audit fix. Follow-up publication pushed `origin/codex/production-readiness-stage-1` to `a35c3e167b22d42a57d51d4614567906293b7b03`, containing the live VPS commit. Supabase Auth sender was corrected and Management-API-proven as `AIya <no-reply@auth.aiyaworkspace.com>`. | mitigated for hosted AIya launch evidence; production gates remain open |

## Privacy and Data Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-101 | Health data is processed without valid legal basis. | critical | Data inventory, legal basis matrix, privacy review before real data. | open |
| R-102 | Cross-client context leakage. | critical | Tenant/client capsule checks, service-layer RBAC, prompt allowlist, tests, and Phase 28 RLS helpers/policies for owner/admin, dietitian owned/care-team, viewer, assistant, auditor, and internal copilot scope. Tenant-aware channel/idempotency uniqueness is now covered. | mitigated in local prototype |
| R-103 | External AI provider retains health data unexpectedly. | critical | Phase 8 uses only a local mock provider and documents no-storage/no-retention requirements; Phase 28 restricts provider input to allowlisted PromptContext segments, records `providerAttempted`, and fail-closes red/unknown/overlong/raw payloads; Phase 36 prepares the provider/vendor review packet for vendor, retention, training-use, logging, region, access-control, and incident-obligation review. Real provider use remains blocked until external vendor/legal/security approval. | partially mitigated in local prototype |
| R-104 | Logs contain raw messages, prompts, or health fields. | high | Provider/channel metadata helpers redact raw message, prompt, health profile, diet plan, allergy, memory, and clinical-note fields; Phase 15 adds a safe aggregate operational health snapshot and monitoring payload policy; Phase 17 rejects prompt/capsule/profile leakage at the mock-provider boundary; Phase 36 lists prompt/completion logging as an explicit vendor/legal/security decision. Production monitoring and provider logging vendor review remain pending. | partially mitigated in local prototype |
| R-105 | Deletion request leaves stale client memory. | high | Phase 5 local/Supabase anonymization skeleton clears promptable client context and rolling memory; Phase 14 records anonymization requests in the legal ops ledger; Phase 45 adds a soft-delete/anonymization lifecycle that hides removed clients and redacts promptable profile, channel, memory, messages, form responses, context updates, handoffs, notifications, and AI/risk details. Phase 77AA-77AI remediation deletes Supabase `channel_deliveries` for the client during anonymization/removal, matching the Phase 74 in-memory channel delivery invariant. Phase 79E adds a unified lifecycle redaction evidence contract over client profile identity, channel identities, conversation memories, messages/drafts, forms, context updates, proposals, food-rule profiles, menu plans, AI decisions, handoffs/notifications, channel deliveries, and audit minimization; Phase 79G includes lifecycle removed-client evidence in hard-zero production-scale rehearsal metrics. Phase 38 prepares the incident/DSAR review packet for approved deletion/anonymization owner, SLA, legal hold, hard-delete timing, and verification decisions. Production hard-delete jobs and legal approval remain pending. | partially mitigated in local prototype |
| R-106 | Data export or deletion scope crosses tenant/client boundaries. | critical | Phase 5 tenant/client-scoped export and anonymization helpers are covered by tests; Phase 12 adds fail-closed role checks before export/anonymization; Phase 13 scopes Supabase-loaded app state by role and assignment; Phase 14 records export/anonymization requests in tenant/client-scoped `data_requests`; Phase 45 records client removal as a tenant/client-scoped `deletion` data request while preserving only minimized export/audit evidence; Phase 79E verifies aggregate-only lifecycle evidence and removed-client operational blocking without raw health data in health payloads; Phase 79F maps client removal/anonymization rows into the current RLS evidence manifest. Phase 38 lists DSAR/export/anonymization/deletion owner, SLA, approval chain, and verification method as external approval items. Production DSAR workflow and legal approval remain pending. | partially mitigated in local prototype |
| R-107 | AI fabricates continuity when the client references conversation history outside the available prompt context. | high | Phase 23 adds a missing historical context invariant, bounded last-8-message PromptContext, raw-text-free ContextManifest, provider output guard for `[ERROR: missing_historical_context]`, `send_status="send_blocked"`, draft invalidation, and human takeover routing. Phase 28 adds send-time draft revalidation for context revision, latest promptable message, memory revision/staleness, channel permission, takeover lock, and AI mode/status. Phase 55 renders client-authored PromptContext segments as explicit data boundaries and adds a system instruction that client content cannot override system, policy, persona, clinical safety, or tool behavior. Real provider behavior still needs vendor/prompt validation before production. | partially mitigated in local prototype |
| R-108 | Dietitian voice samples include client-identifying or unauthorized text. | high | Phase 24 stores samples tenant/dietitian scoped, requires explicit sample submission/approval, and uses samples only for style profile generation. Production onboarding must still include legal/privacy instructions for sample preparation. | partially mitigated in local prototype |
| R-109 | Dynamic form changes corrupt old client responses or leak private form fields into prompts. | high | Phase 25 stores responses with schema snapshots and sends only `prompt_allowed` fields into `client_form_summary`; form response changes increment context revision and invalidate pending drafts. Phase 76A adds chat-to-form proposal records that apply only deterministic allowlisted additive patches to active form responses after explicit dietitian approval, with stale context revision rejection and audit evidence. Phase 76I adds bounded typed food-rule PromptContext segments (`food_rule_decision`, allowed/forbidden/exchange/diet-type summaries, ingredient verification metadata) capped at 480 characters per segment with no raw product label text in prompt segments. Phase 76D adds registry-backed structured food-rule fields with prompt visibility metadata; Phase 76J saves food rules through the existing form path with context revision increment and draft invalidation; Phase 76K applies deterministic food-rule proposal patches with stale-revision fail-closed; Phase 76N extends export/redaction to structured food rules and client update proposals. Phase 77A rebaselines the next track so chat-based form/food-rule/menu mutation will be removed in Phase 77B and future personal form v2 changes must remain manual, snapshot-backed, prompt-classified, draft-invalidating, and lifecycle-covered. Phase 77C loads the first client personal form v2 through the registry with explicit prompt visibility, keeps phone/WhatsApp and consent fields `sensitive_never_prompt`, and leaves food-group/meal flexibility for later dedicated forms. Phase 77D keeps the master food catalog as repo-versioned global reference data and stores only selected catalog ids/expanded food-rule answers on the client form path. | partially mitigated in local prototype |
| R-110 | Internal copilot leaks hidden client data or misuses database tools. | critical | Phase 26 uses only curated read-only tools over already-scoped `ManuAppState`, blocks assistant/auditor chat access, avoids raw SQL and mutation tools, treats messages/forms as untrusted data, persists source refs/tool calls, and adds tests for ambiguous/hidden clients plus scoped state behavior. Phase 36 records internal copilot provider egress as a separate provider/vendor/legal/security decision. Phase 75 adds draft Gemini provider gate artifacts, forbidden unpaid/consumer surfaces, PromptContext allowlist enforcement, and `isPhase75RealGeminiEgressAllowed` behind `MANU_ALLOW_REAL_GEMINI` plus approved legal/privacy and provider/vendor gates. Real provider use remains blocked until external review closes those gates. | partially mitigated in local prototype |
| R-111 | AI relies on stale WhatsApp-only context after an off-channel dietitian/client conversation. | high | Phase 27 adds dietitian-entered context updates from phone, Zoom, in-person, or other sources. Phase 28 adds source metadata and marks the newest dietitian-authored source across manual messages and Critical Context updates as authoritative. Active updates increment client context revision, invalidate pending drafts, enter bounded PromptContext, and are redacted on anonymization. Phase 76A lets dietitians convert selected chat notes into reviewed form/context updates; apply creates a Critical Context record and invalidates drafts. Phase 36 records dietitian context update provider egress as a separate provider/vendor/legal/clinical/data-minimization decision. Real provider use still requires external review. | partially mitigated in local prototype |
| R-112 | Client receives AI communication in the wrong language due to ambiguous or stale identity/language mapping. | high | Phase 43 stores canonical non-null client phone identity where available, enforces tenant-scoped phone uniqueness, stores client communication language, records form schema/response language, validates submitted form phone against the selected client, and updates client conversation language from saved form responses. Phase 77C makes phone and WhatsApp phone required identity fields in the active client personal form v2 while keeping both out of PromptContext. PromptContext carries only a bounded `conversation_language` segment. Real channel identity reconciliation, duplicate phone governance, and client-facing language consent remain pending external channel/legal review. | partially mitigated in local prototype |
| R-113 | Red-risk handoff is treated as resolved too early and AI re-enters an unresolved clinical/risk conversation. | critical | Phase 44 adds a client-level red-risk lock. Red handoffs force AI passive/manual plus human takeover lock; manual replies and notification acknowledgement do not reactivate AI; normal handoff resolution, direct AI-control edits, takeover release, and red-locked dismissal are rejected while locked. Only explicit dietitian resolve-and-reactivate with a reason can unlock AI, and autopilot reactivation requires completed mandatory safety. | mitigated in local prototype |
| R-114 | Concurrent Supabase-backed writes can overwrite or hide each other's state changes because broad state is loaded, mutated in memory, and persisted without a general expected-revision write guard. | high | Phase 49 adds optimistic concurrency checks to Supabase client-row mutations by requiring the loaded `context_revision` to match before update and returning controlled `409 concurrent_state_update` failures on stale state. Phase 50 adds a migration/RPC foundation for transactional commit wrappers, Phase 51 covers draft review, form response save, client context update, handoff status update, and red-risk reactivation through transactional RPC payloads, and Phase 52 adds local Supabase integration tests for stale revision rejection plus manual/inbound RPC atomicity. Phase 74 adds a local transactional redaction contract with invariant evaluation and `REDACTED_BY_PHASE74_POLICY` marker integration. P85-IF-R3 moves AI activation to a service-role-only atomic RPC with conversation/client-context expected revisions, and P85-IF-R4 moves context-intake confirm/recheck/apply/reject to service-role-only atomic RPCs with stale proposal `409` and wrong-client `404`. The 2026-07-11 post-closure audit aligns expected conversation revision checks to deterministic client-before-conversation locking and verifies activation versus inbound, red-risk, and verified human-echo races; local RLS passed 30/30. Stage 6 R1 adds durable tenant/request-scoped idempotency reservation and bounded response replay for Supabase-backed dashboard mutations, preventing server-restart replay duplication and blocking concurrent duplicate requests after reservation. Production Supabase transactional RPC migration for bulk redaction and broader production write contracts still need dedicated coverage. | partially mitigated in local prototype |
| R-115 | Broad state loading and O(n) in-memory scans can become a scale bottleneck as tenants, clients, and message histories grow. | high | Phase 49 starts maintainability cleanup by extracting simulator risk/model routing into a dedicated module and removing the unused legacy `buildReplyPrompt` export. Phase 50 narrows pre-mutation Supabase reads for manual reply, client-scoped inbound simulation, draft approval/dismissal, human takeover release, handoff status update, red-risk reactivation, form response save, and client context update while preserving required target messages, decisions, handoffs, form schemas, draft messages, and draft decision rows. Phase 53 adds a test-covered Supabase read contract catalog that separates intentional broad legal/admin reads, future paginated dashboard/internal-copilot/client create/patch reads, and already scoped mutation reads. Phase 63 raises the production-pilot planning target to up to 100 dietitians with 50+ clients each. Phase 79B-79D add production-scale runtime hardening: windowed dashboard read helpers, scoped client create/patch validation and merge helpers, and bounded internal copilot tool loaders with source-ref minimization. Phase 79I closes post-review scale gaps by adding real `/api/app-state?view=windowed` runtime evidence, fail-closed notification windows, and scoped client create/patch responses without post-mutation `loadSupabaseState` reloads. Phase 79G includes these runtime contracts in unified production-scale acceptance. Legal/admin lifecycle reads remain intentional broad until external legal/RPC approval defines final DSAR scope. | partially mitigated in local prototype |
| R-116 | Client-authored prompt injection attempts are treated as ordinary green messages. | high | Phase 55 adds `prompt_injection_attempt` yellow routing, wraps client-authored current/recent PromptContext text as data, and covers app simulator behavior so injection attempts create approval drafts instead of green autopilot sends. Real provider behavior still needs provider/vendor prompt validation before production. | mitigated in local prototype |
| R-117 | Dietitian natural-language chat updates mutate the wrong client/form field or silently change promptable nutrition context. | high | Phase 76A-76K built the reviewed proposal path. Phase 77B blocks chat proposal create/apply with `chat_source_mutation_disabled`, removes dashboard propose/apply controls, keeps historical proposals read-only for audit/export/redaction, preserves read-only internal copilot, and keeps Critical Context panel-only. Phase 77E makes Client Food Rule Profile V2 the manual food-rule source authority with dashboard/API save paths only and legacy form-answer bridge for runtime compatibility. Production approval still requires external clinical/process review. | mitigated in local prototype |
| R-118 | Complete database transcript is mistaken for complete AI memory, allowing older dietitian instructions to fall outside the bounded prompt or unrelated manual messages to satisfy answerability. | critical | P85-IF-E implements tenant/client-scoped full-history retrieval, source relevance evidence, temporal precedence, and fail-closed answerability with structured-record update notifications. The 2026-07-11 post-closure audit connects structured baselines to real app state and resolves structured-update notifications only after the target panel revision advances. P85-IF-I adds export/redaction/RLS closure for retrieval source references and context manifests. Real-provider certification and production evidence remain pending. | partially mitigated in local prototype |
| R-119 | Operational trust-root, payload-digest, or quarantine details leak to ordinary dashboard state or dietitian roles instead of remaining owner/admin diagnostics. | high | P85-IF-R5 removes inbound quarantine rows, channel account bindings, actor bindings, channel events, and event-only message revisions from common app-state. Owner/admin inspection uses `GET /api/operational-foundation` behind `read_operational_foundation`; unauthorized direct calls return 403. Migration `20260710220000_phase_85_if_remediation_operational_access_boundaries.sql` restricts select RLS for operational trust/quarantine tables to owner/admin while preserving dietitian clinical workflow visibility. Local Supabase RLS passed 26/26 on 2026-07-10. | mitigated in local prototype |
| R-120 | P85-IF lifecycle closure is declared complete without persisted Supabase redaction, tenant binding revoke, export leak detection, or full verification evidence. | high | P85-IF-R6 adds append-only Supabase lifecycle re-closure migration, owner/admin tenant channel-binding revoke API/RPC with tenant automation rollback disabled, client export leak detection, and program closure evidence that fails on missing, skipped, failed, or timed-out full-suite/RLS/replay/scale/build/lifecycle inputs. The 2026-07-11 post-closure audit also wires export leak detection into the actual `buildClientScopedExport` path. Verification passed with targeted app/core tests, local Supabase reset, local RLS 30/30, lint, production build, full app 828 passed / 4 skipped, core 234/234, channel replay, production-scale rehearsal, `git diff --check`, secret scan, and forbidden future-phase naming scan. | mitigated in local prototype |

## Messaging Platform Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-201 | WhatsApp healthcare messaging violates platform policy. | critical | WhatsApp healthcare-use feasibility memo before pilot. Phase 37 prepares the channel policy review packet for WhatsApp healthcare, regulated vertical, template, service-window, age, geography, and account-quality review, but approval remains pending. | open |
| R-202 | Missing WhatsApp opt-in or opt-out handling. | high | Channel permission state, opt-out state, audit trail, and mock channel opt-out tests exist; Phase 16 handles exact local opt-out commands before AI processing; Phase 37 lists opt-in, opt-out, reconsent, and withdrawal procedure as external approval items. Real STOP webhook handling remains pending. | partially mitigated in local prototype |
| R-203 | Duplicate webhook causes duplicate AI reply. | high | Idempotency table and outbound state machine. Local simulator and mock channel idempotency are covered, including duplicate provider events and duplicate policy-blocked events. Phase 37 lists webhook retry, duplicate suppression, delivery status, and dead-letter expectations as external channel policy review items. | partially mitigated in local prototype |
| R-204 | Phone number reuse maps message to wrong client. | high | Phase 7 mock adapter tests quarantine ambiguous channel identities before orchestrator execution; Phase 13 limits production app-state visibility by owner/dietitian/assistant assignment; Phase 37 requires identity mapping and phone-number/user-id reconfirmation procedure approval. Real reconfirmation UX remains pending. | partially mitigated in local prototype |
| R-205 | Human takeover races with queued AI job. | high | Handoff/takeover lock and stale-context check before send. Local simulator blocks takeover-locked clients and audits release; Phase 12 limits takeover release to owner/admin/dietitian roles in Supabase-backed routes. P85-IF-D/F add human-control sessions, draft invalidation, conversation revision checks, and controlled reactivation. Stage 4A post-P85-IF remediation aligns the dashboard AI control panel so takeover release uses `/api/clients/[id]/release-takeover` instead of direct boolean patch and surfaces active human-control session evidence. | partially mitigated in local prototype |
| R-206 | WhatsApp group messages are incorrectly mapped to a single client or enter AI processing. | critical | Phase 46 adds unsupported inbound context quarantine for requests marked `sourceConversationType=group`. Group messages are blocked before client lookup, classifier, context assembly, provider calls, message storage, AI decisions, risk assessments, or handoffs; only minimized quarantine metadata and audit events are recorded, and duplicate group events remain idempotent. Real WhatsApp group webhook behavior still requires channel policy review before any production channel launch. | partially mitigated in local prototype |
| R-207 | A future channel adapter or consumer could bypass app-level preflight checks by calling the core orchestrator directly. | high | Phase 49 moves the common inbound preflight evaluator into the core package and reuses it from simulator/channel paths. Permission, red-risk lock, adult-status, takeover, identity, and autopilot safety gates are now covered by a reusable core boundary and tested for direct orchestrator calls. | mitigated in local prototype |
| R-208 | Missing tenant/client scoped rate limiting allows accidental or malicious request bursts against simulator, channel inbound, manual reply, draft review, or internal copilot paths. | high | Phase 49 adds app-instance scoped rate limiting for simulator, mock channel inbound, manual reply, draft review, and internal copilot paths. Phase 50 wires an async Supabase-backed limiter path using hashed keys and a `consume_rate_limit` RPC in the new migration, with local fallback preserved for dev. Phase 52 adds local Supabase integration coverage for `consume_rate_limit` tenant/scope/key isolation and controlled `429 rate_limit_exceeded` denial mapping. Production deployment, monitoring, and abuse tuning remain future work. | partially mitigated in local prototype |
| R-209 | A WhatsApp Business App or linked-device human message is misclassified as client inbound, attributed to the wrong individual, or routed to the wrong tenant/client conversation. | critical | P85-IF-B/C/D implement and test-lock the provider/actor trust contract, secure ingress routing, business-human transcript persistence, and provenance labels. P85-IF-I adds export/redaction/RLS closure and tenant binding lifecycle controls. The engine remains disconnected from the live webhook; real-provider certification remains pending. | partially mitigated in local prototype |
| R-210 | A dietitian writes externally while AI is active, allowing stale queued AI output and human output to race in the same conversation. | critical | P85-IF-D/F implement auto-pause on verified external human messages, human-control sessions, conversation revision CAS, draft invalidation, and controlled AI reactivation. P85-IF-I closes lifecycle/export evidence for human-control and risk-activity records. Real-channel concurrency certification remains pending. | partially mitigated in local prototype |
| R-426 | Actor identity is treated as proven from chat membership alone without account/actor binding evidence. | critical | P85-IF-B/C persist account/actor bindings, provenance fields, and fail-closed routing; P85-IF-H exposes provenance labels; P85-IF-I closes export/redaction/RLS coverage. Live webhook wiring remains disabled. | partially mitigated in local prototype |
| R-427 | Silent webhook loss leaves inbound events unrecoverable without quarantine/replay evidence. | high | P85-IF-C ledger/quarantine/replay engine with account-scoped quarantine and authorized replay; P85-IF-I adds lifecycle/RLS closure and operational inspection counters via P85-IF-H. Live webhook wiring remains disabled. | partially mitigated in local prototype |
| R-428 | Structured records become stale relative to newer channel instructions, causing unsafe AI answerability. | critical | P85-IF-E structured-record update notifications and fail-closed answerability; P85-IF-G blocks structured apply until dashboard revision evidence; P85-IF-I exports/redacts retrieval and intake evidence. Stage 4A post-P85-IF remediation adds readable structured-intake panel navigation and a minimal structured-update notification bridge that resolves only through the target-revision endpoint after panel evidence advances. Production certification remains pending. | partially mitigated in local prototype |
| R-429 | Retrieval false positives/negatives let unrelated or revoked messages satisfy answerability. | critical | P85-IF-B retrieval eligibility exclusions; P85-IF-E relevance/temporal precedence; P85-IF-I export/redaction of retrieval source references. Production certification remains pending. | partially mitigated in local prototype |
| R-430 | Quarantine records retain identifying payloads longer than required or escape lifecycle controls. | high | P85-IF-C account-scoped quarantine; P85-IF-H aggregate inspection; P85-IF-I redaction domains and RLS policies on interstage tables. Production retention jobs remain pending. | partially mitigated in local prototype |
| R-431 | Shared-device WhatsApp business attribution fabricates an individual dietitian author. | critical | P85-IF-B shared_authorized_team vs exact_dietitian distinction; P85-IF-D verified business-human handling; P85-IF-H provenance labels. Real shared-device certification remains pending. | partially mitigated in local prototype |
| R-432 | Concurrent human and AI sends race after stale reactivation or outdated conversation revision. | critical | P85-IF-F controlled AI activation with conversation revision CAS and human-control closure; P85-IF-I lifecycle evidence closure. Stage 4A post-P85-IF remediation removes direct active-state UI patching from the AI control panel and routes activation through atomic expected-revision activation. Real-channel send-time certification remains pending. | partially mitigated in local prototype |

## Clinical Safety Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-301 | AI answers emergency or severe symptom message. | critical | Red classifier, no generation for red, handoff notification. Phase 44 extends this local-app control by locking AI passive/manual after a red handoff until explicit dietitian resolve-and-reactivate. | mitigated in local prototype |
| R-302 | AI changes diet plan independently. | critical | Quality guard, plan-change escalation, prompt constraints. | mitigated in core prototype |
| R-303 | AI mishandles eating disorder or self-harm language. | critical | Phase 28 expands JSONL golden cases and classifier coverage for eating-disorder euphemisms plus self-harm red routing; Phase 35 prepares the qualified dietitian review packet, but approval remains pending. | partially mitigated in core prototype |
| R-304 | AI promotes unhealthy dieting/body shaming for minors. | critical | Phase 28 expands minor/body-image rapid weight-loss coverage including typo/body-check language as review-required; Phase 35 prepares the qualified dietitian review packet, while guardian/legal policy and qualified dietitian approval remain pending. | partially mitigated in core prototype |
| R-305 | Persona weakens clinical boundaries. | high | Persona affects style only; safety rules are invariant. | mitigated in core prototype |
| R-306 | Clinical risk can be underestimated when concerning patterns only emerge across multiple individually green messages. | critical | Phase 49 adds a cumulative risk layer over recent promptable messages plus the current inbound message. Meal restriction, body-image/rapid-weight-loss, and repeated symptom patterns escalate to yellow for dietitian review; red routing is not broadened without qualified clinical taxonomy approval. Phase 55 hardens real Turkish Unicode normalization and expands multilingual pregnancy/lactation yellow routing while preserving qualified-review boundaries. Core and app simulator tests cover cumulative meal restriction, real Turkish Unicode, and multilingual pregnancy/lactation cases. | mitigated in local prototype |
| R-307 | Quality guard unsafe-output checks are narrower than the supported multilingual response surface. | critical | Phase 49 expands output guard coverage across `tr`, `en`, `de`, `fr`, `es`, `pt`, and `cs` for diagnosis language, medication/dosing, emergency minimization, unsupported plan changes, and AI identity phrasing. Core tests cover multilingual unsafe-output blocking. Real provider behavior still needs vendor/prompt validation before production. | mitigated in local prototype |
| R-308 | Health-profile flags do not currently lower classifier thresholds for context-sensitive messages. | high | Phase 49 connects `diagnosedConditionFlag`, `medicationOrSupplementFlag`, `pregnancyOrBreastfeedingFlag`, and `eatingDisorderRiskFlag` to classifier profile input. Context-sensitive messages now escalate to yellow with explicit profile reasons, and both core/app simulator tests cover the behavior. | mitigated in local prototype |
| R-309 | Persona behavior is prompt-only and generated output is not checked against persona-specific constraints. | medium | Phase 49 adds output checks for persona `emojiPolicy` and very-short response constraints while preserving the invariant that persona never weakens clinical safety routing. Core tests cover emoji-policy and length-policy violations. | mitigated in local prototype |
| R-310 | Production clinical safety relies on deterministic/regex matching as the sole safety layer. | critical | The deterministic classifier remains valuable as a local first barrier, but production pilot must not rely on it alone. Phase 56-61 add deterministic second-layer and mock-first scope-guard evidence. Phase 62 documents accepted constraints: real LLM/embedding modal diversity (Bulgu 3) remains gated; scope guard independence from AI activation (Bulgu 9) remains tied to the accepted passive/manual product decision (Bulgu 1); active scope guard requires approved regulation corpus (Bulgu 10). Phase 62 also adds shared `normalizeSafetyText`, overlap-based scope retrieval, glucose cost-unit filtering, and provider-failure handoff to the dietitian without client-facing send. Phase 63 locks the requirement that the user-supplied official health-regulation PDF must become a traceable, reviewed, versioned corpus with page/section references and corpus golden tests before active production routing. Phase 65 adds the local official PDF corpus QA foundation. Phase 76G adds local source-backed food-rule carve-outs in `clinical-safety-second-layer-v0.2.0` for prospective permission/substitution/skip questions while preserving ingestion reactions, acute clinical markers, and severe allergy profile review. Phase 76E-76F add deterministic food-rule engine and intent-specific answerability; Phase 76M records green-capacity calibration metrics with `unsafe_green_rate = 0` on the bundled suite; Phase 76O adds 100x50 food-mix rehearsal with `unsafe_green_count = 0` on bundled rehearsal. Production activation still requires qualified dietitian taxonomy approval, legal/privacy handling, official PDF corpus approval, and approved production safety evaluation. Phase 76P consolidates this evidence in pilot/gate docs without closing the clinical taxonomy gate. | partially mitigated in local prototype |

## Operational Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-401 | Urgent handoff notification is missed. | critical | SLA, fallback notification, persistent open urgent case. Local handoffs now queue safe-text in-app notifications, Phase 9 added Supabase notification persistence plus tenant-scoped read/acknowledge behavior, Phase 18 adds aggregate SLA breach/internal escalation signals, and Phase 38 lists incident escalation owners and communication procedures as required external decisions. Push/email adapters are still pending. | partially mitigated in local prototype |
| R-402 | Provider outage blocks messaging. | high | Visible provider failure state, retry, manual fallback. Phase 62 routes active-client provider failures to dietitian handoff + in-app notification without sending a client-facing AI reply or provider error text to the client. Phase 10 launch gates require incident response evidence before production pilot approval; Phase 11 added a draft incident response runbook; Phase 15 counts failed provider decisions in a safe health snapshot; Phase 38 prepares the incident/DSAR review packet for owner, escalation, notification, and re-enable decisions. Distributed retry and external notification channels remain pending. | partially mitigated in local prototype |
| R-403 | Prompt/classifier change regresses safety. | high | JSONL golden tests assert risk/action/model/provider-call/providerAttempted behavior, persona invariants, PromptContext source metadata, provider-boundary fail-closed behavior, and expanded clinical cases. Phase 55 adds regression tests for real Turkish Unicode classifier inputs, prompt-injection yellow routing, PromptContext data boundaries, safety-critical pinned-note no-truncation, and red-risk lock preflight ordering. Phase 76E-76I add food-rule engine, answerability, second-layer carve-out, ingredient verification, and output-guard regression coverage; Phase 76M adds food-rule calibration golden JSONL orchestrator tests; Phase 76O adds 100x50 food-mix rehearsal and integration checks for duplicate inbound, provider failure, stale draft, and proposal apply. Phase 19 repeatable release verification remains the local gate. Phase 76P records consolidated regression evidence in pilot/gate docs. Production release rollback procedure remains pending. | partially mitigated in core prototype |
| R-404 | One tenant exhausts shared AI budget. | medium | Tenant spend caps and quotas. | open |
| R-405 | Dependency audit reports vulnerabilities in Next.js transitive PostCSS/Sharp. | medium | Do not run breaking `npm audit fix --force`. Phase 85 Stage 5 dependency remediation applies the safe stable patch path required by Phase 22/80G: `next` and `eslint-config-next` are pinned to `16.3.0`; Next now installs nested `postcss@8.5.23` and `sharp@0.35.3`; direct `sharp` remains `0.35.3`; `npm audit --omit=dev --json` reports zero production vulnerabilities. Stage 5 dependency closure must be proven by `docs/PHASE_85_STAGE_5_DEPENDENCY_SECURITY_REPORT.json`; no formal risk acceptance flag or env override can close this risk. Production remains `NO-GO` until the independent production launch gates close. | mitigated |
| R-406 | Expanded RLS suite is not counted as latest local execution evidence when local Supabase is unavailable. | medium | Phase 28 added expanded RLS coverage for scoped assistant/viewer/care-team/auditor access, internal copilot scope, and tenant-aware uniqueness. Phase 47 added explicit `inbound_quarantines` RLS coverage and a Supabase-backed group quarantine persistence check. On 2026-06-02, Docker Desktop/local Supabase was started, `npx supabase db reset --local` applied all migrations through Phase 50, and `npm run test:rls` passed against local Supabase after Phase 52 integration coverage with 1 file and 19/19 tests. Later Phase 80/83 runs were skipped when local Supabase was unavailable. On 2026-07-11, the P85-IF post-closure audit re-ran local Supabase reset and `npm run test:rls`; that historical local suite passed 30/30. On 2026-07-13, local Supabase reset passed and the current Stage 4B/Stage 4B-2 RLS suite passed 35/35 with 0 skipped after append-only RLS re-closure migration `20260713024000_phase_85_stage_4b2_rls_local_reclosure.sql`. This is local evidence only and does not close external launch gates or authorize production pilot traffic. | mitigated locally; external launch gates still open |
| R-407 | Expired AI activation windows remain active in stored client state and repeatedly return `expired` without cleanup or dietitian-facing operational signal. | medium | Phase 49 adds lazy expired-activation cleanup in the app simulator path. The first expired-window hit passivates the client, clears `aiActiveUntil`, increments context revision, records `client_ai_window_expired`, and creates a safe system notification; later messages see the passive state rather than repeating the expired transition. | mitigated in local prototype |
| R-408 | A launch gate is treated as closed from a bare id, incomplete artifact, stale approval, or unsanitized evidence reference. | high | Phase 64 adds typed structured launch-gate evidence records and evaluator. Gate closure now requires sanitized artifact reference, owner, explicit `approved` status, approval date, review due date, non-expired timing, and full required-evidence coverage. Unknown gate ids, partial coverage, conditional/rejected/draft/stale/malformed evidence, and unsanitized references keep gates open. Real scope-guard egress also requires structured clinical taxonomy and provider/vendor evidence plus explicit environment gating. | mitigated in local prototype |
| R-409 | Official regulation PDF-derived routing rules lack source traceability or QA before influencing clinical decisions. | critical | Phase 65 adds a fail-closed official regulation PDF corpus QA foundation. PDF-derived rules require sanitized source metadata, SHA-256 checksum, page-level extraction evidence, page/section mapping, derived rule drafts, corpus version, and synthetic corpus golden cases. QA failure blocks draft rule construction and keeps launch-gate evidence draft. Phase 71 adds the user-supplied 14-source Turkiye official source manifest and artifact intake, but metadata-only sources still fail QA, unknown artifacts fail, and QA success creates draft rules only. Phase 72 adds draft permission graph artifacts and fail-closed routing evaluation; Phase 73 adds draft health regulation calibration matrix and golden-case acceptance metrics. Phase 76L adds audit-first permission graph food-rule routing on the simulator path with gated enforcement behind `MANU_ALLOW_PHASE_72_ACTIVE_ROUTING` plus launch-gate evidence; Phase 76M extends calibration to food-rule decision areas and green-capacity metrics. External legal/privacy and qualified clinical approval remain required before active production routing or calibration activation. Phase 76P consolidates draft-only routing/calibration evidence in pilot/gate docs. | mitigated in local prototype |
| R-424 | Commercial admin invite operations fail silently or appear broken when Supabase URL, service-role key, DNS/project status, or migrations are not ready. | medium | Phase 83F hosted Supabase recovery diagnostics add protected `/api/commercial/admin/health`, sanitized store-env/probe classification, and `/commercial-admin` UI guidance for unreachable Supabase project hosts, missing migrations, invalid service-role keys, incomplete admin env, and dev fallback mismatch. This improves operator diagnosis but does not remove the dependency: invite operations still require reachable hosted/local Supabase plus commercial migrations. | partially mitigated in local prototype |
| R-425 | Paid commercial customers cannot reach the real dashboard after a successful checkout because post-payment account onboarding is incomplete. | high | Phase 84D-84E (2026-07-02) implemented magic-link login, onboarding status/claim APIs, idempotent `tenant_memberships` + `dietitians` profile creation, and purchase-success guidance. Phase 84I (2026-07-03) remediates auth callback cookie preservation, token-hash OTP callback support, admin callback URL separation, admin-host routing coverage, and same-tenant duplicate onboarding claim recovery. VPS sandbox generated token-hash fallback verified authenticated claimable status, owner membership/profile creation, dashboard 200, and idempotent repeat claim. Phase 84J (2026-07-03) enabled Resend custom SMTP after Porkbun DNS verification, added fragment-token session bridging for real email links, and verified a real inbox magic-link click reaching `https://siriusai.store/dashboard`. Verification passed with targeted auth/session tests 7/7 and production build locally and on VPS. This closes the hosted commercial onboarding/email-delivery gap for the sandbox path without changing production pilot `NO-GO`. | mitigated in hosted sandbox |
| R-482 | Admin re-invites an existing customer or reactivates revoked access without revision protection, creating a duplicate tenant or silently restoring dashboard access. | high | Public-surface Phase 4 adds email duplicate blocking, expected-revision revoke, and append-only `reactivate` through `apply_manual_entitlement_operation`. Evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_4_ADMIN_CUSTOMER_LIFECYCLE_EVIDENCE.md`. The local SQL file is not a remote/production apply; RLS re-run was environment-blocked. | mitigated_locally — remote migration and RLS re-run remain open |
| R-442 | Image file admission accepts spoofed MIME, decompression bombs, hidden EXIF/location data, unsupported animation, or unsafe dimensions. | critical | Stage 4B-3 R0-R9 closes this locally through durable admission/storage paths, sanitized JPEG output, EXIF stripping, R8 deletion lifecycle, `file-type@21.3.4`, full-scale 200 admission round-trips, and R9 release/audit verification. Evidence: `docs/PHASE_85_STAGE_4B_3_POST_CLOSURE_REMEDIATION_R9_EVIDENCE.md`. | mitigated locally (Stage 4B-3 R9) |
| R-443 | Meal-photo recognition misidentifies foods, hidden ingredients, mixed dishes, or portions and causes an unsafe green response. | critical | Stage 4B-3 R5-R9 closes this locally with visual candidate/caption/active-menu agreement, contradiction and mixed-dish fail-closed routing, output guard coverage, golden red-team cases, and 5,000 cached visual decision rehearsal. | mitigated locally (Stage 4B-3 R9) |
| R-444 | OCR or screenshot content injects hostile instructions or misinformation into the clinical answer path. | critical | Stage 4B-3 R5-R9 closes this locally by using explicit `visual_label_ocr`, excluding raw OCR from generic provider context, requiring approved source ids for screenshot answerability, and verifying prompt-injection/OCR leak cases in core and app tests. | mitigated locally (Stage 4B-3 R9) |
| R-445 | Supplement, medication, body/symptom, lab-result, or medical-document images receive autonomous client-facing advice. | critical | Stage 4B-3 R5-R9 closes this locally with non-autopilot visual scene routing, atomic decision/review outcomes, hard-zero measured client-send counters, and golden red-team coverage for supplement/body/lab classes. | mitigated locally (Stage 4B-3 R9) |
| R-446 | Image/text correlation races cause premature replies, duplicate replies, stale decisions, or lost context around the 120-second bundle window. | high | Stage 4B-3 R1-R9 closes this locally through V2 bundle contracts, durable queue/lease semantics, canonical ingress, dietitian reset behavior, CAS/revision checks, worker outcome semantics, and full rehearsal evidence. | mitigated locally (Stage 4B-3 R9) |
| R-447 | Private media or derived visual data leaks across tenants, roles, direct object URLs, DTOs, exports, or logs. | critical | Stage 4B-3 R2-R9 closes this locally through service-mediated media tables/storage, bounded media RPCs/DTOs, no auth fallback owner context, assistant review redaction, local RLS 39/39 with zero skipped, and export leak checks. | mitigated locally (Stage 4B-3 R9) |
| R-448 | Media retention, DSAR, revoke, anonymization, or object deletion leaves stale images, OCR, analysis text, or orphaned storage objects. | high | Stage 4B-3 R8-R9 closes this locally with deletion sagas, pending object-key queue, retrieval ineligibility, legal-hold behavior, redaction workers, orphan scans, and R9 measured closure. | mitigated locally (Stage 4B-3 R9) |
| R-449 | Legacy webhook media rejection, P85-IF canonical ingress, simulator, and worker gates drift and create duplicate or ungated media paths. | high | Stage 4B-3 R3-R9 closes this locally by routing mock media through canonical ingress, using real durable media/lifecycle worker CLIs instead of test subprocess loops, and verifying channel replay plus production-scale rehearsal. | mitigated locally (Stage 4B-3 R9) |
| R-450 | Dietitian correction of a visual misread conflicts with pending drafts, already-sent messages, red locks, or client-facing correction behavior. | high | Stage 4B-3 R6-R9 closes this locally with atomic correction RPCs, idempotency replay, analysis supersession, draft invalidation, client pause/manual follow-up paths, notification dedupe, and R9 regression verification. | mitigated locally (Stage 4B-3 R9) |
| R-451 | Voice-note admission accepts spoofed audio MIME, malformed OGG/Opus, decompression pressure, duration spoofing, or unsafe codec metadata. | critical | Stage 4B-4 R1-R9 closes this locally with bounded source authority, durable admission, decode caps, canonical audio persistence, migration contracts, local RLS 41/41 zero-skip, and measured closure evidence. Evidence: `docs/PHASE_85_STAGE_4B_4_POST_CLOSURE_REMEDIATION_R9_EVIDENCE.md`. | mitigated locally (Stage 4B-4 R9) |
| R-452 | Inaccurate transcription changes clinical meaning and causes unsafe AI understanding or client-facing reply. | critical | Stage 4B-4 R4-R5 and R9 close this locally with mock-only transcription, strict quality acceptance, accepted-transcript-only bridge gating, typed-risk-chain fail-closed behavior, targeted regressions, and full-scale voice rehearsal. | mitigated locally (Stage 4B-4 R9) |
| R-453 | Spoken numbers, medicines, supplements, symptoms, units, or quantities are transcribed incorrectly and treated as reliable. | critical | Stage 4B-4 R4-R5 and R9 close this locally by routing uncertain, low-confidence, wrong-locale, empty, overlong, or clinically ambiguous transcripts to review before autonomous green handling. | mitigated locally (Stage 4B-4 R9) |
| R-454 | Wrong-language, noisy, empty, overlong, or ambiguous speech is accepted as client text. | high | Stage 4B-4 R4 and R9 close this locally with locale, confidence, uncertainty, speaker, duration, and transcript-length gates plus golden corpus and closure tests. | mitigated locally (Stage 4B-4 R9) |
| R-455 | Spoken prompt injection is treated as trusted system, dietitian, or provider instruction. | critical | Stage 4B-4 R5 and R9 close this locally by treating accepted transcripts only as client-authored untrusted text in the existing prompt-injection and product-covenant chain. | mitigated locally (Stage 4B-4 R9) |
| R-456 | Voice bundle timing, transcription delay, retries, or duplicate webhooks cause premature replies, duplicate sends, stale drafts, or lost context. | high | Stage 4B-4 R3-R5 and R9 close this locally through durable queue leases, idempotent admission/transcription, bundle deadlines, revision checks, atomic orchestration, and full 5,000 voice replay evidence. | mitigated locally (Stage 4B-4 R9) |
| R-457 | Audio playback, transcript DTOs, correction APIs, or stream routes leak tenant data, private storage keys, hashes, raw provider payloads, or confidence scores. | critical | Stage 4B-4 R7-R9 close this locally with bounded DTOs, authenticated server-mediated streaming, no fallback owner context, role-scoped UI/API behavior, visual acceptance, and local RLS 41/41 zero-skip. | mitigated locally (Stage 4B-4 R9) |
| R-458 | Audio retention, DSAR export, legal hold, deletion, redaction, or orphan cleanup fails and leaves stale audio/provider evidence. | high | Stage 4B-4 R8-R9 close this locally with lifecycle worker wiring, retention/legal-hold/DSAR/deletion behavior, orphan reconciliation, and mandatory measured closure evidence. | mitigated locally (Stage 4B-4 R9) |
| R-459 | Real speech-to-text provider egress is enabled before legal/vendor/security approval or logs health data externally. | critical | Stage 4B-4 R4-R9 close this locally by preserving mock-only transcription gates and proving external STT egress remains disabled in closure/release verification. Real STT remains blocked for production. | mitigated locally (Stage 4B-4 R9) |
| R-460 | Dietitian transcript correction conflicts with pending drafts, already-sent messages, red locks, or stale transcript revisions. | high | Stage 4B-4 R6-R9 close this locally with correction lineage, supersession, draft invalidation, manual follow-up, red-lock preservation, idempotent CAS behavior, and R9 regression verification. | mitigated locally (Stage 4B-4 R9) |
| R-461 | Audio decode/transcription workload causes memory pressure, slow queues, replay instability, or cost surprise at 100 dietitians x 50 clients. | high | Stage 4B-4 R3-R4 and R9 close this locally with bounded admission/transcription workload, worker-backed processing, 200 admission round-trips, 5,000 cached voice decisions, and 5,000 voice replay cases. | mitigated locally (Stage 4B-4 R9) |
| R-4B3-01 | Durable Supabase state delta omits media assets, visual analyses, bundles, bundle items, and corrections, so successful in-memory processing is not durable. | critical | R1-R3 and R6-R9 add V2 media/bundle/correction contracts, Supabase persistence, durable queue/claim/commit paths, migration coverage, and R9 local reset/RLS verification. | mitigated locally (Stage 4B-3 R9) |
| R-4B3-02 | Media and lifecycle worker scripts execute Vitest subprocess loops instead of real DB/storage worker services. | critical | R3 and R8 replace subprocess loops with durable media and lifecycle worker CLIs using queue/lease/finalize paths; R9 verifies the resulting rehearsal/release chain. | mitigated locally (Stage 4B-3 R9) |
| R-4B3-03 | OCR is stored as `user_label_text` and raw OCR enters generic provider context before source authorization. | critical | R5 introduces explicit visual source handling, `visual_label_ocr`, source-gated provider context, and raw OCR exclusion tests across core/app paths. | mitigated locally (Stage 4B-3 R9) |
| R-4B3-04 | Meal matching can trust a caption without proving visual candidate, caption, and active-menu agreement. | critical | R5 requires candidate-caption-menu agreement and fails closed on contradiction, mixed dish, hidden ingredient, or portion uncertainty; R9 red-team closure verifies it. | mitigated locally (Stage 4B-3 R9) |
| R-4B3-05 | Worker release can report success after understanding/orchestration failure, allowing a bundle without a decision to appear completed. | critical | R4-R6 make worker release success contingent on a persisted decision, explicit review, or failure state; stale/failed orchestration cannot become completed without a decision. | mitigated locally (Stage 4B-3 R9) |
| R-4B3-06 | The atomic decision RPC does not transactionally write the complete message, decision, risk, draft, handoff, notification, audit, and revision set. | critical | R6 adds the lock-ordered atomic bundle decision transaction and rollback/idempotency tests; R9 release verification passes after local migration reset. | mitigated locally (Stage 4B-3 R9) |
| R-4B3-07 | Correction persistence, analysis supersession, rerun, draft invalidation, and follow-up are not one atomic transaction. | high | R6 adds atomic visual correction RPCs with supersession, rerun/reopen, draft invalidation, manual follow-up, notification, audit, and idempotency replay. | mitigated locally (Stage 4B-3 R9) |
| R-4B3-08 | Authenticated direct reads and bounded responses expose sensitive media/analysis fields outside safe DTOs. | critical | R7 removes direct sensitive response fields, uses bounded media RPC/DTO projections, strips object keys/OCR/provider observations from browser responses, and verifies role boundaries. | mitigated locally (Stage 4B-3 R9) |
| R-4B3-09 | Media authentication failure falls back to an owner context, enabling unauthorized local media reads. | critical | R7 requires authenticated tenant context and explicit conversation permission for media/correction routes; auth failure no longer synthesizes owner context. | mitigated locally (Stage 4B-3 R9) |
| R-4B3-10 | Dietitian/manual message paths do not consistently append to and reset active media bundles. | high | R4 routes client, dietitian, and system bundle-item appends through canonical ingress/CAS behavior and makes human-handled bundles ineligible for AI send/draft. | mitigated locally (Stage 4B-3 R9) |
| R-4B3-11 | Lifecycle is primarily in-memory; expiry does not consistently remove retrieval eligibility; redaction schema version is incompatible; orphan sweep is absent. | high | R8 adds durable deletion saga, retrieval eligibility flags, schema-compatible redaction, legal-hold handling, object-operation queue, and storage-vs-DB orphan scanning. | mitigated locally (Stage 4B-3 R9) |
| R-4B3-12 | Closure hard-zero metrics are initialized to zero while several safety/leak/race counters are never measured. | high | R9 records measured scenario counts, source commands, timestamps, hard-zero counters, 5,000/200 Stage 4B-3 closure rehearsal, expanded 5,000-case AI rehearsal, and release verification. | mitigated locally (Stage 4B-3 R9) |
| R-4B3-13 | RLS tests were skipped and visual browser verification was blocked, so security and UI closure inputs are unproven. | critical | R9 runs local Supabase reset plus RLS 39/39 with zero skipped and Playwright Stage 4B-3 visual verification across desktop, tablet, mobile Android, and mobile iOS. | mitigated locally (Stage 4B-3 R9) |
| R-410 | Client-facing AI output discloses AI identity or uses doctor/dietitian/professional referral language that violates the product communication covenant. | critical | The post-Phase 65 direct completion plan locks client-facing covenant rules: no AI self-disclosure, no doctor/dietitian/professional referral language, no medical-advice disclaimer phrasing, and no yellow/red client-facing AI boundary replies. Phase 66 encodes this locally with core covenant detection, PromptContext instruction, provider-output safety metadata, mock-provider self-checks, internal-only handoff acknowledgements, send-time blocking for non-green AI drafts and covenant-violating green draft edits, and regression tests. Future real Gemini/channel phases must reuse the same covenant checks before any production send. | mitigated in local prototype |
| R-411 | Direct 100-dietitian / 5,000-client pilot starts before scale, pagination, and load/backpressure evidence are production-ready. | critical | `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md` removes the small production ring assumption and makes direct 5,000-client scale foundation a prerequisite before production GO. Phase 69, 76O, 77K, and 79B-79I provide local bounded-read, 5,000-client, food-mix, lifecycle, replay, and hard-zero aggregate evidence. Phase 81 remains a fail-closed GO framework with baseline `NO_GO_NOT_ELIGIBLE` and `productionPilotStarted: false`. Its historical Phase 81F report recorded a skipped RLS input; current local RLS was later refreshed successfully through Stage 4B-2 R7/advisory hardening, but the persisted Phase 81 final decision is not automatically rewritten and production GO still requires a fresh authorized gate evaluation plus external approvals, R-405 resolution or acceptance, real monitoring/rollback ownership, roster authorization, and all production preflight evidence. | partially mitigated in local prototype |
| R-412 | Green-risk AI replies are generated without approved source support, causing unsupported client-facing answers. | critical | Phase 67 adds a local approved source answerability engine before provider generation. Green provider calls/sends require approved source support from active diet plan, prompt-allowed form summaries, dietitian context updates, dietitian manual messages, pinned notes, allergies, or restricted foods. AI-generated messages are excluded from source authority. Missing approved source support creates internal handoff/no-send with `providerAttempted=false`. Phase 68 preserves this gate and adds green intent taxonomy only after approved-source answerability. Phase 76D adds structured food-rule fields as authoritative answerability sources; Phase 76E adds deterministic food-rule engine decisions; Phase 76F adds intent-family source matching, food-rule alignment, and structured food-rule source categories with substitution legacy plan/manual fallback; Phase 76O rehearses food-rule green and no-source handoff paths at 100x50 scale with `unsafe_green_count = 0` on bundled rehearsal. Phase 76P consolidates this evidence in pilot/gate docs without production clinical approval. | mitigated in local prototype |
| R-413 | Green maximization lacks intent traceability or accidentally downgrades unsafe yellow/red messages. | high | Phase 68 adds deterministic green intent taxonomy evidence after approved-source answerability and before provider generation. Allowed green intents record `contextManifest.greenIntent.intentFamily`; green-looking sensitive intents block with internal handoff/no-send and `providerAttempted=false`; yellow/red decisions receive `not_applicable_non_green` metadata and are not downgraded. Phase 76C locks the downstream requirement for intent-specific food-rule answerability and food-rule engine evidence before WhatsApp production adapter work. Phase 76D adds registry-backed structured food-rule fields and autopilot completeness gates as the local data foundation for that track. Phase 76E adds the deterministic food-rule engine with audit-only orchestrator evidence. Phase 76F adds intent-family source matching, food-rule alignment, structured food-rule source categories, substitution legacy plan/manual fallback, and yellow/red answerability bypass so clinical second-layer routing is not blocked by green answerability. Phase 76G adds source-backed food-rule carve-outs only for `second_layer_client_allergy_or_restriction_mentioned` on prospective food questions with explicit food-rule decisions; ingestion reactions, acute clinical markers, severe allergy profiles, and other second-layer reasons remain yellow. Phase 76H-76O complete product-ingredient verification, PromptContext/output guards, dashboard/proposal UX, permission graph bridge, calibration metrics, lifecycle coverage, and 100x50 food-mix rehearsal without downgrading yellow/red paths. Phase 76P consolidates the full 76C-76O track in continuity and gate docs. | partially mitigated in local prototype |
| R-414 | Product ingredient or packaged-food questions are answered from invented or unverified ingredient facts. | critical | Phase 76C defines a trusted-source product ingredient verification contract with `ingredient_source_type`, confidence levels, and fail-closed review routing when evidence is unknown. Phase 76H implements core `product-ingredient-verification.js` and app `product-ingredient-verification.ts` with user-label extraction, confidence/source gating, normalized `matchedForbiddenKeywordIds`, diet-type conflict detection on labels, and food-rule engine consumption. Phase 76O rehearses `product_ingredient_uncertainty` and diet-type conflict scenarios at scale with fail-closed review routing and `unsafe_green_count = 0` on bundled rehearsal. Phase 77A locks v1 out-of-catalog inference to deterministic catalog/alias/keyword matching only, keeps LLM-based product/food classification out of scope until external provider gates close, and limits `needs_label` to written ingredient text rather than image interpretation. Open web browsing, label-image interpretation, and real barcode/catalog providers remain out of scope and disconnected. | partially mitigated in local prototype |
| R-415 | Global master food catalog contains an incorrect group, alias, or ingredient keyword that affects all tenants. | critical | Phase 77A requires the user-supplied food list to become a versioned global master catalog with checksum, QA summary, deterministic matching tests, and false-match golden cases before runtime use. Phase 77D loads only the user-supplied `Besin Veritabani` hierarchy as repo-versioned reference data with workbook and record-set checksums, stable ids, QA validation, 12 main categories, 113 subcategories, 518 foods, 0 duplicate triples, and dashboard selection expansion tests. Phase 77G uses catalog/profile/menu matching in Food Decision V2 and fails closed on ambiguous or missing catalog matches; Phase 77K rehearses out-of-catalog uncertainty and forbidden-category behavior at 100x50 scale. Phase 77R adds versioned checksum-backed alias dictionaries with QA-gated global autopilot eligibility and tenant-approved aliases. Residual risk remains for future alias/ingredient metadata expansion and production catalog approval. | partially mitigated in local prototype |
| R-416 | Menu plan content conflicts with client food rules, causing AI to approve a forbidden food because it appears in the active menu. | critical | Phase 77A defines source precedence: forbidden foods, forbidden groups, forbidden ingredients, and diet-type conflicts beat active menu content. Phase 77F adds menu/rule cross-check warnings in the dashboard; Phase 77G enforces forbidden precedence at Food Decision V2 runtime; Phase 77H blocks contradictory provider wording through V2 output guard and bounded prompt segments; Phase 77K includes forbidden-food approval checks with zero inappropriate approvals in the bundled V2 evidence. Legacy 76E fallback remains when V2 is not confident. | partially mitigated in local prototype |
| R-417 | Out-of-catalog deterministic matching falsely maps a client request to the wrong food or group. | high | Phase 77A forbids LLM-based v1 matching and requires deterministic matching to fail closed when confidence is insufficient. Phase 77D adds stable Turkish-normalized ids and exact name lookup for the supplied hierarchy. Phase 77G Food Decision V2 returns `needs_review` for ambiguous exact matches and missing catalog matches instead of guessing; Phase 77K covers `out_of_catalog_uncertain` in the V2 golden suite and 100x50 rehearsal. Phase 77R adds checksum-backed alias dictionaries with exact-only autopilot matching, QA-gated global aliases, brand `needs_label` fail-closed routing, recipe-gated mixed-dish handling, and JSONL false-match golden cases. Phase 77X expanded AI rehearsal reports hard-zero unsafe send and source-unsupported-green counters across 100x50 orchestrator cases to catch alias/catalog blast-radius regressions before channel work. Residual risk remains for broader alias expansion, fuzzy, ingredient, or exchange-group metadata changes without recurring calibration. | partially mitigated in local prototype |
| R-418 | DOCX/PDF menu export introduces new dependency vulnerabilities, broken Turkish text rendering, or sensitive-field leakage. | high | Phase 77J added `docx` and `pdfmake` with production audit recheck (only documented R-405 findings), server-only binary generation, Turkish sample verification in tests, client-facing export document stripping internal fields (`dietitianNotes`, catalog checksums, revision metadata), and active/export-visible eligibility gates. Residual risk: export dependency maintenance and production Turkish rendering across all client menu variants. | open |
| R-419 | Food Decision V2 calibration or AI quality planning drifts and approves unsafe green sends before channel work. | high | Phase 77K added a 14-case V2 golden JSONL suite, deterministic 100x50 V2 rehearsal with `unsafe_green_count = 0`, Phase 76O integration checks, `phase74-export-v1.2` export coverage verification, and operational-health closure signals (`manualSourceAuthorityTrackClosed`). Phase 77M closed the AI Quality Program master rebaseline and spec through `docs/PHASE_77M_MASTER_REBASELINE_AND_SPEC.md` and `docs/PHASE_77M_77Y_AI_QUALITY_MASTER_PLAN.md`, locking responsePlan, claimManifest, deterministic templates, canonical intent, Food Understanding V3, styleDna, AI quality rehearsal, hard-zero quality metrics, and narrow deterministic autopilot eligibility before WhatsApp adapter work. Phase 77X added `ai-quality-expanded-rehearsal-v1-v0.1.0`, deterministic 100-client x 50-message expanded rehearsal (`5000` orchestrator cases), operational-health AI quality fields (`aiQualityStatus`, version stamps, pass rates, narrow autopilot readiness), and hard-zero reporting for `unsafe_client_send_count`, `source_unsupported_green_count`, `forbidden_food_approval_count`, `yellow_red_client_send_count`, and `claim_outside_manifest_count` Phase 77Y closed the 77M-77Y program locally through `docs/PHASE_77Y_CONTINUITY_EVIDENCE_AND_LAUNCH_GATE_UPDATE_SPEC.md` and `phase-77y-ai-quality-program-closure.ts`, synchronizing continuity/pilot/gate docs and recording bundled hard-zero and measured-threshold evidence before WhatsApp adapter work resumes. live channel replay, catalog/alias drift, template drift, responsePlan-output contradiction, style poisoning, and production corpus changes without recurring calibration. | partially mitigated in local prototype |
| R-420 | Response plan, template, and rendered output contradict each other, causing a client-facing answer that bypasses source authority. | critical | Phase 77M locked core-owned `responsePlan`, deterministic templates before claim grounding, `claimManifest` generated from plan/template/sourceRefs instead of LLM output, and output guards that block rendered text outside the manifest. Phase 77O-77Q implemented response-plan, deterministic-template, and claim-manifest runtime with `claim_outside_manifest` grounding in `guardProviderOutput`. Phase 77X rehearses the full AI quality path at 100x50 scale with hard-zero `claim_outside_manifest_count = 0` on bundled sample and full expanded rehearsal scripts. Residual risk: live channel replay and template/manifest drift without recurring calibration. | partially mitigated in local prototype |
| R-421 | Dietitian style learning is poisoned or over-applied, changing clinical/source/food decisions or leaking client-identifying text. | high | Phase 77M locked tenant/dietitian-scoped `styleDna`, edit-history lifecycle controls, no client-identifying style learning, covenant checks for candidate phrases, and tests proving style never changes clinical safety, source authority, Food Decision V2, or green/yellow/red routing. Phase 77S implements `style-dna-v2-v0.1.0` runtime, fallback-store edit-history records (hash/diff metadata only), hard style guard enforcement in `guardProviderOutput`, JSONL style-poisoning golden cases, and measured soft mismatch (not a hard gate). Phase 77X records `style_soft_mismatch_rate` on the expanded AI rehearsal corpus with threshold `0.35`. Residual risk: broader style phrase corpora and production edit-history persistence without recurring calibration. | partially mitigated in local prototype |
| R-422 | Internal workflow states are mistaken for new client-visible risk classes, weakening the product's green/yellow/red operating model. | medium | Phase 77M locked green/yellow/red as the only client-visible risk classes. `unknown_intent`, `needs_label`, `needs_review`, `clarify`, `handoff`, and `block` are internal workflow states only and must map back to existing send/draft/handoff/block behavior. Phase 77N-77W implemented runtime enforcement including `narrow-autopilot-eligibility-v2-v0.1.0` downgrade gates for ambiguous autopilot paths. | mitigated locally |
| R-423 | Deterministic template library drift causes responsePlan templateIds, claim manifests, and rendered client text to diverge without detection. | high | Phase 77P-77Q locked `deterministic-template-library-v1` and claim-manifest generation from template/source authority. Phase 77X expanded rehearsal tracks `responsePlanPassRate`, `claimGroundingPassRate`, and hard-zero `claim_outside_manifest_count` across 100x50 orchestrator cases. Residual risk: production template edits without JSONL golden refresh and recurring rehearsal. | partially mitigated in local prototype |

## Security Operations Risks

| ID | Risk | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R-501 | Backups cannot be restored or retain data longer than approved. | high | Phase 11 added a draft backup/restore runbook with restore drill evidence requirements; Phase 39 prepares the backup/restore review packet for provider, region, retention, encryption, legal-hold, restore-drill, tenant-isolation, RLS, and data-governance validation decisions. Final provider, retention, restore drill, and legal-hold approvals remain external gates. | open |
| R-502 | Production secrets are exposed or cannot be rotated quickly. | high | Phase 11 added a draft secret rotation runbook with emergency revocation steps; Phase 40 prepares the secret rotation review packet for production secret manager, inventory, ownership, cadence, emergency revocation, break-glass, access review, health-check, smoke-test, and evidence decisions. Production secret manager and rotation ownership remain external gates. | open |

## Phase 83 Commercial Track Note (2026-07-01)

Phase 83A scope lock added `docs/PHASE_83_COMMERCIAL_PWA_AND_FRONTEND_RELAUNCH_SPEC.md`. Phase 83C added sandbox Stripe webhook idempotency via `billing_event_ledger` and blocks `sk_live_` keys. Phase 83F added fail-closed commercial admin operations with `commercial_admin_audit_events` and protected `/api/commercial/admin/*` routes. Phase 83G added API-wide active entitlement enforcement on protected dashboard APIs via `resolveAppTenantContext()`, in-memory fail-closed rate limits on invite-status/checkout, PWA stale-session entitlement checks, and network-only service worker policy for `/api/*`. Phase 83H closed the Phase 83 track locally with verification refresh evidence, Playwright visual 16/16, extended `commercial_admin_audit_events` RLS coverage, and rehearse pass. Phase 83 final remediation clarified that commercial admin revoke is full subscriber entitlement revoke only, rejects `mobileInstallOnly: true`, and records `entitlement_revoked`; no separate mobile-install entitlement risk is claimed closed because no separate install-only model exists. Verification passed with targeted Phase 83 64/64, full app suite 665 passed / 4 skipped, and release verify core 225/225 + app 665 passed / 4 skipped. Residual commercial risks (webhook replay at scale, distributed rate-limit bypass, entitlement propagation delay) remain tracked. The recorded `npm run test:rls` skip and R-406 note are historical for Phase 83; later Stage 5/6 RLS evidence is zero-skip. Phase 83 does not change production pilot `NO-GO` status or close launch gates. R-405 is technically resolved locally under the current Stage 5 dependency report.

## Phase 84 Commercial Onboarding Risk Note (2026-07-02)

The VPS/domain/HTTPS/Stripe test webhook validation proves that sandbox payment provisioning can create the commercial tenant and active entitlement. It also exposed the next product risk: successful checkout must create or claim a real authenticated dashboard user. R-425 tracks this until Phase 84 proves magic-link login, onboarding claim, tenant membership/profile creation, dashboard access, and reliable email delivery.

Phase 84D-84E (2026-07-02) implemented magic-link login and onboarding claim locally. Phase 84I (2026-07-03) adds callback cookie persistence, token-hash OTP callback support, admin callback URL separation, admin-host routing, and duplicate claim recovery; targeted/visual/release verification passed locally. Hosted Supabase migrations are applied and VPS generated token-hash fallback verified onboarding claim/dashboard access. Phase 84J (2026-07-03) enabled Resend custom SMTP after Porkbun DNS verification and verified a real inbox magic-link click reaching the dashboard. R-425 is now mitigated in the hosted sandbox path; this does not approve production pilot, live Stripe, real channels/providers, real monitoring/backup/secret-manager, or real client health-data processing.

## Phase 85 Stage 4B Planning Risks (2026-07-11)

| ID | Risk | Severity | Planned mitigation | Status |
| --- | --- | --- | --- | --- |
| R-433 | Clinical risk is duplicated or diverges between handoff notifications and the alert screen. | critical | Derive Uyarilar only from active yellow/red client state, apply red precedence, and exclude clinical handoff notifications from the system surface. | mitigated locally (Stage 4B remediation 2026-07-12) |
| R-434 | Red alert closure is split across UI and handoff mutations, leaving AI, lock, handoff, and human session inconsistent. | critical | Use only the expected-revision atomic activation API/RPC; no separate handoff resolution UI; test conflict rollback and lock ordering. | mitigated locally (Stage 4B remediation 2026-07-12) |
| R-435 | Global notification read/ack state leaks one user's actions to another or crosses tenant/client scope. | high | Tenant-composite per-dietitian receipts, actor-own mutation, linked-client visibility checks, service-layer authorization, and RLS role-matrix tests are implemented. | mitigated locally; complete-chain RLS passed 35/35 and advisory-hardening suite passed 36/36 on 2026-07-13 |
| R-436 | Alert/notification lists expose raw client messages, clinical details, provider payloads, or trust/quarantine evidence. | critical | Use allowlisted safe DTOs, reason-code-to-i18n mapping, no raw notification body, P85-IF-R5 boundaries, and leak/export/redaction regression tests. | mitigated locally (Stage 4B remediation 2026-07-12) |
| R-437 | Alert/notification refresh reintroduces broad app-state reads or becomes unbounded at 100 dietitians/5,000 clients. | high | Use bounded cursor APIs, server-side filters, dedicated resources, visible-tab 30-second polling, in-flight dedupe/backoff, and production-scale rehearsal. | mitigated locally (Stage 4B remediation 2026-07-12) |

Canonical evidence: `docs/PHASE_85_STAGE_4B_UYARI_VE_BILDIRIMLER_EVIDENCE.md`; remediation evidence: `docs/PHASE_85_STAGE_4B_POST_CLOSURE_REMEDIATION_EVIDENCE.md`. Stage 4B risk identifiers are R-433 through R-437 to avoid collisions with the existing P85-IF R-426 through R-432 records.

## Phase 85 Stage 4B-2 Messaging Risks - 2026-07-12

| ID | Risk | Severity | Planned mitigation | Status |
| --- | --- | --- | --- | --- |
| R-438 | Conversation list/detail reads expose tenant-wide or unbounded transcript data. | critical | Use actor-aware bounded list/detail RPCs, keyset cursors, safe DTO allowlists, no full app-state fetch, cross-tenant `404`, and scale tests. | mitigated locally; current RLS passed 35/35 on 2026-07-13 |
| R-439 | A shared unread marker lets one dietitian or assistant clear another actor's unread state. | high | Use tenant/conversation/dietitian composite receipts, monotonic sequence markers, own-actor mutation, assistant own-receipt exception only, and RLS race tests. | mitigated locally; current RLS passed 35/35 on 2026-07-13 |
| R-440 | Yellow AI draft is sent as an unreviewed non-green AI message or red lock closes on manual reply. | critical | Create reviewed yellow replies as new `dietitian_manual` provenance; preserve non-green send blocking; keep red closure on existing atomic activation only; add race/CAS tests. | mitigated locally (Stage 4B-2 closure 2026-07-12) |
| R-441 | Messaging UX grants assistant/viewer/auditor unauthorized domain controls. | high | Project explicit permissions, hide/deny composer/draft/AI controls, enforce API/RLS, and verify assistant assigned read-only transcript access with own receipt. | mitigated locally; current RLS passed 35/35 on 2026-07-13 |

Canonical contract: `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_SPEC.md`; historical closure evidence: `docs/PHASE_85_STAGE_4B_2_CLOSURE_EVIDENCE.md`; current remediation closure: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`.

## Phase 85 Stage 4B-2 Post-Closure Remediation Risks - 2026-07-12

| ID | Risk | Severity | Required remediation evidence | Status |
| --- | --- | --- | --- | --- |
| R-4B2-01 | Viewer assignment can reach Supabase messaging mutations through role-only capability checks. | critical | R1/R2/R3 actor-aware API and RLS matrix denies viewer domain mutation server-side. | mitigated locally; current RLS passed 35/35 |
| R-4B2-02 | Mutation idempotency is persisted after the domain transaction and can duplicate under concurrent retry. | critical | R3 transactional idempotency claim, fingerprint conflict, replay, and rollback evidence. | mitigated locally (R3/R6/R7) |
| R-4B2-03 | Yellow review can commit while a red lock supersedes the yellow hold. | critical | R3 transaction-level red/yellow race test with zero partial writes. | mitigated locally (R3/R6/R7) |
| R-4B2-04 | Supabase projection RPCs load unbounded transcript/source data before application slicing. | critical | R2 SQL-bounded RPC, explain plan, and scale evidence. | mitigated locally; SQL buffers plus 10k scale verified |
| R-4B2-05 | Stage 4B-2 could be closed against a skipped RLS suite when local Docker/Supabase is unavailable. | high | R6/R7 require local reset and a zero-skip RLS role matrix; skipped execution cannot be reclassified as pass. | mitigated locally; local RLS passed 35/35 with 0 skipped on 2026-07-13, followed by advisory-hardening 36/36 |
| R-4B2-06 | Unread navigation badge reflects only loaded pages rather than actor-scoped aggregate totals. | high | R1/R4 aggregate contract and pagination-scale tests. | mitigated locally (R4/R5/R6) |
| R-4B2-07 | Tablet layout uses mobile drill-down below the `lg` breakpoint. | high | R4 responsive layout correction and tablet visual evidence. | mitigated locally (R4/R6) |
| R-4B2-08 | Valid old message anchors are rejected when absent from legacy app-state. | high | R4 API-backed target resolution and deep-link tests. | mitigated locally (R4/R6) |
| R-4B2-09 | Hook, route, concurrency, SQL-scale, and visual evidence is incomplete or synthetic. | medium | R5/R6 zero-skip targeted and independent verification. | mitigated locally (R5/R6/R7) |
| R-4B2-10 | Continuity documents contain stale handoffs and unconditional closure wording. | medium | R7 canonical document reconciliation and reference scan. | mitigated locally (R7) |

Historical Stage 4B-2 checkpoint: production pilot remained `NO-GO`, R-405 was open, and real integration paths were closed. Current R-405 disposition is `technically_resolved` under the 2026-08-18 authority at the top of this register; production remains `NO-GO` and real integration paths remain closed.

## Phase 85 Stage 4C AI Chat Planning Risks - 2026-07-22

| ID | Risk | Severity | Planned mitigation | Status |
| --- | --- | --- | --- | --- |
| R-462 | AI Chat reuses old internal Copilot storage/API assumptions and leaks hidden client data. | critical | Stage 4C uses a separate domain, separate APIs, creator-private conversations, safe DTOs, and blocks assistant/auditor access. | mitigated_locally — `docs/PHASE_85_STAGE_4C_EVIDENCE.md` Faz 11 |
| R-463 | General chat accidentally invokes client data tools or provider context containing PHI. | critical | Scope is immutable; `general` conversations have null `client_id`; context gateway blocks client tools unless scope is `client_bound`. | mitigated_locally — golden corpus + gateway tests |
| R-464 | A client-bound chat accesses more than one client. | critical | Conversation `client_id` is immutable; all retrieval tools require the conversation client id and reject LLM-supplied client ids. | mitigated_locally — second-client red-team corpus |
| R-465 | Large client records are dumped into prompts and increase hallucination or source confusion. | critical | Use bounded retrieval, map/reduce by domain, source caps, excerpt caps, and answerability gates instead of full-record prompt stuffing. | mitigated_locally — context gateway budgets + scale rehearsal |
| R-466 | Client access is revoked after conversation creation but before retrieval or final answer. | critical | Recheck actor/client access and client revision before every tool call and before final message commit. | mitigated_locally — gateway access recheck tests |
| R-467 | AI Chat expands automatic client-send authority. | critical | Safe draft transfer is explicit and never sends; green/yellow/red messaging contracts and existing handoff/manual-review gates remain authoritative. | mitigated_locally — risk bridge hard-zero metrics |
| R-468 | Unsupported clinical claims are presented without approved source evidence. | critical | Personalized recommendations require client fact evidence plus approved clinical source evidence; unsupported claims fail closed. | mitigated_locally — answerability validators + sourced corpus |
| R-469 | Attachment OCR/STT/document text introduces prompt injection or unreviewed PHI into answers. | high | Raw files are never prompted; only scanned, parsed, reviewed/accepted derivatives enter retrieval with prompt-injection labeling. | mitigated_locally — multimodal + injection red-team corpus |
| R-470 | Stop, edit, regenerate, or branch operations leave stale assistant answers visible as current. | high | Persist run states, branch heads, expected revisions, supersession markers, and descendant invalidation. | mitigated_locally — edit/stop/reconnect red-team corpus |
| R-471 | Latest-user-message delete removes too little or too much data. | high | Only the latest user-authored message in the active branch can be deleted; descendant assistant outputs, runs, tool calls, source refs, and chat-only attachments are purged transactionally. | mitigated_locally — Faz 10 lifecycle tests |
| R-472 | AI Chat deletion breaks client-record evidence copied from chat attachments. | high | `copy-to-client-record` creates an independent sanitized client-record asset; chat deletion removes only chat-owned objects. | mitigated_locally — Faz 10 lifecycle tests |
| R-473 | Provider egress is enabled before vendor/legal/security gates. | critical | Real providers are disabled locally; provider gates require DPA, no-training, retention, region, subprocessors, log redaction, incident terms, and secret-manager approval. | mitigated_locally — production provider flag scan; production remains NO-GO |
| R-474 | Role/capability drift lets assistant/auditor use or mutate AI Chat. | high | Add explicit `dietitian_ai_chat` capability checks and RLS role matrix tests; assistant/auditor fail closed. | open — requires local Supabase RLS zero-skip evidence |
| R-475 | AI Chat stores token/cost/capacity telemetry despite the no-quota decision. | medium | Do not add token, cost, capacity, daily quota, or monthly quota fields; keep only safety/concurrency/file-limit evidence. | mitigated_locally — closure aggregate-only evidence scan |
| R-476 | Chat history search/list APIs become unbounded at 100 dietitians and 5,000 clients. | high | Cursor pagination, bounded search, creator-private indexes, and scale rehearsal are required before closure. | mitigated_locally — 100×5k scale rehearsal |
| R-477 | Sourced answer UI exposes raw hidden source text or provider payloads. | high | Source DTOs expose only allowlisted labels, excerpts, source kinds, and claim ids; raw payloads stay server-side. | mitigated_locally — source DTO + visual/accessibility tests |
| R-478 | Red-risk findings inside AI Chat are not surfaced through existing internal notification/handoff paths. | critical | Risk adapter maps red to deduplicated internal notification and explicit handoff link only; no client-send action is created. | mitigated_locally — Faz 9 risk bridge tests |
| R-479 | Old internal Copilot visible UI remains alongside AI Chat and confuses dietitians. | medium | Stage 4C UI phase retires visible Copilot entry points and redirects legacy links while preserving historical data for audit. | mitigated_locally — Faz 4 visual/nav tests |
| R-480 | Stage 4C is mistaken for production readiness or real provider/channel activation. | critical | Every Stage 4C evidence file repeats production `NO-GO`, R-405 open, and real provider/channel/health-data disabled status. | mitigated_locally — closure verdict + evidence reconciliation |
| R-481 | Stage 4C operational job/lifecycle tables are exposed because RLS is disabled and the integration suite does not assert their catalog posture. | critical | Worker-only access model implemented by append-only migration `20260725163000_phase_85_stage_4c_operational_tables_rls_reclosure.sql`: RLS plus explicit deny-direct-user policies, revoked anon/authenticated privileges, preserved service-role access, catalog/advisory regression, clean reset, and expanded zero-skip RLS. | mitigated_locally - 49/49 RLS, 0 skipped, advisory clear |

2026-07-27 override for R-474 and R-481: the first pre-Stage-4D measurement passed 47/47 but exposed the four-table catalog coverage gap. The approved reclosure then passed clean reset, advisory/catalog checks, and the expanded RLS suite at 49/49 with 0 skipped. Treat older open/blocking wording as superseded by `docs/PHASE_85_STAGE_4C_REMEDIATION_EVIDENCE.md`; production pilot remains `NO-GO` and R-405 was open at that checkpoint.

2026-07-29 Stage 4D remediation reclosure override: Stage 4D post-closure remediation Faz 1, Faz 2, the pre-Faz 3 RLS repair, and Faz 3 evidence reconciliation are reclosed locally. Evidence: `docs/PHASE_85_STAGE_4D_REMEDIATION_PHASE_3_RECLOSURE_EVIDENCE.md`. Clean Supabase reset passed, local RLS passed 53/53 with 0 skipped, and release verification passed while R-405 was open at that checkpoint. Production remains `NO-GO`; all external gates remain open.

## Stage 4B-2 Post-Closure Remediation R1 - 2026-07-12

R1 corrected the shared DTO and permission projection contract and added bounded cursor/safe-integer validation plus complete visible-scope unread aggregates. The related risks are not closed: server-side assignment authorization, database-bounded reads, transactional idempotency, concurrency ordering, UI integration, RLS, and release evidence remain assigned to R2-R7.

## Stage 4B-2 Post-Closure Remediation R2 - 2026-07-12

Historical R2 checkpoint: bounded Supabase v2 list/detail RPCs, actor-scoped unread aggregates, and receipt mutation guards were implemented while database role-matrix/RLS and EXPLAIN evidence remained open. R3-R7 subsequently closed those items; current authority is the R7 evidence.
## Stage 4B-2 Post-Closure Remediation R3 - 2026-07-12

R3 addresses the implementation side of mutation authorization, transaction-scoped idempotency, and red/yellow ordering. R-4B2-01, R-4B2-02, and R-4B2-03 remain evidence-open until the real RLS/API matrix and concurrent database rehearsals pass. R4-R7 remain active.
## Stage 4B-2 Post-Closure Remediation R4 - 2026-07-12

R4 implements the client-side portions of R-4B2-06, R-4B2-07, and R-4B2-08: actor-scoped aggregate unread presentation, tablet split layout, and legacy-cache-tolerant deep-links. R-4B2-09 remains open for full regression, RLS, replay, scale, and independent verification; R-4B2-10 remains open until R7. Production remains `NO-GO`; R-405 was open at that checkpoint. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R4_EVIDENCE.md`.
## Stage 4B-2 Post-Closure Remediation R5 - 2026-07-13

R5 closes the application-level portion of R-4B2-09 with full regression, bounded 10k messaging scale, 79G acceptance, full replay, accessibility, and lifecycle/export checks. Real RLS/EXPLAIN and independent verification remain open; R-4B2-10 remains open until R7. Production remains `NO-GO`; R-405 was open at that checkpoint. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R5_EVIDENCE.md`.

## Stage 4B-2 Post-Closure Remediation R6 - 2026-07-13

R6 independently verified the application/runtime gates and closed the transient visual-ordering flake. Local reset and RLS passed 35/35 with 0 skipped; R7 subsequently captured SQL buffer evidence and reconciled R-4B2-10. Production remains `NO-GO`; R-405 was open at that checkpoint. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`.

## Stage 4B-2 Post-Closure Remediation R7 - 2026-07-13

R7 closes R-4B2-01 through R-4B2-10 as mitigated in the local prototype after zero-skip RLS, executed list/detail SQL buffer plans, bounded SQL/10k scale evidence, and canonical reconciliation. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`. The separate Supabase advisory for RLS-disabled `conversation_mutation_idempotency` and `personas` was closed locally on 2026-07-13 by append-only migration `20260713030000_phase_85_stage_4b2_security_advisory_rls_hardening.sql`; both tables are RLS-enabled, direct `anon`/`authenticated` grants are removed, no direct-user policies were added, and service-role mediated behavior is preserved. Evidence: `docs/PHASE_85_STAGE_4B_2_SECURITY_ADVISORY_RLS_HARDENING_EVIDENCE.md`. Production remains `NO-GO`; R-405 was open at that checkpoint.

## Stage 7R Authority And Finding Lock - 2026-08-24

R-Stage7R-001: Stage 7.1 through Stage 7.4 evidence could be mistaken for final frontend QA/accessibility closure even though the review found incomplete harness execution, visual baseline proof, hard-gate enforcement, assistive-technology output proof, performance proof, and continuity reconciliation. Stage 7R.0 mitigates this by superseding Stage 7.1 through Stage 7.4 for closure, preserving the old evidence as historical only, and locking 15 remediation findings in `docs/PHASE_85_STAGE_7R_FINDING_LOCK.json`. Stage 7R.1 resolves the harness assertion dispatch, role/assignment metadata, and deterministic network fixture boundary findings. Stage 7R.2 records the trusted deterministic baseline. Stage 7R.3 resolves the shared/public/commercial remediation set with zero open `remediationPhase: "7.2"` findings. Stage 7R.4 resolves the dashboard/PWA remediation set with zero open `remediationPhase: "7.3"` findings. Stage 7R.5 resolves the hard-gate/evidence-reclosure set with zero open Stage 7 findings and zero open locked P0/P1/P2 findings. Status: Stage 7R remediation is implemented, validated, and superseded for closure by Stage 7.5. Stage 7 is locally STAGE_7_CLOSED, Stage 7.5 is complete, production remains `NO-GO`, and physical iPhone remains `WAIVED_NOT_EXECUTED`.
Superseded AIya Performance Plan 1 Phase 4 closure note, 2026-09-11: an earlier summary said local authenticated baseline collection and non-production hosted collection each completed 20/20 valid samples and only physical-device environments blocked final closure. That note is superseded by the 2026-09-13 canonical evidence above and must not be treated as current Phase 4 state.

## AIya performance continuation note - 2026-09-22

The bounded route/history race is recorded in `docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-client-only-dashboard-navigation-fix-v1-20260922T101352Z_EVIDENCE.json` (SHA-256 `55B6DF4617967D2FD73964E884CCE4A63D335ECBD319C154B5AA642A185D3652`). The working-tree guard mitigates one same-document `/dashboard` duplicate-writer boundary locally, but it does not reduce the risk that shared auth/session work, RSC fan-out, or broad React commits cause the general freeze. The related performance findings remain evidence-open/blocked, no production acceptance is granted, and production remains `NO-GO`. A repeated bounded J1 or real interaction capture is still required before deciding whether this boundary recurs and what latency remains.

## Hosted Global-Freeze Attempt-Budget Update - 2026-09-27

Update to R-P5-036/R-P5-037: the user authenticated to the same hosted
synthetic clinic and authorized five bounded Phase 1 attempts. All five
150-sample host captures completed under release
`hs-1c9756046b01-b55ed4ff550f`; average CPU ranged `5.85-6.38%`, peak CPU
`28.77-58.33%`, the application process remained present, and swap, cgroup
throttling/OOM, memory-pressure, and IO-pressure deltas were zero. No browser
trace was persisted and aligned, so these windows are not evidence against a
transient server/database issue or evidence for a browser-only cause.

The Playwright and CDP input-control calls timed out in this session, while a
simple page-side JS evaluation returned quickly on one attempt. These failures
remain classified as browser-control/trace-capture limitations, not confirmed
application freezes. Attempt 3's reload call returned in `478 ms`; attempt 5's
reload completion was not captured. The new evidence is
`docs/aiya-global-freeze-phase-1-20260927T203028151Z-ba4f64ee-de8c-4661-8142-d4f4d9df4637_EVIDENCE.json`
(SHA-256 `97DE789E4A62A2F0CCE7899412CE6B6B4E6712144E8DC799DC2CF8ABD4375919`):
five interrupted attempts, `0/3` valid paired records, all checkpoint chains
validated, and outcome `BLOCKED_ATTEMPT_BUDGET_EXHAUSTED`. Risk remains open;
root cause, finding disposition, Plan 2 eligibility, and production readiness
are unchanged. Do not repeat this identity, start Phase 2, or change/deploy
runtime code. A future capture requires separate approval for a fresh bounded
identity and a trace-export path proven to meet the host-overlap gate before a
run starts.

## Hosted Global-Freeze Trace-Transfer Preflight - 2026-09-28

R-P5-036/R-P5-037 remain open and un-attributed. A read-only trace-transfer
preflight received CDP trace completion and read the stream to EOF without
reported data loss, but could not persist the trace as a local file; the
existing sanitizer was therefore not exercised. The 100-row host sample was
not persisted, and its 89.127-second overlap estimate used a clock probe made
after capture. Neither is formal paired evidence. The host summary did not
show elevated pressure in that window, but cannot rule out a transient or
non-host cause. Evidence:
`docs/AIYA_GLOBAL_FREEZE_TRACE_TRANSFER_PREFLIGHT_20260927T214247Z-8f5ac140-9912-405a-a88e-9aad6d980506_EVIDENCE.json`
(SHA-256 `9607D072DC76989F81892C7AA549E5B0B08E71C6EE26CA61A3103804695393F3`).

The attempted browser reload followed the injected large-buffer transfer
attempt; page state after reload was not verifiable and must not be counted as
application performance evidence. No source, runtime, database, environment,
secret, or production state changed. The hosted v1 diagnostic remains
`BLOCKED / attempt_budget_exhausted` (5/5 attempts, 0/3 valid pairs). Do not
retry that identity or infer that any layer has been cleared. Before any new
bounded hosted measurement, prove local-file trace export without page-side
bulk injection and pass the existing sanitizer. A newly versioned measurement
identity also requires separate approval. Plan 1 remains
`COMPLETE / DIAGNOSIS_BLOCKED`; Plan 2 eligible findings remain zero;
production remains `NO-GO`.

## Local Synthetic Trace Sanitizer Sub-Gate - 2026-09-28

The existing `readChromeTrace` importer passed a focused test using a
gzip-compressed synthetic trace written to a temporary local file; the input
bytes stayed unchanged and the temp directory was removed. Evidence:
`docs/AIYA_GLOBAL_FREEZE_LOCAL_TRACE_SANITIZER_PREFLIGHT_20260928T092828Z-0af9f788-0845-435e-92ad-1d3c8380c723_EVIDENCE.json`
(SHA-256 `B6DBEE968F3997358ED41B0502C6C362B1B1039B2E19C6CBE051001BC89994CB`).
This closes only synthetic file parsing/redaction. R-P5-036/R-P5-037 remain
open: actual Chrome/CDP-to-local-file export and sanitizer import of that exact
export have not been proved, and no freeze/cause layer was measured. Hosted
Phase 1 remains blocked at 5/5 attempts and 0/3 valid paired records. No new
measurement identity is authorized by this sub-gate.

## Browser Export Bridge Policy Block - 2026-09-28

R-P5-036/R-P5-037 remain open. A tiny synthetic transfer test in a new blank
Chrome tab was stopped when browser URL policy rejected the requested
`data:` navigation before it occurred. The policy explicitly prohibited
trying the same outcome by raw CDP, another browser surface, or workaround; no
such retry was made. No download/trace artifact or checkpoint resulted, and
no hosted app or production state was touched. Evidence:
`docs/AIYA_GLOBAL_FREEZE_TRACE_EXPORT_POLICY_BLOCK_20260928T095640Z-b69eaddf-a297-4bfb-a5ea-7291a6c44c22_EVIDENCE.json`
(SHA-256 `804AE205B5C9A2F82CFBC3D1BAAD8923976A56298F0ABDAC512498DFA0AAF39F`).

The synthetic local-file sanitizer test remains passed, but actual browser
trace export is now explicitly blocked by the available browser capability.
Do not attempt an alternate browser route or raw CDP to bypass this restriction.
Resume only if the platform exposes an approved trace-to-file capability;
Phase 1 remains `BLOCKED / attempt_budget_exhausted` (5/5, 0/3). Cause and
responsible layer remain unknown; Plan 1 closure, Plan 2 eligibility zero, and
production `NO-GO` are unchanged.

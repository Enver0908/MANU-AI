# AIya Uctan Uca Performans Denetimi ve Iyilestirme Eylem Plani - Revizyon 2

## Active umbrella scope - 2026-09-18

The user-authorized simplification is recorded in the canonical
`plan1-final-v3` section of `docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md`.
That section exclusively governs current Plan 1 order, dependencies,
diagnostic validity, experiments, evidence, and closure, superseding
conflicting directions anywhere below.

Plan 1 diagnoses and establishes causal evidence; Plan 2 implements accepted
fixes; Plan 3 verifies the resulting candidate. Plan 2 and Plan 3 must be
prepared from the findings and separately authorized. Legacy sections below
that combine local remediation with diagnosis are not execution permission.
Existing performance budgets and the official nine-scenario x 20-valid-sample,
28-attempt acceptance contract remain in force for formal acceptance.
Existing security and production approval boundaries remain unchanged.

The plan revision and v3 4.3/4.4 capture correction are preserved in the
recovered Plan 1 v3 source. The active execution source is now the main
checkout at `C:\Users\Dell\OneDrive\Masaüstü\MANU-AI`; the former `38c0`
directory is empty and is not an execution source. The recovered snapshot is
`e52d7b48a234dbf5e83f6ff836cc7c7640b97e3d`, and its provenance is recorded in
`docs/WORKTREE_RECONCILIATION_20260918T163307Z_EVIDENCE.json`. The targeted
probe, scoped local observations,
4.4.4 trace reconciliation, the explicitly reopened 4.5/4.6 hosted and
device observations, and the 4.7 reconciliation are recorded under the
separate v3 evidence convention. They are not an official baseline,
performance acceptance, causal proof, or runtime fix. The current scoped
result is `COMPLETE / DIAGNOSIS_BLOCKED`; Phase 5.1 hypothesis ordering is
complete as `HYPOTHESES_PRE_REGISTERED`; Phase 5.2 is complete as a
provisional single-variable experiment result; Phase 5.3 is complete as
`LAYER_ATTRIBUTION_INCONCLUSIVE`; Phase 5.4 is now
`COMPLETE / SAFETY_BEHAVIOR_CHECKS_COMPLETE`, including the required local
runtime RLS boundary. The H-5.1-002 candidate loop in Phase 5.5 is
`COMPLETE / INCONCLUSIVE`; H-5.1-003 is now complete as
`COMPLETE / REPEATABLE_PROVISIONAL_EFFECT` without confirming a root cause or
accepting a runtime fix. Phase 5.6 is now
`COMPLETE / FINDING_DISPOSITIONS_REVIEWED`: the three F2 findings are
`INCONCLUSIVE` and the two F12 findings are `OPEN_BLOCKED`. Phase 5.7 is
complete as `COMPLETE / DIAGNOSIS_BLOCKED`; Plan 1 is closed for this scoped
diagnosis, no finding is eligible for Plan 2, and production remains NO-GO.

## Active shared-runtime continuation result - 2026-09-19

The separately authorized local Docker continuation completed a single-variable
A1 -> B -> A2 diagnosis. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-ab-a-20260919T111921Z-cd652e70-18de-4d16-89e4-2aadfcd336ce_EVIDENCE.json`.
The tested boundary is `DashboardApp` passing a render-unstable full
`DashboardUrlState` object to `useStage4BInbox`; B memoized only the six inbox
filter fields. All three B repetitions reduced the second-action overlapping
request count from five to three by removing redundant alerts and
notifications refreshes. This is a repeatable contributing boundary, not a
complete explanation of the global freeze: auth/session and RSC/bootstrap
costs remain, React commit causality is not isolated, and DB lock sampling is
still unavailable.

The memoized projection is retained as a behavior-preserving local candidate
in `app/src/components/dashboard-app.tsx`. It is not an official baseline,
Plan 2 finding, accepted production fix, or production readiness decision.
Plan 1 closure, finding dispositions, Plan 2 eligibility, and production
`NO-GO` remain unchanged. The focused inbox behavior regression passed 39/39;
the next eligible work is a separate auth/RSC single-variable experiment.

## Active shared-runtime auth/RSC cache result - 2026-09-19

The separately authorized local continuation completed a second single-variable
A1 -> B -> A2 diagnosis. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-auth-cache-ab-a-20260919T123718Z-479575bb-ed48-487c-b099-f935ad403948_EVIDENCE.json`.
The tested boundary was
`app/src/lib/dashboard-server-auth.ts:resolveDashboardAuth`. B wrapped that
function in request-local React cache while the retained inbox projection was
unchanged. The selected J1 normal and diagnostic records were 6/6 valid and
successful in all variants. A2's other journey units include one invalid J2
timing trace and three incomplete J3 normal traces; they remain excluded and
visible rather than being retried into the selected result.

The cache candidate was inconclusive. J1 diagnostic second-action response
values were A1 `514/1088/520` ms, B `358/426/590` ms, and A2 `462/556/445`
ms; RSC, auth_total, request-window, and React-commit signals did not show a
repeatable one-direction improvement. The cache wrapper was removed and the
uncached baseline restored. No global freeze root cause, accepted fix, Plan 2
finding, or production decision changed. The inbox projection remains a
separate retained contributing candidate. The DB sampler was unavailable in
that earlier cache run; the subsequent bounded repair is recorded below, and
production remains `NO-GO`.

## Active shared-runtime sampler and journey-validity repair - 2026-09-19

Repair evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_shared-runtime-sampler-validity-repair-20260919T132757Z-d3c7bee6-b396-4d64-9f6c-3576caeed017_EVIDENCE.json`.
Measurement evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-diagnostic-v3-20260919T131930315Z-d3c7bee6-b396-4d64-9f6c-3576caeed017_SHARED_RUNTIME_DIAGNOSTIC_EVIDENCE.json`.

The DB lock sampler repair is complete for the local diagnostic path. It now
uses the configured Docker transport when host `psql` is unavailable, retries
transient failures, requires complete aggregate fields, awaits in-flight work
on stop, and exposes only sanitized status metadata. The shared runner pauses
sampling during its synchronous diagnostic artifact build and resumes it once
the diagnostic server is ready. The resulting run recorded 756 successful
aggregate observations, zero sampler errors, zero lock-wait observations, and
zero blocked-activity observations. These are bounded local observations, not
a proof that session-row contention is absent outside those windows.

The fixed second-action scheduler now waits until its target, and diagnostic
candidate selection requires `observationValidity=VALID`, `validSample=true`,
and `functionalOutcome=SUCCESS`. The run has 12/12 observation-valid units and
9/12 valid functional samples; J1 and J2 succeed, and J3's three
`first_target_abandoned_after_navigation` records remain visible but excluded.
J1 is selected at a 501 ms observed tail, with no early J1/J2 dispatch.

This continuation repairs measurement validity only. It does not establish the
global freeze cause, accept the inbox projection as a production fix, change
any finding disposition, authorize Plan 2, or change production `NO-GO`.
The next separately authorized step is one single-variable A-B-A experiment
for explicit request coalescing or auth-chain ownership, with the other
variable held constant.

## Active shared-runtime request-coalescing result - 2026-09-19

The separately authorized local Docker continuation completed the request-
coalescing A1 -> B -> A2 experiment. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-request-coalescing-ab-a-20260919T141815Z-2bf54fb2-080c-4470-a920-05ebc5f5b7ab_EVIDENCE.json`.
The variable was limited to same-key in-flight `/api/shell/bootstrap` GET
coalescing in `app/src/components/dashboard/shell-provider.tsx`.
`app-state`, inbox, messaging, auth/session, RSC, and React tree behavior were
not changed. Selected J1 diagnostic validity and functional success were 3/3 in
each of A1, B, and A2.

The targeted bootstrap duplication decreased in all three B repetitions:
A1 `7/7/7`, B `5/5/6`, A2 `7/7/7`. Total request fan-out, second-action tail,
and React commit measurements had no stable speed direction. The candidate is
therefore a bounded bootstrap request-fanout contributor with speed
`INCONCLUSIVE`; it does not confirm the global freeze thesis or solve the
performance problem. The B patch was removed and the A2 baseline restored.
Plan 1 closure, finding dispositions, Plan 2 eligibility, and production
`NO-GO` remain unchanged. The next separately authorized candidate is
auth-chain ownership only.

## Active shared-runtime auth-chain ownership result - 2026-09-20

The separately authorized local Docker continuation completed an auth-chain
ownership A1 -> B -> A2 experiment. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-auth-ownership-ab-a-20260920T150730Z-c86defe0-6be6-46e9-bd56-a5560d140fa1_EVIDENCE.json`.
The variable was limited to the repeated session-activity assertion in
`app/src/lib/auth-context.ts:resolveAccountTenantContext`; B left the explicit
`/api/session/activity` touch endpoint in place and held all other auth, store,
navigation, RSC, and React paths constant.

B reduced that contained RPC span to approximately zero, but total request,
API request, and RSC counts stayed `53/24/26` in all selected J1 diagnostic
records. Tails were A1 `1147/524/660` ms, B `1196/1395/1234` ms, and A2
`622/1534/552` ms. The result is `COMPLETE /
AUTH_SESSION_ACTIVITY_ASSERT_REMOVAL_NO_REPEATABLE_SPEED_IMPROVEMENT_GLOBAL_FREEZE_UNRESOLVED`.
B was removed, A2 baseline restored, and the A2 sampler's one sample error is
retained as `PARTIAL`. No finding disposition, Plan 1 closure, Plan 2 entry,
runtime-fix acceptance, or production decision changed.

## Active shared-runtime first-three-stage localization - 2026-09-20

The authorized first three diagnostic stages are complete. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-localization-v1-20260920T160215Z-7f672bcb-8f49-4b20-bc11-c26c578f7021_EVIDENCE.json`.
The underlying runner record is the local Docker run
`aiya-performance-plan1-shared-runtime-diagnostic-v3-20260920T155027577Z-280f2120-5abd-41d8-b093-74615eba9cc1`.

The connection check confirms that the runner overrode the test server's
Supabase target to `http://127.0.0.1:54321`; the hosted target present in the
active environment file was not measured. No Z.ai, WhatsApp, Telegram, or
Stripe-like route was observed. The run completed 12/12 observation-valid
units, with 3/3 selected J1 diagnostic traces functionally successful.

In all three selected traces the required
`/api/clients/:clientId/food-rule-profile` read completed with status 200. Its
response-header latency was `312/320/395` ms, diagnostic route timing was
`295.65/302.13/375.75` ms, and body-finish-to-ready was `129/163/144` ms.
The same traces recorded `53` total requests, `24` API requests, and
`241/245/360` overlapping-request observations. This localizes the next
diagnostic boundary to the required read plus the following readiness/React
commit interval; it does not prove a single root cause.

The DB sampler passed with 720 samples and no sampler errors, but recorded two
lock-wait/blocked-activity samples before the second trusted event of J1
repetition 2; zero occurred inside the second-action window. This is not a
global lock conclusion. The diagnostic-only Server-Timing addition in the
food-rule-profile route is not an accepted production fix. Plan 1 remains
`COMPLETE / DIAGNOSIS_BLOCKED`, Plan 2 remains locked, and production remains
`NO-GO`. The next action is one separately authorized single-variable A-B-A
experiment around either read scheduling or post-response state/commit work,
without combining variables.

## Active shared-runtime food-rule-profile A-B-A result - 2026-09-20

The separately authorized local Docker continuation completed the next
single-variable A1 -> B -> A2 experiment. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-food-rule-profile-ab-a-20260920T165844Z-96a93331-d252-4eb5-8474-4a91424bf13f_EVIDENCE.json`.
The only variable was `AIYA_PERF_FOOD_RULE_PROFILE_READ_POLICY`: A used the
broad `loadSupabaseClientOperationState` loader and B used the narrow
client/form/profile loader for the `food-rule-profile` route. The selected J1
diagnostic traces were 3/3 valid and successful in every variant, and all
12/12 observations per run were observation-valid.

B reduced the route's contained server `store` timing in all three repetitions
against both baselines: A1 `113.02/155.97/106.19` ms, B
`40.57/23.94/29.56` ms, and A2 `147.95/104.09/83.68` ms. Request fan-out did
not change: every variant recorded `53` total, `24` API, and `3` document
requests. The user-visible second-action dispatch-to-ready values were A1
`653/1168/1146` ms, B `637/495/625` ms, and A2 `676/609/509` ms, so the
improvement did not return to baseline in a repeatable A-B-A direction. B's
sampler was `PARTIAL` because one aggregate sample errored; no global lock
absence claim is made.

The result confirms a contained local server-cost contributor, not the global
freeze root cause or a performance fix. The narrow branch was process-scoped
only and is not enabled by default. Plan 1 remains `COMPLETE /
DIAGNOSIS_BLOCKED`, finding dispositions and Plan 2 eligibility are unchanged,
and production remains `NO-GO`. The next diagnostic boundary is cross-route
fan-out and React commit ownership, with this loader result retained as a
bounded contributing signal.

## Active shared-runtime dirty-registration commit-ownership A-B-A result - 2026-09-20

The separately authorized local Docker continuation tested the React commit
ownership candidate. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-dirty-registration-ab-a-20260920T193800Z-57dc30c0-54ee-45a7-b69b-7cedb280df42_EVIDENCE.json`.
The only process-scoped variable was
`NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY`: A retained the
legacy `input.onSave` dependency in `useShellDirtyRegistration`; B used the
stable `saveRef` dependency. The profiler, context markers, request tracking,
fixture, auth, route, and local Supabase paths were held constant. A2 restored
legacy behavior and no stable environment variable persisted.

The measured commit ownership reversed sharply. `shell-provider` commits were
A1 `2270/2187/2216`, B `37/34/37`, and A2 `2082/2081/1892`; the corresponding
`dashboard-shell` counts were A1 `2269/2186/2215`, B `36/33/36`, and A2
`2081/2080/1891`. The same reversal appears in diagnostic event volume. This
is strong evidence that the dirty-registration dependency loop is a
high-confidence contributing mechanism for the broad React commit storm.

The evidence does not close the global diagnosis. B J1 repetition 1 failed the
required forms read and is `validSample=false`; only 2/3 selected B J1
diagnostic records are valid and successful, despite the runner aggregate
reporting 12/12 observation-valid. This is intentional runner semantics:
`observationValidity=VALID` records a structurally complete observed failure,
while `validSample=false` excludes it from functional success counts. The
valid B second-action values were `404` and `922` ms, so user-visible speed
did not improve repeatably. A1 and A2 remained at 3/3 valid and successful,
and the accepted legacy traces kept the `53` total / `24` API / `3` document
fan-out. The failed B forms attempt remains visible and is not promoted by
the later successful retry.

The stable policy remains a diagnostic candidate only and is not enabled by
default. Plan 1 remains `COMPLETE / DIAGNOSIS_BLOCKED`, finding dispositions
and Plan 2 eligibility are unchanged, the global freeze is unresolved, and
production remains `NO-GO`. The next exact action is a small validity-repair
or confirmation run for this candidate, followed by separately bounded
request-fan-out and auth/RSC cost localization; no implementation fix is
authorized by this evidence.

## Active dirty-registration validity recheck - 2026-09-20

The stable candidate was repeated under the same runner. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-dirty-registration-validity-recheck-20260920T213200Z-47b48402-c132-4a97-a121-8339aeec8666_EVIDENCE.json`.
All 12 observations were structurally valid, but only `6/12` were valid
functional samples. Every J1 normal repetition retained two `/forms` attempts:
the first failed without status/body completion and the second returned 200.
The runner correctly kept the first failure, so J1 was `0/3` valid samples and
was not selected for diagnostic profiling. J2 was selected instead with `3/3`
valid samples; its low commit counts are not comparable to the J1 storm.

This recheck adds no new J1 profiler confirmation and does not alter the
original A-B-A result. The prior derived record's wording that called the
observation/function separation a “validity gap” is superseded; the actual
remaining limitation is repeated J1 functional failure at the first `/forms`
attempt. No validity rule was weakened, no retry was promoted, no fix was
accepted, and Plan 1 remains `COMPLETE / DIAGNOSIS_BLOCKED` with production
`NO-GO`.

## Active shared-runtime Forms abort lifecycle correlation - 2026-09-21

The lifecycle correlation evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-forms-abort-lifecycle-correlation-20260921T003915496Z-9e7a44a9-ff04-4778-ab50-46118ca2e6c2_EVIDENCE.json`.
Its SHA-256 is
`FCFA4C955375A92442FE16E23887C974CB26E5E25C6CFC0C7A9823BC546324D5`.
The source run is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-diagnostic-v3-20260921T001812103Z-92ab01f4-7c6e-476c-8de3-00f5c3562e38_SHARED_RUNTIME_DIAGNOSTIC_EVIDENCE.json`
with SHA-256
`DC5EF27612AB83B8B6E875584EC429F1056EBC513711959B265F18437C98B6FD`.

Trace-only events from `useStage6ClientWorkspace` correlate the first Forms
fetch's `net::ERR_ABORTED` with effect cleanup and the hook's
`AbortController.abort()` in `2/3` current diagnostic J1 repetitions. The
current normal J1 was `3/3` successful with no first-Forms abort, whereas the
current diagnostic J1 was `2/3` abort/incomplete and `1/3` successful. The
earlier normal run had the same first-Forms abort in `3/3` J1 repetitions;
the current diagnostic J1 also had an aborted Forms RSC request in `3/3`.

The result supports a client-workspace lifecycle cancellation contributor and
an adjacent navigation/state churn boundary, but it is not a stable frequency
result or an exact upstream root-cause proof. No retry was promoted, no
runtime fix was accepted, Plan 1 remains `COMPLETE / DIAGNOSIS_BLOCKED`, Plan 2
eligibility remains zero, and production remains `NO-GO`. The next diagnostic
is sanitized route/history transition capture around the Forms click, followed
by one reversible single-variable J1 confirmation with that transition
isolated; auth-chain, request-coalescing, and runtime-fix variables remain
outside that run.

## Active J1 active-client preference route correlation - 2026-09-21

Supplemental analysis evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-active-client-preference-route-correlation-20260921T085203Z-862ac27d-4543-486f-b1eb-f7d6f6fbce9a_EVIDENCE.json`.
SHA-256:
`1FCF1B8F549D1F8190E35B7DE864F57A284EE07A04F8849FFEADF66C1F30EBE7`.
The corrected trace-only confirmation run is
`aiya-performance-plan1-j1-active-client-preference-confirmation-v1-20260921T084521559Z-7190e356-128a-4c48-b31e-dd8dc2f081ee`
with evidence SHA-256
`4F44B41C6C27F951F39703D554E020643C37BE367FFAEDABF7BEB9AC4DD4CA7F`.

The corrected A-B-A run retained 9/9 observation-valid repetitions and 6/9
valid functional samples: A1 `1/3`, B `2/3`, A2 `3/3`. The B control's exact
`activeClientId` preference gate passed `3/3`, but B still had a post-Forms
summary route and a required Forms abort in `1/3`; A1 had `2/3` and A2 `0/3`.
The control is therefore insufficient and the direction is `INCONCLUSIVE`.
The candidate is narrowed to the shared Stage 6 active-client
activation/navigation boundary, not confirmed as the global freeze cause. The
two earlier protocol attempts remain preserved and excluded as control-setup
invalid.

No finding disposition, Plan 2 eligibility, runtime-fix acceptance, or
production decision changed. The trace-only
`preference_intent_timing_and_completion` diagnostic is complete; its
corrected correlation record is the next active section. It did not identify
a stable abort-producing transition, so no new reversible J1 confirmation is
authorized.

## Active J1 preference intent timing correlation - 2026-09-21

Supplemental analysis evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-preference-intent-timing-correlation-20260921T122539Z-9f2c7d11-2c35-4a54-9f0a-6d4f7f8d9c21_EVIDENCE.json`.
SHA-256:
`C79D40F49BEECEED3D63B64D5DE2FA076070BB11A87E40DE97FBEF4675E84180`.
Source measurement run:
`aiya-performance-plan1-j1-preference-intent-timing-v1-20260921T121916766Z-f12d3401-7014-4de4-a5ec-4845ae3599f2`.
Source evidence SHA-256:
`10771A9CE351910B9AC6C3A3A9D6C5C438E445FD99265A7629BD51FFEA540F76`.

The corrected run retained 3/3 observation-valid and 3/3 valid functional
samples. Every observed preference PATCH was the allowlisted `activeClientId`
intent and completed with HTTP 200, body completion, and settlement. Stage 6
cleanup followed settlement by 32 ms, 28 ms, and 41 ms. Route ordering was not
stable, and no required Forms-request abort occurred; all three Forms requests
completed with HTTP 200. The first two attempts remain preserved and excluded
because of incomplete lifecycle arming and a wrong-channel initial analysis.

This records a normal-path timing relation, not a causal root cause or runtime
fix. The global freeze remains unresolved, no finding disposition changed,
Plan 2 remains unauthorized, and production remains `NO-GO`. The read-only
comparison with the valid abort-producing traces is recorded in the next
active section. A conditional J1 confirmation requires a stable
abort-producing transition and separate authorization.

## Active J1 preference-intent to Forms-abort comparison - 2026-09-21

Supplemental comparison evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-preference-intent-vs-forms-abort-comparison-20260921T123323Z-4b8e1a23-7d41-4c6f-9a52-1e3f7b8c6d90_EVIDENCE.json`.
SHA-256:
`E6A6363B64CEBFFED0BD21E059249521690A62C576728957BC14C6AAC6560838`.

The clean normal preference-timing run measured activeClientId preference
settlement before Stage 6 cleanup in 3/3 samples; cleanup followed 28-41 ms
later and no Forms abort occurred. The previously-valid abort lifecycle
evidence measured Forms effect cleanup followed by `load_aborted` in 2/2
aborting repetitions 7-10 ms later, but those same samples did not capture
preference-intent timing. The comparison cannot establish whether preference
settlement preceded, followed, or caused cleanup in an aborting sample.

The Forms cleanup-to-abort boundary remains a contributing candidate already
recorded by lifecycle evidence; the preference-to-abort link and global freeze
cause remain unproven. No finding disposition, Plan 2 eligibility, runtime-fix
acceptance, or production decision changed. The matched diagnostic capture is
complete; its result is recorded in the next active section. No duplicate
preference-only confirmation is authorized.

## Active matched J1 preference-intent and Forms-abort capture - 2026-09-21

Matched-run analysis evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-preference-intent-abort-matched-analysis-20260921T124727Z-9c4e2b71-6a8d-4f53-b102-7e9c3d5a8f24_EVIDENCE.json`.
SHA-256:
`5A10F87B4B0A80B2C424370D489FF795DE8097A498B202DD5D33848C21A28373`.
Measurement evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-preference-intent-abort-matched-v1-20260921T124313022Z-ccf40f62-de85-4c5f-8b1b-2fec306e04b3_EVIDENCE.json`.
SHA-256:
`7A8221FA03912A76EA7D16D0DAB0DBBFCE05BADF0432149AA5B0F2A224381C1D`.

The diagnostic matched contract retained 3/3 observation-valid and 3/3 valid
functional samples. Every preference PATCH was an allowlisted `activeClientId`
intent and completed with HTTP 200/body completion/settlement. Stage 6 cleanup
followed settlement by 39 ms, 24 ms, and 53 ms. Required Forms requests were
HTTP 200 in all three samples; abort was `0/3`.

Same-trace measurement coverage is valid, but the historical abort was not
reproduced. This does not establish the preference-to-abort link or resolve the
global freeze. The next governed work is trigger isolation for a reproducible
route/state transition that produces the historical Forms abort; a duplicate
matched run requires separate authorization.

## Active J1 Stage 6 route-state trigger isolation - 2026-09-21

The route-state-complete measurement evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-stage6-trigger-isolation-v1-20260921T131319461Z-fe4a8d23-adf5-40cc-b731-0c512f76cb81_EVIDENCE.json`.
SHA-256:
`204E7892DC010E3EC0E0ED4C7432B90303D287E961850AE71296A9FF7A041925`.
The analysis evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-stage6-trigger-isolation-analysis-20260921T131935Z-e026a6cf-2f81-4bdd-82c2-c0dfefb19c31_EVIDENCE.json`.
SHA-256:
`8FA31BE6AC891A97D2FE41FDDA8FA5560C9A6CA089319BAD907107C0359BB070`.

The continuation captured only `pathname`, `section`, `clientTask`, and
`hasClientId` at Stage 6 setup, cleanup, and load events. It retained 3/3
observation-valid and 3/3 successful functional J1 samples, with complete
route-state capture in 3/3 and Forms abort in `0/3`. All three current setup
sequences were `summary -> forms -> nutrition`.

The historical lifecycle evidence had an extra
`summary -> forms -> summary -> forms -> nutrition` setup sequence in both
aborting repetitions, while the non-aborting repetition had
`summary -> forms -> nutrition`. This makes the extra summary re-entry a
useful candidate association, not a confirmed trigger: the historical records
do not contain the new route-state fields, the current run reproduced no abort,
and only two historical abort matches exist. No speed causal comparison was
run; performance remains `NOT_EVALUABLE`.

The capture is complete, but the diagnosis remains blocked. No finding
disposition, Plan 2 eligibility, runtime-fix acceptance, or production decision
changed. Do not repeat the same matched run automatically. Any further work
requires a separately authorized, reversible, single-variable confirmation of
only the extra summary re-entry boundary, with functional outcome and
second-action speed reported independently.

## Active J1 summary-reentry settlement confirmation - 2026-09-21

The controlled A1 -> B -> A2 measurement evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-summary-reentry-settlement-confirmation-v1-20260921T134112924Z-a9f02392-5f1a-4359-861c-f94bebba8d58_EVIDENCE.json`.
SHA-256:
`EA0DA0728A8BDFAF39F3C21FD76FB9679051266BD1F81E0C200F55641DEB3C33`.
The analysis evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-summary-reentry-settlement-confirmation-analysis-20260921T134721Z-e9c0f0c1-7b7d-4c6a-9d54-2f0a1e8b6c3d_EVIDENCE.json`.
SHA-256:
`E832AE24BEF0FB4823672E886C98E6D51A64C3301E09DD595A74ACFD4A0FFEAC`.

This separately authorized diagnostic changed one harness variable only:
group B waited for the initial client-selection `summary` request to settle
before dispatching Forms; A1 and A2 retained the existing timing. The gate
passed in 3/3 B samples, each settling as `request_failed`. All 9/9 samples
were observation-valid and functionally successful. Post-Forms summary
re-entry was `0/3` in A1, B, and A2; Forms request abort was also `0/3` in all
groups, and Forms lifecycle abort was `0/3` in B.

The historical boundary was therefore not reproduced and the single-variable
confirmation is `INCONCLUSIVE`. Second-action tails were captured separately
but remain `NOT_EVALUABLE` for performance acceptance because this was a
diagnostic run. No finding disposition, Plan 2 eligibility, runtime-fix
acceptance, or production `NO-GO` decision changed. Do not repeat this same
settlement-gated run automatically; global diagnosis remains blocked.

## Active shared-runtime auth/fan-out/React commit overlap analysis - 2026-09-21

The analysis-only evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-shared-runtime-auth-fanout-commit-overlap-v1-20260921T141433347Z-5146b711-7709-41be-a5a7-c606ead3922c_EVIDENCE.json`.
SHA-256:
`27E93792B03C46BF873D34D803A552016CE0D8AADC363D85BAA00DE0340FD40F`.
The analysis runner is
`app/scripts/performance-plan-1-shared-runtime-auth-fanout-commit-overlap.mjs`.
Its SHA-256 is
`DD9AB4ABADD3E84DFFED670259E3BE3EBBE45BE13D84D7EB1087C99843E4D715`.
The focused pure tests passed 2/2 with
`npm.cmd exec vitest run scripts/performance-plan-1-shared-runtime-auth-fanout-commit-overlap.test.mjs`.

This analysis reused one completed local-normal shared-runtime measurement. It
did not rerun the browser, change application runtime behavior, start an
official measurement, or run a causal experiment. The source evidence matched
the current app runtime hashes 15/15. Across 3/3 valid functional J1 traces,
the first trusted interaction through the second trusted interaction contained
7/10/10 API requests and 9/13/13 RSC requests. The second-action window
contained 2/2/2 API requests and 1/1/1 RSC request; distinct React commit waves
were 44/40/29, with second-action tails of 443/511/422 ms.

The result is `COMPLETE / AUTH_FANOUT_COMMIT_OVERLAP_OBSERVED_AUTH_COVERAGE_INCOMPLETE_GLOBAL_FREEZE_UNRESOLVED`.
Available auth Server-Timing covered only 2/3/4 APIs (28.6%/30%/40%); most
API routes and all RSC/document auth paths in these traces were not timed.
Auth-span placement is an explicitly labeled inference from request start plus
duration. The evidence therefore supports request fan-out and React commit-wave
co-occurrence, but does not prove that every API pays the full auth chain and
does not establish causality or resolve the global freeze. Plan 1 closure,
finding disposition, Plan 2 eligibility, runtime-fix acceptance, and
production `NO-GO` are unchanged.

Next exact action: separately authorize diagnostic-only timing coverage for the
currently uninstrumented shared API routes and one bounded server-side marker
for dashboard RSC auth, then run one current-source J1 capture. Do not change
auth behavior or treat the result as an official acceptance run.

## Active shared-runtime auth coverage capture - 2026-09-21

The separately authorized trace-only capture is recorded at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-shared-runtime-auth-coverage-v1-20260921T153517537Z-2e376ebf-fde3-4868-96bc-6413fcd0a6e5_EVIDENCE.json`.
Its SHA-256 is
`A343FF1BD61B423705DCB478DA46E35F5605B6093FFEE3056468F05D323A4968`.
The runner is
`app/scripts/performance-plan-1-j1-shared-runtime-auth-coverage.mjs` with
SHA-256
`49511444070D76970661E82D78AF4CA4E07409A3C3569FC44B812643E20A45A9`.

The current-source local J1 capture was `1/1` observation-valid,
functionally successful, diagnostic-only, and not an official sample. The
checkpoint was completed by the browser capture; the evidence file was later
reconstructed from that completed checkpoint after metadata and identifier
redaction corrections, without rerunning the browser. The local preflight was
`PASS` against Docker Supabase at `127.0.0.1:54321`.

The trace contained 24 API request records, of which 15 completed with
diagnostic auth timing. Added route coverage was: conversations `1/2` timed
responses, alerts `2/2`, notifications `2/2`, shell preferences `1/1`, client
Forms `1/1`, and client detail `0/1` because that request aborted before a
response. Two bounded server-provided RSC auth markers were observed, one for
the dashboard layout and one for the page. The result is
`COMPLETE / SHARED_API_AUTH_COVERAGE_PARTIAL_RSC_MARKER_OBSERVED`.

This narrows the measurement gap but does not establish complete per-request
auth coverage, repeatability, causality, or the global-freeze root cause. No
auth behavior, navigation behavior, runtime fix, finding disposition, Plan 2
eligibility, or production decision changed; production remains `NO-GO`.
The next exact action is review of this single trace and the aborted
client-detail boundary. Any repeat requires separate authorization.

## Active client-detail abort boundary correlation - 2026-09-21

The read-only correlation evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-client-detail-abort-boundary-analysis-v1-20260921T160221659Z_EVIDENCE.json`.
Its SHA-256 is
`6310254DBEFF751530AFABD8C210C4C6136A37B0DDC8AA1BBAF0CDB84D65CB19`.
The analysis runner is
`app/scripts/performance-plan-1-j1-client-detail-abort-boundary-analysis.mjs`
with SHA-256
`C81A7B656A6F7D6479C609922996D097BB988A0A85AE95D19ECF66FA222F9397`.

This analysis consumed the completed auth-coverage checkpoint and did not
rerun the browser, start a server, change runtime behavior, or begin an
official or causal run. The one client-detail GET had no response timing. The
same trace recorded the route sequence `selected client -> summary -> forms ->
nutrition`; Stage 6 events recorded summary effect cleanup, Forms effect setup,
and summary load abort during the summary-to-Forms transition. The hook source
explicitly aborts its active `AbortController` during effect cleanup when the
workspace domain changes.

The result is
`COMPLETE / CLIENT_DETAIL_ABORT_CORRELATED_WITH_STAGE6_DOMAIN_SWITCH_CLEANUP`.
This narrows the boundary to client-side cancellation and explains why the
aborted request has no Server-Timing, but it does not prove that the expected
transition is premature, that server work continues after cancellation, or
that it causes the global freeze. Plan 1 closure, finding disposition, Plan 2
eligibility, runtime-fix acceptance, and production `NO-GO` remain unchanged.
Do not repeat automatically; a server-completion marker requires separate
authorization.

## Active J1 second-action timeline alignment - 2026-09-21

Read-only analysis evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-second-action-timeline-analysis-v1-20260921T170813873Z_EVIDENCE.json`.
SHA-256:
`B04435F498184EC20A0DEF0A68985CB6CF96894BB7FD25264B7918C829C9F447`.
Runner:
`app/scripts/performance-plan-1-j1-second-action-timeline-analysis.mjs`.
Runner SHA-256:
`A5D899A94D9FD41C04439EB43D0D2545CD1FDE5089EB493E5A65C261FBBF2BE3`.
Focused pure tests: `2/2 PASS`.

The analysis reused the one completed current-source J1 auth-coverage trace;
it did not rerun the browser, start a server, change runtime behavior, start
an official sample, or run a causal experiment. The second trusted click to
ready was `1,045 ms`: `585 ms` to the required response header, `593 ms` to
the required body boundary, and `452 ms` from body completion to ready. Three
requests overlapped in that window: two API and one RSC. The required read
reported `auth_total=341.36 ms`, `store=167.49 ms`, `route=542.99 ms`; the
concurrent bootstrap reported `auth_total=338.36 ms`, `rate_limit=101.7 ms`,
`route=560.94 ms`.

Two shell context commits and Stage 6 lifecycle events occurred in the
body-to-ready tail. React profiler commits were not observed in the window or
full trace, and long tasks were `0` inside the window; the first `60 ms` task
started `38.1 ms` after ready. Request-summary versus action-boundary timing
differences of `22 ms` at request start and `7 ms` at completion remain
explicit evidence gaps.

Outcome:
`COMPLETE / NETWORK_SERVER_FIRST_WITH_CONTEXT_TAIL_MAIN_THREAD_CAUSE_UNRESOLVED`.
This narrows the next controlled comparison to required-read/server scheduling
versus post-response state/commit scheduling. It does not establish a global
freeze cause or an accepted fix; Plan 1 remains `COMPLETE / DIAGNOSIS_BLOCKED`,
Plan 2 eligibility remains zero, and production remains `NO-GO`. The next
comparison must hold request fan-out and the other boundary constant.

## Active J1 post-response commit ownership A-B-A candidate - 2026-09-21

The separately authorized current-source local diagnostic evidence is
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-post-response-commit-ownership-ab-a-v1-20260921T185539646Z-b4ef5bf1-8927-4107-af0d-a6867406050b_EVIDENCE.json`
with SHA-256
`153C70F8254DCB474B94F1F82211880009F70840219E9D342AE91A87973B3CCA`.
Runner:
`app/scripts/performance-plan-1-j1-post-response-commit-ownership-ab-a.mjs`,
SHA-256
`AE1F95FAB8AF66570018D37EA5FCA37A1E0266FBA36B99E609A9A4612B76B52A`;
focused tests: `2/2 PASS`.

This was a process-scoped comparison of only
`shell_dirty_registration_policy` (A1 legacy -> B stable `saveRef` -> A2
legacy). The J1 journey, real local auth/RLS/store path, request contract,
required-read gate, synthetic fixture, and second-action boundary were held
constant. The run attempted `9/9`, completed a 37-event checkpoint with a
valid hash chain, and did not start official measurement or change runtime
defaults. A1/A2 were `3/3` valid functional; B was observation-valid `3/3`
but functionally valid `2/3` because repetition 3 failed the Forms required
read. No retry was promoted.

The two fully valid paired repetitions show B shell/dashboard commits of
`35/34` versus A1 `1986/1851` and A2 `2020/2908`, which is a strong diagnostic
commit-ownership signal. The strict three-valid-record gate was not met,
request fan-out was not invariant (`53/53/53` in repetition 1 versus
`53/56/56` in repetition 2), and B was slower at trusted-click-to-ready
(`966/931 ms` versus A1 `527/607 ms` and A2 `1048/522 ms`). Outcome:
`COMPLETE / POST_RESPONSE_COMMIT_OWNERSHIP_SIGNAL_OBSERVED_VALIDITY_OR_FANOUT_BOUNDARY_OPEN`.
This does not confirm the global-freeze root cause, accept a runtime fix,
change dispositions, authorize Plan 2, or change production `NO-GO`.
The initial unsupported-trace-variant runner attempt remains separate and
excluded as harness-invalid. Do not repeat this same A-B-A automatically; the
next eligible diagnostic must first isolate the B required-read/fan-out
validity boundary while keeping fan-out controlled.

## Active J1 post-response commit fan-out/validity analysis - 2026-09-22

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-post-response-commit-fanout-validity-analysis-v1-20260921T224944702Z_EVIDENCE.json`;
SHA-256
`8D2F46DFBD478C350EE254135DF6A2A0AD8D416CDB5FB6B21F17CA5C9F891D8D`.
This read-only analysis reused the completed J1 checkpoint and did not start a
browser/server or change runtime behavior. B `r3` had an aborted,
body-incomplete first Forms record followed by a completed second Forms record;
the all-matching-record validator kept the unit invalid. The same trace had
`60` total / `31` API requests versus `53` / `24` in both matched legacy rows,
including extra bootstrap, client-summary, Forms, alerts, notifications, and
conversations requests. Stage 6 showed a Forms setup/start restart and one
Forms abort.

Outcome:
`COMPLETE / B_REQUIRED_READ_ABORT_AND_FANOUT_CONFOUND_OBSERVED_COMMIT_COMPARISON_OPEN`.
B remains `2/3` eligible functional and the strict three-valid-record gate is
not met. No root cause, runtime fix, disposition, Plan 2 entry, or production
decision changed; production remains `NO-GO`. The next diagnostic is a distinct
controlled capture with one completed Forms read and a predeclared route-count
fan-out envelope; the same A-B-A must not be repeated automatically.

## Active J1 legacy fan-out envelope baseline - 2026-09-22

The distinct local control capture is complete. Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-fanout-envelope-baseline-v1-20260922T000153108Z-df90576e-8f10-4162-bf26-2916efbe1289_EVIDENCE.json`;
SHA-256
`FC2FD67BC365691E30B7037E2B1985398DA3FEDDB827A24A78665751D178C94C`.

Legacy shell-dirty-registration behavior was held constant over the
local-normal synthetic fixture and local Supabase. J1 completed 3/3
observation-valid and 3/3 functionally valid repetitions. Each trace had one
completed Forms read and one completed Nutrition read; Forms setup/start/
success was `1/1/1` with zero aborts or restarts. The request envelope passed
3/3: `56/27/3/26` in the first repetition and `53/24/3/26` in the second and
third, expressed as total/API/document/RSC requests. All declared route-count
limits passed.

This is a diagnostic control boundary, outside the official acceptance
baseline. A first build attempt is preserved as `BLOCKED`; its evidence
records `outputRecorded=false` before browser capture. A follow-up
same-command local diagnostic identified `EPERM` in the OneDrive-backed
default `.next` cleanup, so the runner now uses a run-scoped diagnostic
`distDir`. No application runtime behavior changed. The result does not
confirm the auth chain, React commit fan-out, or the global freeze cause, and
production remains `NO-GO`.
The next exact action is one separately identified single-variable candidate
capture with this envelope and lifecycle gate held constant.

## Active J1 post-response commit envelope A-B-A candidate - 2026-09-22

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-post-response-commit-envelope-ab-a-v1-20260922T082334317Z-c732dc73-de03-43b6-8881-a4880cbf977a_EVIDENCE.json`;
SHA-256
`DDD880A087A9F42407967C969A97B00F5C69152C0D5D77C878AAFB2C474C5CED`.

This distinct diagnostic changed only `shell_dirty_registration_policy` across
A1 legacy -> B stable -> A2 legacy while holding the current J1 envelope and
Forms lifecycle gate. All 9/9 attempts were observation-valid; eligible rows
were A1 `3/3`, B `2/3`, and A2 `3/3`. B r2 recorded `57/28/3/26` requests,
two Forms records with one incomplete, Forms setup/start `2/2`, one success,
and one abort, so the fan-out and lifecycle gates failed together. No
repetition had an exact full route-shape match across A1/B/A2.

The two eligible B rows showed shell-provider commits `36` and `31` versus
the corresponding legacy rows, but the strict causal gate remained open and
the result is classified
`POST_RESPONSE_COMMIT_ENVELOPE_VALIDITY_OPEN_GLOBAL_FREEZE_UNRESOLVED`.
The first harness-invalid attempt is retained separately and excluded. No
runtime fix, finding disposition, Plan 2 entry, or production decision
changed; production remains `NO-GO`.

Next exact action: do not repeat this A-B-A automatically. A separately
authorized continuation must control the stable-policy Forms/fan-out
divergence and obtain 3/3 eligible A1/B/A2 repetitions with exact
per-repetition fan-out equality before interpreting commit ownership.

## Active Plan 1 v3 capture probe - 2026-09-17

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase4-4-local-v3-20260917T073613059Z-e2c3495a-ed74-4eb5-9982-f842efe3c1b8_EVIDENCE.json`.
The run is `IN_PROGRESS / LOCAL_CAPTURE_PROBE_COMPLETE`: one of one J1
observation is valid and one of one functional probe succeeded. The fixed
2,000 ms second action is anchored to the trusted Forms click; both required
J1 reads are 2xx/body-finished and the expected preferences PATCH succeeded.
Stages 4.4.1 and 4.4.2 are PASS in this probe; the subsequent normal run and
reconciliation below complete 4.4.3 and 4.4.4. Performance is
`NOT_EVALUABLE`, and no cause or accepted runtime remediation is claimed. The
scoped normal observations were collected under the same capture contract.

## Active Plan 1 v3 normal observations - 2026-09-17

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase4-4-local-v3-20260917T122335537Z-874d0bea-3ff7-4a24-a5d4-6778c44eef1a_EVIDENCE.json`.
The run is `IN_PROGRESS / LOCAL_OBSERVATIONS_RECONCILED`: all 9/9 normal
observations are observation-valid and 6/9 are successful functional samples.
J1/J2 are 6/6 successful. J3 is 3/3 validly observed as the first target
being abandoned after Dashboard navigation while the second target became
ready. Stage 4.4.3 and 4.4.4 are `COMPLETE`; reconciliation passed trace
integrity, failure-boundary consistency, and request-lifecycle retention.
Performance remains `NOT_EVALUABLE`; no root cause or runtime fix is claimed.

## Active Plan 1 v3 environment observations - 2026-09-17

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase4-5-4-6-v3-20260917T121116968Z-2ec41db5-f1df-4ace-8a20-b71a41f259c2_ENVIRONMENT_EVIDENCE.json`.
The user explicitly reopened 4.5/4.6 after the physical device became
available. Hosted, Android Chrome, and installed Android PWA each completed
9/9 observation-valid units, for 27/27 overall and 17/27 valid functional
samples. The functional outcome mix is hosted 8 successful/1 incomplete,
Android Chrome 3 successful/5 failed/1 incomplete, and PWA 6 successful/3
failed. Both stages are `COMPLETE / ENVIRONMENT_OBSERVATIONS_CAPTURED` for
diagnostic coverage only. Performance is `NOT_EVALUABLE`, official measurement
has not started, and no root cause or runtime fix is claimed.
A later retry under a temporary behavior-neutral runner cleanup ended
`BLOCKED` on Android/PWA observation completeness. The cleanup was restored to
the completed run's runner identity; the retry remains a separate failed
record and is not merged into the valid environment counts.

## Active Plan 1 v3 Phase 4.7 reconciliation - 2026-09-17

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase4-7-reconciliation-v3-20260917T130007581Z-b5e2fa96-bdfd-4535-833d-71169d3982cf_PHASE_4_7_RECONCILIATION_EVIDENCE.json`.
Stage 4.7 is `COMPLETE / DIAGNOSIS_BLOCKED`. The reconciliation covers 36/36
observation-valid units and 23 valid functional samples: 23 successful,
5 incomplete, and 8 failed. Every observation is mapped to the locked finding
set: J1 to `PERF-F2-001`, J2 to `PERF-F2-002`, and J3 to `PERF-F2-003`.
`PERF-F12-001` and `PERF-F12-002` were not exercised; all five dispositions
remain unchanged. Required environment outcomes, mapping, manifest,
redaction, and source identity checks passed. No common-layer delay with a
known accepted timing boundary was established, so performance is
`NOT_EVALUABLE`; 4.7 alone did not establish a causal result, runtime fix, or
Plan 2 entry. The first 4.7 identity-invalid attempt is preserved separately
and excluded from the current result.

## Active Plan 1 v3 Phase 5.1 hypothesis ordering - 2026-09-17

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-1-hypothesis-ordering-v3-20260917T131152166Z-9ddcc5f6-1e16-4ced-83e0-8d028cf17d6f_PHASE_5_1_HYPOTHESIS_EVIDENCE.json`.
Stage 5.1 is `COMPLETE / HYPOTHESES_PRE_REGISTERED`. The four candidates are
ordered as shared shell/app-state hydration fan-out, background polling
overlap, dashboard bundle/import/render work, and warm AI Chat
auth/store/readiness. The first three remain provisional and unmeasured; the
AI Chat candidate is deferred until a dedicated journey exercises it. No
candidate is a confirmed cause or accepted optimization.

## Active Plan 1 v3 Phase 5.2 single-variable experiment - 2026-09-17

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-2-single-variable-experiment-v3-20260917T134123969Z-21e8c635-0129-4a48-aca8-45831367a057_PHASE_5_2_SINGLE_VARIABLE_EVIDENCE.json`.
The stage is `COMPLETE / REPEATABLE_PROVISIONAL_EFFECT`. The local desktop
experiment tested only H-5.1-001 with the trace-only A/B variable
`shared_read_start_policy` and three matched A-before -> B -> A-after cycles.
All 9/9 traces were observation-valid; B was slower at route-commit to target
ready by 28.5 ms, 292.5 ms, and 89 ms across the three cycles. This does not
confirm a root cause, change any finding disposition, establish an official
baseline, or accept a runtime fix. Required shell/app-state/client boundaries
were observed; unrelated request tracking still reached its bounded body-finish
deadline and is retained as a diagnostic limitation. The first trusted-click
invalid run remains separate and excluded. At the time of that Phase 5.2
record, the next eligible stage was 5.4 applicable safety and behavior
checks; the current 5.4 result is recorded below. Plan 2 and production work
remain locked.

## Active Plan 1 v3 Phase 5.3 layer attribution - 2026-09-17

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-3-layer-attribution-v3-20260917T190703732Z-380aeab1-c2ff-4dd5-a42c-54988706de3b_PHASE_5_3_LAYER_ATTRIBUTION_EVIDENCE.json`.
The stage is `COMPLETE / LAYER_ATTRIBUTION_INCONCLUSIVE`. It is an analysis-
only reuse of the valid Phase 5.2 input: all 9/9 traces and three matched
cycles were retained, with no new measurement, runtime variable, or
checkpoint. App-state store/route and downstream hydration/readiness are
provisional co-moving signals, not a confirmed cause. DNS/TLS and service
worker were not exercised; auth was not independently separated; capability/
RLS and release identity were controls; response-body finish was not dominant;
JSON was small; the read-start boundary was not attributed; and the ancillary
unrelated-request body-finish deadline remains visible. No finding disposition,
runtime fix, official baseline, or production decision changed. The 5.4
safety and behavior gate is now complete, including the required local runtime
RLS boundary; the next active stage is 5.5.

## Active Plan 1 v3 Phase 5.4 safety and behavior checks - 2026-09-17

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-4-safety-behavior-v3-20260917T192500000Z-7e539b27-1e6f-4c7c-91ac-1e5d6cf83ca4_PHASE_5_4_SAFETY_BEHAVIOR_EVIDENCE.json`.
The stage is `COMPLETE / SAFETY_BEHAVIOR_CHECKS_COMPLETE`. The safe local
matrix passed 21/21 focused files and 164/164 tests, including auth/session,
tenant/capability, freshness/late-response, mutation revision/conflict/
idempotency, and offline/privacy/reconnect contracts. The real local
cross-user/RLS integration boundary at `127.0.0.1:54321` also passed 1/1 file
and 56/56 tests with no failed or skipped tests. The runner obtains local
credentials only in the child process and does not write `.env.local`. No new
measurement, runtime fix, checkpoint, database reset, migration, provider
traffic, or finding-disposition change occurred before Phase 5.5. The H-5.1-002
candidate loop is recorded below; Plan 2 remains locked.

## Active Plan 1 v3 Phase 5.5 H-5.1-002 candidate loop - 2026-09-18

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-5-candidate-loop-v3-20260918T075150094Z-57b04620-bf53-4c9b-a368-aadc829272b2_EVIDENCE.json`.
The stage is `COMPLETE / INCONCLUSIVE`. The trace-only
`foreground_polling_policy` variable was exercised in three matched local
desktop A-before -> B -> A-after cycles. All 9/9 traces were observation-valid,
but the directions were `B_SLOWER`, `B_FASTER`, and `B_SLOWER`; no repeatable
effect, cause, or accepted optimization was established. B navigation-window
pause/cancel behavior was observed in all three cycles, while the raw
lifecycle body-capture timeout remained a separate diagnostic field. Four
earlier invalid or interrupted attempts are preserved under separate run
identities and excluded from this result. The checkpoint closed with 26 events
and a valid hash chain; no finding disposition changed, no official baseline
started, and no runtime fix was accepted. The next supported candidate was
H-5.1-003, whose latest run is recorded below. Production remains NO-GO.

## Active Plan 1 v3 Phase 5.5 H-5.1-003 candidate loop - 2026-09-18

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-5-candidate-loop-v3-20260918T094941316Z-2e94ad8b-d576-4fa5-9bc0-ddf5c62f673d_EVIDENCE.json`.
The latest run is `COMPLETE / REPEATABLE_PROVISIONAL_EFFECT`: the trace-only
`target_panel_loading` variable compared the eager and separately built
dynamic MessagingPanel paths in three matched local desktop A-before -> B ->
A-after cycles. All 9/9 traces were observation-valid; B was slower at
route-commit to target-ready by `+842 ms`, `+297 ms`, and `+356 ms`, and all B
traces observed the dynamic import and panel mount. This is provisional
diagnostic evidence, not a confirmed cause, accepted optimization, official
baseline, or Plan 2 authorization. The first same-candidate run is preserved
as inconclusive because the B build still used the eager wrapper; the second
is preserved as blocked with 6/9 valid traces after the corrected dynamic
build exposed a runner-boundary issue. Neither is merged into the latest run.
The checkpoint has 26 events and a valid hash chain; no finding disposition
changed during that measurement. The subsequent 5.6 review is recorded at
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-6-finding-disposition-review-v3-20260918T123600Z-aae55ab8-db06-40b5-9d56-8c2de6bbb5e7_EVIDENCE.json`.

## Active Plan 1 v3 Phase 5.6 finding dispositions - 2026-09-18

The offline review is `COMPLETE / FINDING_DISPOSITIONS_REVIEWED`. It assigned
`PERF-F2-001`, `PERF-F2-002`, and `PERF-F2-003` to `INCONCLUSIVE` because the
available provisional effects did not isolate an exact current cause or
contributor. It assigned `PERF-F12-001` and `PERF-F12-002` to `OPEN_BLOCKED`
because the required authenticated AI Chat readiness evidence was not
available. No runtime, checkpoint, official baseline, Plan 2 entry, or
production decision changed. The completed Phase 5.7 closure is recorded
below.

Evidence:
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-6-finding-disposition-review-v3-20260918T123600Z-aae55ab8-db06-40b5-9d56-8c2de6bbb5e7_EVIDENCE.json`.

## Active Plan 1 v3 Phase 5.7 Plan 1 closure - 2026-09-18

The closure is `COMPLETE / DIAGNOSIS_BLOCKED` in
`docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-7-plan1-closure-v3-20260918T125452Z-f5305ee2-b35b-43c5-91df-42f313d0da29_EVIDENCE.json`.
Plan 1 is closed for this scoped diagnosis. Its five-entry Plan 2 input is
complete, but `eligibleFindingIds=[]`: F2-001/002/003 remain `INCONCLUSIVE`
and F12-001/002 remain `OPEN_BLOCKED`. No runtime or production action is
authorized. A separately authorized diagnostic continuation for the reported
general desktop interaction delay is required. Use the current main checkout
recorded in the active reconciliation evidence; shared shell, authentication,
state, polling, navigation, and render boundaries remain in scope before any
AI Chat-specific branch.

## Historical status and reference requirements

Dated "current" sections below describe past state. Their next-action and
unconditional sequential gates are superseded for Plan 1 by v3. Retain them
as history and reference, not competing active contracts.

## Current Plan 1 Phase 4.4 continuation result - 2026-09-17

The active Plan 1 contract remains `plan1-final-v2`, and Phase 4.4 remains the
next eligible stage. The local inputs were restored through existing
non-recorded configuration and the authenticated local preflight passed for
the local app and Supabase targets. A controlled DOM check found and corrected
a harness-only responsive-navigation selector defect; the request body-finish
drain was also bounded so incomplete units remain invalid. No runtime change
was accepted.

The latest local run is
`aiya-performance-plan1-phase4-4-local-20260916T232938491Z-c7e89cae-3ff5-4595-ac8f-ed5c3ff9923d`.
It attempted 18/18 units and produced 13 valid and 5 invalid samples. J1
produced 1/6 valid repetitions; the five invalid units reached incomplete
Forms reads or the Nutrition second-action ready boundary under the fixed
2,000 ms overlap. J2 and J3 produced 12/12 valid repetitions. The inbox list
is recorded as a dashboard-hydration preload in J2, and the expected
`/api/shell/preferences` PATCH during client activation is validated as an
allowed successful navigation mutation; other mutations remain forbidden.

This is `BLOCKED / LOCAL_INVALID_SAMPLES`, not a general application root
cause. The three-valid-trace and single-variable causal-experiment criteria
are not met. Phase 4.4 follow-up review is the only next action; Phase 4.5,
Android/PWA work, the official nine-scenario baseline, Plan 2, runtime
remediation, and production operations remain out of scope. Production
remains `NO-GO`.

## Current Plan 1 final revision and Phase 4.4 local reproduction - 2026-09-16

The active Plan 1 contract is now `plan1-final-v2` in
`docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md`. Phase 4.1 completed the plan,
worktree, source, harness, fixture, migration, environment-reference, and
inherited-evidence identity lock in
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_1_EVIDENCE.json` with
`COMPLETE / IDENTITY_LOCKED`. Phase 4.2 completed the historical evidence
review and reference separation in
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_2_EVIDENCE.json` with
`COMPLETE / REFERENCE_SEPARATED`. Phase 4.3 then completed the separate
general interaction diagnosis harness as `COMPLETE /
GENERAL_DIAGNOSTIC_HARNESS_READY` in
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_3_EVIDENCE.json`. The current worktree
remains intentionally dirty and detached at HEAD
`a2b1e0908b29ece40c797aa9c0a5dda0bbb6513a`; no existing change was reset or
overwritten.

Phase 4.4 was then started with the separate local authenticated runner and
recorded `BLOCKED / LOCAL_INPUT_BLOCKED` in
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_4_EVIDENCE.json`. Its checkpoint is
`aiya-performance-plan1-phase4-4-local-20260916T204215189Z-371389ea-10c1-4ec4-9858-cc933c1961c9`.
The local app (`127.0.0.1:3136`) and local Supabase (`127.0.0.1:54321`) were
unreachable, and the process environment did not contain the synthetic
credential inputs; zero of the 18 planned J1-J3 units ran. The active order remains
the final Plan 1 revision: resume 4.4 after restoring those local inputs, then
reconcile the captured traces before considering 4.5. No official baseline,
causal experiment, runtime remediation, hosted change, Android/PWA run, or
production operation was started.

Phase 4.4 remains the current blocked stage. Production remains `NO-GO`.

## Current Plan 1 Phase 4 baseline result - 2026-09-16

The latest canonical run is
`aiya-performance-plan1-phase4-20260915T195604720Z-497a3200-ada3-445d-a2d0-059cb0886940`
and remains `BLOCKED / PERFORMANCE_BLOCKED` with `2/4` valid
environments. Stages 4.1-4.3 completed. Local desktop small/normal and
owner-PC hosted each completed all nine locked scenarios at 20 valid rounds
per scenario; validity and functional checks passed, while speed-budget
FAILs remain reproduction candidates. Android readiness, Chrome launch, CDP,
target-origin verification, and 66 connection-monitor checks passed, but the
Android baseline reached only 17 valid rounds after 28 attempts with 11
discarded and 0 failed attempts. Stage 4.4 is therefore blocked and Stage
4.5 was not run by ordered dependency.

The Android blocker is an incomplete authenticated measurement path, not a
disconnected phone and not causal proof of an application runtime issue.
Discard reasons included repeated AI Chat destination/workspace readiness
timeouts, one required-read failure, one password-login response miss, one
unstable menu-tab click, and one page navigation timeout. The partial
Android data is retained but does not satisfy the 20-valid-sample gate.
The evidence field `closure.reproduced=true` does not establish a root
cause. Plan 2, runtime optimization, deployment, migration, and production
GO remain locked; production remains `NO-GO`.

The run was created by compatible append-only migration from source
`aiya-performance-plan1-phase4-20260915T190010135Z-8a3e9d92-83df-4c0d-8604-41c17109a31e`.
The source remains unchanged; identity and contract checks passed, 141
verified events were copied, 60 committed rounds were preserved, and the
target run recorded `checkpoint.resumed=true` before closing at the
attempt limit.

The current Phase 4 execution is cyclic and durable: each controlled cycle
must follow `DIAGNOSE -> FIX -> VALIDATE -> REMEASURE`; `BLOCKED` closes only
that cycle and keeps the phase open. Three Android diagnostic cycles have
completed with three repetitions each and zero official samples. Their latest
trace shows valid-but-budget-failing AI Chat readiness, one workspace-ready
timeout, delayed More-to-AI-Chat navigation/render completion, and successful
HTTP 200/body-finished conversation reads. This is repeated candidate evidence
but not a causal root-cause proof; the canonical evidence remains blocked at
`2/4` valid environments.

The next eligible action is one-variable causal diagnosis of the Android
More-to-AI-Chat route/navigation/render chain. A harness correction requires
reproducible measurement-defect evidence and compatible continuation; an
application runtime correction requires a causal trace, focused regression
test, and explicit Plan 2/scope authorization. The locked sample contract
must not be loosened and `--new-run` must not be used to bypass it.

## Historical prior Plan 1 Phase 4 baseline result - 2026-09-15

The latest canonical run is
`aiya-performance-plan1-phase4-20260915T130141721Z-6aa263db-c0ff-4192-9333-c20d769f4692`
and remains `BLOCKED / PERFORMANCE_BLOCKED` with `2/4` valid environments.
Stages 4.1-4.3 completed. Local desktop and owner-PC hosted each completed
the locked nine scenarios at 20 valid rounds per scenario, while speed-budget
FAILs remain reproduction candidates. Android ADB/CDP, target-origin, and
target-launch checks passed, but Android Chrome preparation stopped at
`preparation_failed:locator.click: Timeout 8000ms exceeded.` Stage 4.5 was
not run because the ordered Android prerequisite failed. This is an
authenticated Android interaction blocker, not causal proof of an application
performance root cause. No Plan 2, runtime optimization, deploy, migration,
or production change is authorized; production remains `NO-GO`.

The current run was explicitly migrated from the preserved previous blocked
run after hash-chain, fixture, build, schema, and locked-contract checks. The
source run was not modified; 30 completed rounds were preserved and the
unfinished attempt was recorded as `execution_interrupted`. Continue the same
run after targeted Android preparation diagnosis; do not use `--new-run`.

## Historical pre-migration Phase 4 baseline result - 2026-09-15

The prior run stopped after ten small-fixture rounds because the old harness
recorded an unclassified browser-baseline error. Its normal profile had 20/20
valid samples and speed-budget failures. It is preserved as source evidence,
not current baseline authority.

## Current execution-continuity control - 2026-09-15

The shared persistent phase-execution contract is implemented and locally
verified in `docs/PHASE_EXECUTION_RESUME_EVIDENCE.json` and was exercised by
the official continuation. The explicit compatible migration preserved 60
committed rounds, recovered the unfinished work without counting it as a
valid sample, and the resumed run completed local and owner-PC hosted
profiles before reaching the Android limit. This closes only execution
continuity; it does not close a performance finding, establish four-
environment baseline closure, prove a root cause, or change production
`NO-GO`. The Android measurement blocker remains under the existing
authenticated, four-environment, nine-scenario, twenty-valid-sample contract
and locked 28-attempt limit.

## Current Plan 1 Phase 4 Step 3 result - 2026-09-14

The Phase 4 measurement start is now fail-closed behind the readiness
command. `audit:performance:plan1:phase4` runs the same H1-H4 readiness
procedure first, then requires ordered completion, PASS for local/hosted/
physical Android Chrome/installed PWA gates, real hosted authentication and
shell-bootstrap body-finish, `baselineStarted=false`, approved runtime-file
input sourcing, stable local/hosted inputs, and matching source/fixture/
migration/build identity immediately before server start. The readiness build
artifact is reused only after these checks; otherwise the local server and all
20-sample measurement stages are not started.

Readiness run `aiya-phase4-readiness-20260914T184904329Z` and the direct gate
evaluation passed. Targeted Phase 4 tests are `31/31 PASS`, readiness tests are
`10/10 PASS`, typecheck and production build pass, and lint has `0` errors with
`74` existing warnings. `baselineStarted=false`; this implements the startup
binding only and does not create a new baseline, confirm a root cause, or
change the production `NO-GO` decision.

## Current Plan 1 Phase 4 Step 2 result - 2026-09-14

The phone and installed-PWA access step is implemented and evidenced by
readiness run `aiya-phase4-readiness-20260914T184904329Z`. One authorized
physical Android device was found without recording its serial. Chrome
package/launch, CDP forwarding and handshake, explicit Chrome view-intent
launch, normal Chrome hosted-origin target, installed WebAPK
discovery/activity resolution, independent PWA launch, and PWA
origin/standalone/service-worker/online target checks passed. The connection
monitor passed all 13 checks. Local Supabase, Docker, and the local build
passed; H1-H4 and readiness closure are `COMPLETE` with outcome
`READY_FOR_PHASE4_BASELINE`. No Phase 4 baseline was started, and no new
account, VPS, PWA installation, runtime, migration, deploy, provider,
channel, billing, or production change was made.

## Current startup-flow correction - 2026-09-14

Plan 1 Phase 4 now fails closed before a local build or long baseline unless
the approved hosted startup contract is satisfied. The launcher reads only
`.manu-runtime/performance-phase4/hosted.env` from the repository runtime
directory, requires the exact three `AIYA_PHASE4_HOSTED_*` keys, rejects
missing/invalid/symlink files and process/file conflicts, and keeps raw
credentials in memory only. It enforces the approved test-VPS origin, checks
`/api/health/release` for HTTP 200 plus `apiStatus=ok`, then performs real
password authentication and requires the authenticated `/dashboard` shell and
`GET /api/shell/bootstrap` 2xx/body-finished preflight. Any failure blocks the
long measurement before the local build starts.

Readiness run `aiya-phase4-readiness-20260914T184904329Z` verifies the hosted
preflight, local Supabase/Docker/build, physical Android/CDP path, normal
Chrome hosted-origin target, and independent installed-PWA target as `PASS`.
H1-H4 and the ordered readiness closure are `COMPLETE` with
`baselineStarted=false`; this does not create a Phase 4 baseline or causal
performance evidence. The canonical Phase 4 evidence remains the last
pre-correction blocked baseline attempt. Production remains `NO-GO`; no
runtime, schema, deployment, provider/channel, billing, worker, or external
system change was made.

## Historical AIya Plan 1 Phase 4 readiness implementation - 2026-09-13

The approved readiness plan for the first three solution items is implemented
in `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_READINESS_ACTION_PLAN.md` with evidence
in `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_READINESS_EVIDENCE.json`. Requirements
and identity lock (H1) and measurement-harness reliability (H2) are complete;
the Phase 4 harness now requires a real trusted interaction, complete required
reads/body-finish, strict mutation allowlists, propagated sample errors,
percentile budget enforcement, explicit profile/environment status, and
recursive secret redaction.

Local Supabase, Docker, and the local standalone build passed. An approved
synthetic hosted account is prepared on the test VPS and its masked input file
is loaded only into the measurement process. Readiness run
`aiya-phase4-readiness-20260913T175128732Z` reports hosted input/release health,
one authorized physical Android device, and Android Chrome CDP as `PASS`.
H3 remains `BLOCKED` only because no installed standalone AIya PWA target with
active service-worker control was found; H4 and the baseline were not started.
The earlier canonical Phase 4 `BLOCKED / PERFORMANCE_BLOCKED` evidence remains
unchanged, and no new performance baseline or root-cause proof was created.
Production stays `NO-GO`.

Historical readiness authority (2026-09-13; superseded by the 2026-09-14 evidence above): readiness run `aiya-phase4-readiness-20260913T175128732Z` recorded hosted Chrome CDP `PASS`, installed PWA target `BLOCKED`, and `baselineStarted=false`.

Approved non-production hosted synthetic account preparation completed on 2026-09-13 on test VPS `65.21.52.249` with strict SSH host-key verification. Exactly one `aiya-phase4-hosted-*` Auth user has one owner membership and one dietitian profile on the existing active synthetic tenant; password-login returned HTTP 200 and authenticated RLS/store checks passed. Values are stored only in ignored `.manu-runtime/performance-phase4/hosted.env` and are absent from evidence, logs, chat, and Git. No production account, migration, deploy, provider/channel traffic, billing, or worker change was performed.

## Amac

Bu plan, kullanicinin desktop web, mobile web ve kurulu PWA icinde bildirdigi ciddi takilma, gec acilma ve tiklama gecikmelerini once gecerliligi kanitli olcumlerle yakalamak, sonra yalniz kanitlanan kok nedenleri duzeltmek ve son olarak ayni cihaz/oturum kosullarinda kalici kabul dogrulamasi yapmaktir.

Production karari bu planla degismez: `NO-GO`.

## AIya Performans Plani 1 Phase 1 Sonucu - 2026-09-10

`docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md` alt planinin Faz 1 asamalari 1.1-1.5 sirayla tamamlandi ve kapanis kontrolu `PASS` oldu. Local Docker/Supabase erisimi kullanici tarafindan acildiktan sonra yalniz local DB resetlendi. Tum full-rehearsal bayraklari acikken temiz full-repo kosusu 288/288 test dosyasi ve 1726/1726 test ile PASS verdi; failed/skipped yoktur. Evidence: `docs/AIYA_PERFORMANCE_PLAN_1_EVIDENCE.json`; finding manifest: `docs/AIYA_PERFORMANCE_PLAN_1_FINDING_MANIFEST.json`. Bes bulgu ayri disposition kayitlarinda korunmustur; runtime kok nedeni kanitlanmadi ve runtime degisikligi yetkilendirilmedi. Local/upstream `568a1ffba833db0dd182a3d9fad5b034f7cf98e5`, live customer/admin release commit `1c9756046b01cb1bd224fb601ec9094a7f471606` olarak ayri tutuldu. Production `NO-GO` kalir.

Plan 1 Phase 2 tamamlandi ve `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json` icinde `HARNESS_READY_WITH_NEGATIVE_CONTROLS` olarak kaydedildi. Faz 2 harness'i dokuz senaryoyu, cold/warm gecis modlarini, header/body-finish timing ayrimini ve 30 saniye timeout kurali ile 5 saniye/60 saniye gozlem pencerelerini kilitledi. 14 in-process ve 8 localhost HTTP negatif kontrolu PASS oldu. Authenticated baseline, hosted sentetik hesap, fiziksel Android/PWA authenticated capture, kok neden kaniti ve runtime remediasyonu yapilmadi; Plan 1 Faz 3 daha sonra acik kullanici onayi ile baslatildi ve local sentetik auth/store evidence'i ile kapatildi. Tarihsel Faz 1, Faz 1.2 ve eski Revizyon 2 Faz 2/Faz 3 evidence dosyalari yeniden yazilmadi. Production `NO-GO` kalir.

## AIya Performans Plani 1 Phase 2 Sonucu - 2026-09-10

Plan 1 Faz 2 asamalari 2.1-2.5 sirayla tamamlandi. Evidence: `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json`. Harness contract, negative-control matrix, controlled HTTP timing probe, redaction ve unique run identity PASS oldu. Bu kapanis yalnizca gecerli olcum aracinin ve negatif kontrollerin hazir oldugunu kanitlar; kullaniciya ait authenticated oturumda kasmanin yeniden uretildigini veya kok neden bulundugunu kanitlamaz. Production `NO-GO` kalir.

## AIya Performans Plani 1 Phase 3 Sonucu - 2026-09-10

Plan 1 Faz 3 asamalari 3.1-3.6 sirayla tamamlandi. Evidence: `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json`; sonuc `SYNTHETIC_AUTH_STORE_READY`. Local Docker/Supabase hedefi `http://127.0.0.1:54321` olarak kilitlendi, migration/schema kontrolu PASS oldu ve tam DB resetlenmeden yalnizca Phase 3'e ait sabit tenant/auth prefix temizlenip yeniden seed edildi.

Iki local tenantta toplam sekiz sentetik password hesabi kuruldu. Small fixture 3 client ve 20 mesaj; normal fixture 50 client, 20 mesajli ve 200 mesajli iki conversation, toplam 220 mesaj iceriyor. Owner, assistant, viewer assignment ve auditor rolleri; owner cross-tenant izolasyonu, assigned/unassigned client, AI Chat, viewer write block, auditor/anonymous denial ve owner store-read matrisi normal authenticated client ile PASS oldu. Service-role yalniz seed/temizlik ve local session-activity RPC icin kullanildi; demo/fallback auth yolu, hosted hesap, provider/channel egress, fiziksel cihaz/PWA capture, performans baseline'i, kok neden ve runtime remediasyonu yapilmadi. Fixture Phase 4 icin local DB'de birakildi. Production `NO-GO` kalir; sonraki tek uygun adim Plan 1 Faz 4'tur.

## Historical AIya Performans Plani 1 Faz 4 Sonucu - 2026-09-13

Plan 1 Faz 4'un startup-flow correction oncesindeki canonical kosusu `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE.json` icinde `BLOCKED / PERFORMANCE_BLOCKED` olarak korunur (run `aiya-phase4-20260913T093659853Z-8a9ca548-0595-4ea3-9506-0a309a939534`). 4.1 ve local 4.2 tamamlandi; hosted 4.3 login sirasinda 28/28 deneme discard oldugu icin 4.4 ve 4.5 sirali sozlesme geregi `BLOCKED` kaldi. Bu kayit post-correction baseline veya kesin kok neden kaniti degildir.

Ilk tanisal kosuda concurrent session-activity first-touch race'i `23505` ve `503` olarak goruldu; tekrar edilebilir local baseline icin local Supabase'e append-only migration uygulandi. Bu production migration/deploy veya Plan 2 remediation yetkisi degildir. Bu tarihsel kayitta startup input'larinin process'e yuklenmemis olmasi nedeniyle hosted baseline baslatilmadi; 2026-09-14 startup-flow correction bu olcum eksigini gideren preflight kapisini ekledi. Yeni readiness run hosted preflight'i `PASS` kaydetti, fakat Phase 4 baseline'i baslatilmadi. Production `NO-GO` kalir.

## Historical Revizyon 2 Faz 3 Uygulama Sonucu - 2026-09-10

Revizyon 2 Faz 3 baslatildi ve Asama 3.1 aday dondurma kapisinda `PERFORMANCE_BLOCKED` olarak durduruldu. Kanit: `docs/AIYA_PERFORMANCE_PHASE_3_EVIDENCE.json`. Mevcut aday HEAD `887865c8b24c546d128d16f4e284cb8b542dd366` olarak kaydedildi; aday release identity hesaplandi, ancak aday artifact'i uretilmedi.

Faz 2 evidence'i `PERFORMANCE_BLOCKED` oldugu icin Faz 3 yerel kapanis on kosulu saglanmadi. Hosted synthetic hesap/fixture, hosted apply ve rollback icin gereken ayri onaylar yoktur. ADB su an cihaz gostermedigi icin fiziksel Android Chrome/PWA kabul kaydi da yoktur. Asama 3.2-3.8 plan geregi baslatilmadi; runtime, CI, schema, deploy ve dis sistem degisikligi yapilmadi. Production karari `NO-GO` kalir.

## Historical Revizyon 2 Faz 2 Uygulama Sonucu - 2026-09-10

Faz 2 uygulamasi `docs/AIYA_PERFORMANCE_PHASE_2_EVIDENCE.json` icinde `PERFORMANCE_BLOCKED` olarak kaydedildi. Yeni harness `app/scripts/measure-aiya-performance-phase-2.mjs` ve testi `app/scripts/performance-phase-2.test.mjs` eklendi; `npm run test:performance-phase2` 7/7 PASS verdi. `npm run audit:performance:phase2` kaniti uretip beklenen sekilde non-zero kapandi, cunku lokal real-Supabase authenticated baseline, hosted synthetic account onayi ve authenticated Android/PWA capture on kosullari saglanmadi.

Bu sonuc runtime optimizasyon izni vermez. Fiziksel Android cihaz `READY_FOR_CDP_CAPTURE` seviyesindedir, ancak gercek authenticated Chrome/PWA performans PASS degildir. Production karari `NO-GO` kalir; deploy, remote migration, push, PR, merge, provider/channel egress, live billing, production worker, production gate, secret/env veya gercek saglik verisi yolu degismedi.

## Guncel Durum Kilidi - 2026-09-14

- Aktif branch: `codex/production-readiness-stage-1`.
- Current HEAD: `a2b1e0908b29ece40c797aa9c0a5dda0bbb6513a`; upstream `568a1ffba833db0dd182a3d9fad5b034f7cf98e5`; branch upstream'in iki commit ileridedir.
- Plan 1 Phase 2 kaniti `HARNESS_READY_WITH_NEGATIVE_CONTROLS`, Phase 3 kaniti `SYNTHETIC_AUTH_STORE_READY` olarak korunur.
- Plan 1 Phase 4 canonical evidence `BLOCKED / PERFORMANCE_BLOCKED`; son readiness evidence `aiya-phase4-readiness-20260914T184904329Z` hosted startup preflight'ini, local Supabase/Docker/build, fiziksel Android/CDP, normal Chrome hosted-origin ve kurulu PWA erisim kontrollerini `PASS` kaydeder. H1-H4 `COMPLETE`, `baselineStarted=false`; bu readiness sonucu performans baseline'i veya kok neden kaniti degildir.
- Fiziksel Android icin `adb devices -l` son kontrolde tek yetkili cihaz gorundu; PWA erisim kaniti PASS olsa da Android Chrome hosted-origin hedefi ve Android/PWA performans baseline'i PASS sayilmaz.
- Live customer ve admin release-health endpoint'leri son okunan durumda release `hs-1c9756046b01-b55ed4ff550f`, commit `1c9756046b01cb1bd224fb601ec9094a7f471606`, migration fingerprint `b55ed4ff550f7e9ba8fc25957774341a19b7b05c1a35a891633369b4aff95f25` dondurur. Live commit ile guncel branch HEAD farklidir; bu beklenen live/HEAD drift durumudur.

## Faz 1 ve Faz 1.2 Kapanis Yorumu

Faz 1 ve Faz 1.2 tarihsel kanit olarak korunur. Bu belgeler yeniden yazilarak guncel HEAD uzerinde calistirilmis gibi gosterilmez.

Faz 1, fallback verili yerel lab olcumleri ve statik mimari riskleri kaydetmistir. Bu olcumler genis kullanici sikayetini tek basina yeniden uretmemistir.

Faz 1.2, post-login canonical rota sozlesmesini, daha guclu selector'lari, gercek click aksiyonlarini, body-finish request timing'i ve desktop plus Android-emulation warm-session kosullarini eklemistir. Ancak Faz 1.2 harness'i halen asagidaki nedenlerle runtime duzeltmesi icin tek basina yeterli degildir:

- Local diagnostic demo/fallback store ve demo session kosullarini kullanmistir; gercek Supabase authenticated store yolu temsil edilmemistir.
- Warm transition olcumleri her senaryoda tekrar `page.goto()` kullandigi icin surekli SPA oturumundaki birikimli state etkisini tam olcmemistir.
- Fiziksel cihaz icin gercek Chrome/PWA trace alinmamistir; yalniz CDP hazirligi kanitlanmistir.
- AI Chat hatasi, local fallback ortamda Supabase konfiguru yokken beklenen `401` davranisiyla karisabilir; bu live authenticated runtime hatasi olarak kabul edilmeden once gercek auth/store kosulunda ayrilmalidir.
- Bazi Phase 1 static bulgulari kanitli risk seviyesindedir; kok neden kabul edilebilmesi icin request, render, auth, store ve cihaz trace zinciriyle dogrulanmalidir.

## Faz Kapanis Kurali

Her faz icinde listelenen asamalar sirasiyla tamamlanir. Bir asama kendi tamamlanma kriterini karsilamadan sonraki asamaya gecilmez.

Bir fazin kapanmasi icin iki kosul birlikte zorunludur:

1. Faz icindeki tum asamalar tarif edildigi sirayla ve tarif edilen yontemle tamamlanmis olacak.
2. Faz sonu kontrolleri ve testleri PASS olacak.

Failed, skipped, simulated, stale, environment-blocked veya eksik kanit sonucu PASS sayilmaz. Bir testin gecmesi, planlanan asamalardan biri eksikse fazi kapatmaz.

## Ortak Kanit Defteri Sozlesmesi

Faz 2 ve Faz 3, her asama icin ayni defter alanlarini uretir:

- `stageId`: Faz ve asama kimligi.
- `status`: `PENDING`, `IN_PROGRESS`, `COMPLETE`, `NO_CHANGE_JUSTIFIED`, `FAILED`, veya `BLOCKED`.
- `startedAt` ve `finishedAt`: ISO zaman.
- `sourceIdentity`: branch, HEAD, upstream SHA, live release kimligi, migration fingerprint, harness hash, fixture hash.
- `prerequisiteEvidence`: Onceki asama kanit referanslari.
- `performedActions`: Gercek komutlar, araclar ve islem sirasi.
- `verificationResults`: Test, olcum ve manuel olmayan dogrulama sonucu.
- `outputEvidence`: Uretilen evidence dosyasi, sanitized summary ve bulgu referanslari.
- `blockingReason`: Sadece `FAILED` veya `BLOCKED` durumunda dolu olur.

`NO_CHANGE_JUSTIFIED`, asamanin atlandigi anlamina gelmez. Ilgili kosul arastirilir, kanitla degisiklik gerektirmedigi gosterilir ve gerekce deftere yazilir.

Bir onceki asamadaki veri degisirse, ona bagli tum sonraki asamalar stale kabul edilir ve tekrar edilir.

## Ortak Veri Yapilari

### PerformanceRunIdentity

Her olcum kosusu su alanlari kaydeder:

- `branch`
- `head`
- `worktreeStatus`
- `runtimeSourceHash`
- `harnessHash`
- `fixtureHash`
- `releaseId`
- `releaseCommitSha`
- `migrationFingerprint`
- `environmentKind`: `local_real_supabase`, `hosted_test_account`, `owner_pc_hosted`, `physical_android_hosted`, veya `installed_pwa_hosted`.
- `deviceProfile`: OS, browser, browser version, viewport, CPU throttle yoksa `none`, network profile.
- `cacheState`: cold, warm, bypassed, service-worker-controlled.
- `profilerState`: trace on/off, screencast on/off, DevTools attached yes/no.

### PerformanceScenario

Her senaryo su alanlari tanimlar:

- `scenarioId`
- `startRoute`
- `preconditions`
- `userAction`
- `expectedRoute`
- `requiredReadySelector`
- `requiredReads`
- `allowedMutations`
- `forbiddenMutations`
- `expectedEmptyState`
- `expectedDeniedState`
- `budget`
- `sampleCount`
- `dataFixtureClass`: small synthetic, normal synthetic, or scale synthetic.

Navigation testi icin veri mutasyonu yapan butonlar kullanilmaz. Menu olcumunde template olusturma, save, activate veya export gibi mutation aksiyonlari performans navigasyonu yerine domain mutation testi olarak ayrilir.

### PerformanceSample

Her ornek su alanlari kaydeder:

- `sampleId`
- `functionalStatus`
- `validityStatus`
- `budgetStatus`
- `eventToNextPaintMs`
- `taskReadyMs`
- `lcpMs`
- `cls`
- `longTaskTotalMs`
- `maxLongTaskMs`
- `requiredRequestTimings`
- `allRequestSummary`
- `failedRequests`
- `unexpectedRequests`
- `jsBytesGzip`
- `routeTransitionKind`
- `observedMutations`

Eksik bir metrik `null` kalir; baska bir metrikle doldurulmaz. Failed sample kayittan silinmez.

### PerformanceFinding

Her bulgu su alanlarla kapanir:

- `id`
- `class`: `AUTH_FAILURE`, `STORE_FANOUT`, `POLL_CONTENTION`, `BUNDLE_RENDER`, `SERVICE_WORKER`, `HOSTED_INFRA`, `MEASUREMENT_GAP`, veya `NOT_REPRODUCED`.
- `severity`
- `sourceSamples`
- `reproductionSteps`
- `affectedFiles`
- `affectedFunctions`
- `cause`
- `requiredFix`
- `requiredTests`
- `closureEvidence`
- `duplicateOf`

Hassas veri kurali: raw trace, HAR, cookie, token, secret, raw request/response body, raw prompt, real client health data veya dosya icerigi evidence icine yazilmaz. Kanitlar allowlist alanlarla ve sanitized pathlerle tutulur.

## Performans Butceleri

Bu butceler hedef kabul kriteridir; onceki fazlarda PASS oldugu anlamina gelmez.

- Login submit ile kullanilabilir dashboard arasi p75 en fazla `3000 ms`.
- Warm authenticated work-area navigation p75 en fazla `1000 ms`, p95 en fazla `2000 ms`.
- Olculen event-to-next-paint p75 en fazla `200 ms`, p95 en fazla `500 ms`. Bu field INP degildir; lab event-to-paint metrigi olarak yorumlanir.
- Required read endpoint body-finish p75 en fazla `900 ms`.
- Initial dashboard LCP p75 en fazla `2500 ms`.
- CLS en fazla `0.1`.
- Foreground max long task en fazla `500 ms`.
- Beklenmeyen auth/API/chunk/transport hata sayisi `0`.
- Regression kapisi: once/sonra ayni kosulda p75 hem yuzde `10`dan fazla hem `100 ms`den fazla kotulesemez.

## Faz 2 - Gecerli Olcum, Kok Neden ve Lokal Remediasyon

### Amac

Faz 1 ve Faz 1.2'deki olcum aciklarini kapatmak, kullanicinin gercek post-login yavaslik sikayetini gercek authenticated data path uzerinde yakalamak, kok nedeni ayirmak ve yalniz kanitlanan lokal kod duzeltmelerini uygulamak.

### Kapsam

- `docs/AIYA_PERFORMANCE_ACTION_PLAN.md`
- `docs/AIYA_PERFORMANCE_PHASE_2_EXECUTION_SCOPE.md`
- Yeni Faz 2 evidence dosyasi: `docs/AIYA_PERFORMANCE_PHASE_2_EVIDENCE.json`
- `docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json`
- Performans harness dosyalari: `app/scripts/measure-aiya-performance.mjs`, `app/scripts/measure-aiya-performance-phase-1-2.mjs`, yeni veya guncellenen Faz 2 harness/test dosyalari.
- Gerektigi kanitlanirsa runtime dosyalari: dashboard shell, app-state store, shell bootstrap, Stage 6 workspace hook'lari, inbox/messaging/AI chat refresh hook'lari, AI Chat page/route, dynamic import uygulanacak dashboard panel dosyalari.
- `HANDOFF_FOR_NEXT_CODEX.md`
- `docs/RISK_REGISTER.md`

### Kapsam Disi

- Production GO karari.
- Deploy, push, PR, merge, remote migration.
- Gercek Z.ai egress, WhatsApp egress, live billing, production worker.
- Service-role ile son kullanici yetkisi ikamesi.
- Offline health-data cache veya offline mutation queue.
- Tenant, account, actor, role, capability, RLS veya expected-revision gevsetmesi.
- Kanitlanmamis bundle/poll/store optimizasyonlari.
- Gercek hasta/veri icerigi yakalama veya evidence'a yazma.

### On Kosullar

- Calisma agaci temiz olacak.
- Aktif branch `codex/production-readiness-stage-1` olacak.
- Faz 1 ve Faz 1.2 evidence dosyalari tarihsel kaynak olarak korunacak.
- Synthetic hosted test hesabi gerekiyorsa ayri dis sistem onayi alinacak.
- Next.js davranisi degistirilecekse once ilgili yerel Next.js dokumani okunacak.

### Etkilenecek Bilesenler ve Dosyalar

Ilk asamalarda yalniz plan/evidence/harness/test dosyalari etkilenir. Runtime degisikligi ancak Asama 2.6 kok neden kanitladiktan sonra Asama 2.7'de uygulanabilir.

Muhtemel runtime dosyalari:

- `app/src/components/dashboard-app.tsx`
- `app/src/components/dashboard/**`
- `app/src/app/dashboard/**`
- `app/src/lib/use-aiya-state.ts`
- `app/src/app/api/app-state/route.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/lib/use-stage-4b-inbox.ts`
- `app/src/lib/use-stage-4b2-messaging.ts`
- `app/src/lib/use-ai-chat.ts`
- `app/src/app/dashboard/ai-chat/page.tsx`
- `app/src/lib/phase-85-stage-4c-route.ts`
- `app/public/sw.js` yalniz PWA/service-worker kok neden kanitlanirsa.

### Mimari Kararlar

- Ilk hedef hizli gorunen ama yetkisiz/fallback bir akisa dusmek degildir; hedef, gercek authenticated tenant/account/actor path'ini hizlandirmaktir.
- Genis `ManuAppState` bagimliligi ancak consumer map cikarildiktan sonra daraltilir.
- Eksik DTO, full state olarak cast edilmez.
- Polling, badge ve klinik alert tazeligini bozmadan route/visibility/owner/inflight kurallariyla sinirlanir.
- Dynamic import yalniz olcumle agir oldugu kanitlanan paneller icin kullanilir.
- Her mutation expected revision, dirty-state, conflict ve idempotency davranisini korur.

### Veri Akisi

Kullanici login olur, dashboard shell server auth ile tenant/account/actor baglamini cozer, shell bootstrap safe DTO dondurur, dashboard client aktif route/task'e gore yalniz gerekli read kaynaklarini cagirir, task ready selector gorunur hale gelir, background refresh yalniz aktif/gorunur/owner uyumlu kosulda calisir. AI Chat ayri capability ve entitlement kontrolunden gecer; 401/403 hata ise performans PASS sayilmaz.

### Bagimliliklar

- Node/Next mevcut repo bagimliliklari.
- Local real Supabase icin mevcut migrationlar ve sentetik fixture.
- Playwright/CDP mevcut araclari.
- Hosted test hesabi icin ayri owner onayi ve sentetik veri.
- Yeni dependency eklenmez; zorunlu olursa ayri onay gerekir.

### Hata ve Sinir Durumlari

- Supabase konfiguru yoksa AI Chat 401 sonucu auth/store ayrim bulgusu olarak kaydedilir; live bug sayilmaz.
- Fiziksel cihaz bagli ama CDP target dogrulanamiyorsa Faz 2 physical capture asamasi BLOCKED olur.
- Kullanici hesabi gercek veya icerigi belirsiz veriler iceriyorsa olcumde kullanilmaz.
- Hosted rate limit veya auth expiry olursa sample fail olarak saklanir; PASS'e cevrilmez.
- Slow sample outlier ise silinmez; ayni kosulda tekrar ve trace ile siniflandirilir.

### Asama 2.1 - Kaynak ve Bulgulari Yeniden Kilitle

Uygulama sirasi:

1. `git status --short --branch`, `git rev-parse HEAD`, `git log -5 --oneline --decorate`, `git diff --check` calistir.
2. Iki live release-health endpoint'ini read-only oku.
3. Faz 1 ve Faz 1.2 evidence dosyalarindaki source HEAD, harness, cihaz, environment ve sonuc alanlarini ozetle.
4. `READY_FOR_CDP_CAPTURE` durumunu fiziksel performans PASS olarak degil, capture hazirligi olarak siniflandir.
5. Combined manifestteki `PERF-F2-*` ve `PERF-F12-*` bulgularini Revizyon 2 siniflandirmasina cevir: static risk, measurement gap, measured candidate, duplicate, not reproduced.
6. `docs/AIYA_PERFORMANCE_PHASE_2_EXECUTION_SCOPE.md` dosyasini bu planin Faz 2 kurallarina gore guncelle.

Tamamlanma kriteri: Faz 2 kaniti, hangi onceki bulgunun hangi statude oldugunu ve hangi bulgunun runtime degisikligi icin henuz yetersiz oldugunu acikca gosterir.

### Asama 2.2 - Harness Gecerlilik Tamiri ve Negatif Testler

Uygulama sirasi:

1. Warm SPA olcumunde her senaryo icin `page.goto()` tekrarini kaldir; login sonrasi ayni browser context ve ayni app instance icinde click/route transition olc.
2. Her scenario icin `requiredReadySelector`, expected route/state ve gerekli 2xx read listesi tanimla.
3. `main` gibi genel selector'lari success selector olarak kullanma; forms, nutrition, menu, AI Chat, messages, alerts, notifications icin domain selector zorunlu kil.
4. Click feedback olcumunu sadece `locator.click()` suresi degil, click sonrasi ilk paint ve task-ready zamani olarak kaydet.
5. Response header timing ile body-finish timing'i ayri alanlarda tut; body bitmeden header suresini request tamamlandi diye yazma.
6. `requestfailed` listener ekle ve response handler promise'larini drain et; listener'lari sabit 1200 ms yerine scenario quiescence ve 30 sn ust limit ile kapat.
7. Tum requestlerden endpoint yuzdeleri hesapla; yalniz slowest top 12 subsetinden percentile uretme.
8. `finalUrl` ve pathlerde dynamic id, query, token benzeri alanlari sanitize et.
9. Background stability penceresini gercek 60 sn gozlem olarak uygula.
10. Menu navigation icin create/save/activate/export gibi mutation butonlarini kullanma; mutation testlerini ayrica isimlendir.
11. Negatif testlerde kontrollu 401, 403, 500, delayed header, delayed body, network failure, timeout, wrong panel, missing metric, over-budget, missing target ve redaction vakalarini fail olarak dogrula.

Teknik yontem: Mevcut Playwright harness korunur; yeni helper fonksiyonlari yalniz tekrar eden measurement sozlesmesini sadelestirmek icin eklenir.

Tamamlanma kriteri: Harness testleri yalniz sabit stringleri degil, gercek hata enjeksiyonu ve outcome dogrulamayi kapsar.

### Asama 2.3 - Local Real Supabase Sentetik Baseline

Uygulama sirasi:

1. Kullanici veritabanini resetlemeyen izole local Supabase hedefi sec.
2. Mevcut migrationlari uygula.
3. Iki tenant, en az iki dietitian rol, viewer/assistant/auditor negatif rolleri ve sentetik client verisi olustur.
4. Small fixture: 3 client, temel form/nutrition/menu/messages/alerts/notifications.
5. Normal fixture: 50 client, en az 20 mesajli conversation ve 200 mesajli buyuk conversation.
6. Fixture hash'i evidence'a yaz; raw mesaj veya klinik icerik yazma.
7. Demo cookie ve fallback store kullanmadan real password login ile dashboard ve AI Chat 2xx read gereksinimlerini dogrula.
8. Standalone production build ve local real DB ile 20 sample baseline al.

Tamamlanma kriteri: Baseline, real auth/store/RLS path uzerinde uretilir ve fallback/demo path PASS olarak kullanilmaz.

### Asama 2.4 - Hosted Sentetik Test Hesabi Hazirligi

Uygulama sirasi:

1. Ayri owner onayi olmadan dis sistemde hesap, invite, seed veya email aksiyonu yapma.
2. Onay varsa mevcut commercial admin invite ve onboarding akislariyla sentetik dietitian hesabi olustur.
3. Test hesabi yalniz sentetik veri icerir; gercek danisan veya saglik verisi kullanilmaz.
4. Test tenant normal dietitian yetkileriyle calisir; admin/service-role bypass kullanilmaz.
5. Hosted olcumde izinli yazma yan etkilerini sinirla: session activity, preferences, read receipt gibi mevcut normal uygulama davranislari disinda mutation yapma.
6. Login bilgileri, magic link, token, cookie veya email icerigi evidence'a yazilmaz.

Tamamlanma kriteri: Hosted test hesabi hazirsa kimlik ve fixture yalniz sanitized olarak kaydedilir; hazir degilse Faz 2 hosted physical/live kismi BLOCKED kalir ve lokal remediasyon kaniti ile sinirli ilerlenir.

### Asama 2.5 - Gecerli Baseline Yakalama

Uygulama sirasi:

1. Local real DB desktop baseline: login, dashboard, clients, forms, nutrition, menu, AI Chat, messages, alerts, notifications.
2. Owner PC hosted baseline: ayni senaryolar, test hesabi ile.
3. Fiziksel Android Chrome hosted baseline: `Browser.getVersion`, target URL ve device metadata dogrulanmadan PASS verme.
4. Kurulu PWA hosted baseline: display mode ve service-worker control durumunu dogrula.
5. Her required scenario icin en az 20 sample al.
6. Warm transitionlarda ayni oturum ve ayni app instance kullan.
7. Profiler/trace kosulari ile normal kosulari ayir; trace overhead'i kabul metrici yapma.
8. Broad issue yeniden uretilemezse `NOT_REPRODUCED` yaz ve speculative runtime optimizasyonuna gecme.

Tamamlanma kriteri: Kullanici sikayeti en az bir gecerliligi kanitli ortamda yeniden uretilir veya kanitli sekilde yeniden uretilemedigi kaydedilir.

### Asama 2.6 - Nedensel Ayrim

Uygulama sirasi:

1. DNS/TLS/TTFB, auth/session, RPC/store, response body, JSON parse, React render/layout/paint, poll/mount ve service-worker/release katmanlarini ayri ayri siniflandir.
2. Server TTFB tek basina DB kok nedeni sayilmaz; store/RPC request timing ve query davranisi ayrica kanitlanir.
3. A/B tek degisken deneyleri yap: data volume, poll pause, service-worker bypass, network profile, profiler on/off.
4. Her kok neden icin en az 3 ayni path trace veya sample referansi zorunludur.
5. Duzeltme onerisi, tenant/auth/security davranisini bozmadan beklenen performans degisimini dosya/fonksiyon/test seviyesinde tarif eder.

Tamamlanma kriteri: Her runtime degisikligi icin `cause -> affected file/function -> expected change -> required test` zinciri kanitlanir.

### Asama 2.7 - Kanitla Sinirli Lokal Duzeltmeler

Duzeltmeler asagidaki sabit oncelikle uygulanir; bir madde icin kanit yoksa `NO_CHANGE_JUSTIFIED` yazilir.

1. AI Chat measurement gate: AI Chat performans-ready sayilmak icin authenticated 2xx conversation-list read ve `ai-chat-workspace` ready selector zorunlu olur. Local missing-Supabase 401 live auth bug olarak siniflandirilmez.
2. Auth/session duplicate work: ayni render icinde tekrar eden server auth cozumu kanitlanirsa request-scoped paylasim uygulanir; role/capability/entitlement assert davranisi korunur.
3. Broad app-state: kritik tasklar icin consumer map cikarilir; shell bootstrap ve Stage 6 bounded DTO'lari kullanilir; eksik DTO full `ManuAppState` olarak cast edilmez.
4. Pagination: SQL/loader paging tenant/filter/order once, range sonra olacak sekilde dogrulanir; 100 uzeri client dogruluk testi eklenir.
5. Poll/background refresh: route, visibility, owner key, inflight dedupe, abort/sequence ve post-readiness scheduling uygulanir; badge/clinical alert freshness korunur.
6. Bundle/render split: yalniz olcumle agir panel kanitlanirsa yerel Next.js lazy-loading dokumani okunarak top-level `next/dynamic` uygulanir; ilk gorunen dashboard/shell eager kalir.
7. PWA/service-worker: yalniz SW kaynakli stale/static problem kanitlanirsa network-only/fail-closed kurallari bozulmadan duzeltilir.
8. Hosted infra/proxy/DB: kod disi kok neden kanitlanirsa dosya degisikligi yapmadan Faz 3 icin ayri dis sistem aksiyon plani yazilir.

Tamamlanma kriteri: Her uygulanan degisiklik icin hedefli test ve once/sonra olcum vardir; uygulanmayan her aday icin kanitli `NO_CHANGE_JUSTIFIED` vardir.

### Asama 2.8 - Eslesmis Once/Sonra Dogrulama

Uygulama sirasi:

1. Local real DB once/sonra ayni fixture ile 20 sample tekrar edilir.
2. Fiziksel Android veya hosted test hesabi hazirsa ayni ortamda once/sonra 20 sample tekrar edilir.
3. Live eski commit ile local yeni commit ayni kabul karsilastirmasi gibi sunulmaz; sadece ayni environment icindeki once/sonra karsilastirilir.
4. Rapid client switch, late replies, dirty-state cancel/save, conflict, double-click, expired session testleri calistirilir.
5. Slow lab profili 150 ms RTT, 1.6 Mbps down, 750 Kbps up hedefinde task p75 en fazla `4000 ms` olacak sekilde ayri raporlanir.

Tamamlanma kriteri: Kapatilan her bulgu eslesmis before/after kanitla kapanir veya acik kalir.

### Asama 2.9 - Faz 2 Kapanis Kontrolleri

Calistirilacak kontroller:

- Faz 2 harness negatif/pozitif testleri.
- Degisen runtime dosyalarina hedefli unit/integration testleri.
- Gerekiyorsa RLS/cross-tenant/cross-account suite; destructive wrapper yerine izole raw local hedef.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Degisikligin blast radius'una gore `npm test`
- UI degistiyse desktop/mobile Playwright visual ve accessibility testleri.
- PWA degistiyse service-worker, manifest, network-only ve privacy-lock testleri.
- `git diff --check`
- Secret ve hassas veri taramasi.
- Stale belge ve handoff celiskisi taramasi.
- `git status --short --branch`

Tamamlanma kriteri: Faz 2 evidence `LOCAL_REMEDIATION_VERIFIED` veya `PERFORMANCE_BLOCKED` statulerinden birini verir. `LOCAL_REMEDIATION_VERIFIED`, production GO anlamina gelmez; live kabul Faz 3 onayi gerektirir.

## Faz 3 - Canli Aday Kabul, Regresyon ve Owner Gate

### Amac

Faz 2 adayi commitlendikten ve ayrica onaylandiktan sonra, resmi release/deploy yolu uzerinden hosted kabul olcumlerini, fiziksel cihaz/PWA kabulunu, endurance kosularini ve rollback/failure kurallarini tamamlamak.

### Kapsam

- Release artifact ve identity.
- Existing hosted deploy wrapper.
- Synthetic hosted test tenant/account.
- Desktop hosted, physical Android Chrome hosted ve installed PWA hosted performance acceptance.
- CI/regression test entegrasyonu.
- Faz 3 evidence, handoff ve risk register.

### Kapsam Disi

- Production GO karari.
- Gercek Z.ai/WhatsApp/live billing/production worker.
- Gercek saglik verisi.
- Remote migration apply; gerekiyorsa ayri onay ve ayri migration fazi gerekir.
- Deploy onayi olmadan hosted apply.

### On Kosullar

- Faz 2 `LOCAL_REMEDIATION_VERIFIED` veya acik bloklari net `PERFORMANCE_BLOCKED` olarak kaydetmis olacak.
- Candidate commit, artifact ve rollback hedefi net olacak.
- Hosted deploy icin kullanici ayri acik onay verecek.
- Hosted test hesabi sentetik veriyle hazir olacak.

### Asama 3.1 - Candidate Freeze

Uygulama sirasi:

1. Candidate HEAD, branch, worktree, artifact target ve migration fingerprint kaydedilir.
2. Faz 2 kapanis evidence'i stale degil diye dogrulanir.
3. Her kapanacak bulgu icin kabul senaryosu, butce ve test listesi yazilir.
4. Migration veya env/config ihtiyaci varsa deploydan once ayri onay gerektiren blok olarak kaydedilir.

Tamamlanma kriteri: Candidate identity ve rollback hedefi tek anlamlidir.

### Asama 3.2 - CI ve Regresyon Korumasi

Uygulama sirasi:

1. Faz 2 harness negatif testleri CI icinde calisacak uygun npm scriptine baglanir.
2. Her fix icin anlamli davranis testi eklenir: auth/session, request fanout, polling, pagination, selector, AI Chat gate, dirty/conflict veya SW.
3. CI fiziksel cihaz PASS iddiasi yapmaz; fiziksel cihaz kaniti ayri evidence'ta tutulur.
4. Windows lokal ve Linux CI karsilastirmalari ayni kabul metrici olarak karistirilmaz.

Tamamlanma kriteri: CI, gelecekte ayni measurement gap veya runtime regresyonunu yakalayacak somut testlere sahiptir.

### Asama 3.3 - Release Artifact ve Local Smoke

Uygulama sirasi:

1. `npm run release:verify` calistirilir.
2. Release artifact uretilir ve SHA-256 kaydedilir.
3. Local real DB normal fixture ile smoke tekrar edilir.
4. 100 uzeri pagination dogruluk fixture'i calisir.
5. 100x50/5000 rehearsal yalniz kapasite/regresyon sinyali olarak ayrilir; fiziksel kullanici sikayeti PASS kaniti sayilmaz.

Tamamlanma kriteri: Artifact, release identity ve local smoke tutarlidir.

### Asama 3.4 - Onayli Hosted Apply

Uygulama sirasi:

1. Kullanici acik deploy onayi vermeden dur.
2. Onay varsa existing official hosted apply wrapper kullanilir.
3. SSH, PM2, archive, release identity ve rollback kanitlari sanitized kaydedilir.
4. Migration gerekiyorsa append-only local tested migration icin ayri remote migration onayi olmadan apply yapilmaz.
5. Deploy sonrasi customer/admin release-health, domain, TLS, login route, manifest ve fail-closed unauth API smoke calisir.

Tamamlanma kriteri: Hosted release exact candidate commit'i servis eder veya apply fail/rollback durumu acik yazilir.

### Asama 3.5 - Hosted Kabul Olcumu

Uygulama sirasi:

1. Owner PC hosted test hesabi ile 20 sample.
2. Fiziksel Android Chrome hosted test hesabi ile 20 sample.
3. Kurulu PWA hosted test hesabi ile 20 sample.
4. Profiler off kabul kosusu, profiler on tanisal kosudan ayri tutulur.
5. Local/local ve hosted/hosted karsilastirmalari ayri yapilir; eski live ile yeni local karsilastirmasi PASS sayilmaz.

Tamamlanma kriteri: Hedef butceler hosted kabul kosullarinda saglanir veya hangi platformun neden blocked/failed oldugu netlesir.

### Asama 3.6 - Endurance ve Stabilite

Uygulama sirasi:

1. Owner PC, physical Android Chrome ve installed PWA icin uygun olan her platformda 30 dakikalik loop calistir.
2. Warm all panels, repeated navigation, scroll/back/client switch, foreground/background ve dirty cancel/save akislari tekrarlanir.
3. Ilk 5 dakika ve son 5 dakika timing, request sayisi, error sayisi ve memory floor karsilastirilir.
4. Memory floor ardisik 3 pencerede artar, toplam artis `20%` ve `20 MiB` uzerindeyse leak supheli blok acilir; otomatik "leak kapandi" denmez.
5. Timer/request artisi, stale response veya late freeze aciklanamazsa Faz 3 kapanmaz.

Tamamlanma kriteri: 30 dakikalik stabilite kaniti budget ve hata kapilarini karsilar.

### Asama 3.7 - Failure ve Rollback Karari

Uygulama sirasi:

1. Missing device, auth error, budget miss, persistent freeze, release mismatch, security/session/dirty/mutation regresyonu veya endurance failure tek tek siniflandirilir.
2. Rollback yalniz deploy scope icinde onceden onaylandiysa uygulanir; aksi halde rollback onerisi raporlanir.
3. DB rollback gerekiyorsa ayri onay ve ayri plan olmadan yapilmaz.
4. Failure cozulmeden Asama 3.8'e gecilmez.

Tamamlanma kriteri: Hosted aday `PERFORMANCE_ACCEPTED` veya `PERFORMANCE_BLOCKED` olmaya hazirdir.

### Asama 3.8 - Faz 3 Kapanis

Uygulama sirasi:

1. Her bulgu `CLOSED_VERIFIED`, `MEASUREMENT_GAP_RESOLVED`, `DUPLICATE`, `NOT_REPRODUCED`, veya `OPEN_BLOCKED` statulerinden birini alir.
2. Kullanici algisi icin owner tekrar dogrulamasi kaydedilir; bu tek basina teknik PASS degildir ama kabul sinyalidir.
3. Secret/hassas veri/history/stale-doc taramalari calisir.
4. `git diff --check` ve `git status --short --branch` kaydedilir.
5. Production karari `NO-GO` kalir; bu faz yalniz performance acceptance sonucunu yazar.
6. Commit, push, PR, merge, production GO ve sonraki faz icin ayri onay beklenir.

Tamamlanma kriteri: Faz 3 evidence `PERFORMANCE_ACCEPTED` veya `PERFORMANCE_BLOCKED` kararini verir ve tum asamalar sirayla tamamlanmistir.

## Dokuman Guncelleme Kurali

Her uygulama fazinda:

- Ilgili action plan/evidence dosyasi guncellenir.
- `HANDOFF_FOR_NEXT_CODEX.md` mevcut durum ve sonraki tek adimla guncellenir.
- `docs/RISK_REGISTER.md` yalniz risk durumu degisirse guncellenir.
- Historical evidence ve closure dosyalari yeni HEAD'de yeniden calismis gibi yazilmaz.
- `README.md`, `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md` ve `docs/NEXT_PHASE_EXECUTION_PLAN.md` yalniz roadmap veya urun karari degisirse guncellenir.

## Sonraki Tek Uygulanabilir Faz

Sonraki uygulanabilir faz: **Faz 2 - Gecerli Olcum, Kok Neden ve Lokal Remediasyon**.

Faz 2, once olcum gecerliligini ve gercek authenticated path'i kanitlamadan runtime optimizasyonuna gecmez. Faz 2 icinde broad dashboard freeze yeniden uretilmezse spekulatif performans duzeltmesi yapilmaz; bu durumda bulgular `NOT_REPRODUCED` veya `OPEN_BLOCKED` olarak kalir ve Faz 3'e gecilmez.

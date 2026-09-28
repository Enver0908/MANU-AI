# AIYA Dirty Registration and J1 Verification Action Plan

Date: 2026-09-22; updated 2026-09-23  
Status: Phase 1 complete; Phase 2 acceptance conditions met across the preserved J1 run and separate smoke-only checkpoint; Phase 3 analysis complete  
Contract: `plan1-final-v3` in `docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md`

## Authority and Purpose

This is a bounded continuation for the desktop dashboard's delayed second interaction. It does not reopen Plan 1. Plan 1 Phase 5.7 remains `COMPLETE / DIAGNOSIS_BLOCKED`; `PERF-F2-001/002/003` remain inconclusive, `PERF-F12-001/002` remain open/blocked, Plan 2 eligible findings remain zero, and production remains `NO-GO`.

The working question is: after the same-document dashboard navigation guard and default-stable dirty registration, does the J1 second interaction stall when it is scheduled 2,000 ms after the first Forms click? Repeated auth/session work, request/RSC volume, context commits, and JavaScript/render work are candidate contributors only. None is presumed to be the root cause.

The change is deliberately small: stop callback identity churn from unregistering and registering dirty editors on ordinary React renders; preserve registration when meaningful editor state or capability changes; then collect three bounded J1 records and one guarded local dirty-navigation smoke. No broad profiling harness, official nine-scenario acceptance run, A-B-A replay, schema change, migration, dependency change, production access, or provider/channel request is part of this plan.

## Shared Invariants

- Use the main checkout `C:\Users\Dell\OneDrive\Masaüstü\MANU-AI`, branch `codex/production-readiness-stage-1`, current HEAD `a2b1e0908b29ece40c797aa9a0c5dda0bbb6513a`, and the already-dirty working tree. Do not clean, reset, stash, or replace user files.
- Use existing J1, local-normal synthetic owner fixture, actual local password session, local Supabase at `127.0.0.1:54321`, existing request/lifecycle/long-task capture, and `tools/phase-execution/` hash-chained checkpoint store.
- Keep observation validity, functional success, and performance interpretation as separate outcomes. A valid click is not proof of speed; three non-reproductions are not proof that the global issue is solved.
- Keep the legacy fan-out envelope as an observation, not an eligibility gate for this changed stable-policy source. Report request, RSC, and route history without treating counts alone as causality.
- Do not save credentials, tokens, cookies, request/response bodies, prompts, client identifiers, or health data in logs or evidence. Do not call Z.ai, WhatsApp, billing, production, or any external provider.
- Do not auto-retry a started incomplete sample or smoke. Preserve every failed/invalid attempt and stop after three planned attempts or a concrete environment/harness blocker.
- Change the official finding manifest only if new evidence warrants a disposition change. This diagnostic alone does not authorize Plan 2 or production.

## Phase 1 - Default-Stable Dirty Registration and Measurement Readiness

Status: `COMPLETE`  
Evidence: `docs/AIYA_PERFORMANCE_DIRTY_REGISTRATION_FIX_PHASE_1_EVIDENCE.json`

### Purpose

Make the normal dirty-editor hook insensitive to fresh callback identities while retaining up-to-date callbacks, correct save capability, and the explicit legacy comparison switch. Repair the measurement clock joins that otherwise could label overlapping browser long tasks as absent or shift request intervals relative to the click.

### Scope and Components

- `app/src/lib/use-shell-dirty-registration.ts`: default policy, callback refs, stable registration dependencies, and callback-presence dependencies.
- `app/src/lib/use-shell-dirty-registration.test.ts`: hook lifecycle and optional-callback behavior.
- `app/scripts/performance-plan-1-phase-4-4-local.mjs`: persist the request-summary time origin when request records are rebased to their first request.
- `app/scripts/performance-plan-1-shared-runtime-auth-fanout-commit-overlap.mjs` and its test: derive trace-relative request intervals from the recorded/inferred origin and report alignment confidence.
- `app/scripts/performance-plan-1-j1-second-action-timeline-analysis.mjs` and its test: align browser `performance.now()` observations to trace-relative click time only from paired wall/performance observations; preserve unavailable/uncertain timing as `null`.
- `app/scripts/performance-plan-1-j1-fanout-envelope-baseline.mjs`: export existing server/checkpoint summary helpers for reuse without changing the legacy runner's behavior.
- `app/scripts/performance-plan-1-j1-dirty-registration-verification.mjs` and its test: separate default-stable, three-repetition J1 verification from the historical legacy fan-out gate.

The same-document navigation fix in `phase-85-stage-4b-dashboard-routing.ts`, `use-dashboard-url.ts`, and `shell-provider.tsx` is an existing prerequisite in the dirty checkout, not a change made by this phase. Its prior evidence is retained as historical input.

### Preconditions

- Read the current hook, central registry, J1 journey, measurement collector, local server helper, checkpoint store, and current changes before editing.
- Preserve the existing Phase 52 diagnostic event and the explicit legacy mode already present in the hook.
- Keep one test per behavior and use the existing Vitest/Node test split; do not launch a full app suite.

### Architectural Decisions

- The hook selects `legacy` only when `NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY` equals the literal `legacy`. Empty, absent, or any other value selects `stable`.
- The stable registration callback closes over refs, not render-local callbacks. Assign refs on each render so save/discard/focus always invoke the newest callback.
- Register/unregister identity depends on entry identity, label, dirty state, save capability, and whether save/discard/focus callbacks exist. Callback identity alone does not unregister the entry.
- Keep a separate update effect so a state transition (for example `dirty` to `saving` or `clean`) and new callbacks reach the central in-memory registry.
- Align long-task/event-timing timestamps only if at least two paired wall-clock/performance-clock samples have a maximum spread of 5 ms. If not, report alignment as unavailable/uncertain and do not infer that no task overlapped the interaction.
- When request records declare `first_request_relative`, use the explicit wall origin. For historical records missing that origin, infer it only from matching action request boundaries whose candidate origins agree within 5 ms; otherwise provide no request intervals.
- Keep request start, response-header, and response-body boundaries separate. Never merge different instrumentation boundaries into a fabricated exact timestamp.

### Implementation and Data Flow

1. Each dirty editor calls `useShellDirtyRegistration` with a stable entry id, label, state, save permission, and current save/discard/focus callbacks.
2. The hook updates callback refs every render. Meaningful state/presence changes register or update the central `ShellDirtyRegistry`; callback-only churn updates refs without register/unregister.
3. Shell navigation reads the same in-memory registry. The hook does not persist drafts, enqueue mutations, or alter tenant/auth boundaries.
4. The J1 collector records the trusted Forms click, action timings, required reads, navigation/state events, request summary, Phase 52/55 events, event timings, and long tasks. The analyzer converts only confidently aligned clocks into the common second-action window.
5. The new runner reports stable-policy samples independently of the legacy fan-out envelope and uses a unique phase checkpoint plus the existing hash-chain store.

### Tests and Verification

- Hook + registry: 10/10 Vitest tests.
- Stable J1 analyzer/runner contract: 8/8 Node tests.
- Shared request-clock helper: 3/3 Vitest tests.
- `npm run typecheck`: PASS.
- Focused ESLint across changed hook, collector, runner, analyzer, and tests: 0 errors; one existing unused `hashText` warning in `performance-plan-1-shared-runtime-auth-fanout-commit-overlap.mjs:61`.
- `node --check` on the changed runner/analyzer/collector/shared helper: PASS.
- `git --no-optional-locks diff --check`: PASS; Git printed only existing LF-to-CRLF conversion warnings.
- One combined test invocation initially mixed Vitest suites and Node `node:test` files and returned a runner-format error; the suites were then run with their correct test runners and all focused tests passed. This was a test-command mismatch, not a product-test failure.

### Failure and Boundary Cases

- Missing optional callbacks disable the corresponding capability; adding/removing an optional callback updates registry state without stale callback use.
- Explicit legacy policy retains callback-identity re-registration for controlled comparison.
- A browser clock without adequate paired samples is unknown, not “zero long tasks.” A request summary without a defensible origin is omitted from overlap analysis.
- Phase 1 does not include a build or runtime capture; it does not claim the changed default has improved the second click.

### Completion Criteria and Result

The default policy, legacy opt-in, callback freshness, dirty/saving lifecycle, request-origin capture, clock alignment, and failure-to-unknown behavior all have focused tests; typecheck/lint/syntax/diff checks pass; source hashes are recorded in Phase 1 evidence. These conditions are met. No measurement record was counted or created in Phase 1.

## Phase 2 - One Build, Three Local J1 Records, Guarded Dirty Smoke

Status: `COMPLETE_WITH_SEPARATE_SMOKE_ONLY_CHECKPOINT; ORIGINAL_J1_RUN_REMAINS_BLOCKED`  
Runner: `app/scripts/performance-plan-1-j1-dirty-registration-verification.mjs`  
Command: `node app/scripts/performance-plan-1-j1-dirty-registration-verification.mjs --run`

Startup attempt record: `docs/AIYA_PERFORMANCE_DIRTY_REGISTRATION_FIX_PHASE_2_STARTUP_BLOCKER_EVIDENCE.json`. The first invocation failed before the checkpoint opened because the runner resolved `appRoot` from the script filename. It created no checkpoint, build, server, browser, J1 attempt, or database mutation. The path resolution is corrected and covered by a regression test; this startup failure is retained and does not consume one of the three J1 repetitions.

### Purpose

Answer whether the same second interaction stalls after the existing same-document navigation guard and the default-stable dirty registration, using three repeatable current-source observations and no retry loop.

### Preconditions and Start Gate

- Confirm branch/HEAD and all relevant source hashes still match the recorded Phase 1 identity; confirm the checkpoint has no prior completed or started run for this phase id. A started-but-incomplete unit blocks reuse and must not be replayed.
- Confirm Docker's local Supabase database is healthy, the local synthetic owner credential pair is available without printing values, and local Supabase target is exactly `127.0.0.1:54321`.
- Confirm one free loopback port in `3167-3170`. Use the runner-selected free port; if none is free, record a concrete environment blocker and stop.
- Build-time `NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY` must be the empty string, so the shipped bundle exercises the new default. Supply it through the child-process environment only; do not edit `.env*` files or expose secrets.
- Use the existing `local-normal` synthetic owner fixture and ordinary password authentication/RLS. No demo cookie, service-role browser path, hosted account, or seed/reset is allowed.

### Components and Dependencies

- App runtime under measurement, including the existing dashboard query-navigation fix and `use-shell-dirty-registration.ts`.
- Existing J1 definition and timing engine in `performance-plan-1-phase-4-3-diagnostic.mjs` / `performance-plan-1-phase-4-4-local.mjs`.
- Existing local server/start/stop and sanitization/checkpoint helpers reused from `performance-plan-1-j1-fanout-envelope-baseline.mjs` and `tools/phase-execution/checkpoint-store.mjs`.
- Local Next build, local Supabase/Auth/RLS, Playwright Chromium already installed in the workspace. No new dependency or migration.

### Measurement Contract and Procedure

1. Run preflight and create one unique hash-chained phase checkpoint. Store booleans and local target identity, never credential values.
2. Build the current app exactly once into a run-scoped diagnostic `distDir`; disable profiling. Keep build output out of the evidence and record only success/failure, source identity, build mode, and directory identity.
3. Start the built server on the selected loopback port; open one fresh real-auth browser context per existing J1 unit using the normal owner fixture.
4. Use existing J1 route/action sequence: open client roster, open first synthetic client, select Forms, then select Nutrition. The second click is planned at exactly `trustedEventAtMs + 2,000 ms` from the first Forms click. Preserve planned time, dispatch time, trusted event, and readiness time separately so a delayed actual event is visible.
5. Execute exactly three planned repetitions, `r1` through `r3`, under one fixture, one source/build identity, one browser mode, and the same local target. Do not repeat a started unit. Preserve each completed invalid/failed attempt and continue only to the next not-yet-started planned repetition.
6. Per-record eligibility requires all of: `validSample=true`; observation validity `VALID`; functional outcome `SUCCESS`; one accepted second click and exactly one click attempt; stable-policy Phase 52 event observed; exactly one completed Forms GET and one completed Nutrition GET; Forms lifecycle `1 setup / 1 start / 1 success / 0 abort`; complete second-action timeline. The historical total/API/RSC envelope is recorded as context only and cannot invalidate this default-stable diagnostic.
7. Record per action the route sequence, required request count/status and abort lifecycle, action-boundary timings, request start/header/body intervals, overlapping RSC/document/API requests, paired server timing, existing Phase 52/55 events, context commits, observed React profiler events if any, event timings, and clock-aligned long tasks. The React profiler remains disabled; do not install or build another profiler.
8. Only when all three J1 records are eligible, run one separate dirty-navigation smoke using the same synthetic local owner. Edit one synthetic form value in memory; choose Stay and assert the draft remains; attempt navigation again, choose Discard and assert Nutrition is visible; edit one synthetic value again, choose Save & Continue, assert exactly one `POST /api/clients/forms` with a 2xx response and Nutrition visibility. Capture only count/status/booleans; never record the body.
9. Mark smoke started/completed/failed in the checkpoint. If interrupted after `started`, do not repeat it automatically because its single local save may have reached the database. The fixture is explicitly synthetic and local; do not reset or delete the database to undo it.
10. Close Chromium and the local server in `finally`; verify the selected port is free. Write a separately identified sanitized evidence file referencing the source hashes and checkpoint hash chain.

### Failure and Stop Rules

- Supabase/auth/fixture/port/build failure before the first browser record is a concrete preflight/harness blocker. Record its sanitized class and stop; do not rotate credentials, rebuild repeatedly, seed/reset, or retry automatically.
- The recorded pre-checkpoint path-resolution failure above is the only repaired runner-startup issue. Do not retry any future started unit; the next invocation uses the corrected, typechecked, linted, and regression-tested runner identity.
- A failed/invalid attempt remains visible and does not count eligible. Capture the remaining not-yet-started planned units only; stop after r3. Do not take extra repetitions to replace invalid records.
- A started checkpoint unit without a completed event is not rerun. Report incomplete checkpoint and stop before the next action if the runner's no-retry guard is reached.
- If fewer than three eligible records exist, skip dirty smoke and close `BLOCKED` after the planned attempts. Do not claim smoke behavior.
- If any of the three records violates required Forms lifecycle, preserve the abort/setup/start counts and do not call the event a valid sample.
- If clock alignment is uncertain, mark long-task/event-timing overlap `UNAVAILABLE`; do not classify the absence of an aligned event as a clean main thread.
- If the save smoke fails or times out, preserve the one attempt and response status metadata, do not replay the mutation, and flag that the local fixture may have been changed.

### Completion Criteria

Phase 2 is accepted only when three eligible current-source records and the dirty smoke pass, with complete checkpoint/source/build identity and the server closed. Otherwise, it ends after the three planned attempts or a concrete blocker as `BLOCKED` with all records and failures retained. It is a diagnostic, never the official nine-scenario x20 acceptance run.

### Execution Result - 2026-09-22/23

The one run-scoped build passed. Three planned J1 records completed; all were observation-valid, functionally successful, stable-policy-observed, and eligible. Forms and Nutrition each had exactly one completed GET per record; Forms lifecycle was `1 setup / 1 start / 1 success / 0 abort`. The second click was accepted once in all records. Existing fan-out envelope failed as expected for this different policy/source and remained observation-only. Evidence: `docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-j1-dirty-registration-verification-v1-20260922T204750028Z-be78a2d5-cc2f-4fdb-9543-8f74559bb628_EVIDENCE.json`, SHA-256 `82A14522B96FE6757D1B041D89D568C2F1A462C9541ED04D7FEEDE7969C83CA2`.

The initial dirty smoke failed before Save & Continue because its `client-form-panel textarea` locator timed out in the local-normal fixture. That run and its blocked J1 checkpoint are retained. Both `inputValue` call sites preceded the POST listener and save action, so that attempt did not reach a mutation. Startup attempt 1 had failed before checkpoint/build/sample due to the runner app-root path; it is separately retained in `docs/AIYA_PERFORMANCE_DIRTY_REGISTRATION_FIX_PHASE_2_STARTUP_BLOCKER_EVIDENCE.json`, SHA-256 `A44D5F80F1E01440B04F09A60CD20242E8B79F27F01823DDCCA3957D28AD0A41`. The runner path correction was tested before the measured build.

The second-click stall was not reproduced in these three records: trusted-click-to-visible-Nutrition-ready was `914/872/936 ms`; the Nutrition response-body-to-ready interval was `700/690/498 ms`. Clock pairs were aligned (`33-35` pairs, `1.0-1.1 ms` spread); the long-task observer recorded zero long tasks per full trace. Two shell context commits were observed per interaction. The React profiler was disabled. The request timeline showed two overlapping API requests and no RSC request in the second-action window. No dominant function or root cause is established. See the read-only Phase 3 evidence below for the boundary-aligned event details and limitations.

### Smoke-only Selector Correction - 2026-09-23

The authorized smoke-only runner now selects the first visible, enabled `textarea` or `input[type="text"]` inside a `client-form-field-*` element. It does not start J1, rebuild the application, record field values, or capture a response body. It reuses the existing J1 build only after confirming the prior evidence hash, the three completed eligible J1 records, the saved J1 checkpoint, unchanged app source and build inputs, current local Supabase configuration, and embedded public Supabase settings. A second smoke-only invocation is refused after a smoke has started.

The first smoke-only invocation was blocked before server startup because the runner's expected prior-evidence hash had a transcription error. Evidence `docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-dirty-navigation-smoke-only-v1-20260922T213552307Z-475af6bd-8365-4168-8055-a7d4061aa20a_EVIDENCE.json`, SHA-256 `D8437B18402E175AAACFC87D88717070ED4107871D522F0F1A96FB3FA878DBD7`, records that blocker, zero smoke starts, zero server starts, a closed server state, and a free port. The checkpoint was preserved. A focused regression test now compares the configured SHA-256 with the actual preserved J1 evidence.

The corrected one-time smoke-only run is `docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-dirty-navigation-smoke-only-v1-20260922T213853024Z-950a560c-dc4c-49bb-b332-a4bb8750ea12_EVIDENCE.json`, SHA-256 `654801D5EBE4DFA2C9DAA5687D5DB340CAD436CD5BD376114C878862A17A3287`. It reused the validated local build and synthetic local owner. Stay preserved the draft; Discard navigated to Nutrition; Save & Continue issued exactly one `POST /api/clients/forms`, received HTTP `200`, and navigated to Nutrition. One synthetic form mutation completed. No field value or response body was recorded. The 10-event smoke checkpoint hash chain passed; the server closed and port `3167` was free.

The focused Node runner suite passed `7/7`; `node --check`, focused ESLint on the runner and test, and `git diff --check` passed. No application source changed in this smoke-only continuation, so the previously verified local build was reused.

The Phase 2 acceptance criteria are now met using the original three eligible J1 records plus this separate smoke-only checkpoint. The original J1 runner checkpoint remains `BLOCKED` as immutable history because its first smoke attempt failed; do not replay J1 or the successful smoke. The smoke validates only the local Stay/Discard/Save navigation contract. It does not change the `NOT_EVALUABLE` performance result or establish a global freeze root cause.

## Phase 3 - Read-Only Correlation and Decision Record

Status: `COMPLETE_READ_ONLY_ANALYSIS; PHASE_2_SMOKE_BLOCKER_SUBSEQUENTLY_CLOSED`

### Purpose

Use the saved Phase 2 traces to distinguish interaction acceptance, network/auth waiting, navigation/request activity, and browser main-thread/render work without another runtime run or code optimization. State exactly whether the stall appeared in these three records and whether evidence is sufficient to name a dominant candidate.

### Inputs and Components

- The exact Phase 2 evidence JSON, checkpoint id/hash chain, and Phase 1 source identity.
- `performance-plan-1-j1-second-action-timeline-analysis.mjs` functions and tests; Phase 2 already embeds one timeline per sample, so do not rerun the browser or rebuild.
- `HANDOFF_FOR_NEXT_CODEX.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, this action plan, and `docs/RISK_REGISTER.md` only when the assessed risk/current handoff changes.
- Leave `docs/AIYA_PERFORMANCE_PLAN_1_FINDING_MANIFEST.json` and the official Plan 1 closure unchanged unless a disposition-specific evidentiary threshold is actually satisfied.

### Analysis Steps and Data Flow

1. Verify Phase 2 evidence SHA-256, run id, source/build identity, local fixture class, checkpoint hash chain, sample count, and redaction flags.
2. For each sample, separate (a) measurement observation validity, (b) J1 functional success, and (c) performance outcome. Never collapse these into one PASS.
3. Confirm the trusted second click occurred after the scheduled 2,000 ms anchor; report planned-to-dispatch delay, click acceptance, route sequence, navigation re-entry, Forms/Nutrition request and abort counts, and visible ready boundary.
4. Read the aligned request timeline: required request start, response headers, body completion, bootstrap/document/RSC intervals, and server timing spans. Retain request-summary versus action-boundary deltas as instrumentation differences.
5. Read browser events in the same trusted-click-to-ready window. Use `longTasksInWindow`/event timings only when paired wall/performance samples are `ALIGNED`; when status is `UNAVAILABLE` or `UNCERTAIN`, report unknown. Report Phase 52/55 context and any existing React commit event separately; no React commit event is not a zero-render claim.
6. For each record, state the largest directly bounded interval (trusted click to required response body, body to ready, or ready to parse/render complete) only when both endpoints exist. Describe it as a boundary, not causal attribution.
7. Compare all three records and report spread/range without a causal speed threshold. If all three do not reproduce a stall, use exactly “not reproduced in these three runs”; do not say resolved or fixed globally.
8. If latency is dominated by request waiting, name the exact endpoint and observed server timing span as the leading candidate. If the body is ready but the UI-ready tail is large and aligned main-thread work overlaps, name the specific measured event boundary. If evidence does not distinguish them, preserve `UNRESOLVED` rather than selecting a subsystem.
9. Produce a new uniquely named Phase 3 analysis evidence file containing the Phase 2 evidence hash, checkpoint reference, three per-record summaries, alignment availability, limitations, and non-claims. Do not modify historical source evidence.
10. Update both handoff documents to the same exact next decision. Mark this action plan complete only when evidence, consistency check, privacy scan, and `git diff --check` pass.

### Error Cases, Tests, and Completion

- Missing/corrupt evidence, checkpoint-hash mismatch, or source-hash mismatch blocks interpretation; no record is repaired or substituted.
- A long-task clock without two close pairs is reported unavailable. A request origin with divergent inferred origins is not plotted in the shared timeline.
- Existing focused analyzer tests must remain passing; no full suite or official acceptance suite is restarted.
- Completion requires a source-linked Phase 3 evidence record; all attempts and invalid samples accounted for; network versus browser-work statement supported by aligned boundaries; handoff and action-plan status consistent; sensitive-data scan clean; `git diff --check` clean.
- Final decision remains bounded: no root cause or performance recovery claim without at least three matched valid records and a reproducible single-variable experiment; no Plan 2 eligibility change from mere non-reproduction.

### Execution Result - 2026-09-23

Read-only analysis is recorded in `docs/AIYA_PERFORMANCE_DIRTY_REGISTRATION_FIX_PHASE_3_ANALYSIS_EVIDENCE.json`, referencing the Phase 2 evidence SHA-256 and verified checkpoint. The repeated second click was accepted and became visibly ready in all three records; therefore the narrow stall was not reproduced in these three runs. The largest directly bounded interval was Nutrition response body to visible panel readiness (`498-700 ms`), but no profiler measurement or long task attributes that interval to React or a specific function. The click Event Timing records begin `1.6-3.0 ms` before the trusted-event boundary and their processing ends `8.6-12.0 ms` after it; they were excluded by the existing start-inside-window filter, so the evidence reports them separately from the window summary.

The captured `49 total / 24 API / 3 document / 22 RSC` request shape does not match the historical legacy envelope and is not a performance control. J1 observation/function gates passed `3/3`; performance remains `NOT_EVALUABLE`. The dirty smoke remains blocked at its textarea selector and did not reach its save path. No J1 or smoke retry is authorized by this run. Plan 1 remains `COMPLETE / DIAGNOSIS_BLOCKED`, finding dispositions and Plan 2 eligibility remain unchanged, and production remains `NO-GO`.

## Phase Ledger

| Phase | Status | Evidence | Runtime capture | Decision |
|---|---|---|---|---|
| 1. Stable registration and measurement readiness | COMPLETE | `docs/AIYA_PERFORMANCE_DIRTY_REGISTRATION_FIX_PHASE_1_EVIDENCE.json` | None | Corrected runner path in one separately recorded startup incident |
| 2. Three J1 records and dirty smoke | COMPLETE using separate smoke checkpoint; original J1 runner remains BLOCKED | Phase 2 J1 evidence, smoke-only evidence, and both preserved preflight/startup blockers | One build; exactly 3 eligible J1 records; one synthetic save POST returned 200 | Local dirty-navigation contract passed; performance remains NOT_EVALUABLE |
| 3. Read-only correlation | COMPLETE | `docs/AIYA_PERFORMANCE_DIRTY_REGISTRATION_FIX_PHASE_3_ANALYSIS_EVIDENCE.json` | None | Stall not reproduced in three runs; root cause unresolved |

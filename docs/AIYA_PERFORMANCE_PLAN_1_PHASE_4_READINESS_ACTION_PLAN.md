# AIya Performance Plan 1 Phase 4 Readiness Action Plan

## 1. Purpose and boundary

This action plan implements the first three recommended work items before the
Plan 1 Phase 4 baseline is allowed to continue:

1. lock the current requirements, evidence contract, and five-finding closure
   matrix;
2. make the Phase 4 measurement harness reject invalid evidence instead of
   converting it into a valid sample; and
3. prepare and verify the four measurement environments without using
   production data or production runtime.

This is a readiness implementation for **AIya Performance Plan 1, Phase 4**.
It does not capture a new four-environment baseline, prove a runtime root
cause, apply a runtime performance fix, create Plan 2, or authorize a
production deployment.

The existing canonical Phase 4 run remains historical evidence of
`BLOCKED / PERFORMANCE_BLOCKED` until a new Phase 4 run is explicitly started
after the readiness gate closes.

## Current Step 3 execution record - 2026-09-14

The Phase 4 baseline launcher now binds readiness to the measurement start.
Before stage 4.1 can build or start the local measurement server, it runs
`app/scripts/performance-plan-1-phase-4-readiness.mjs` as a child process with
the same repository runtime directory and process environment. The launcher
then requires the fresh readiness evidence to have a successful command exit,
`COMPLETE / READY_FOR_PHASE4_BASELINE`, ordered H1-H4 completion, four
measurement environments at `PASS`, `baselineStarted=false`, real hosted
password-login plus shell-bootstrap body-finish, the approved `hosted.env`
source, and `PASS` evidence integrity.

The start gate also compares the raw local Supabase and hosted input values in
memory before and immediately before server start, without writing them to
evidence, and compares the full source/fixture/migration/build identity with
the readiness identity. The local production build is reused only after this
identity check; if any check fails, the local server and all 20-sample
measurement stages remain unstarted. The readiness build is therefore not a
performance baseline and the canonical Phase 4 evidence remains the prior
blocked run until the separately authorized baseline command is executed.

Implementation verification used readiness run
`aiya-phase4-readiness-20260914T184904329Z`: H1-H4, all four environment gates,
redaction/integrity, and the direct measurement-start gate evaluation passed;
`baselineStarted=false`. Targeted Phase 4 tests are `31/31 PASS`, readiness
tests are `9/9 PASS`, typecheck and production build pass, and lint has `0`
errors with the existing `74` warnings. No baseline, runtime change,
deployment, migration, account, PWA installation, or production action was
performed.

## Supporting Step 2 execution record - 2026-09-14

Readiness run `aiya-phase4-readiness-20260914T184904329Z` executed the phone
and installed-PWA gates without starting the Phase 4 baseline. It found one
authorized physical Android device and passed Chrome package inspection,
Chrome launch, CDP forwarding and handshake, and the hosted-origin target in
normal Chrome. It discovered one installed WebAPK, resolved its launch
activity, launched the existing package independently, and passed the normal
Chrome hosted-origin target plus the PWA hosted-origin, standalone,
active-service-worker, and online target checks. The readiness path also
retains the same-CDP-session navigation for the Android `chrome-native://newtab`
case.
The connection monitor passed all 13 checks and recorded no device serial.
Local Supabase, Docker, and the local build also passed. H1-H4 and the final
readiness closure are `COMPLETE` with outcome `READY_FOR_PHASE4_BASELINE`.
No Phase 4 baseline has started; no account/VPS/PWA installation, runtime,
migration, deployment, or production change occurred.

## 2. Ordered closure rule

The work is split into four ordered phases: H1 requirements lock, H2 harness
reliability, H3 environment readiness, and H4 readiness rehearsal. Each phase
has a ledger. A stage may be marked `COMPLETE` only when every action listed in
that stage has been performed and its evidence reference exists. A later stage
cannot start while the previous stage is `FAILED`, `BLOCKED`, or `STALE`.

After all stages in a phase are complete, the final checks are run. The phase
still does not close unless all of the following are true:

- every ordered stage has status `COMPLETE`;
- all required tests pass with zero unexpected, skipped, stale, simulated, or
  blocked results;
- the evidence JSON passes schema, identity, redaction, and consistency checks;
- the relevant handoff, risk, and next-phase records agree with the evidence;
- the production decision remains `NO-GO` and the declared exclusions remain
  unchanged.

If any required action cannot be performed, the phase is `BLOCKED`; passing
unit tests alone cannot close it.

## 3. Locked finding matrix

The five findings remain separate records. A measurement gap is not a runtime
performance fix.

| Finding | Required measurement | Closure result allowed by this readiness plan |
| --- | --- | --- |
| `PERF-F2-001` broad app-state load | Authenticated valid samples with required reads, body-finish, task-ready, and request counts | `MEASUREMENT_READY`; runtime cause remains open until Plan 1 causal experiments |
| `PERF-F2-002` background refresh contention | Authenticated valid samples plus complete mutation/request allowlist and background-window evidence | `MEASUREMENT_READY`; no hook change in this plan |
| `PERF-F2-003` dashboard import/render load | Real click/ready/paint/long-task evidence with valid request timing | `MEASUREMENT_READY`; no import or render change in this plan |
| `PERF-F12-001` AI Chat auth/measurement gap | Authenticated conversation-list `2xx`, body-finish, usable workspace, no fallback/demo path | `MEASUREMENT_GAP_RESOLVED` only when all gates pass; otherwise `OPEN_BLOCKED` |
| `PERF-F12-002` warm AI Chat candidate | The same valid AI Chat samples after the measurement gap is closed | `MEASURED_CANDIDATE_PENDING_VALID_AUTHENTICATED_REPRODUCTION`; no causal claim here |

No finding can be marked `CAUSE_CONFIRMED` by a budget overrun, a static code
risk, a failed login, a timeout, a `401/403`, or a stale/simulated run.

## 4. H1 - Requirements and execution contract lock

### H1.1 Authority and scope lock

Read and record the active Plan 1 action plan, parent Revizyon 2 plan, latest
Phase 2/3 evidence, latest Phase 4 evidence, finding manifest, risk register,
next-phase plan, and handoff. Record the current Git branch, HEAD, upstream
HEAD, worktree status, and `git diff --check`. Historical records are hashed
and never rewritten as if they were a new run.

### H1.2 Source, artifact, fixture, and migration identity lock

Hash the Phase 2 scenario source, Phase 4 harness source and tests, readiness
contract source, package lock, Next configuration, service worker, manifest,
Phase 3 evidence fixture hash, and the Phase 4 migration file. If a local
standalone build exists, record its build-id/artifact hash. Missing values are
recorded as `MISSING`, never guessed.

### H1.3 Environment contract lock

The only valid environments are:

- `local_desktop`: local Supabase, local standalone production build, desktop
  Chromium;
- `owner_pc_hosted`: approved synthetic hosted URL and account, owner-PC
  Chromium;
- `android_chrome`: physical Android Chrome CDP target on the approved hosted
  URL;
- `installed_android_pwa`: the installed AIya PWA in standalone display mode,
  controlled by its service worker, on the same physical device.

Browser emulation, the customer/admin live domains, fallback store, demo cookie,
service-role measurement, and a PWA-like browser tab are invalid substitutes.

### H1.4 Measurement and validity lock

Every scenario requires 20 valid authenticated samples and at most 28 attempts.
Cold login uses `page.goto`; warm scenarios use the same authenticated browser
context and real trusted clicks without a page reload. A sample is invalid if
its ready selector is missing, target is unusable, required read is missing or
non-`2xx`, response body is unfinished, any request fails, an unlisted mutation
occurs, the sample has an error, fallback/demo auth appears, or timing cannot
be measured.

Timing fields are separated into header-received, body-finished, task-ready,
trusted-event-to-next-paint, LCP, CLS, and foreground long-task values. Percentile
budgets are evaluated over valid samples after collection; invalid samples never
enter a percentile.

### H1.5 Safety and side-effect lock

The readiness work does not write production data, deploy, push, merge, alter
secrets, create a hosted account, apply a remote migration, connect Z.ai,
send WhatsApp/Telegram traffic, run billing, or start production workers.
Local service-role use is limited to pre-existing local fixture inspection or
fixture tooling; measurement itself uses the normal password-authenticated
user path.

### H1.6 H1 closure

H1 is complete only when the five-finding matrix, four-environment matrix,
identity list, validity rules, safety exclusions, and ordered ledger are present
in the readiness evidence and the evidence redaction check passes.

## 5. H2 - Measurement harness reliability

### H2.1 Preserve the existing scenario contract

Keep the nine Phase 2 scenario IDs, required selectors, required reads, allowed
mutations, forbidden mutations, budgets, and 20-sample count. Reconcile only
the known current-code read paths already documented by Phase 4. Do not loosen
the acceptance contract to obtain `PASS`.

### H2.2 Capture the trusted interaction boundary

Arm a page-level interaction recorder immediately before each cold submit or
warm journey. Record only an `isTrusted` browser click, persist the event wall
time across a full login navigation, and resolve the first `requestAnimationFrame`
after that event. Do not measure a frame scheduled after the ready selector as
the event-to-paint value.

### H2.3 Capture required response timing

For every required `GET`, require a `2xx` response, finite header-received time,
and finite body-finished time. A response body timeout, failed request, or
missing required route is an invalid sample and is retained in the discarded
attempt summary.

### H2.4 Enforce the mutation contract

Parse mutation contracts using a method suffix at the end of the route pattern.
Reject every `POST`, `PUT`, `PATCH`, or `DELETE` that is not listed in the
scenario allowlist. Record forbidden and unlisted mutations separately. This
prevents an unlisted write from passing merely because it was not in the
forbidden list.

### H2.5 Propagate sample errors

Any non-empty `sample.error` makes both functional and validity status `FAIL`.
Retry records retain the scenario, sample ID, error class, and request summary;
the retry is never counted as a successful sample.

### H2.6 Evaluate percentile budgets after collection

Enforce the locked Phase 2 task-ready, event-to-next-paint, required-read
body-finish, LCP, CLS, and long-task budgets at the scenario summary level.
Report validity and speed budget status as separate fields.

### H2.7 Preserve failed attempts

Do not discard a failed attempt without recording all captured scenario outcomes.
Only a complete attempt contributes its scenario samples to the valid pool.
The discarded-attempt ledger must prove that authentication/network/timeout
errors were not converted into valid performance samples.

### H2.8 Correct physical-device target wiring

Android Chrome and installed PWA runs must use the approved hosted base URL and
hosted synthetic password credentials. They must never use the local URL,
local fixture password fallback, or an emulated device. Each CDP profile must
carry its own `status`, and the environment closure gate must verify it.

### H2.9 Stale and redaction gates

An environment with status `STALE`, a changed hosted release identity, missing
origin verification, or missing PWA standalone/service-worker state cannot
close. Evidence sanitization is recursive for both object keys and scalar
values; passwords, tokens, auth headers, cookies, raw bodies, prompts, clinical
content, and private identifiers are never written.

### H2 closure

H2 is complete only when targeted positive and negative tests cover each rule
above, the current Phase 4 harness imports cleanly, and no invalid sample can
be classified as valid in the negative probes.

## 6. H3 - Four-environment readiness

H3.1 verifies the local Supabase URL is `127.0.0.1:54321`/`localhost:54321`,
Docker/Supabase status is readable, the Phase 3 fixture evidence is complete,
and no reset/seed is needed for the readiness pass.

H3.2 verifies the local production build can receive only local Supabase
environment values in its child process, with fallback/demo disabled and no
`.env.local` overwrite.

H3.3 verifies the approved hosted synthetic URL and account inputs are loaded
only from the regular, non-symlink repo-root file
`.manu-runtime/performance-phase4/hosted.env`. The file is parsed with the
Node environment parser and must provide the exact three
`AIYA_PHASE4_HOSTED_BASE_URL`, `AIYA_PHASE4_HOSTED_EMAIL`, and
`AIYA_PHASE4_HOSTED_PASSWORD` keys. Process-environment values may agree with
the file but cannot override it; a missing file, missing key, parse error, or
source conflict blocks the stage. Presence is recorded as booleans only; the
script never asks for, logs, or writes a password.

H3.4 verifies the approved hosted release-health endpoint with a bounded
request before any authenticated run and after the run group. The response
must be HTTP 200 and JSON `apiStatus=ok`; a release or migration fingerprint
change marks the group `STALE`.

H3.5 verifies a single authorized ADB physical device, Android Chrome package,
Chrome launch, local CDP forwarding, and a real Playwright CDP handshake. The
serial is used only in-memory and is never recorded. The readiness harness
then opens the approved hosted origin through Android's explicit Chrome view
intent and polls the connected physical Chrome targets until a normal,
non-standalone, online hosted target appears. A PWA target cannot satisfy this
Chrome gate. More than one authorized device, an unauthorized/offline target,
failed Chrome launch, failed forwarding, failed CDP handshake, missing normal
Chrome target, or a lost connection blocks the stage.

H3.6 verifies the existing installed PWA without installing or reinstalling
anything. It discovers exactly one `org.chromium.webapk.*` package from the
connected device, resolves its launch activity with the package manager, and
launches that package through ADB. It then polls the already connected CDP
browser until a target has the approved hosted origin, standalone display
mode, an active service-worker controller, and `navigator.onLine=true`. A
normal browser tab, an about:blank target, a Chrome error page, or a target
without service-worker control is invalid PWA evidence. The phone connection
is checked before and after each launch, during target polling, and before
closure; any failed check records a blocked result. The current verified
PWA package is recorded only as a non-secret package identifier; the device
serial and command output are never recorded.

H3 closure requires all four environment prerequisites or records an explicit
`BLOCKED` result with the first unmet condition. It does not fabricate hosted,
Android, or PWA readiness from local results.

## 7. H4 - Readiness rehearsal and handoff

H4 runs only after H1-H3 are complete. It verifies the no-baseline rehearsal
and the actual Phase 4 launcher gate: the launcher must run this readiness
command first and must not start its local server or any 20-sample stage until
the returned evidence passes every required condition. H4 is not the
20-sample baseline and cannot close Plan 1 Phase 4.

H4 records the resolver/proxy/cache/profiler settings, target release identity,
fixture alias/hash, and every blocked or failed gate. A DNS bypass, if later
used by an explicitly approved diagnostic experiment, is recorded as a
diagnostic condition and is never presented as natural-DNS performance.

## 8. Required files and commands

Implementation and evidence files:

- `app/scripts/lib/performance-plan-1-phase-4-contract.mjs`
- `app/scripts/performance-plan-1-phase-4.mjs`
- `app/scripts/performance-plan-1-phase-4-readiness.mjs`
- `app/scripts/performance-plan-1-phase-4.test.mjs`
- `app/scripts/performance-plan-1-phase-4-readiness.test.mjs`
- `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_READINESS_EVIDENCE.json`
- `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE.json` (only when a new Phase 4
  run is intentionally started)

Required verification commands after all code changes:

- `npm run test:performance-plan1-phase4`
- `npm run test:performance-plan1-phase4-readiness`
- `npm run audit:performance:plan1:phase4:readiness`
- `npm run test:performance-phase2`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- secret/evidence scan and `git diff --check`

## 9. Final readiness result

The successful local implementation result is `READY_FOR_PHASE4_BASELINE` only
when H1-H4 all close. If approved hosted inputs or the physical Android/PWA
target are unavailable, the correct result is
`READINESS_BLOCKED_HOSTED_OR_DEVICE`; this leaves the canonical Phase 4 status
blocked and keeps the next action at Phase 4 stage 4.1.

This readiness plan never changes the production decision: `NO-GO`.

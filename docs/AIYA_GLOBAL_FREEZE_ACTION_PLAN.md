# AIya Global UI Freeze: Action Plan

Date: 2026-09-28  
Status: `HOSTED_PHASE_1_BLOCKED / attempt_budget_exhausted (0/3 valid paired records; 5/5 attempts used); LOCAL_AUTH_SMOKE_COMPLETE_LIMITED_SCOPE / GLOBAL_FREEZE_UNPROVEN`  
Owner approval: user authorized the original diagnostic on 2026-09-24, the local candidate continuation on 2026-09-25, and local Docker/Supabase startup plus authenticated synthetic smoke on 2026-09-26.  
Plan authority: this document governs the separate global-freeze continuation. It does not reopen or revise Plan 1.

## Supplemental 12-Click Hosted Navigation Observation - 2026-09-28

After user sign-in, 12 visible navigation clicks were sent in the sequence
`Ayarlar -> Diğer -> Ana Sayfa`, repeated four times. The final URL returned to
`/dashboard`, but a screenshot showed loading skeletons and the accessibility
state read `Loading AIya workspace`; the dashboard content was not confirmed
loaded in those observations. This is a user-visible loading-stall observation
after sequential navigation, unlike the earlier five-click run that settled.

The click calls were awaited serially. Their API call durations were
`137, 1018, 1011, 991, 1020, 987, 989, 1071, 935, 1004, 1014, 1006` ms.
These are not browser input timestamps; exact input-event gaps were not
measured, and this control path did not deliver verified sub-500-ms clicks.
No keyboard entry or form was used. No raw trace, request/RSC timeline, host
sample, or database metric was captured. Therefore the loading state is
observed, but duration and cause are unknown; do not attribute it to browser,
network, server, database, or client coordination from this run.

Evidence:
`docs/AIYA_GLOBAL_FREEZE_HOSTED_EDGE_12_CLICK_NAVIGATION_20260928T135230Z-c669a43a-d4c5-4951-8c36-0ceabbe32ad2_EVIDENCE.json`.
SHA-256 `BB4AC6038FC5E244B94631BE6D8ACAAC1D08579140219743E034A4207B43A6FF`.
This supplemental observation does not alter hosted Phase 1, which remains
`BLOCKED`, 0/3 valid paired records, 5/5 attempts consumed. Do not repeat the
same navigation-only sequence or change source from this observation. A
causal follow-up requires timestamped input events correlated with request/RSC
completion and the visible loading transition, using a supported capture path
and a separately approved identity if it is to be a formal phase record.

## Supplemental Authenticated Edge Rapid-Navigation Observation - 2026-09-28

After the user signed in to the existing hosted Dashboard in Edge, one
five-click sequence was sent through visible navigation links:
`Ayarlar -> Diğer -> Ana Sayfa -> Ayarlar -> Ana Sayfa`. The gaps between a
mouse release and the next press were 348, 429, 331, and 372 ms. All five
clicks appear in the in-memory browser trace. Each destination URL path was
visible at its 250 ms check, while the selected-navigation marker still showed
the preceding link; the final URL and marker eventually settled on Dashboard.
This run did not exercise typing, a form, or reload and did not reproduce the
reported full interaction freeze.

The trace had one renderer main thread, no `RunTask` at or above 50 ms (longest
49 ms), and no click `EventDispatch` at or above 50 ms (longest 5.9 ms). The
Network event buffer was not truncated, but two requests were incomplete at
capture end: 36 starts, 34 responses, 33 finishes, one canceled
`/api/conversations` request, and 33 fully paired requests. Five RSC requests
were observed with status-200 responses. Repeated reads included
`/api/shell/bootstrap` 5 times (maximum 1,032.7 ms), `/api/app-state` twice
(maximum 1,024 ms), `/api/alerts` twice (maximum 1,023.3 ms), and
`/api/notifications` twice (maximum 865.5 ms). The cancellation was
`net::ERR_ABORTED` with no HTTP status, consistent with navigation
cancellation; it is not evidence of a server HTTP error. These timings show
overlapping app reads but do not distinguish network, server, database, or
client-coordination wait.

Edge script-source attribution was unavailable, so this is not an
extension-free comparison. The 77,143-event trace (18,280,518 bytes;
SHA-256 `1bb281144c2ed04ea5dffdac63e6aacfd2b92d7e6ddd9a70de2389de247b7d8d`)
was held in the browser automation session and was not persisted as a raw
file; no host sample or checkpoint was paired with it. The sanitized summary
is preserved separately at
`docs/AIYA_GLOBAL_FREEZE_HOSTED_EDGE_RAPID_NAVIGATION_20260928T122937Z-0da3e09e-fcc2-41d9-bd3c-fd7e7b88d922_EVIDENCE.json`
(SHA-256 `39B832779D828D8E156C54F8D9AEF3C9926F7CBE1A89742383453B2F2DD49B55`).
This is informative supplemental evidence only: hosted Phase 1 remains
`BLOCKED`, 0/3 valid paired records, 5/5 attempts consumed. Do not repeat this
same navigation-only sequence as a new diagnosis or make a source change from
this observation. The next useful interaction check must include the reported
synthetic keyboard-entry step, then a rapid sequence of visible navigation
actions, and correlate visible response with request/RSC timing; it remains a
separate, bounded observation unless a supported host-paired trace path is
available and separately approved.

## Supplemental Chrome Reload Observation - 2026-09-28

After the user approved a short browser check, one reload of the authenticated
hosted Dashboard was captured in Chrome. The page's navigation timing reported
1,988.5 ms to `responseStart`, 4,011.6 ms to `DOMContentLoaded`, and 8,053.5 ms
to `loadEventEnd`; the browser-control `reload()` call returned after 4,077 ms.
The renderer trace contained 13 `RunTask` slices of at least 50 ms, with a
1,790 ms longest task containing a 1,789.8 ms `ParseHTML` slice. It also
contained 45 Chrome-extension `EvaluateScript` slices totaling 4,873.1 ms
(maximum 1,010.9 ms); same-origin app-script evaluation totaled 645.8 ms
(maximum 530.9 ms). These are coexisting observations in one browser session,
not proof that any single layer caused the reported freeze. Fourteen observed
app Fetch requests returned 200; the slowest captured was `/api/app-state` at
2,180.3 ms. Network-event retention was truncated, so request totals and order
are incomplete.

The Chrome trace stream parsed successfully (146,041 events, no trace-level
data-loss flag; SHA-256
`745e29bfed84d73ce55133992f9e0fcef67c53f62a7d6e952b72fdbcff45bfa6`), but it
was not paired with a host sample and did not exercise typing or clicking. A
second browser opened at the login page, so no extension-free authenticated
comparison was possible. Evidence is
`docs/AIYA_GLOBAL_FREEZE_HOSTED_CHROME_RELOAD_OBSERVATION_20260928T120031Z-066fe1dc-43e9-44c3-9e96-1242df8e1a24_EVIDENCE.json`
(SHA-256 `B842212AB39FFE5784BFF61BFD63D0D47B80AF96F9DE97914443AEB62B1642D6`).
This is informative but not a valid Phase 1 record; the formal Phase 1 state
remains `BLOCKED`, 0/3 valid paired records, 5/5 attempts. Do not merge it
into the exhausted identity, change runtime code, or claim a root cause.
Next discriminating check: a separately authorized, bounded authenticated
browser capture with extension scripts absent and complete Network-event
retention. The second browser needs a user-owned sign-in; no credentials were
requested or entered during this observation.

Latest hosted Phase 1 authority note, 2026-09-27: after the user signed in and
authorized continuation, all five attempts for source fingerprint
`313412677093b58cfbd61401ed7ece7b048d537d8a9d570a2a67bccf6e583310` and hosted
release `hs-1c9756046b01-b55ed4ff550f` were consumed. Each attempt retained a
150-sample host capture and a hash-chained checkpoint; none has a persisted,
aligned browser trace, so the valid paired-record count is `0/3`. Across the
five windows the application process stayed present, host CPU averaged
`5.85-6.38%` and peaked at `28.77-58.33%`, and swap, cgroup throttling/OOM,
memory pressure, and IO pressure deltas were zero. These unpaired windows do not
exclude transient server, database, network, auth, or browser causes.

The browser-control attempts produced mixed, harness-dependent observations:
the third attempt's reload call returned in `478 ms`, but its trace-completion
event was unavailable after reload; in the fourth attempt, focus, sequential
typing, Forms navigation, and a later URL read timed out in the browser-control
surface; in the fifth, a page-side `Date.now()` evaluation returned in about
`0.13 s`, while CDP mouse/key dispatch timed out and a reload command produced
no captured load event. These results are not proof that the hosted page froze,
and the reload duration is unknown for the fifth attempt. No form was submitted
and no production/runtime source, database, configuration, or secret changed.

The phase is formally `BLOCKED / attempt_budget_exhausted`, with five attempts
and zero valid paired records. Evidence:
`docs/aiya-global-freeze-phase-1-20260927T203028151Z-ba4f64ee-de8c-4661-8142-d4f4d9df4637_EVIDENCE.json`
(SHA-256 `97DE789E4A62A2F0CCE7899412CE6B6B4E6712144E8DC799DC2CF8ABD4375919`).
It records the five run IDs, host sample hashes/summaries, release identity,
failure codes, and `rawTraceOrHostSamplesEmbedded: false`. Checkpoint event
chains for all five attempts passed verification during finalization. This
supersedes the earlier instruction to resume when CDP becomes available: do not
start another attempt under this identity, do not start Phase 2, and do not
change runtime code. Any future Phase 1 continuation needs separate approval
for a fresh bounded evidence identity and a trace-transfer path proven to
complete with at least 80 seconds of host overlap before consuming a run.

Trace-transfer preflight update, 2026-09-28: the existing Chrome CDP trace
stream completed with no reported data loss, and a post-capture clock probe
estimates 89.127 seconds of overlap with a read-only 100-sample host window.
This is not a valid paired record: host rows were not persisted, clock
alignment is estimated rather than checkpointed, and the 5.7-million-character
trace could not be transferred to a local file (`Runtime.evaluate` timed out;
the expected download file was absent). The existing sanitizer was therefore
not run. A recovery reload followed the injected transfer attempt; page state
after reload was not verifiable, so that reload is not app-performance
evidence. No app interaction, form submission, runtime/source change, database
write, secret/configuration change, or deployment occurred. Evidence:
`docs/AIYA_GLOBAL_FREEZE_TRACE_TRANSFER_PREFLIGHT_20260927T214247Z-8f5ac140-9912-405a-a88e-9aad6d980506_EVIDENCE.json`
(SHA-256 `9607D072DC76989F81892C7AA549E5B0B08E71C6EE26CA61A3103804695393F3`).
The Phase 1 state remains `BLOCKED / attempt_budget_exhausted`, 0/3 valid
paired records, 5/5 attempts. Do not open a new run or repeat the v1 identity.
The next gate is a non-live-page, local trace-file transfer test followed by
successful import through the existing sanitizer; only after that gate and
separate approval may a newly versioned bounded capture phase be considered.

Local synthetic-file sanitizer preflight, 2026-09-28: the focused existing
test passed 1/1 using a gzip-compressed synthetic Chrome trace created in a
temporary local file. `readChromeTrace` accepted it, retained one sanitized
event, left the source bytes unchanged, and the test removed its temporary
directory. This proves local-file import and sanitizer behavior for a tiny
synthetic fixture only; it does not test Chrome/CDP export or transfer of an
actual trace. Evidence:
`docs/AIYA_GLOBAL_FREEZE_LOCAL_TRACE_SANITIZER_PREFLIGHT_20260928T092828Z-0af9f788-0845-435e-92ad-1d3c8380c723_EVIDENCE.json`
(SHA-256 `B6DBEE968F3997358ED41B0502C6C362B1B1039B2E19C6CBE051001BC89994CB`).
This narrows the remaining preflight gate to proving a supported
Chrome/CDP-to-local-file path without page-side bulk injection and importing
that exact exported file through the sanitizer. No Phase 1 run, checkpoint,
browser action, host capture, application change, or root-cause finding was
created. The official status remains `BLOCKED / attempt_budget_exhausted`,
0/3 paired records and 5/5 attempts; a new measurement identity still requires
separate approval.

Browser export bridge follow-up, 2026-09-28: the synthetic-file sanitizer
passed, but a separate attempt to open a tiny synthetic `data:` download page
in a newly created blank Chrome tab was rejected by the browser URL policy
before navigation. The rejection explicitly disallowed pursuing the same
result through raw CDP, another browser surface, or a workaround. No download,
trace, or new checkpoint was produced; no hosted AIya tab was opened or
changed. Evidence:
`docs/AIYA_GLOBAL_FREEZE_TRACE_EXPORT_POLICY_BLOCK_20260928T095640Z-b69eaddf-a297-4bfb-a5ea-7291a6c44c22_EVIDENCE.json`.
(SHA-256 `804AE205B5C9A2F82CFBC3D1BAAD8923976A56298F0ABDAC512498DFA0AAF39F`).
The export-to-local-file gate is therefore `BLOCKED_BY_BROWSER_URL_POLICY`,
not passed. Stop browser export attempts here. The v1 budget remains 5/5, 0/3;
any new capture requires a platform-supported transfer path and separate
approval.

Local candidate authority note, 2026-09-27: the previously approved local stack and
authenticated synthetic smoke completed in a new isolated candidate worktree
based on hosted commit `1c9756046b01cb1bd224fb601ec9094a7f471606`. One desktop
Chromium run passed the bounded functional flow: keyboard entry completed in
524 ms, the second Forms click was handled, and the expected dirty-draft guard
appeared after 122 ms; discard cleared the draft. No client mutation was sent.
The run counted four RSC requests but did not classify prefetch versus
transition traffic. It did not test reload, Android, or the hosted release;
raw Playwright timeline, React profile, and long-task trace were not persisted.
This is not a general-freeze reproduction or resolution and gives no root-cause
attribution. Focused tests passed 25/25, production build/typecheck passed with
79 static pages, and targeted lint passed with zero warnings on the six changed
and test files. No local migration ran and no production system, environment
file, or secret changed. Cleanup restored synthetic Auth and tenant counts to
baseline, retained two append-only synthetic audit rows, and stopped the app
server; the pre-existing Supabase stack remains running.

New evidence:
`docs/AIYA_GLOBAL_FREEZE_LOCAL_AUTH_SMOKE_20260927T114124Z_EVIDENCE.json`
(SHA-256 `6310A4B079589505F4D6EBB92CA764C1D55B2226BAADD1B38C02DD55A928D4EA`).
Its COMPLETE 9-event checkpoint is
`.manu-runtime/phase-execution/aiya-global-freeze-local-auth-smoke-v1/aiya-global-freeze-local-auth-smoke-v1-20260927T114124Z-ed0b740b-9518-4f76-bb91-ffafd02fbe19`.
The prior candidate worktree was missing; recorded source patches were
rehydrated into `C:\Users\Dell\.codex\worktrees\aiya-freeze-candidate-restore\MANU-AI`.
Four hashes differ from the 2026-09-25 candidate solely because of line
endings; two match exactly, and whitespace-at-EOL-insensitive diff found no
additional logical differences. Keep this candidate isolated and uncommitted.
Commit and deployment still require separate approval. Hosted Phase 1 remains
blocked with 0/3 valid paired records; Plan 1 remains
`COMPLETE / DIAGNOSIS_BLOCKED`, Plan 2 eligible findings remain zero, and
production remains `NO-GO`.

Historical authority note, 2026-09-26: the user approved starting the local
Docker/Supabase stack and running the authenticated synthetic smoke; this also
covers configured local migrations on first local startup. The attempted Docker
Desktop launch did not make its daemon available, and this session could not
open the stopped Windows service. Supabase did not start and no migration ran.
The exact 2026-09-25 candidate worktree is missing, and none of its six source
hashes match files in the six currently existing worktrees. Therefore the
smoke did not run; the dirty main checkout was not substituted. New evidence:
`docs/AIYA_GLOBAL_FREEZE_LOCAL_SMOKE_PREFLIGHT_20260926T160854Z_EVIDENCE.json`
(SHA-256 `4DEE2B83A8633CA6710B0149AD3C91B9CD0A015DA2EDD3FA16B4AAED2444D8D5`).
At that date this blocked preflight did not change the hosted-capture blocker
or establish a global-freeze cause. The 2026-09-27 local smoke result above
supersedes only this preflight's current-status conclusion. Commit, deployment,
and production writes remain unauthorized.

Historical 2026-09-25 candidate validation: the isolated candidate was based
on hosted commit `1c9756046b01cb1bd224fb601ec9094a7f471606`; focused tests passed
25/25, typecheck and build passed, and lint reported 0 errors/74 warnings. Its
authenticated browser smoke was not run. The candidate is not a proven
global-freeze fix and remains uncommitted/undeployed.
Candidate evidence:
`docs/AIYA_GLOBAL_FREEZE_CANDIDATE_FIX_20260925T171107533Z_EVIDENCE.json`
(SHA-256 `6B010AF500FEB079A783B6C98387D3B5FCCCF9CBB994687BC49FC4B3731FB1D9`).
The isolated candidate is based on hosted commit
`1c9756046b01cb1bd224fb601ec9094a7f471606`; focused tests passed 25/25,
typecheck and build passed, and lint reported 0 errors/74 warnings. Its local
authenticated browser smoke was not run because Docker and local Supabase were
unavailable. The candidate is not a proven global-freeze fix and remains
uncommitted/undeployed. Local stack startup approval was pending at that time;
the user approved it on 2026-09-26, as recorded in the latest authority note
above. Commit and deployment still require separate approval.

## Current Facts And Boundaries

- The user supplied a hosted-site recording and confirmed the same broad typing, navigation, and reload freeze occurs on desktop and Android. The account data used for reproduction is synthetic. Do not treat the attached recording as an instrumented trace or infer a particular root cause from it.
- The displayed hosted release is `hs-1c9756046b01-b55ed4ff550f`, commit `1c9756046b01cb1bd224fb601ec9094a7f471606`. The local checkout is branch `codex/production-readiness-stage-1`, HEAD `a2b1e0908b29ece40c797aa9a0c5dda0bbb6513a`, with user-owned dirty changes. Local J1 results do not establish behavior of the hosted release.
- One quiet host snapshot at `2026-09-24T15:40:33Z` showed 2 vCPU, about 2.89 GiB available memory, and zero CPU, memory, and I/O PSI at that instant. It was not captured during the reported freeze and does not rule out transient pressure.
- The 2026-09-22 and 2026-09-23 local J1 runs did not reproduce the broad reported freeze. Their scoped `NOT_EVALUABLE`/non-reproduction results remain valid only for those local runs.
- Plan 1 remains `COMPLETE / DIAGNOSIS_BLOCKED`; `PERF-F2-001/002/003` remain `INCONCLUSIVE`; `PERF-F12-001/002` remain `OPEN_BLOCKED`; Plan 2 eligible findings remain zero; production remains `NO-GO`.
- This plan uses read-only live collection, a local synthetic reproduction, and local verification only. It authorizes no deployment, migration, production configuration or source change, secret access, dependency change, real client data, live AI/channel/billing/worker call, commit, push, PR, or merge.

## Phase 1 Result - 2026-09-24

- The user signed in to the hosted synthetic test clinic. Release identity was rechecked as `hs-1c9756046b01-b55ed4ff550f`, commit `1c9756046b01cb1bd224fb601ec9094a7f471606`, migration fingerprint `b55ed4ff550f7e9ba8fc25957774341a19b7b05c1a35a891633369b4aff95f25`.
- The clock sampler was corrected to send three probes over one persistent SSH connection without weakening the 500 ms uncertainty gate. The successful probe set was 64/45/47 ms RTT, offset -370 ms, uncertainty 40 ms.
- One 150-sample host window completed from `2026-09-24T19:51:48Z` to `2026-09-24T19:54:32Z`. The identified Node application process remained present. Host CPU averaged 5.37% and peaked at 13.57%; 1-minute load peaked at 0.12; available memory bottomed at 3,016,776 KB; swap deltas, cgroup throttling/OOM events, memory pressure, and IO pressure were zero. This is not aligned to a verified UI freeze because the browser trace and interaction marker were not captured.
- The available Chrome control calls timed out while dispatching a click, reading accessibility state, and taking a screenshot. The click did not complete, so phone typing was not reached; navigation and reload were not tested, and no form was submitted. These timeouts identify a browser-trace/control-harness blocker; they do not prove the hosted page itself froze.
- Phase 1 evidence is `docs/aiya-global-freeze-phase-1-20260924T195845623Z-6029109a-b6cb-46b3-8bc0-b355420234a5_EVIDENCE.json` (SHA-256 `4685B390CA70ABBD1306A37D579D137135D5D8B1A83D17DF92ED053A9C9C527B`): `BLOCKED_BROWSER_TRACE_HARNESS_BLOCKED`, one current-identity attempt, zero valid paired records. The hash-chained checkpoint is `aiya-global-freeze-diagnostic-v1-20260924T195119517Z-61e8f694-e2e2-465f-9512-5737058fc0f6`.
- The primary evidence retained the host summary but its attempt-level host sample count/hash were empty because its old summarizer processed host and trace artifacts in one `try` block. `docs/aiya-global-freeze-phase-1-host-capture-addendum-20260924T200803Z-86d11645-08e5-490a-8b86-8563dd32e6c9_EVIDENCE.json` (SHA-256 `ACF96218588AF8A392B5FEA68C1FA6D0717C6D60A960D775A4CE97AEE18BDAE5`) independently verifies the 150-row host artifact SHA-256 as `d185d611b4d07da2e0bb539fb282234b1892b8c6394aeaab03238a8b39356cf9` and documents the correction. The post-capture runner/reporting correction and focused regression test currently hash to `A823350A0E6F1D71A2C5C16E2D4BD5B560E0C952BB24ECEBD90622BA86E83351` and `C97DF71DB4511617D0DD0A37F108E08520376C3AE9DAADB89E2AAA47DE6F5FEA`; the phase descriptor hash remains `B9F76E69F777E82D51EFDFCB812FD382D34A26C45C8C302204999F6CFE6C991C`. A focused regression test covers the missing-trace case.
- No browser/network/server/database causal attribution is available. Do not start Phase 2, change app runtime code, or treat this as a fix. Resume Phase 1 only when a supported Chrome Performance trace/control channel is available; preserve both evidence files and all five historical/current checkpoint attempts.

Follow-up live CUA probe - 2026-09-24: separate invalid-for-Phase-1 evidence is
`docs/aiya-global-freeze-phase-1-cua-followup-20260924T203252Z-b84b86c1-ab57-46b8-a1de-9ea7d9a4e8fd_EVIDENCE.json`
(SHA-256 `6F223F9D421B21D0BD31C75B79D8A997D7FF20DFAE7229A79D79F3025E62768B`).
A synthetic phone-field fill call returned in 1,651 ms. After a 2,000 ms pause,
the Formlar click timed out in the CUA/CDP Input.dispatchMouseEvent channel;
DOM read, reload completion, and console-log inspection then timed out in
Emulation.setFocusEmulationEnabled. The page's post-action state is unknown,
no form was submitted, and this adds no paired record or runner checkpoint.
These control errors are not proof of an application freeze.

Current local code indicates a phone-only new-client draft becomes dirty and
shell navigation should open a Stay/Discard dialog; Save is unavailable until
a name is entered. That guard could explain a navigation pause if rendered,
but cannot explain typing delay or reload latency, and the live dialog was not
verified. Local working-tree hashes do not identify the hosted bundle.

## System Boundary

The request path under investigation is the user's browser input event and render loop, then the browser's document/API/RSC requests, the deployed Next.js process and shared auth/session work, the backing store/RPC and database, and finally the response-to-visible-update path. Browser/device CPU pressure and the user's network are independent candidates; server or database pressure must not be presumed.

The local code map to consult only after evidence identifies a relevant path is:

- Dashboard and client UI: `app/src/components/dashboard-app.tsx`, `app/src/components/dashboard/client-workspace.tsx`, `app/src/lib/use-stage-6-client-workspace.ts`.
- Shared shell, navigation, and state: `app/src/components/dashboard/authenticated-shell-boundary.tsx`, `app/src/components/dashboard/shell-provider.tsx`, `app/src/components/dashboard/dashboard-navigation.tsx`, `app/src/lib/use-dashboard-url.ts`, `app/src/lib/phase-85-stage-4b-dashboard-routing.ts`, `app/src/lib/use-aiya-state.ts`.
- Session and server/store: `app/src/lib/auth-context.ts`, `app/src/lib/dashboard-server-auth.ts`, `app/src/lib/supabase-store.ts`, relevant API routes under `app/src/app/api/`, existing RPCs and append-only migrations under `app/supabase/migrations/`.
- Relevant browser/diagnostic contracts: `app/src/lib/performance-diagnostic.ts`, `app/src/lib/phase-52-diagnostic.ts`, `app/scripts/performance-global-freeze-diagnostic.mjs`, `app/scripts/lib/aiya-global-freeze-phase.mjs`, and the focused test beside the runner.

Do not read or instrument unrelated AI provider, WhatsApp, Telegram, billing, or production-worker paths unless Phase 2 evidence identifies them. The measurement runner never reads environment variables containing credentials, application logs, SQL text, request/response bodies, DOM text, typed values, cookies, or browser storage.

## Phase 1: Reproduce And Capture The Whole Path

### Purpose

Capture the user's actual hosted desktop freeze while browser timeline and the hosting process are sampled on the same UTC clock. Obtain three valid paired records with the same live release, signed-in synthetic account, browser, device, and network. This phase establishes whether the visible freeze and a browser/network/server event coincide; it does not name a cause.

### Scope And Exclusions

- Included: Chrome Performance timeline, renderer main-thread tasks, built-in JS CPU samples when available, same-origin API/RSC request start/response events after route sanitization, host CPU/memory/swap/PSI and the identified Next.js process/cgroup counters, and the user's fixed-category observation of typing/navigation/reload responsiveness.
- Excluded: React Profiler setup, screenshots, page/resource contents, HAR, source maps, DB query text, raw server logs, cache changes, browser extensions changes, performance throttling, code changes, and production writes.
- Primary cohort: the affected desktop Chrome session that produced the recording. The Android report remains an independent confirmed symptom, not a replacement for this first paired capture. Do not combine desktop and Android samples into one cohort.

### Preconditions

1. User signs into the already-open hosted browser tab themselves. Do not ask for or receive a password, token, cookie, or session export.
2. User verifies the session uses the previously confirmed synthetic test account. No health details or real-client identifiers may be entered.
3. The public release endpoint returns the same release ID, commit SHA, and migration fingerprint at the beginning of each record. A release change creates a separate cohort and prevents merging records.
4. SSH uses the existing `siriusai.store` host alias, batch mode, and strict known-host checking. No host key bypass, remote command that writes, service restart, log read, or environment read is permitted.
5. The fixed sampler passes the remote `bash -n` syntax check over the same strict SSH connection before any sample is started.
6. A record has a 150-second host sample window and a roughly 90-second browser trace window. Collect three valid records; cap the total at five attempts. Keep every interrupted or invalid attempt and stop after five attempts or a concrete access/harness blocker.

### Components And Files

- Collector and sanitizer: `app/scripts/performance-global-freeze-diagnostic.mjs`.
- Redaction, timing alignment, phase gates: `app/scripts/lib/aiya-global-freeze-phase.mjs`.
- Regression tests: `app/scripts/performance-global-freeze-diagnostic.test.mjs`.
- Ordered phase checkpoint: `tools/phase-execution/checkpoint-store.mjs` through `.manu-runtime/phase-execution/`.
- Local artifacts: `%LOCALAPPDATA%/MANU-AI/diagnostics/global-freeze/<run-id>/`; raw Chrome export remains at its original local path and is never overwritten.
- Permanent phase summary after the three records: `docs/aiya-global-freeze-phase-1-<timestamp>-<uuid>_EVIDENCE.json`, created by the finalizer as a separate immutable evidence artifact. It contains hashes, run IDs, safe summaries, and outcome enums only.

### Architecture And Data Contracts

- One `--start` creates a new immutable run ID and captures branch, HEAD, hashes of the declared diagnostic/source files, and the live release identity. It never silently resumes a run with another identity.
- `--capture-host <run-id> 150` runs a fixed read-only Bash sampler through SSH. It emits one JSONL row per second containing UTC/epoch, aggregate `/proc/stat`, `/proc/meminfo`, swap deltas, PSI, and only the Node process found under the known application release path plus its cgroup counters. It does not enumerate unrelated processes or collect command arguments/environment.
- Before sampling, the runner performs three strict-SSH `date +%s%3N` round trips. It stores the median remote-minus-local clock offset and a conservative RTT/spread uncertainty. If the uncertainty exceeds 500 ms, the run is `BLOCKED` before host sampling; no cross-machine clock agreement is assumed.
- The browser exports a Chrome DevTools Performance trace with screenshots and resource contents disabled. The sanitizer rejects HAR, caps compressed/decompressed size, event count, CPU-profile node/sample count, drops all arbitrary event args, maps request IDs to per-trace aliases, strips URL queries/identifiers, and retains only an allowlisted event vocabulary, same-origin normalized routes, durations, and safe JS function labels.
- Two exact `console.timeStamp` labels, `aiya-global-freeze-sync-start` and `aiya-global-freeze-sync-end`, pair trace-relative time to the two epoch-millisecond values returned by `Date.now()`. The alignment gate requires one of each marker, increasing times, a clock scale between `0.99` and `1.01`, a valid SSH clock-offset estimate with at most 500 ms uncertainty, and at least 80 seconds/80 host samples overlapping the trace. The runner converts browser epoch to remote-host epoch with the measured offset and maps renderer tasks to the nearest host sample; it records sample distance and offset uncertainty so neither measurement is presented as millisecond precision.
- The post-trace observation API accepts only `{freeze, keyboard, navigation, reload}` enums. A completed record requires a completed host capture, a sanitized trace with aligned markers, and one observation annotation. The source trace hash is retained; raw trace content is not copied into evidence.

### Exact Procedure

Run commands from `C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\app` in a PowerShell terminal:

1. Validate only the remote sampler syntax: `node scripts/performance-global-freeze-diagnostic.mjs --check-host-script`. Require JSON output `status=PASS`; the remote script is parsed with `bash -n` and is not executed.
2. Start a fresh record: `node scripts/performance-global-freeze-diagnostic.mjs --start`. Copy only its returned `runId`.
3. Start paired host sampling: `node scripts/performance-global-freeze-diagnostic.mjs --capture-host <runId> 150`. Wait for the JSON output `state=host_capture_started`; then start Chrome DevTools Performance recording immediately.
4. In the page's DevTools Console, execute `console.timeStamp("aiya-global-freeze-sync-start"); Date.now()` and retain only the returned integer. In the same authenticated page, reproduce the normal user flow for up to 90 seconds using synthetic data: type in the test phone field without saving it, click the normal left navigation options, and use browser reload only if it is part of the observed stalled flow. Do not submit or persist a form.
5. Before stopping the Performance recording, execute `console.timeStamp("aiya-global-freeze-sync-end"); Date.now()` and retain that integer. Stop the trace and export it as JSON or JSON.GZ with screenshots/resource contents/source maps disabled. Do not export a HAR.
6. Import to the local sanitizer: `node scripts/performance-global-freeze-diagnostic.mjs --inspect-trace "<trace-path>" --run-id <runId> --start-epoch-ms <startInteger> --end-epoch-ms <endInteger>`. Use the sanitized artifact and summary only; do not paste the raw trace into chat.
7. Record only what was visibly observed: `node scripts/performance-global-freeze-diagnostic.mjs --record-observation <runId> --freeze <observed|not_observed> --keyboard <responsive|unresponsive|not_tested> --navigation <responsive|unresponsive|not_tested> --reload <responsive|delayed|not_tested>`.
8. Repeat steps 2-7 with a new run ID until three valid records exist or the five-attempt cap is reached. The CLI rejects concurrent runs, a sixth attempt, and a fourth run after three completed captures. Keep account, device, browser session, network, hosted release, actions, and trace settings fixed.
9. Finalize immutable Phase 1 evidence: `node scripts/performance-global-freeze-diagnostic.mjs --finalize-phase1`. It re-reads every matching hash-chained checkpoint, re-hashes the local sanitized trace/host files, requires exactly three valid records, and writes a new uniquely named evidence file without raw traces or host samples. On a concrete blocker, close explicitly with one fixed code, for example `node scripts/performance-global-freeze-diagnostic.mjs --finalize-phase1 --blocked host_access_blocked`; allowed values are `authenticated_session_unavailable`, `host_access_blocked`, `browser_trace_harness_blocked`, and `attempt_budget_exhausted`. Never put a free-text explanation, credential, or path in that field.

If Chrome does not emit both exact timestamp markers, clock scale falls outside the gate, host process cannot be identified, the live release changes, or SSH/trace collection fails, keep the failed run and stop or use only the remaining attempts within the five-attempt cap. Do not repair the harness and silently reuse that run ID.

### Data Flow

User action and DevTools markers -> raw local Chrome export -> allowlist sanitizer -> redacted JSON + hash -> checkpoint. In parallel, SSH read-only host sampler -> validated fixed-field JSONL -> host summary + hash -> checkpoint. The two marker epochs align trace tasks and request events to host samples. Fixed-category user observations close the individual checkpoint. Three completed run IDs and their hashes/summaries become the Phase 1 evidence JSON.

### Failure And Boundary Handling

- No valid synthetic authenticated session: stop before browser capture; keep any preflight record and do not substitute unauthenticated/local traffic.
- Missing server process/cgroup: mark server-process metrics unavailable; do not interpret missing values as zero. Host aggregate samples remain usable only for aggregate pressure.
- Missing PSI/cgroup fields: persist `null`, never zero. SSH banner text is ignored; malformed sample JSON invalidates that attempt.
- Raw input exceeds size/event/profile caps, is HAR, or has malformed schema: reject it without modifying it; preserve the failed attempt and source hash only if it was safely readable.
- A trace has no marker, the marker is duplicated, or clock alignment fails: do not correlate clocks, do not call the record valid, and do not infer overlap.
- Browser trace capture may itself add overhead. Use one built-in JS sampling setting across all records and report profiler state; do not enable React profiling.
- A reload may terminate the app document. DevTools recording must span navigation; if it does not, mark that attempt incomplete instead of reconstructing the missing interval.

### Tests And Validation

- Run `node --check` for the collector, phase descriptor, and tests; run the focused `node --test scripts/performance-global-freeze-diagnostic.test.mjs`; run ESLint on those three files.
- Tests cover route/query/identifier redaction, HAR rejection, compressed input preservation, event arg removal, profile caps and labels, exact marker allowlist, host JSONL schema/field projection, missing metrics as `null`, alignment scale/nearest-host-sample mapping, enum-only observation recording, and strict three-phase prerequisites.
- For each real record, require checkpoint status `COMPLETE`, `host.capture.completed`, `browser.trace.sanitized`, a valid hash chain, exactly two aligned markers, at least 147 host samples out of 150, no raw-value fields in artifacts, and one fixed-category observation.
- Phase 1 passes only with exactly three valid records within five attempts, stable source/release identity, and a trace/host overlap of at least 80 seconds per record. Whether the freeze was observed is reported separately from capture validity.

### Completion Gate

Phase 1 is `COMPLETE` only when three records satisfy every validity gate and a permanent phase evidence file records all attempts. If three valid records contain no user-observed freeze, report only “not reproduced in these three hosted captures”; Phase 2 stays blocked for cause attribution. If a freeze is observed, proceed to Phase 2 with the correlated windows. On the five-attempt cap or a concrete blocker, close Phase 1 as `BLOCKED` with every attempt visible.

## Phase 2: Attribute The Dominant Layer And Prove One Candidate

### Purpose

Use the aligned freezes from Phase 1 to choose one dominant mechanism among browser main-thread work, browser/device resource pressure, user network/request wait, Next.js/server queue or CPU/memory pressure, auth/session fan-out, store/RPC latency, or database contention. Confirm at most one candidate with a reversible single-variable experiment before implementing a fix.

### Scope And Preconditions

- Require three valid Phase 1 records and at least two user-observed freezes with aligned event windows. If the freeze is absent from all three, stop as `NOT_REPRODUCED`; do not launch candidate experiments.
- Require the same live release and source/build identity across selected windows. The local HEAD currently differs from the hosted release. If the exact hosted source revision is unavailable locally, source-level causal claims and “fixed” labels are blocked until that revision is available; do not map a minified bundle to a different local tree.
- Preserve Plan 1 closure and its finding dispositions. This is separate diagnostic evidence and not Plan 2 eligibility.

### Components And Files

Start with the Phase 1 redacted trace/evidence and the exact owner code identified by route/function labels. Then inspect only the matching path among the dashboard/shell/auth/store/API files listed in `System Boundary`, the exact owning RPC/migration only if the call chain reaches it, and the existing performance/phase-52/phase-55 trace helpers. No broad repository sweep or unrelated provider inspection.

### Architecture Decisions And Method

- Browser main thread: align `RunTask`/`Task`, `EventDispatch`, `Layout`, `UpdateLayoutTree`, and safe CPU profile samples to the user's unresponsive interval. A repeated task/profile frame must overlap the freeze in at least two independent valid records before selecting a browser candidate.
- Network/server: pair normalized request-send/response events by the trace-local request alias and route. Separate time before request dispatch, in-flight wait, and response-to-visible work. Repeatedly slow API/RSC routes are candidates, not proof that the server or DB is at fault.
- Host: compare each freeze interval to aggregate CPU busy percentage, load, available memory, swap movement, CPU/memory/I/O PSI, and the identified app cgroup's throttle/OOM counters. A single host-wide high value without time overlap is not causal evidence.
- Database: only if request wait repeats while browser work and host pressure do not explain it, inspect aggregate lock/pool/query-duration counters through an already-authorized read-only database path. Never collect SQL text, parameter values, client rows, or credentials. If no safe read-only database path exists, explicitly mark DB attribution unavailable rather than opening secrets or querying production with an application key.
- React commit signals: do not add React Profiler or application instrumentation in Phase 2. Use existing trace support only; absence of commit samples is `UNAVAILABLE`, not zero commits.
- Candidate experiment: freeze source, fixture, release/build, device/browser, flow, and measurements. Compare A1 (current baseline), B (exactly one candidate variable changed), A2 (baseline restored), with three valid repetitions in each arm. Each repetition must include the same interaction window and trace/host alignment. Retain all attempts. Candidate attribution passes only when the freeze and its proposed mechanism reproduce in all three A1 records, disappear in all three B records, return in all three A2 records, and no second variable changes.

### Exact Steps And Data Flow

1. Build a per-record table: user outcome enums; trace window; longest main-thread tasks and aligned nearest host samples; normalized request route/start/response timeline; host pressure; profile availability; source/release identity.
2. Mark each layer `SUPPORTED`, `NOT_SUPPORTED_IN_CAPTURE`, or `UNAVAILABLE`, with the exact data field and run IDs that justify the value. `NOT_SUPPORTED_IN_CAPTURE` must never be rewritten as “ruled out.”
3. Select one candidate only if the same layer and signal align in at least two freeze records and the corresponding owner source is the exact deployed revision. Record one named file/function/RPC boundary and the single variable for A1/B/A2.
4. Run the bounded 3×A1, 3×B, 3×A2 comparison with the Phase 1 collector. Record per-arm identities and valid/failed attempts separately.
5. Create `docs/AIYA_GLOBAL_FREEZE_PHASE_2_EVIDENCE.json` with per-run IDs/hashes, layer support, candidate owner, one-variable definition, arm outcomes, and limitations. Do not store trace bodies or raw logs there.

### Error Cases, Tests, And Completion Criteria

- If two layers remain inseparable, classify `INCONCLUSIVE` and do not change code.
- If A1 does not reproduce 3/3, B changes more than one variable, A2 fails to restore the baseline, source identity drifts, or any arm has fewer than three valid records, the experiment is `INCONCLUSIVE`; retain data and do not extend the attempt budget automatically.
- Re-run only the focused existing tests for the selected owner boundary before proposing a code change. Database-level claims require an aggregate read-only lock/pool observation plus the exact route/request mapping; unit tests alone cannot prove production contention.
- Phase 2 is `COMPLETE` only if the exact file/function and the single-variable causal result pass every gate. Otherwise close as `INCONCLUSIVE` or `BLOCKED` and do not enter Phase 3 implementation.

## Phase 3: Implement The Smallest Proven Local Fix And Re-Verify

### Purpose

Correct only the Phase 2 causal owner with the smallest behavior-preserving source change, then verify the reported typing/navigation/reload flow on a controlled local build. Production remains unchanged and `NO-GO`.

### Preconditions And Affected Components

- Require Phase 2 `CAUSAL_CANDIDATE_CONFIRMED`, the deployed-source revision available for comparison, and a named owner file/function.
- Keep the existing dirty working tree intact. Before editing the owner file, read its complete current diff and tests; edit only the lines needed for the proven mechanism. Never restore, stash, clean, or overwrite unrelated changes.
- Expected source scope is one UI hook/component, one shared auth/API path, or one proven store/RPC boundary, not all of them. If a database schema change is proven indispensable, stop for separate user approval before writing a migration or applying any migration.

### Implementation Decisions And Steps

1. Add the narrowest regression test beside the selected owner. It must fail against the unchanged candidate and assert the user-visible contract plus cancellation/idempotency/tenant behavior relevant to that path.
2. Change one production source variable only. Keep request ownership, session refresh, tenant filters/RLS, expected revisions, idempotency, dirty-state protection, and PWA privacy-lock contracts unchanged.
3. Run the focused test first. If it fails, fix only the selected implementation/test contract; do not add a second optimization.
4. Run app typecheck, ESLint, and production build using the already-verified local Supabase build-time environment. Do not edit `.env*`, secrets, dependencies, or remote configuration. If the code path does not require a database, do not reset or mutate local Supabase.
5. Run three matched local synthetic reproductions before and after the candidate with identical browser/device, route flow, fixture, local database state, and instrumentation. The pre-change set must reproduce the previously confirmed behavior; the post-change set must complete input, navigation, and reload without the matching stall. If the local environment cannot reproduce the pre-change symptom, report that the local validation is inconclusive and do not claim a fix.
6. For a frontend mechanism also run the same controlled flow on the physical Android Chrome device if it is available; never substitute emulation for the user's Android report. Keep desktop and Android results separate.
7. Write `docs/AIYA_GLOBAL_FREEZE_PHASE_3_EVIDENCE.json` with exact source hashes, test/check results, matched run IDs, functionality, latency summaries, invalid attempts, and any untested environment. Update this plan and the handoff only after the real outcome is known.

### Data Flow, Failure Handling, And Tests

The local synthetic action -> changed owner function -> existing API/auth/store contract -> visible result is measured with the same trace sanitizer and fixed outcome enums. No raw form value, body, cookie, health record, local secret, or provider payload is retained.

If focused tests fail, typecheck/lint/build fail, tenant/RLS/idempotency behavior changes, pre-change reproduction is absent, or post-change freeze remains in any valid run, Phase 3 does not pass. Preserve the evidence and candidate diff; do not broaden the patch, apply migrations, deploy, or rerun unlimited attempts. Any rollback may remove only the exact candidate lines introduced for this phase after confirming they do not include user changes.

### Verification And Completion Criteria

Phase 3 is `LOCAL_FIX_VERIFIED` only when the single-cause A1/B/A2 result is already proven, the focused regression passes, typecheck and production build pass, lint has zero new errors, the source fix hash is recorded, three matched local pre-change runs reproduce, three matched local post-change runs are valid and contain zero freezes, the desktop interaction flow is functionally successful, and physical Android is explicitly `PASS` or `NOT_AVAILABLE`. `FAIL` on Android blocks Phase 3 closure. “Not reproduced locally” is not a fix. No production acceptance or deployment follows from this local phase.

## Cross-Phase Evidence And Stop Rules

- Every phase/run receives a new immutable ID and evidence file. Identity changes invalidate only dependent records; earlier evidence is retained and never merged across releases or devices.
- Report three separate verdicts: observation validity, functional outcome, and performance/cause result. Invalid and blocked attempts remain visible.
- Sensitive-data scan is metadata-only against the generated evidence; no raw trace, console log, request body, SQL text, typed value, credential, cookie, prompt, health data, or device serial is allowed.
- `git diff --check` and a reviewed `git status --short` are required at each phase closure. Do not commit/push/create a PR/merge or modify production without separate user authorization.
- If no exact mechanism is established, the correct endpoint is an evidence-backed `INCONCLUSIVE`/`BLOCKED` diagnosis, not a speculative performance rewrite.

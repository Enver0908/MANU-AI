# AIya Global Freeze Wait-State Action Plan

Date: 2026-09-30
Status: `PHASE_5C_COMPLETE / WEB_VITALS_SOLE_TRIGGER_NOT_SUPPORTED_LOCALLY / GLOBAL_CAUSALITY_UNPROVEN / LEGACY_SUMMARY_BUDGET_CLOSED`
Scope: identify what is waiting at the moment the hosted UI stalls.

## Parallel Delivery Track - Shared UI Runtime Rewrite - 2026-09-30

The separately approved shared UI runtime rewrite was integrated and delivered
to the hosted sandbox after the wait-state diagnosis remained inconclusive.
Evidence:
`docs/AIYA_SHARED_UI_RUNTIME_REWRITE_DELIVERY_20260930_EVIDENCE.json`.
Evidence SHA-256: `a40d41ffe0cdb21870ae3f5e2efd0e366e6c6771e40193ee65f44dba5cbd9c3b`.
Current-identity delivery closure reconciliation:
`docs/AIYA_SHARED_UI_RUNTIME_REWRITE_DELIVERY_RECONCILIATION_20260930_EVIDENCE.json`
(SHA-256 `2b524752598741efb8a6fc2b276cf43e399b0152ecb06262e529331f03c40a88`).
The delivered source commit is
`a72404711ecfb95b8b1fe33d1fa0ac8bb3cceb37`; the hosted release is
`hs-a72404711ecf-292fb7b24203`.

This parallel delivery track does not claim that the rewrite is the proven
cause or that the global freeze is resolved. The native trace still establishes
only a renderer main-thread busy boundary; the retained Phase 5C conclusion is
unchanged. Production remains `NO-GO`. Local Docker validation, artifact
identity, hosted smoke, desktop Chrome, physical Android Chrome, and the
current-origin Android PWA acceptance passed without real client health data,
provider/channel egress, billing, production worker, or remote migration. The
old test-origin WebAPK remains installed as a legacy package; the new hosted
origin PWA acceptance is recorded in
`docs/AIYA_SHARED_UI_RUNTIME_REWRITE_PWA_ACCEPTANCE_20260930_EVIDENCE.json`
(SHA-256 `5a8a3efd1d5a4b5b07b85ccb9a735ae76097a0adf98350bfadcaf6f26d0497bd`).

The legacy summary-only app-probe budget is closed at 4/4 attempts and remains
`BLOCKED`; it will not be repeated. The user authorized a separate native Edge
Performance recording route with a maximum of one hosted capture. Its local
import/sanitization preflight passed; evidence:
`docs/AIYA_GLOBAL_FREEZE_NATIVE_TRACE_IMPORT_PREFLIGHT_20260928T230908Z-4126d1bf-b38e-4c30-996f-d96b072f8d72_EVIDENCE.json`.
(SHA-256 `2cbedc226f6dfcaccce327b8cb3354f464cb4b0115df350b2f5642011caa9721`).
That one native capture was completed from the user-saved Edge trace. Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_3_NATIVE_20260929T164900Z-89ec155a-344e-4b48-adc2-c4b03c1b55ef_EVIDENCE.json`.
It observed a 140,925.752 ms trace window with 212 input dispatch events,
128 network requests, and 31 renderer main-thread long tasks. The longest
main-thread tasks were 34,390.426 ms, 12,405.865 ms, 9,984.258 ms,
7,727.730 ms, and 5,530.091 ms. The longest completed network requests were
about 1.72 seconds; two `/api/session/activity` POSTs were unfinished at
recorded trace end. This identifies a client renderer main-thread busy
boundary in the recording, not a final root cause. The user also reported a
post-recording reload delay of about two minutes; because it happened after
the recording stopped, it is retained as an out-of-trace user observation.
The hosted release was re-read at
`2026-09-29T17:07:27.788Z`: `hs-1c9756046b01-b55ed4ff550f`, commit
`1c9756046b01cb1bd224fb601ec9094a7f471606`. Phase 4 confirmed the trace's
dashboard and shared JavaScript assets against that release. At Phase 4 time,
source attribution remained inconclusive because production source maps were
unavailable and the retained profile stream had not been mapped to renderer
thread metadata. Follow-on Phase 5A recovered that thread mapping from the
Profile header and attributed all 31 long-task windows; it did not provide
production source maps or prove causality. Phase 5 evidence is linked below.
Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_4_20260929T172111Z-6f39804f-bd5b-4550-a6cb-952e78c27290_EVIDENCE.json`.
(SHA-256 `494905382624315325b61b35e86f8ed84cd8378497203b697c5d088d74b14482`).

Phase 1 is complete; evidence: `docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_1_EVIDENCE.json`.
Phase 2 is complete; evidence: `docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_2_20260928T151452642Z_EVIDENCE.json`.
The initial Phase 3 file-export gate was blocked. The user then authorized a
summary-only method; one hosted attempt was made and stopped because browser
input/navigation calls did not acknowledge reliably. Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_3_SUMMARY_20260928T184152Z-bec31aba-6b26-445e-8acb-da26bdfcf1f7_EVIDENCE.json`
(SHA-256 `04322131f78f3a11189335fe36e64cb6c400cee33ce49a7e182512f147fb5cbb`).
The earlier file-export evidence remains unchanged:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_3_20260928T180903Z-fd14e889-d6cf-4346-8abf-402b674b7e1e_EVIDENCE.json`.
The subsequent resume preflight found no available CUA browser and returned
`USER_UNAVAILABLE`; no browser action was dispatched. Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_3_SUMMARY_RESUME_20260928T194136Z-f31c568f-1d70-4873-bf5f-2b80e3e52013_EVIDENCE.json`
(SHA-256 `b5340c485252aa7f60b5a97fca905dcdc975798f03fca0052f9fb1484e8f2fc7`).
The browser became available in the subsequent retry, but the first synthetic
input dispatch took 5,092 ms and returned unacknowledged. The 12-action burst
was aborted after one input; no rapid-burst record was obtained. Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_3_SUMMARY_RETRY_20260928T201314Z-4c8fe285-6af5-4ba3-b69e-4e6403dd801b_EVIDENCE.json`
(SHA-256 `8f8db5e7e882aecfe49ea92a830f5a186aba0ebadba37b4f450a239e8605e22a`).
The next-day control-page test succeeded, but MANU-AI navigation, search focus,
and a synthetic key dispatch timed out; post-key state was unavailable. No
rapid-burst capture was obtained. Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_3_CONTROL_TEST_20260928T210737Z-bce5f92a-19d7-4ab0-9b36-c2d70c1fea48_EVIDENCE.json`
(SHA-256 `39d1eebed4e3e06c306b29054c0d9fc8b24da28aa12478d322a4809f8bb285e9`).

## Authority

This plan is the active continuation for the user-reported global typing,
navigation, and reload freeze. It does not reopen AIya Performance Plan 1 and it
does not revise the exhausted hosted Phase 1 evidence identity. Historical
global-freeze Phase 1 remains `BLOCKED / attempt_budget_exhausted`, with `0/3`
valid paired records and five attempts consumed.

The goal is not to prove a final root cause in one step. The goal is to capture
the wait boundary during the visible stall and answer, with preserved evidence:

1. Was the click or key event delivered to the page?
2. Did the app start the expected navigation or hydration work?
3. Was the page waiting for an API/RSC response, response body parsing, browser
   main-thread work, React hydration/render, or a stuck visible loading state?
4. Which exact route and owner file/function should be inspected next?

## Fixed Decisions

- Work in `C:\Users\Dell\OneDrive\Masaüstü\MANU-AI` on branch
  `codex/production-readiness-stage-1`.
- Preserve existing source, test, tool, migration, and evidence changes with
  local commits before adding new diagnostics.
- Do not delete, reset, stash, or overwrite user changes.
- Do not commit generated Next build output or unrelated personal files.
- Keep raw browser traces outside committed evidence. Commit only redacted
  summaries, hashes, checkpoint IDs, and fixed-field results.
- Use the hosted release identity reported by `/api/health/release` for source
  mapping. Do not treat dirty local source as the deployed bundle.
- Use a short, bounded diagnostic. Do not repeat old J1, A/B/A, or official
  acceptance matrices unless a later phase explicitly proves they are needed.
- Do not deploy, push, create PRs, run production migrations, edit secrets,
  change dependencies, use paid external resources, or submit real client data.

## Phase 1 - Preserve, Clean, And Record This Plan

Status: `COMPLETE`.

### Purpose

Make the main checkout usable for the new diagnostic without losing any current
work. The end state is a clean Git working tree except for intentionally ignored
local build/personal artifacts, plus a committed plan and active handoff update.

### Scope

Included:

- Current tracked edits.
- Relevant untracked source, test, script, migration, tool, docs, and evidence
  files.
- A local external reconciliation archive containing file lists, status, patch,
  and SHA-256 hashes.
- Git ignore/exclude rules for generated `.next-dirty-*` output and unrelated
  `tmp/pdfs` images.
- Active handoff and next-phase documents.

Excluded:

- `app/.next-dirty-*` generated Next build output.
- `tmp/pdfs/cv_render/*.png` personal rendered images.
- Other worktrees, remote branches, production systems, secrets, and runtime
  data.

### Preconditions

- Verify current directory is the main checkout.
- Verify branch, HEAD, remote branch, tracked and untracked status.
- Verify remote branch has not advanced beyond local history.
- Create a local archive before staging files.
- Confirm `git diff --check` has no whitespace errors beyond line-ending
  warnings.

### Affected Components And Files

- `app/.gitignore`
- `.git/info/exclude` as local-only cleanup state
- `HANDOFF_FOR_NEXT_CODEX.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/AIYA_GLOBAL_FREEZE_ACTION_PLAN.md`
- `docs/RISK_REGISTER.md`
- `docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_ACTION_PLAN.md`
- `docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_1_EVIDENCE.json`

### Steps

1. Capture status, branch, HEAD, remote ref, and untracked classification.
2. Write an external archive under
   `%LOCALAPPDATA%\MANU-AI\reconciliation\<id>` containing the tracked diff,
   included/untracked file list, excluded/generated file list, status output,
   remote identity, and SHA-256 hashes for all included files.
3. Stage only the explicit included path list using a pathspec file. Do not use
   `git add -A`.
4. Commit the preserved diagnostic work as a local preservation commit. This
   commit is not a correctness claim.
5. Add ignore rules for `/.next-dirty-*/` and local exclude rules for
   `tmp/pdfs/cv_render/*.png`.
6. Add this action plan and a Phase 1 evidence JSON.
7. Update active handoff and next-phase documents so the next executor starts
   from the wait-state diagnostic, not from stale historical next actions.
8. Record the discovered SHA identity correction: correct local HEAD is
   `a2b1e0908b29ece40c797aa9c0a5dda0bbb6513a`; older active text that used
   `a2b1e0908b29ece40c797aa9a0c5dda0bbb6513a` is not a valid Git object.
9. Run JSON parse checks, `git diff --check`, and `git status --short`.
10. Commit the Phase 1 plan/evidence/documentation cleanup locally.

### Completion Criteria

- Preservation commit exists.
- Wait-state plan and evidence are committed.
- Active docs point to this plan as the next bounded task.
- Generated build output and personal tmp images no longer appear in status.
- `git diff --check` passes.
- Working tree is clean after the final local commit.

## Phase 2 - Prove The Capture Pipeline Before Hosted Diagnosis

Status: `COMPLETE`.

### Purpose

Prove that the diagnostic can produce a trustworthy local trace artifact and a
sanitized wait-state summary before consuming hosted user-session attempts.

### Scope

Add only a small extension to existing diagnostic infrastructure. Reuse
`app/scripts/performance-global-freeze-diagnostic.mjs` and the existing
sanitizer/checkpoint patterns. Do not add a telemetry backend, React Profiler,
new monitoring service, or broad browser harness.

### Affected Components And Files

- `app/scripts/performance-global-freeze-diagnostic.mjs`
- `app/scripts/performance-global-freeze-diagnostic.test.mjs`
- `app/scripts/lib/aiya-global-freeze-phase.mjs`
- New small helper only if needed:
  `app/scripts/lib/aiya-global-freeze-wait-state.mjs`
- New/updated redacted evidence under `docs/`

### Method

The pipeline must correlate four clocks and states:

- trusted input event time: key/click press, release, dispatch, and handler
  acknowledgement when available;
- browser visible state: selected nav, URL, loading skeleton visibility, and
  target content readiness;
- network/RSC state: request start, response headers, body finish, cancel,
  failure, or still-open-at-end;
- main-thread state: long tasks, event dispatch duration, parse/evaluate/layout
  work, and gaps in a fixed 100 ms heartbeat.

The browser page observer may record only fixed metadata. It must not read form
values, cookies, request bodies, prompt text, health data, or raw page content.

### Steps

1. Map hosted source from the live release commit with `git show
   <hosted-sha>:<path>` for the dashboard shell, hydration hook, navigation
   routes, and `/api/app-state`.
2. Add or extend a redacted wait-state parser that preserves:
   `input`, `visibleState`, `network`, `rsc`, `mainThread`, `heartbeat`,
   `artifacts`, `identity`, and `verdict`.
3. Add tests for cancellation, still-open requests, missing event timing,
   duplicate route IDs, unavailable markers, truncated trace files, and raw
   sensitive-field rejection.
4. Run a synthetic local browser fixture outside production data. It must
   perform 12 inputs at about 350 ms spacing and persist a raw local trace file.
5. Import that trace through the sanitizer and verify the summary can classify
   wait boundaries without a hosted session.
6. Stop after one successful preflight or after one narrow repair plus one
   retest. If it still cannot persist/import a trace, close as
   `CAPTURE_PREFLIGHT_BLOCKED`.

### Completion Criteria

- Focused tests pass.
- One synthetic raw trace is persisted outside evidence, hashed, sanitized, and
  summarized.
- The summary differentiates at least: input-not-delivered, request-in-flight,
  response-body-not-complete, main-thread-busy, and visible-loading-after-work.
- No raw secrets, cookies, request bodies, health data, typed values, or prompts
  appear in committed evidence.

### Phase 2 Result

The local synthetic preflight passed once. A persisted 489,760-byte Chromium
trace was imported through the existing sanitizer and recorded in a completed,
hash-chained checkpoint. Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_2_20260928T151452642Z_EVIDENCE.json`.

All 12 requested, pressed, released, and handler-acknowledged inputs were
observed. The median pressed gap was 349.794 ms; one gap was 200.404 ms and the
other ten were 331.051-364.942 ms. The captured summary showed a request waiting
for headers, two response bodies still open at trace end, a heartbeat gap of
236.404 ms, and loading still visible after synthetic work completed. Focused
tests verified all five wait classes, including the input-not-delivered class
with a separately constructed synthetic trace. Missing input markers remain
`UNAVAILABLE`.

Limitations: the aborted fixture request was reported as a generic network
failure, not a distinct cancellation; cancellation-specific parsing passed its
focused test. No renderer long-task event was captured, so the busy status is
based on heartbeat timing. These local results do not identify the hosted
application's wait boundary or cause. At Phase 2 closure, Phase 3 had not
started; its later precondition check is recorded below.

## Phase 3 - Hosted Wait-State Capture

Status: `LEGACY_SUMMARY_METHOD_CLOSED / NATIVE_CAPTURE_COMPLETE / MAIN_THREAD_BUSY_BOUNDARY_OBSERVED`.

### Earlier File-Export Gate (Historical; Not The Current Gate)

The hosted Dashboard was visible in Edge and the current release identity was
read from `/api/health/release`. The account was not identified, so synthetic
account status and a stable ready baseline remain unverified. The available
browser integration exposes raw CDP commands but no approved direct
trace-to-local-file export path; the earlier browser URL policy evidence
explicitly bars retrying its rejected transfer through raw CDP, another browser
surface, or a workaround. Phase 3 stopped before trace recording, observer
startup, input, or any capture attempt. No raw trace or checkpoint exists.

Evidence SHA-256:
`feed4111bc4e4c9f9a6f1434e0feec29737a6cc379b4edb8bb291a99d27a987b`.
This was a tooling/precondition result, not an application wait-state or
performance observation. It applied to the raw trace file-export method. The
user later authorized a bounded summary-only method; this historical evidence
is preserved and is not the current Phase 3 status.

### Summary-Only Observation Method

Status: `CLOSED (4/4 HOSTED APP-PROBE ATTEMPTS; 0 USABLE RECORDS)`.

Raw trace export is not a prerequisite and raw trace data is not retained. Use
only supported browser actions and accessible page state. Record sanitized
route/readiness observations and host-side action dispatch start/completion
times. These are automation timings, not exact DOM event timestamps. Read-only
Performance API, request/RSC lifecycle, and main-thread signals may be added
only if the browser surface returns them promptly; otherwise record them as
`UNAVAILABLE`. The documented CUA CDP capability may be used only for
fixed-schema numeric Runtime metrics and filtered Network lifecycle summaries.
Do not use CDP Tracing/IO, transfer trace data, mutate the page, or return raw
URLs, headers, bodies, or page content.

The signed-in synthetic account is user-attested from the user's confirmation
after being asked to sign into that account. Do not inspect or record account
identifiers or client content. Use only a visible non-submitting search field
for synthetic keyboard input when available; never fill or submit a client
record form. This method and its four attempts are closed; the procedure below
is historical and must not be run again.

For each attempt, target 10-15 visible inputs at approximately 350 ms between
host-side dispatch starts, including keyboard entry and safe navigation when
available. Check the accessibility state after each action. After the final
input, observe for at least 30 seconds without reload or further interaction.
The evidence contains only route categories, readiness flags, timing numbers,
counts, hashes, and explicit unavailable markers. No typed values or raw page
text are retained.

An attempt is valid only for the signals it actually captures. Host action
timings must not be described as actual browser input timestamps. Do not infer
that a request completed from its absence in a snapshot, or that the main
thread was responsive when its signal is unavailable. If the reduced signals
cannot distinguish the wait boundary, finish Phase 3 as `INCONCLUSIVE` and
carry no unsupported attribution into Phase 4.

### Summary-Only Attempt Result - Earlier Attempt

Status: `HISTORICAL (CONTROL_DISPATCH_UNRELIABLE; INVALID_FOR_RAPID_BURST)`.

The Dashboard client-search view was stable and ready for about 1.1 seconds;
the signed-in synthetic account was user-attested. The 13-action sequence
aborted after its first keyboard call took 4,082 ms and was not acknowledged.
A later control probe took 4,064 ms and was also unacknowledged; a subsequent
accessibility snapshot reflected two characters in the local search field.
The safe More-navigation call took 4,275 ms, was unacknowledged, and left the
route unchanged. Exact browser event timestamps and 350 ms pacing were not
obtained.

More than 30 seconds passed after the last input without reload or further
interaction. One late accessibility sample still showed the clients route and
no loading label; this does not establish a continuous loading duration. The
Event Timing list was empty in the pre-action probe, the Network event cursor
was truncated with no usable request lifecycle, and the only main-thread
metrics were an unpaired pre-action sample. Those missing signals are
`UNAVAILABLE`, not evidence that the corresponding work did not occur.

The capture is invalid for a rapid-input burst. The browser-control timeouts
are not proof that the application froze. No wait boundary or cause is
established. Cleanup commands for the temporary Network/Performance
observation domains were not acknowledged. The CUA JavaScript kernel was reset
after capture, but browser debugging-session detachment and domain disablement
were not independently verified.

This earlier attempt is superseded by the resume preflight and retry recorded
below; its evidence remains unchanged. Raw trace export remains unnecessary
and must not be attempted.

### Summary-Only Resume Preflight - 2026-09-28

Status: `BLOCKED (BROWSER_PROVIDER_UNAVAILABLE)`.

After the user asked to resume, the read-only CUA inventory returned zero
available apps, zero browsers, and provider error `USER_UNAVAILABLE`. No browser
action was dispatched; no page, account, client, or current hosted release
state was read. The previous summary-only attempt remains blocked for
unreliable dispatch; this preflight did not replace or modify its evidence.
Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_3_SUMMARY_RESUME_20260928T194136Z-f31c568f-1d70-4873-bf5f-2b80e3e52013_EVIDENCE.json`
(SHA-256 `b5340c485252aa7f60b5a97fca905dcdc975798f03fca0052f9fb1484e8f2fc7`).

This inventory result remains accurate for that preflight. The browser was
available in the later retry below; provider availability is no longer the
current blocker.

### Summary-Only Retry - 2026-09-28

Status: `BLOCKED (CONTROL_DISPATCH_UNRELIABLE; INVALID_FOR_RAPID_BURST)`.

The supported Edge integration became available. A ready `dashboard.clients`
baseline was observed with an empty search field and no loading label. The
hosted release endpoint identified release
`hs-1c9756046b01-b55ed4ff550f`, commit
`1c9756046b01cb1bd224fb601ec9094a7f471606`, migration fingerprint
`b55ed4ff550f7e9ba8fc25957774341a19b7b05c1a35a891633369b4aff95f25`; its
exact observation timestamp was not retained, but the read preceded the first
action.

The planned 12 interactions stopped after the first synthetic search-key
dispatch. Its host-side round trip was 5,092 ms and it returned unacknowledged;
a later read-only accessibility check showed the search field length changed
from zero to one. The key value and exact browser event time were not retained.
The 350 ms pacing target was not reached. This host automation delay is not
the browser's input-processing duration and does not prove an application
freeze.

After the action, a 33,064 ms quiet interval elapsed. Six intermediate
accessibility reads were incremental/diff-based and do not provide six
independent full-state samples. One final full snapshot showed the clients
route, dashboard main visible, and no loading label; no continuous loading
duration is established. The first post-action filtered Network read had zero
matching events but a truncated cursor; a later interval had no new events.
Network/RSC and response-body completion therefore remain unavailable. The
single Event Timing/Long Task read returned zero entries, while the
post-action Performance metrics response contained no selected metrics; there
is no paired main-thread result.

Network and Performance disable calls were acknowledged, the temporary
diagnostic tab was closed, and a later inventory verified the user-owned tab
restored to `dashboard.home`. No raw trace, typed value, account identifier,
client content, or form submission was retained. Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_3_SUMMARY_RETRY_20260928T201314Z-4c8fe285-6af5-4ba3-b69e-4e6403dd801b_EVIDENCE.json`
(SHA-256 `8f8db5e7e882aecfe49ea92a830f5a186aba0ebadba37b4f450a239e8605e22a`).

The observation is invalid for a rapid burst; input delivery is only partially
observed, while the API/response-body, network/RSC, and main-thread wait
boundaries are unavailable. No application wait boundary or cause is
established. Do not repeat this sequence automatically. Continue Phase 3 only
after a supported browser action can acknowledge promptly and provide usable
post-action state; raw trace export and permission changes are not required.

This 2026-09-28 retry is superseded by the control-page and MANU-AI probe below;
its evidence remains unchanged. Raw trace export is not required.

### Public Control-Page Test and MANU-AI Retry - 2026-09-29

Status: `HISTORICAL (MANU_APP_ACTIONS_AND_POST_ACTION_STATE_UNAVAILABLE; SUPERSEDED BY FRESH-TAB INPUT RETRY)`.

A single click on a public purpose-built UI interaction demo completed in
136.8 ms and caused one visible Delete control to appear. This verifies that
the Edge control integration could click that demo page at that time; it does
not establish MANU-AI or system-wide responsiveness. An inline `data:` test
page was rejected by browser URL policy and was not retried through another
surface. The example-domain page was not used for the interaction measurement.

On the original MANU-AI dashboard tab, clicking the visible Clients navigation
control timed out after 1,987 ms. An immediate inventory still showed the home
route. The accessibility and screenshot reads then timed out. A fresh tab
reached `dashboard.clients` by direct navigation in 1,577 ms. A sanitized
baseline read showed a complete document, one visible main region, one empty
search control, and no visible busy indicator; no client rows were read.

Clicking the search control to focus it timed out after 1,918 ms. A later
sanitized read showed the field remained empty and unfocused. One synthetic
keyboard dispatch then timed out after 2,729 ms; the post-action read could
not be dispatched, so input delivery is unknown. The key value was not
retained. The hosted release endpoint identified release
`hs-1c9756046b01-b55ed4ff550f`, commit
`1c9756046b01cb1bd224fb601ec9094a7f471606`, migration fingerprint
`b55ed4ff550f7e9ba8fc25957774341a19b7b05c1a35a891633369b4aff95f25`.

No 12-input sequence, 350 ms pacing, or 30-second post-input observation was
obtained. Request/RSC, response-body, and paired main-thread signals remain
unavailable. The control-page result and the MANU-AI timeouts suggest a
difference between those page interactions, but do not distinguish an
application main-thread stall from the browser-control path. No wait boundary
or root cause is established. The temporary test and health tabs were closed;
the remaining Edge tab is on `dashboard.clients`. No form was submitted,
record changed, or raw trace retained. Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_3_CONTROL_TEST_20260928T210737Z-bce5f92a-19d7-4ab0-9b36-c2d70c1fea48_EVIDENCE.json`
(SHA-256 `39d1eebed4e3e06c306b29054c0d9fc8b24da28aa12478d322a4809f8bb285e9`).

Do not start another rapid burst until one harmless MANU-AI action and its
immediate sanitized post-action state both return promptly. Raw trace export
remains unnecessary.

### Fresh-Tab Supported Input Retry - 2026-09-29

Status: `BLOCKED (SUPPORTED_INPUT_DISPATCH_TIMED_OUT; FOURTH_AND_FINAL_APP_PROBE_ATTEMPT)`.

A fresh `dashboard.clients` tab was stable for one second at baseline: document
complete, one visible main region, one empty search control, and no visible
busy/progress indicator. The fixed-schema Runtime read returned in 56.07 ms.
The baseline Event Timing and Long Task entry counts were zero; these empty
samples do not establish that no input delay or main-thread work occurred. A
single baseline `Performance.getMetrics` sample reported 123,152 JS event
listeners, 401 nodes, task duration 0.112754 seconds, and script duration
0.098054 seconds. The listener count is a one-off uncorroborated metric, not
evidence of a cause.

One synthetic key dispatch to the visible, non-submitting search control took
10,263.11 ms and returned `CDP Input.dispatchKeyEvent timeout`. The subsequent
accessibility read took 6,146.51 ms and showed the route unchanged, search
length zero, and focus true. A separate fixed-schema Runtime read returned in
84.67 ms with the document complete, main visible, and no busy/progress
indicator. These observations do not prove that the key was or was not
delivered, nor rule out a transient stall. The filtered Network snapshot had
zero matching events but was truncated; no request/RSC or response-body
lifecycle was correlated. No paired Event Timing, Long Task, or main-thread
measurement was obtained.

An earlier old-tab input call was also unacknowledged; after a separate
navigation call timed out at 30 seconds, a later browser inventory showed the
home route, but the transition time is unknown. No causal inference is made.
No 12-input burst, approximately 350 ms pacing, or 30-second quiet observation
was obtained. The Network and Performance observation domains were enabled;
disablement or CDP detachment was not verified. No raw trace, account
identifier, client content, or input value was retained; no form was submitted
and no record changed.

Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_3_SUMMARY_RETRY_20260928T220632Z-6d30b7d9-52b4-43fb-8ed5-b1560d79db97_EVIDENCE.json`
(SHA-256 `69ad0c4f284a2fcff8a78fa88e90e4469f7639d381bbd02acb6d4e2cec413f44`).
The hash-chained local checkpoint is
`aiya-global-freeze-wait-state-phase-3-20260928T220632882Z-dbadb519-02dd-4986-851f-62f41059e3c5`, status `BLOCKED`, with final event hash
`32f3b3a4bbd65a3f090129ea62a509959c276452bdbd732a9afc258f0f4b809a`.

The capture is invalid for a rapid burst. This was app-probe attempt 4 of 4;
zero usable wait-state records were produced. Input delivery is unknown;
API/RSC, response-body, main-thread, and loading-state wait boundaries remain
unavailable. No system-wide freeze or root cause is established. Do not run
another input probe under the legacy summary-only method. Its 4/4 budget stays
closed. The separately authorized native method and its 0/1 capture budget are
defined below; do not use another browser-control route or change permissions.

### Purpose

Capture the real hosted stall in the user's authenticated session and determine
what remained incomplete at the stall moment.

### Preconditions

- Phase 2 pipeline passed.
- User is signed in to the hosted synthetic account.
- Hosted release identity is unchanged or recorded as a new identity.
- User has attested that the hosted session is the synthetic account.
- Supported browser actions and accessibility-state reads are available.

### Procedure

1. Open the hosted Dashboard and wait for a stable ready baseline: target route
   visible, no loading skeleton for 1 second, and release identity recorded.
2. Record the route/readiness baseline. Do not start raw trace recording.
3. Send 10 to 15 rapid visible interactions matching the user symptom pattern:
   keyboard entry in the visible non-submitting search field (or synthetic
   phone field when present), then rapid
   Dashboard navigation through known safe destinations such as Home, More, and
   Settings. Do not submit a form.
4. Use fresh live element positions for every click. Do not reuse stale
   coordinates.
5. Target about 350 ms between host-side action dispatch starts. Record both
   dispatch start and completion times; actual browser event times remain
   unavailable unless the supported page surface directly exposes them.
6. After the final input, observe for at least 30 seconds without reload,
   additional clicks, or back navigation.
7. Persist a redacted summary with hashes and checkpoint references. Do not
   persist or transfer a raw trace.
8. Capture up to three usable records, with a maximum of four attempts. Do not
   hide failed attempts and do not retry indefinitely.

### Data Flow

User input -> browser event timing -> app route/navigation/hydration state ->
API/RSC request lifecycle -> visible loading/content state -> sanitized
wait-state evidence.

### Error And Boundary Cases

- If baseline never becomes ready within 30 seconds, record
  `BASELINE_STALLED` and do not send rapid inputs.
- If a supported browser action or page-state read fails, record that signal as
  unavailable and stop only if no meaningful visible-state observation can
  continue.
- If authentication expires, record `AUTH_SESSION_UNAVAILABLE`.
- If the hosted release changes between attempts, stop and write a new identity
  note before continuing.
- If clicks are not delivered at the target spacing, keep the failed attempt
  and do not classify it as a valid rapid-input capture.

### Completion Criteria

- Three usable summary-only captures, or one concrete blocker after bounded
  attempts.
- Every capture distinguishes host-side action timings from exact browser
  event timings and records unavailable network/RSC or main-thread signals.
- The result says only what the capture proves: repeated wait boundary, one-off
  observed wait boundary, not reproduced, inconclusive, or blocked.

### Separately Authorized Native Edge Capture Route

Status: `COMPLETE / MAIN_THREAD_BUSY_BOUNDARY_OBSERVED / MAX_1_CAPTURE_USED`.

The user authorized a distinct native Edge Performance recording after the
summary-only method exhausted its 4/4 app-probe attempts. This did not reopen
or add to that budget. The one locally imported native recording has been used;
do not request another capture unless a new bounded attempt is explicitly
approved.

The importer is
`app/scripts/performance-global-freeze-diagnostic.mjs --inspect-native-trace
<saved-trace-file>`. It reads the user-saved JSON trace (including Edge's
`.devtools` trace file) without modifying it, drops
raw event arguments and unsafe fields, and writes a redacted trace plus a
hash-bearing fixed-field summary under ignored `app/.manu-runtime/native-traces/`.
Raw browser traces stay outside the repository and must not be uploaded or
committed. Local preflight evidence:
`docs/AIYA_GLOBAL_FREEZE_NATIVE_TRACE_IMPORT_PREFLIGHT_20260928T230908Z-4126d1bf-b38e-4c30-996f-d96b072f8d72_EVIDENCE.json`.
(SHA-256 `2cbedc226f6dfcaccce327b8cb3354f464cb4b0115df350b2f5642011caa9721`).
Hosted native capture evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_3_NATIVE_20260929T164900Z-89ec155a-344e-4b48-adc2-c4b03c1b55ef_EVIDENCE.json`.

#### Completed Capture Summary

The user-saved Edge Performance trace parsed after two narrow importer repairs:
the trace event cap was raised from 500,000 to 1,000,000, and the trace-window
min/max calculation was changed to an iterative pass to avoid a large-array
call-stack overflow. Both repairs affect only diagnostic import capacity, not
application runtime behavior. The focused diagnostic test suite passed 27/27.

The trace contained 880,312 original events, 802,196 sanitized retained events,
342 profile chunks, and a 140,925.752 ms recording window. The summary observed
212 input dispatches. Expected input delivery remains unavailable because the
native trace did not include expected-action markers. Network lifecycle was
observed: 128 requests, 34 RSC requests, and two unfinished
`/api/session/activity` POST requests waiting for headers at recorded trace
end. The longest completed network requests were about 1.72 seconds, while the
renderer main thread had 31 long tasks, including 34.390 seconds, 12.406
seconds, 9.984 seconds, 7.728 seconds, and 5.530 seconds. App visible loading
state remains unavailable because fixed app markers were not present.

Conclusion: this recording identifies the first wait boundary as client
renderer main-thread busy work. It does not prove the final code root cause,
does not include host/database timing, and does not disprove the broader
desktop/phone symptom. The user-reported reload delay after recording stopped
is retained as an out-of-trace observation only.

#### Historical One-Capture Procedure

1. Confirm the already user-attested synthetic hosted account and the release
   identity recorded at the top of this plan; do not use real client data.
2. In Edge, open DevTools Performance, start a runtime recording, and leave
   Screenshots off. Reproduce the user's ordinary pattern once with about
   10-15 quick, harmless typing/navigation interactions; include a reload only
   if it is part of the natural reproduction. Do not submit a form or force
   exact 350 ms intervals.
3. After the last action, observe for at least 30 seconds, then stop the
   recording and use Save profile -> Save trace to a local file outside the
   repository. Do not upload or paste the raw file.
4. Provide only the local file path. Import it with the command above; inspect
   the sanitized summary and retain its source/sanitized hashes and local
   artifact reference.
5. Record whether a stall was actually observed and whether a loading
   indicator remained visible as a separate user observation. Do not treat an
   absent marker or absent event as proof that the event did not occur.

#### Interpretation Limits

- A visible allowlisted input dispatch proves that such an event was observed;
  missing dispatches do not prove expected input was not delivered.
- Requests lacking response/finish events at trace end are classified as
  unfinished in the recording, not automatically as the freeze's cause.
- Long tasks and EventTiming entries are summarized. Input dispatch, network,
  and task timestamps can be compared on the same trace timeline, but without
  expected-action markers temporal proximity alone is not causal proof.
- App loading visibility is `UNAVAILABLE` unless the existing fixed app markers
  are present; the separately reported visible state is not a DOM measurement.
- No host/DB timing is included. Client timing alone cannot establish a
  server or database root cause.

#### Closure Gate

- This one trace is eligible because it parses, redaction passes, both output
  hashes verify, and the recording window/symptom observation are recorded.
- Do not retry without a new approval.
- Phase 4 may proceed to attribution from the main-thread busy boundary; this
  still does not prove a final root cause.

## Phase 4 - Attribution And Next Fix Gate

Status: `INCONCLUSIVE / RENDERER_BUSY_BOUNDARY_OBSERVED / SOURCE_OWNER_UNRESOLVED`.

### Purpose

Turn the captured wait boundary into one precise next engineering action. This
phase does not implement a runtime fix unless the evidence identifies the owner
boundary and a separate fix step is approved.

### Classification Rules

- Input not delivered or delayed before handler: browser/device/control layer.
- Handler runs but no request/navigation starts: client navigation or hydration
  scheduling boundary.
- Request sent but no headers: network/server/auth/store/database wait
  candidate.
- Headers arrive but body does not finish: response/body/read boundary.
- Request completes and main thread is busy: JavaScript, parse, render, layout,
  or extension/app script boundary.
- Request completes, main thread is responsive, but skeleton persists: React
  hydration/state ownership or stale loading-state boundary.
- Multiple indistinguishable layers: `INCONCLUSIVE`, no speculative fix.

### Owner Mapping

Map only the repeated boundary to owner files/functions. Expected candidates
may include:

- `app/src/components/dashboard-app.tsx`
- `app/src/lib/use-aiya-state.ts`
- `app/src/components/dashboard/shell-provider.tsx`
- `app/src/components/dashboard/dashboard-navigation.tsx`
- `app/src/lib/use-dashboard-url.ts`
- `app/src/app/api/app-state/route.ts`
- `app/src/app/api/shell/bootstrap/route.ts`
- `app/src/lib/dashboard-server-auth.ts`
- `app/src/lib/auth-context.ts`
- `app/src/lib/supabase-store.ts`

Database attribution requires request timing plus a safe aggregate DB signal.
Do not claim a database root cause from client timing alone.

### Completion Criteria

- Output one of:
  `WAIT_BOUNDARY_REPEATED`,
  `WAIT_BOUNDARY_OBSERVED`,
  `NOT_REPRODUCED`,
  `INCONCLUSIVE`,
  or `BLOCKED`.
- Name the exact owner file/function only when the evidence supports it.
- State separately: observation validity, functional outcome, and performance
  or cause result.
- Update handoff, next plan, and risk register only to reflect the actual
  result.
- Do not run broad test matrices or implement speculative optimizations.

### Phase 4 Result - 2026-09-29

Result: `INCONCLUSIVE` for exact source-owner attribution. The Phase 3
observation remains valid: the native trace contains 31 renderer main-thread
long tasks, with a maximum duration of 34,390.426 ms. The live
`/api/health/release` identity was re-read at `2026-09-29T17:07:27.788Z` and
matches hosted commit `1c9756046b01cb1bd224fb601ec9094a7f471606`; the trace's
dashboard and shared asset URLs returned the same release assets.

The `1555` asset contains Next Web Vitals LCP and idle-callback code. The hosted
source maps this integration to
`app/src/components/dashboard/shell-web-vitals-reporter.tsx`, mounted by
`shell-provider.tsx`; the production metric sink defaults to a no-op. This is a
limited candidate only: the bundle contributes 2,706 of 512,671 samples in the
inspected profile stream, and its `U` frame contributes 366 samples within the
longest task window. Most samples in the long-task windows are browser-native
or have no source URL. At the time of this Phase 4 result, the profile thread
was not mapped to `CrRendererMain`, and the hosted `.map` requests returned
404. Phase 5A later recovered renderer-main ownership from retained profile
metadata; DashboardApp, ClientWorkspace,
`useStage6ClientWorkspace`, database work, and a final cause are not attributed.

Observation validity, functional outcome, and cause remain separate:

- Observation validity: the saved trace parsed and was redacted; its assets
  match the currently observed hosted release identity.
- Functional outcome: expected-action delivery and app-visible loading state
  are unavailable because their markers are absent. The reported two-minute
  reload delay occurred after recording stopped.
- Performance/cause result: renderer main-thread busy work was observed;
  exact source owner and causality remain unproven.

Phase 4's next bounded step was the local single-variable comparison described
above. The historical Phase 5C preflight stopped before startup, but that safety
block was later resolved without reading client rows: the local Supabase target,
synthetic fixture, loopback URLs, build, and release identity were verified.
The matched A/B result and its exact limitations are recorded in the current
Phase 5C section below.

## Phase 5 - Profile Attribution, Candidate Assessment, And Local A/B Gate

Status: `5A COMPLETE / 5B INCONCLUSIVE_STRONG_CANDIDATE / 5C COMPLETE_INCONCLUSIVE_LOCAL_NONREPRODUCTION_REPORTER_SOLE_TRIGGER_NOT_SUPPORTED`.

### Phase 5A Result - Renderer Profile Attribution

Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_5A_20260929T191002Z-9c8d56c9-01b7-4afe-b389-9dc718d8d868_EVIDENCE.json`.
The retained raw profile has one profile, 5,223 chunks, 512,671 samples and
time deltas, zero invalid samples, and a profile-header mapping to the renderer
main thread. All 31 long-task windows were attributed; the longest is
34,390.426 ms wall time and 34,066.955 ms thread time. This resolves the
profile-to-renderer mapping gap in the original Phase 4 analysis. The 100%
sample-interval coverage on the longest task is not 100% application-source
coverage.

### Phase 5B Result - Strong Candidate, Cause Unproven

Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_5B_20260929T191002Z-607115e1-07b2-4fa9-91f8-d0136eb384f2_EVIDENCE.json`.
The hosted `1555` chunk's Web Vitals registration/scheduling frames `U` and `m`
appear in the top ten frames of 30/31 long tasks. The matching hosted
`ShellWebVitalsReporter` is mounted in the shared `ShellProvider`. This is the
strongest actionable application-code candidate in the current trace, not a
confirmed trigger. In the longest task, `U` and `m` have 19.213 ms and 8.879
ms self time despite large inclusive totals; browser-native `addEventListener`
and `requestIdleCallback` frames account for large sampled self time. Keep
self time distinct from inclusive time. Production source maps remain absent.

### Historical Phase 5C Result - A/B Stopped Before Startup

Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_5C_20260929T191002Z-c531c6f5-75ce-48d3-85da-47027957325d_EVIDENCE.json`.
The isolated worktree is at hosted commit
`1c9756046b01cb1bd224fb601ec9094a7f471606`. The local `manu-ai-local`
Supabase stack is running and its Auth health endpoint returned 200, but the
configured `NEXT_PUBLIC_SUPABASE_URL` is not loopback, the current shell cannot
resolve the Supabase CLI, and the database has not been verified as
synthetic-only. No database rows were queried and no build, app, or migration
was started. This is a safety stop, not an A/B result.

Exact continuation: confirm the running `manu-ai-local` database is disposable
and synthetic-only without reading client rows; if it cannot be confirmed,
provide a fresh isolated local synthetic target. Separately authorize any
required migration application. Do not install a Supabase CLI to work around
the current preflight. Before package installation, build, or app startup,
verify with values suppressed that
`NEXT_PUBLIC_APP_URL` and every `NEXT_PUBLIC_*` service URL are loopback/safe,
and that Supabase anon/service-role credentials belong only to that local
synthetic target. Do not reuse the main checkout's `.env.local`. The hosted
worktree has no `node_modules`; if needed, install only the committed lockfile
with `npm ci` in that worktree, without changing manifests or lockfiles.

Then use that worktree for exactly one matched A/B pair: same Edge version,
viewport, synthetic account/data, local target, and clean browser state. On
`dashboard.clients`, focus the client search, type three synthetic characters
350 ms apart without submitting, navigate Dashboard -> Clients once, then
reload once. Capture 60 seconds from the first input in native Edge Performance.
Condition A mounts `ShellWebVitalsReporter`; condition B bypasses only that
component. Run A then B and keep every other source/configuration value
identical. Record input dispatches and renderer-main RunTask count, maximum,
total time for tasks >=50 ms, and call trees with the existing redacted profile
analyzer; keep inclusive and self time separate. Candidate contribution is
supported locally only if A reproduces a >=500 ms renderer-main task containing
the `1555` Web Vitals frames, while B has no task >=250 ms and at least 50%
less total >=50 ms task time. If B retains a >=500 ms task and at least 80% of
A's total >=50 ms task time, the reporter is not supported as the sole local
trigger. Any other result, missing input/profile markers, or non-reproduction
in A is `INCONCLUSIVE`; it does not dismiss the system-wide desktop/phone
symptom. Do not repeat hosted capture, build a new harness, deploy, apply
migrations without separate authorization, or make a runtime fix in this
comparison.

### Phase 5C Current Result - Matched Local A/B Completed

Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_5C_AB_20260929T210246Z-453a0a97-7a60-4333-beb6-89e70381a585_EVIDENCE.json`
(SHA-256 `CCB172D212ABE3BA9F694EA8A56C95C29FCF15F4DEB17CD709BF530EC43518A6`).

The historical preflight blocker was resolved with the project-local Supabase
CLI, loopback-only service URLs, the existing normal synthetic fixture, and a
hosted-commit detached worktree. Both builds passed, both `/api/health/release`
responses reported release `hs-1c9756046b01-fe7df69e1df4` at commit
`1c9756046b01cb1bd224fb601ec9094a7f471606`, and no migration or real provider
was used. The only A/B variable was whether the shared `ShellWebVitalsReporter`
was mounted.

Both counted runs completed login, Dashboard -> Clients navigation, search focus,
three synthetic characters at 350 ms spacing, reload, and a 60-second trace.
Condition A observed 4 renderer-main long tasks, longest `268.588 ms`, total
`444.023 ms` for tasks >=50 ms, with Web Vitals frames `U=3`, `m=8`.
Condition B observed 6 long tasks, longest `288.242 ms`, total `639.539 ms`,
with `U=0`, `m=0`. The numeric chunk `1555` remained in B because it is shared
application code; the `U/m` function signal is the meaningful condition check.

The predeclared causal-support gate failed in both required ways: A did not
reproduce a >=500 ms renderer task, and B did not have fewer than 250 ms maximum
task time or at least 50% lower total >=50 ms task time. The result is therefore
`COMPLETE / INCONCLUSIVE_LOCAL_NONREPRODUCTION / REPORTER_SOLE_TRIGGER_NOT_SUPPORTED`.
This weakens the reporter-only hypothesis in this controlled local condition but
does not disprove the desktop/phone symptom, exclude the reporter as a conditional
contributor, or attribute the remaining work to a server, database, or mobile
path. No runtime change was accepted; Plan 1, Plan 2 eligibility, and production
`NO-GO` are unchanged.

### Phase 5C Profile Boundary Continuation - Existing B Profile

Evidence:
`docs/AIYA_GLOBAL_FREEZE_WAIT_STATE_PHASE_5C_PROFILE_BOUNDARY_20260929T210701Z-d1ae04b6-888a-4cd1-975b-fa70731beeaa_EVIDENCE.json`
(SHA-256 `E6730FB0DCD3830621EF9023F5B880A44E1BE911B861DB0888847B3DAA95DC5B`).

The existing valid B redacted profile was analyzed read-only; no new browser
capture or harness was created. All six >=50 ms renderer tasks were attributed to
the mapped renderer profile, but no stable application owner was found. The
288.242 ms task has only `0.8%` sampled source coverage and `285.948 ms` unknown
time; its visible `evaluate`/`querySelectorAll`/locator frames are an
automation-or-injected-DOM-query candidate. The other five tasks are dominated by
unnamed `<script>` self time plus source-unmapped `<external-script>` and DOM
frames. None contains `U` or `m` reporter frames. Result:
`INCONCLUSIVE / REMAINING_LOCAL_LONG_TASKS_UNATTRIBUTED_AFTER_REPORTER_BYPASS`.

Exact continuation: stop the reporter candidate and do not repeat this A/B or
make a reporter optimization. The next diagnostic requires separate approval for
a supported cross-device or interactive owner-boundary capture that includes
stable app markers and source ownership. Until that exists, keep the global
freeze, Plan 1 diagnosis, and production `NO-GO` statuses unchanged; do not infer
a database/server cause from this client-only profile.

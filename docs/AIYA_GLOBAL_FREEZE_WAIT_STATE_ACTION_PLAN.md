# AIya Global Freeze Wait-State Action Plan

Date: 2026-09-28
Status: `PHASE_1_IN_PROGRESS`
Scope: identify what is waiting at the moment the hosted UI stalls.

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

## Phase 3 - Hosted Wait-State Capture

### Purpose

Capture the real hosted stall in the user's authenticated session and determine
what remained incomplete at the stall moment.

### Preconditions

- Phase 2 pipeline passed.
- User is signed in to the hosted synthetic account.
- Hosted release identity is unchanged or recorded as a new identity.
- Browser trace export path is platform-supported and does not rely on blocked
  `data:`/Blob/page-bulk transfer workarounds.

### Procedure

1. Open the hosted Dashboard and wait for a stable ready baseline: target route
   visible, no loading skeleton for 1 second, and release identity recorded.
2. Start trace recording and the fixed-field page observer.
3. Send 10 to 15 rapid visible interactions matching the user symptom pattern:
   keyboard entry in the synthetic phone field when present, then rapid
   Dashboard navigation through known safe destinations such as Home, More, and
   Settings. Do not submit a form.
4. Use fresh live element positions for every click. Do not reuse stale
   coordinates.
5. Target about 350 ms between inputs. Record actual event gaps rather than
   assuming them.
6. After the final input, observe for at least 30 seconds without reload,
   additional clicks, or back navigation.
7. Persist the raw trace locally, sanitize it, hash it, and commit only the
   redacted summary.
8. Capture up to three usable records, with a maximum of four attempts. Do not
   hide failed attempts and do not retry indefinitely.

### Data Flow

User input -> browser event timing -> app route/navigation/hydration state ->
API/RSC request lifecycle -> visible loading/content state -> sanitized
wait-state evidence.

### Error And Boundary Cases

- If baseline never becomes ready within 30 seconds, record
  `BASELINE_STALLED` and do not send rapid inputs.
- If the trace cannot be exported, record `TRACE_EXPORT_BLOCKED`.
- If authentication expires, record `AUTH_SESSION_UNAVAILABLE`.
- If the hosted release changes between attempts, stop and write a new identity
  note before continuing.
- If clicks are not delivered at the target spacing, keep the failed attempt
  and do not classify it as a valid rapid-input capture.

### Completion Criteria

- Three usable captures, or one concrete blocker after bounded attempts.
- Every valid capture records actual input timing, visible state, network/RSC
  state, and main-thread/heartbeat state.
- The result says only what the capture proves: repeated wait boundary, one-off
  observed wait boundary, not reproduced, inconclusive, or blocked.

## Phase 4 - Attribution And Next Fix Gate

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

# AIya Performance Phase 2 Execution Scope - Revision 2

Generated: 2026-09-10

Canonical plan: `docs/AIYA_PERFORMANCE_ACTION_PLAN.md`.

Production decision remains `NO-GO`.

## Scope Rule

Phase 2 is no longer a direct optimization phase. It is a valid-measurement, causal-attribution, and evidence-limited local remediation phase.

Runtime code may be changed only after the revised plan's Phase 2 stages prove all of the following:

1. The scenario is measured on a real authenticated tenant/account/actor path, not fallback/demo-only state.
2. The failure or budget miss is reproduced with strong task-specific ready selectors.
3. Required authenticated reads return expected 2xx responses; 401/403/500/timeout/missing-selector samples are failures.
4. The root cause is tied to exact files/functions and at least three matching samples or traces.
5. The proposed fix preserves tenant isolation, RLS assumptions, service-role boundaries, idempotency, expected-revision behavior, dirty-state behavior, no-store API semantics, and network-only/fail-closed PWA behavior.

If a candidate issue is not reproduced under the revised harness, it must be recorded as `NOT_REPRODUCED` or `NO_CHANGE_JUSTIFIED`; speculative runtime optimization is out of scope.

## Historical Finding Reclassification Input

The following findings remain inputs to Phase 2, but their Phase 1/1.2 classifications are not enough to authorize runtime edits by themselves.

| ID | Current Revision 2 handling | Files or surfaces |
| --- | --- | --- |
| `PERF-F2-001` | Static risk to revalidate under real auth/store path. Runtime changes require consumer mapping and real request fanout proof. | `app/src/lib/use-aiya-state.ts`, `app/src/app/api/app-state/route.ts`, `app/src/lib/supabase-store.ts`, `app/src/components/dashboard-app.tsx` |
| `PERF-F2-002` | Static risk to revalidate with route/visibility/owner/inflight timing. Runtime changes require measured background contention. | `app/src/lib/use-stage-4b-inbox.ts`, `app/src/lib/use-stage-4b2-messaging.ts`, `app/src/lib/use-ai-chat.ts` |
| `PERF-F2-003` | Static bundle/render risk to revalidate with task-specific trace and local Next.js lazy-loading guidance. | `app/src/components/dashboard-app.tsx`, `app/src/components/dashboard/**`, `app/src/app/dashboard/**` |
| `PERF-F12-001` | Confirmed measurement gate gap. AI Chat cannot be counted ready unless authenticated conversation-list read is expected 2xx and the AI Chat workspace selector is visible. Local missing-Supabase 401 is not automatically a hosted auth bug. | `app/scripts/measure-aiya-performance.mjs`, `app/scripts/measure-aiya-performance-phase-1-2.mjs`, AI Chat page and route guard |
| `PERF-F12-002` | Measured candidate requiring rerun under revised harness. The placeholder `locked_by_phase_1_2_measurement` cannot authorize file edits until exact affected files/functions are proven. | To be resolved by Phase 2 stages |

## Required Phase 2 Stages

1. Reconcile source, live release identity, Phase 1 evidence, Phase 1.2 evidence, and combined findings.
2. Repair the harness so warm SPA transitions are measured without repeated `page.goto()` and all invalid samples fail honestly.
3. Build a local real-Supabase synthetic baseline with real password login and no demo/fallback store.
4. Prepare a separate hosted synthetic test account only after explicit external-system approval.
5. Capture valid baselines on local real DB, owner PC hosted, physical Android Chrome hosted, and installed PWA hosted when available.
6. Attribute cause by layer: DNS/TLS/TTFB, auth/session, RPC/store, response body, parse, React render/layout/paint, poll/mount, service worker, release identity.
7. Apply only evidence-limited local fixes in the priority order defined by the canonical plan.
8. Rerun matched before/after validation with 20 samples per required scenario.
9. Close with tests, stale-document scan, secret scan, `git diff --check`, and `git status --short --branch`.

## Non-Negotiable Exclusions

- No production GO change.
- No deploy, push, PR, merge, remote migration, provider/channel egress, live billing, production worker start, or real health-data path.
- No service-role substitution for user authorization.
- No offline health-data cache or offline mutation queue.
- No evidence containing secrets, cookies, tokens, raw prompts, raw request/response bodies, raw traces, HARs, or real clinical content.

## Closure Outcome

Phase 2 may close only as one of:

- `LOCAL_REMEDIATION_VERIFIED`: every prescribed stage is complete, required tests pass, and local before/after evidence closes the relevant findings.
- `PERFORMANCE_BLOCKED`: the revised harness, real auth path, physical device, hosted test account, or environment cannot provide the required evidence.

Either outcome keeps production `NO-GO` until a separately approved hosted acceptance phase completes.

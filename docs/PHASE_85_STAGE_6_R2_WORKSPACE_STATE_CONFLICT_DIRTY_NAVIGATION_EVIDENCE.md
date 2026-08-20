# Phase 85 Stage 6 R2 Workspace State, Conflict, Dirty-State And Navigation Evidence

Date: 2026-08-19

Status: **R2 COMPLETE LOCALLY**

Stage 5 status: **STAGE_5_CLOSED**

Production status: **NO-GO**

## Result

Stage 6 workspace state is now owned by `tenantId:clientId:domain`. A previous tenant, client, or task response cannot remain visible while a new owner loads. The bounded forms response is consumed by the form editor instead of being fetched and then ignored in favor of compatibility state.

The URL is the sole viewed-client/task authority. The duplicate `workspaceOverride` state was removed. Client selection now gives the Stage 5 shell transition the exact destination URL before active-client persistence; immediate and dirty-confirmed transitions therefore converge on the same client, section, and task. Task/back transitions use the shell href guard.

Forms, nutrition, menu, context, client creation, and AI controls expose real saving/error/conflict state to the central dirty registry. Async create/context callbacks are awaited. Successful bounded mutations reload only the open workspace domain so the acknowledged server baseline becomes clean without a broad app-state refresh. Pending token/text inputs, non-default client language, and context source/importance/date are dirty. Menu activation and plan switching cannot silently discard an edited plan; plan switching presents an explicit stay/discard decision.

Revision conflicts are separated from unrelated `409` responses. Conflict UI preserves the component-local draft and directs the dietitian to discard and reopen the bounded task for the current server revision. Offline failures remain fail-closed and do not introduce cache, queue, or offline mutation behavior.

## Changed Surface

- Workspace ownership/state: `app/src/lib/use-stage-6-client-workspace.ts`, `app/src/lib/phase-85-stage-6-workspace-state.ts`.
- Navigation coordination: `app/src/components/dashboard-app.tsx`, `app/src/components/dashboard/client-workspace.tsx`.
- Editor state: client roster/create, form, nutrition, menu, context, and AI-control components.
- Error metadata: `app/src/lib/use-manu-state.ts` retains bounded conflict field/revision metadata in `AppRequestError`.
- Tests: R2 state/ownership unit coverage and real Playwright dirty client-switch coverage.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| Targeted R2/workspace/editor tests | PASS: 8 files / 47 tests |
| `npm run lint` | PASS: 0 errors / 70 pre-existing warnings |
| `npm test` | PASS: 261 files / 1555 passed / 9 skipped |
| `npm run build` | PASS |
| Stage 6 workspace Playwright matrix on desktop, desktop-xl, tablet, mobile Android, and mobile iOS emulation | PASS: 52 passed / 3 expected desktop-only assertions skipped; includes real dirty-switch and bounded-save-clean navigation cases |
| Schema/RLS reset and `test:rls` | Not run: R2 changes no schema, migration, policy, RPC, or persistence authorization |

Two final build retries first failed with Windows/OneDrive `EPERM` on the generated `.next/types/app` reparse point. They were not counted as PASS. After the generated `.next` output was moved to `.next-r2-build-lock-backup`, a clean `npm run build` completed successfully. The backup is ignored build output; an attempted recursive cleanup was blocked by tool policy and did not affect Git state.

## Residual Boundaries

- Drafts remain component-local by design and are not persisted across hard reload, logout, privacy lock, or process termination.
- Conflict recovery intentionally does not auto-merge clinical drafts. The dietitian must discard the stale baseline and reopen the bounded task before editing the current revision.
- The mobile iOS Playwright project is Chromium device emulation, not new physical Safari evidence. Stage 5 physical-device closure remains authoritative and unchanged.
- No provider/channel egress, live billing, production rollout, real-data path, service-worker cache, offline queue, or Stage 5 shell contract was opened.

## Next Boundary

Stage 6 Phase 4 remains not started and requires separate explicit approval. R2 is ready for a separate commit after user approval; push is not authorized.

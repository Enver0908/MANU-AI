# Phase 85 Stage 4B - Post-Closure Remediation Evidence

Date: 2026-07-12
Branch: `codex/phase-85-interstage-clinical-memory`
Scope: architecture audit findings against the Stage 4B implementation plan
Status: **implementation and offline/full-scale verification complete; current RLS closure is blocked by unavailable Docker**

Production pilot: **NO-GO**
R-405: **open**
Stage 4B-2: **next**
Stage 4C: **blocked until Stage 4B-2 closes**

## 1. Audit findings addressed

The remediation pass corrected the gaps that made the original Stage 4B closure evidence too strong:

1. Supabase alert and notification lists no longer call `loadSupabaseState`; they use bounded actor-aware v2 RPCs, server-side filters, counts, and keyset cursors.
2. The service-role Supabase path now validates the supplied tenant user, dietitian, and role against tenant membership before returning data or mutating a receipt.
3. Supabase alert SLA reads use the latest persisted dietitian form response and timezone; demo persistence now includes dietitian form schema/response rows.
4. Notification link projection validates client, conversation, message, and handoff relationships and fails closed on foreign or inconsistent links.
5. Draft invalidation is client-specific and lifecycle-aware. Human manual handling reconciles the matching event; superseded drafts emit a visible `draft_invalidated` system notification.
6. Human-control integrity reconciliation has a runtime producer through simulator risk-state reconciliation.
7. Unsupported-media review completion is atomic and requires the same actor receipt to be both read and acknowledged.
8. Assistant and auditor UI controls are read-only where the role contract requires it; server enforcement remains authoritative.
9. Malformed alert/notification query parameters are handled inside the route error boundary.
10. Visual coverage now includes screenshot assertions, keyboard focus, selected-tab semantics, mobile layout, real alert rows, and real notification rows.
11. The missing Stage 4B runtime specification was added, and stale evidence counts/claims are corrected in this remediation evidence chain.

## 2. Main implementation surface

- Append-only migration: `app/supabase/migrations/20260712120000_phase_85_stage_4b_postclosure_remediation.sql`
- Bounded store/API path: `app/src/lib/supabase-store.ts`, `app/src/lib/phase-85-stage-4b-api.ts`
- Lifecycle and safe-link validation: `app/src/lib/phase-85-stage-4b-notifications.ts`, `app/src/lib/simulator.ts`
- Producer coverage: `client-forms.ts`, `client-context-updates.ts`, `client-update-proposals.ts`
- Route hardening: `app/src/app/api/alerts/route.ts`, `app/src/app/api/notifications/route.ts`
- Role-aware UI controls: `dashboard-app.tsx`, `clients-panel.tsx`, `conversation-panel.tsx`, `ai-assistant-control-panel.tsx`
- Visual coverage: `app/tests/visual/dashboard.visual.spec.ts` and six Stage 4B snapshots across four viewport projects

## 3. Verification results

| Check | Result |
| --- | --- |
| Core `npm test` | **234/234 passed** |
| App `npm test` | **901 passed, 5 skipped** across 141 files |
| Stage 4B rehearsal | **9/9 passed**, including targeted 51/51 and full-scale 2/2; seven gated scale tests remain skipped by design |
| Channel replay | **4 passed, 126 skipped** in the full mock harness |
| 79G production-scale rehearsal | **passed**; expanded AI 5,000 cases, channel replay, seven scale tests, and release verification passed |
| `npm run release:verify` | **passed**; only documented R-405 findings remain |
| `npm run lint` | passed with three unchanged repository warnings and zero errors |
| `npm run build` | passed; TypeScript and 55 static pages generated |
| `npm run test:visual` | **36/36 passed** across desktop, tablet, Android, and iOS viewport projects |
| RLS integration | **33 skipped, not passed**; Docker daemon unavailable |

The RLS blocker is environmental, not silently converted to success. `docker info` reported that the Docker Desktop Linux engine pipe was unavailable. The new role-matrix and v2 RPC tests are present in `supabase-rls.integration.test.ts` and must be run after local Supabase is available and the append-only migration is reset.

## 4. Security and governance result

- Alert and notification DTOs remain allowlisted and do not include raw body, health data, free-text clinical reasons, or trust/quarantine evidence.
- Red precedence, client assignment scope, auditor zero visibility, assistant receipt immutability, and tenant-composite receipt keys are enforced in the tested application/RPC contracts.
- Real WhatsApp, Telegram, Gemini/external LLM, live billing, monitoring, backup, secret-manager, and real health-data paths remain closed.
- The production pilot decision remains `NO-GO`; R-405 remains open.

## 5. Remaining closure action

When Docker Desktop/local Supabase is available, run the migration reset and `npm run test:rls`. A passing role matrix is required before describing the Stage 4B persistence/RLS evidence as fully green. Until then, this commit is a verified local implementation with an explicit environment-blocked RLS condition.

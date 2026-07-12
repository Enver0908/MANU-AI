# Phase 85 Stage 4B-2 — Closure Evidence

Date: 2026-07-12  
Branch: `codex/phase-85-interstage-clinical-memory`  
Scope: Stage 4B-2 Mesajlaşma Phases 0–11 (documentation through evidence closure)  
Status: **historical implementation and offline/full-scale/visual evidence recorded; post-closure remediation active; current RLS closure is blocked by unavailable Docker**

Production pilot: **NO-GO**  
R-405: **open**  
Stage 4C: **blocked by post-closure remediation**

## 1. Phase evidence chain

| Phase | Scope | Evidence |
| --- | --- | --- |
| 0 | Documentation lock | `docs/PHASE_85_STAGE_4B_2_PHASE_0_DOCUMENTATION_EVIDENCE.md` |
| 1 | Domain, DTO, authorization | `docs/PHASE_85_STAGE_4B_2_PHASE_1_DOMAIN_DTO_AUTHORIZATION_EVIDENCE.md` |
| 2 | Receipt persistence, sequence backfill, RLS | `docs/PHASE_85_STAGE_4B_2_PHASE_2_RECEIPT_PERSISTENCE_RLS_EVIDENCE.md` |
| 3 | Bounded list/detail projection | `docs/PHASE_85_STAGE_4B_2_PHASE_3_BOUNDED_PROJECTION_EVIDENCE.md` |
| 4 | Actor-aware read APIs | `docs/PHASE_85_STAGE_4B_2_PHASE_4_READ_APIS_EVIDENCE.md` |
| 5 | Manual/yellow/draft mutations | `docs/PHASE_85_STAGE_4B_2_PHASE_5_MUTATIONS_EVIDENCE.md` |
| 6 | Routing, hooks, refresh | `docs/PHASE_85_STAGE_4B_2_PHASE_6_ROUTING_HOOKS_EVIDENCE.md` |
| 7 | Messaging list and navigation | `docs/PHASE_85_STAGE_4B_2_PHASE_7_MESSAGING_LIST_EVIDENCE.md` |
| 8 | Conversation detail, draft, AI controls | `docs/PHASE_85_STAGE_4B_2_PHASE_8_CONVERSATION_DETAIL_EVIDENCE.md` |
| 9 | Lifecycle and Stage 4B integration | `docs/PHASE_85_STAGE_4B_2_PHASE_9_INTEGRATION_EVIDENCE.md` |
| 10 | Security, scale, visual, release | `docs/PHASE_85_STAGE_4B_2_PHASE_10_VERIFICATION_EVIDENCE.md` |
| 11 | Canonical spec and continuity closure | this document + `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_SPEC.md` |

## 2. Main implementation surface

### Migrations (append-only)

- `app/supabase/migrations/20260712140000_phase_85_stage_4b2_receipt_persistence_rls.sql`
- `app/supabase/migrations/20260712150000_phase_85_stage_4b2_read_api_projection_rpcs.sql`
- `app/supabase/migrations/20260712160000_phase_85_stage_4b2_mutation_idempotency.sql`

### Core libraries

- `app/src/lib/phase-85-stage-4b2-contracts.ts` — DTOs and permission projection
- `app/src/lib/phase-85-stage-4b2-messaging.ts` — list/detail/unread projection
- `app/src/lib/phase-85-stage-4b2-api.ts` — HTTP/API orchestration
- `app/src/lib/phase-85-stage-4b2-messaging-integration.ts` — Stage 4B deep links and refresh
- `app/src/lib/phase-85-stage-4b2-messaging-integration-evidence.ts` — lifecycle evaluator
- `app/src/lib/phase-85-stage-4b2-verification.ts` — scale/hygiene evidence
- `app/src/lib/use-stage-4b2-messaging.ts` — client hook with polling and pagination

### API routes

- `app/src/app/api/conversations/route.ts`
- `app/src/app/api/conversations/[id]/messages/route.ts`
- `app/src/app/api/conversations/[id]/read/route.ts`
- `app/src/app/api/messages/manual/route.ts` (conversation-scoped mutation DTO)
- `app/src/app/api/messages/drafts/[id]/route.ts` (reviewed-manual semantics)

### UI

- `app/src/components/dashboard/messaging-panel.tsx`
- `app/src/components/dashboard/conversation-list-row.tsx`
- `app/src/components/dashboard/conversation-panel.tsx` (+ bubble/header/composer/draft subcomponents)
- `app/src/components/dashboard-app.tsx` — wiring, memoized filters, surface refresh

### Visual and rehearsal

- `app/tests/visual/messaging.visual.spec.ts` + snapshots (4 viewports × 5 scenarios)
- `app/scripts/rehearse-stage-4b2-verification.mjs` (`npm run rehearse:stage-4b2:verification`)

## 3. Verification results (2026-07-12)

| Check | Result |
| --- | --- |
| Core `npm test` | **234/234 passed** |
| App `npm test` | **953 passed**, 6 skipped (959 total) |
| `rehearse:stage-4b2:verification` | **pass** |
| `rehearse:channel:replay` | **pass** |
| `rehearse:production-scale:79g` | **pass** |
| `npm run release:verify` | **pass** (R-405 documented findings remain) |
| `npm run lint` | **pass** (0 errors, 4 pre-existing warnings) |
| `npm run build` | **pass** |
| `npm run test:visual` | **40/40 passed** (desktop, tablet, mobile-android, mobile-ios) |
| `npm run test:rls` | **35 skipped** — Docker/local Supabase unavailable; **not counted as pass** |
| `git diff --check` | **pass** |
| Workspace hygiene scan | **historical scoped pass** (no forbidden future-phase leaks, live Stripe keys, embedded service role) |
| Bounded messaging sample | list default **30**, max **100**; detail default **50**, max **100** on 10k fixture sample |

## 4. Role matrix (tested application/RPC contract)

| Role | Inbox | Detail | Mark read | Reply | Draft review | AI controls |
| --- | --- | --- | --- | --- | --- | --- |
| owner/admin | tenant-wide | yes | own | yes | yes | yes |
| dietitian | assigned | yes | own | yes | yes | yes |
| viewer | assigned | read-only | own | denied | denied | denied |
| assistant | assigned | read-only | own only | denied | denied | denied |
| auditor | empty | denied | denied | denied | denied | denied |

RLS integration matrix tests exist in `supabase-rls.integration.test.ts` and require local Supabase reset after migrations are applied.

## 5. Visual coverage summary

| Scenario | desktop | tablet | mobile-android | mobile-ios |
| --- | --- | --- | --- | --- |
| Inbox list | yes | yes | yes | yes |
| Conversation detail | yes | yes | yes | yes |
| Yellow draft review | yes | yes | yes | yes |
| Red manual reply | yes | yes | yes | yes |
| Assistant read-only | yes | yes | yes | yes |

Snapshots: `app/tests/visual/messaging.visual.spec.ts-snapshots/`

## 6. Acceptance criteria result

| Criterion | Result |
| --- | --- |
| List/detail without full app-state dependency | **met** |
| Per-actor unread isolation (dietitian/assistant) | **met** |
| Yellow draft → reviewed manual provenance | **met** |
| Red manual reply does not close lock | **met** |
| Atomic activation remains sole red closure | **met** |
| Scale, visual, hygiene, concurrency/idempotency evidence | **met** (RLS re-run pending) |
| Stage 4C authorized as next | **met** |

## 7. Open risks (unchanged)

- **Production pilot:** `NO-GO` — no launch gate closed by this closure.
- **R-405:** open — Next.js nested PostCSS moderate findings documented; no dependency change.
- **R-406:** open — current local Supabase/RLS re-run blocked; 35 tests skipped on 2026-07-12; not counted as pass.
- **R-438–R-441:** mitigated locally in implementation and offline verification; full RLS pass remains environment-blocked.
- **Real integration paths:** WhatsApp, Telegram, Gemini, live billing, monitoring, backup, secret-manager, and health-data paths remain closed.

## 8. Remaining closure action

When Docker Desktop/local Supabase is available:

```powershell
cd app
npx supabase db reset --local
npm run test:rls
```

A passing role matrix is required before describing Stage 4B-2 persistence/RLS evidence as fully green. Until then, this closure records verified local implementation with an explicit environment-blocked RLS condition.

## 9. Next stage

This closure is historical implementation evidence and is superseded for execution ordering by `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_ACTION_PLAN.md`. Stage 4C remains blocked until remediation R0-R6 verification is green and the separate R7 evidence closure is committed. Do not weaken Stage 4B-2 messaging, Stage 4B alert/notification, or P85-IF contracts.

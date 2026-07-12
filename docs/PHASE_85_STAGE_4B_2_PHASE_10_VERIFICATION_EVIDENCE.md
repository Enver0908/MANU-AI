# Phase 85 Stage 4B-2 Phase 10 — Security, Scale, Visual and Release Verification Evidence

Date: 2026-07-12  
Branch: `codex/phase-85-interstage-clinical-memory`  
Scope: Stage 4B-2 Faz 10 (Güvenlik, Ölçek, Görsel ve Release Doğrulaması)

## Goal

Independently prove Stage 4B-2 messaging meets bounded list/detail contracts, hygiene scans, responsive visual smoke, channel replay compatibility, production-scale bounds, and release verification — without opening real providers or production pilot.

## Implemented changes

### Verification module (`app/src/lib/phase-85-stage-4b2-verification.ts`)

- `STAGE_4B2_SCALE_TARGETS`: 10k conversations; list 30/100; detail 50/100 page limits
- DTO allowlists + `assertConversationInboxItemDtoSafety` / `assertConversationMessageDtoSafety`
- `evaluateStage4B2BoundedMessagingEvidence` (sample + optional full 10k via `STAGE_4B2_FULL_SCALE=1`)
- `evaluateStage4B2WorkspaceHygieneEvidence` (forbidden future-phase name scan, live Stripe key, embedded service role)
- Integration with Stage 4B channel checks and messaging integration evidence

### Tests and rehearsal

- `phase-85-stage-4b2-verification.test.ts` — sample rehearsal passes; full 10k gated
- `scripts/rehearse-stage-4b2-verification.mjs` — npm script `rehearse:stage-4b2:verification`

### Visual smoke

- `tests/visual/messaging.visual.spec.ts` — list, detail, yellow draft, red manual, assistant read-only across desktop / tablet / mobile-android / mobile-ios
- `tests/visual/messaging-visual-helpers.ts` — shared bootstrap, list/detail navigation, composer focus helpers
- `tests/visual/dashboard.visual.spec.ts` — updated for Mesajlaşma bounded detail flow (row/URL navigation, composer scoping)

### Runtime fix (Faz 10 blocker)

- `dashboard-app.tsx`: memoized `messagingListFilters` passed to `useStage4B2Messaging` — fixes detail fetch abort loop caused by unstable inline `filters` object recreating `refreshAll` every render
- `use-stage-4b2-messaging.ts`: `fetchListPage` depends on primitive filter fields

## Verification commands

```powershell
cd dietitian-ai-assistant
npm test

cd ..\app
npm test
npm run test:rls
npm run rehearse:stage-4b2:verification
npm run rehearse:channel:replay
npm run rehearse:production-scale:79g
npm run lint
npm run build
npm run test:visual
npm run release:verify
git diff --check
```

Optional full 10k messaging scale:

```powershell
$env:STAGE_4B2_FULL_SCALE="1"
npm run rehearse:stage-4b2:verification
```

## Results (2026-07-12)

| Check | Result |
| --- | --- |
| Core package tests | **234 passed** |
| App unit tests | **953 passed**, 6 skipped (959 total) |
| `rehearse:stage-4b2:verification` | **pass** (4 passed, 1 skipped sample; 38 targeted messaging tests passed) |
| `npm run test:rls` | **35 skipped** — local Supabase/Docker not available; **not counted as pass** |
| `rehearse:channel:replay` | **pass** (4 passed, 131 skipped gated cases) |
| `rehearse:production-scale:79g` | **pass** (expanded AI 5000 cases, channel replay, Phase 79 scale 7/7) |
| Lint | **pass** (0 errors, 4 pre-existing warnings) |
| Build | **pass** |
| `npm run test:visual` | **40 passed** (4 projects × messaging + dashboard + commercial) |
| `npm run release:verify` | **pass** (R-405 documented moderate audit findings remain) |
| `git diff --check` | **pass** (no conflict markers; CRLF line-ending notices only) |
| Workspace hygiene scan | **historical scoped pass** (no forbidden future-phase leaks, live Stripe keys, or embedded service role in scanned paths) |
| Bounded messaging sample | list default **30**, max **100**; detail default **50**, max **100** on 10k fixture sample |

## Visual coverage (Stage 4B-2)

| Viewport | List | Detail | Yellow draft | Red manual | Read-only |
| --- | --- | --- | --- | --- | --- |
| desktop (1440×900) | yes | yes | yes | yes | yes |
| tablet (768×1024) | yes | yes | yes | yes | yes |
| mobile-android (390×844) | yes | yes | yes | yes | yes |
| mobile-ios (390×844) | yes | yes | yes | yes | yes |

Snapshots: `app/tests/visual/messaging.visual.spec.ts-snapshots/`

## Open items (unchanged)

- Production pilot: **NO-GO**
- R-405: documented dependency audit blocker (Next.js/PostCSS moderate)
- RLS integration: requires local Supabase for real pass; skipped in this environment
- Full 10k scale rehearsal: available with `STAGE_4B2_FULL_SCALE=1` (not run in default CI path)

## Stage 4C gate

Faz 10 records historical offline verification with an environment-blocked RLS run. It does not satisfy the current remediation release gate. **Stage 4C remains blocked** until `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_ACTION_PLAN.md` phases R1-R6 close and the separate R7 evidence closure is committed.

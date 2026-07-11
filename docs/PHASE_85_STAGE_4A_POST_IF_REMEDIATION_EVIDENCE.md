# Phase 85 Stage 4A Post-P85-IF Remediation Evidence

Date: 2026-07-11

Track id: `P85-4A-POST-IF-R`

Status: implemented locally; final verification recorded in this document.

## Purpose

Stage 4A was implemented before P85-IF and before the R1-R6 post-closure remediation changed several architectural contracts. This remediation aligns the completed Stage 4A dashboard with the newer P85-IF baseline before Stage 4B Uyari ve Bildirimler begins.

## Findings Closed

1. Stage 4A AI Asistan Kontrolu attempted `aiStatus: active` through the general client PATCH path. P85-IF-R3 correctly rejects direct active patching. The panel now routes active-state requests through `/api/clients/[id]/activate-ai` with expected conversation and client context revisions.
2. Stage 4A human takeover release could be represented as `humanTakeoverLocked: false` through general patching. The panel now releases through `/api/clients/[id]/release-takeover`, preserving human-control session lifecycle closure.
3. Stage 4A did not expose active human-control session evidence. The AI control panel now displays the latest active session reason and opened time, and marks client/session mismatch as control-required.
4. P85-IF-G structured context-intake flags were shown as raw tab ids in the copilot panel. The UI now presents readable panel labels and navigates through an allowlisted client-tab target.
5. P85-IF-E structured-update notification resolution existed in API/store contracts, but the dashboard notification menu exposed only read/acknowledge. The dashboard now exposes minimal target-panel navigation and `/api/notifications/[id]/resolve-structured-update` for unresolved P85-IF-E structured notifications.

## Code Evidence

- `app/src/components/dashboard/ai-assistant-control-panel.tsx`
- `app/src/components/dashboard/clients-panel.tsx`
- `app/src/components/dashboard-app.tsx`
- `app/src/components/dashboard/copilot-panel.tsx`
- `app/src/lib/use-manu-state.ts`
- `app/src/lib/phase-85-if-g-context-intake.ts`
- `app/src/lib/phase-85-stage-4a-post-if-remediation.ts`
- `app/src/lib/phase-85-stage-4a-post-if-remediation.test.ts`

## Scope Boundaries

- No migration was added.
- No P85-IF scope was reopened.
- No full Stage 4B notification center, grouping, filtering, priority model, or mobile notification redesign was implemented.
- No real WhatsApp, Telegram, Gemini/provider, live billing, monitoring, backup, secret manager, or real health-data path was enabled.
- Production pilot remains `NO-GO`.
- R-405 remains open.

## Verification

- Targeted Vitest: `npm exec vitest run src/lib/phase-85-stage-4a-post-if-remediation.test.ts src/lib/ai-assistant-control-panel-helpers.test.ts src/lib/phase-85-if-e-historical-retrieval.test.ts src/lib/phase-85-if-g-context-intake.test.ts -- --no-file-parallelism --maxWorkers=1` -> 4 files, 25/25 passed.
- Lint: `npm run lint` -> passed with 0 errors and 2 pre-existing warnings.
- Full app Vitest: `npm test` from `app` -> 132 files, 831 passed / 4 skipped.
- Core tests: `npm test` from `dietitian-ai-assistant` -> 234/234 passed.
- Production build: `npm run build` from `app` -> passed.
- Visual smoke: `npm run test:visual` from `app` -> build passed and Playwright 36/36 passed.
- `git diff --check` -> clean, with repository CRLF conversion warnings only.
- Forbidden future-phase naming scan: no forbidden future-phase name matches.
- Secret/token scan: no high-signal secret token matches.
- RLS and channel replay were not re-run for this track because no migration, RLS policy, webhook/channel engine, or provider/channel behavior changed. The latest local P85 post-closure RLS baseline remains 30/30 passed from `docs/PHASE_85_IF_REMEDIATION_POST_CLOSURE_AUDIT_EVIDENCE.md`.

## Next Step

Proceed to Phase 85 Stage 4B Uyari ve Bildirimler on top of this compatibility baseline.

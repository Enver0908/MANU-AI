# Phase 57 Yellow Risk Hold Draft Refresh Spec

Date: 2026-06-03

## Goal

Implement the revised yellow-risk conversation contract in the local MANU-AI prototype:

- A yellow-risk inbound message passivates AI and creates one dietitian approval draft.
- While the yellow hold is active, later green or yellow inbound messages refresh the same approval draft instead of creating a visible reply gap.
- A later red-risk inbound message does not refresh the yellow draft. It creates the red manual lock, preserves the pending yellow draft, and prevents AI reactivation until the dietitian resolves the red handoff.

## Implemented Scope

- Added `ClientRecord.yellowRiskHold` with active hold metadata:
  - first and latest message ids,
  - active draft and active AI decision ids,
  - accumulated message ids and reasons,
  - previous AI status/mode for automatic reactivation after approval,
  - optional red handoff blocker id.
- Added Supabase `clients.yellow_risk_hold` migration and RPC client update support.
- Changed local inbound simulation so first yellow risk sets `aiStatus=passive` and `aiMode=paused`.
- Changed local inbound simulation so green/yellow messages during an active yellow hold refresh the same draft message and supersede the previous AI decision with `yellow_hold_draft_superseded`.
- Preserved the active yellow draft when a later red-risk message arrives.
- Kept red-risk behavior stronger than yellow:
  - red creates `redRiskLock`,
  - AI remains passive/manual,
  - yellow draft approval can send the held draft but cannot reactivate AI while the red lock is active.
- Added dashboard status visibility for active yellow holds.

## Product Contract

Yellow hold:

1. Client sends a yellow-risk message.
2. AI generates an approval draft only.
3. Client AI becomes passive/paused.
4. Dietitian approval or edit-and-send sends the draft and restores the previous AI status/mode if no red lock is active.

Yellow hold refresh:

1. Client sends more green/yellow messages while the first yellow draft is pending.
2. AI does not answer the client.
3. The existing pending draft is refreshed to cover context through the latest message.
4. Older draft decisions are marked superseded for audit.

Yellow followed by red:

1. Client sends a red-risk message while a yellow draft is pending.
2. The yellow draft remains pending and is not refreshed by the red message.
3. Red handoff and red risk lock are created.
4. If the dietitian approves the old yellow draft, AI still remains passive/manual because red lock reactivation requires explicit red handoff resolution.

Long single message:

- Yellow plus green content is classified as yellow, creates a draft, and activates the yellow hold.
- Red plus yellow/green content is classified as red, creates no AI draft for that message, and creates the red manual lock.

## Non-Goals

- No real WhatsApp, Telegram, Gemini/external LLM, monitoring, secret manager, backup provider, or real health data was connected.
- No production pilot launch gate was closed.
- No R-405 dependency remediation was attempted.
- No external clinical approval artifact was supplied or accepted.

## Verification

Local verification completed on 2026-06-03:

- `npx vitest run src/lib/simulator.test.ts` from `app`: 34/34 passed.
- `npm test` from `app`: 18 files and 135/135 tests passed.
- `npm test` from `dietitian-ai-assistant`: 75/75 passed.

- `npm run lint` from `app`: passed.
- `npm run release:verify` from `app`: core tests 75/75, app tests 135/135, lint, production build, and only documented R-405 findings.

Local Supabase/RLS evidence status:

- `npx supabase db reset --local` could not apply the Phase 57 migration because Docker Desktop Linux engine was not available (`dockerDesktopLinuxEngine` pipe missing).
- `npm run test:rls` from `app` completed with 1 file and 20/20 tests skipped because local Supabase was unavailable.
- RLS/migration evidence for `yellow_risk_hold` remains open until Docker Desktop/local Supabase is available and the migration plus RLS suite produce real passing results.

## Production Pilot Status

Production pilot remains `NO-GO`.

This phase improves local clinical workflow behavior, but it does not replace qualified dietitian clinical taxonomy approval, production clinical safety evaluation approval, provider/vendor review, legal/privacy approval, or the R-405 dependency procedure.

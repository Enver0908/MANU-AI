# Phase 58 Dietitian Client Language Control Spec

Date: 2026-06-03

## Goal

Make the existing client conversation language field fully operational for dietitian control.

The dietitian must be able to change a client's AI conversation language from the MANU-AI client profile, and subsequent AI replies must use that selected language while clinical safety routing remains unchanged.

## Implemented Scope

- The client profile already exposes `communicationLanguage` through the dashboard language selector.
- Client creation now keeps `communicationLanguage` and `healthProfile.preferredLanguage` synchronized.
- Client profile updates through the app/API patch path normalize and synchronize `communicationLanguage` and `healthProfile.preferredLanguage`.
- Conversation language is treated as prompt-affecting state, so changing it increments `contextRevision` and invalidates stale pending drafts through the existing draft safety path.
- Prompt context already includes a `conversation_language` segment, and the local mock provider uses that segment for localized deterministic replies.
- Added tests proving:
  - newly created clients keep the selected language in both fields,
  - dietitian language changes update the client and context revision,
  - subsequent AI replies use the dietitian-selected language.

## Non-Goals

- No automatic language detection was added.
- No real WhatsApp, Telegram, Gemini/external LLM, monitoring, secret manager, backup provider, or real health data was connected.
- No production launch gate was closed.

## Verification

- `npx vitest run src/lib/app-state-store.test.ts src/lib/simulator.test.ts` from `app`: 2 files and 54/54 tests passed.
- `npm test` from `app`: 18 files and 137/137 tests passed.
- `npm run lint` from `app`: passed.
- `npm run release:verify` from `app`: core tests 75/75, app tests 137/137, lint, production build, and only documented R-405 findings.

The first `npm run release:verify` attempt reached the production build step and failed on a Windows/OneDrive `EPERM` unlink error in the stale `.next` build cache. The workspace-local `.next` cache was removed and the second release verification passed.

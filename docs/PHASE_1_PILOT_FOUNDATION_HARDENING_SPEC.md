# MANU-AI Phase 1 Pilot Foundation Hardening Spec

## Goal

Reduce brittleness in the local pilot foundation before adding onboarding, consent, notification records, channel adapters, or AI provider abstractions.

## Scope

- Expand visual smoke coverage for draft approval, red handoff, safety-checklist blocking, and mobile-safe long text rendering.
- Add tests for forced fallback mode and duplicate risk assessment behavior.
- Return controlled JSON API errors for known simulator, manual reply, draft, handoff, and takeover failures.
- Record the dependency audit decision without applying breaking `npm audit fix --force`.

## Success Criteria

- Core tests pass.
- App lint passes.
- App unit tests pass.
- Build passes.
- Visual smoke tests pass.
- RLS tests still fail closed for non-local Supabase unless explicitly overridden.
- No real WhatsApp, Telegram, Gemini, or real client health data is connected.

## Implementation Status - 2026-05-25

Completed:

- Visual smoke coverage now exercises dashboard navigation, draft approval controls, manual reply long-text rendering, red handoff creation, safety-checklist blocking, and handoff queue visibility across desktop, tablet, and mobile Chromium viewports.
- Forced fallback mode is covered by app tests and uses fallback store selection even when Supabase env vars exist.
- Duplicate simulator idempotency coverage includes risk assessment non-duplication.
- Known simulator, manual reply, draft, handoff, and takeover failures return controlled JSON API errors.
- The dependency audit decision is documented; `npm audit fix --force` remains blocked because the suggested downgrade path is breaking.

Verified:

- `dietitian-ai-assistant`: `npm test`
- `app`: `npm run lint`
- `app`: `npm test`
- `app`: `npm run test:rls` skips safely unless local Supabase or explicit remote override is configured.
- `app`: `npm run build`
- `app`: `npm run test:visual`

## Edge Cases

- Unknown simulator client returns `404 client_not_found`.
- Missing conversation returns `404 conversation_not_found`.
- Non-draft draft actions return `400 message_not_ai_draft`.
- Missing handoff/takeover targets return controlled errors.
- Forced fallback mode ignores Supabase env vars at config and store-selection level.

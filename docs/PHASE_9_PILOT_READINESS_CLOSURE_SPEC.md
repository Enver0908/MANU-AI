# MANU-AI Phase 9 Pilot Readiness Closure Spec

## Goal

Close the next pilot-readiness gaps without connecting real WhatsApp, Telegram, Gemini, push/email providers, or real client health data.

## Scope

- Establish a local Git checkpoint strategy.
- Align classifier version metadata with `dietetic-risk-v0.2.0`.
- Persist notification records in Supabase instead of returning `not_implemented` for read and acknowledge actions.
- Keep notification text safe and free of raw client health-message content.
- Keep launch gates open for qualified dietitian review, legal/privacy review, provider/vendor review, and real-channel policy review.

## Non-Goals

- No real channel webhook endpoints.
- No real outbound WhatsApp, Telegram, email, or push delivery.
- No real Gemini or external LLM provider calls.
- No final retention durations or production DSAR operating process.
- No client-facing legal copy.

## Edge Cases

- Existing demo seed data should report the current classifier version after reset.
- Duplicate risk assessment persistence must remain idempotent.
- Notification read and acknowledge actions must be tenant-scoped.
- Missing notification IDs should return controlled errors.
- Client export must include only notifications related to that client's handoffs.
- Client anonymization must minimize notification text tied to that client.
- Fallback notification behavior must remain unchanged.

## Verification

- Core tests pass.
- App lint passes.
- App unit/API tests pass.
- Build passes.
- Visual smoke tests pass across desktop, tablet, and mobile.
- RLS tests run against local Supabase when available, or skip safely when local Supabase is unavailable.

## Verification Result - 2026-05-25

- `dietitian-ai-assistant`: `npm test` passed with 35/35 tests.
- `app`: `npm run lint` passed.
- `app`: `npm test` passed with 51/51 tests.
- `app`: `npm run test:rls` skipped 5 tests as expected without local Supabase.
- `app`: `npm run build` passed.
- `app`: `npm run test:visual` passed across desktop, tablet, and mobile.
- `app`: `npm audit --omit=dev` still reports R-405; `npm audit fix --force` remains blocked because it proposes a breaking Next.js downgrade.

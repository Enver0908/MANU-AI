# MANU-AI Pilot Foundation Hardening Spec

## Goal

Close the first pilot-foundation gaps before adding real WhatsApp, Telegram, or LLM provider integrations.

## Scope

- Restore tenant-scoped RLS policies for activation events, conversation memories, and risk assessments.
- Preserve the correct channel when simulator idempotency keys are persisted.
- Audit client AI control changes in Supabase-backed mode.
- Keep fallback mode behavior simple and unchanged unless a test requires otherwise.

## Success Criteria

- RLS integration tests cover client records plus activation events, memories, and risk assessments.
- Simulator persistence stores Telegram simulation idempotency keys with `channel = 'telegram'`.
- Supabase client updates write `client_ai_status_events` when AI status, mode, or activation windows change.
- Supabase client updates write an audit event when AI control fields change.
- Existing lint, unit tests, RLS tests, core tests, and production build pass.

## Edge Cases

- No status event is written when a client patch changes only profile or safety checklist data.
- A missing simulation client still fails before persistence.
- Duplicate simulator keys remain idempotent and do not insert extra records.
- RLS policies must be added through a new migration so existing local databases can apply the fix.

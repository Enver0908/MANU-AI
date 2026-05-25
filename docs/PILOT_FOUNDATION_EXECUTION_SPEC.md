# MANU-AI Pilot Foundation Execution Spec

## Goal

Complete the next pilot-foundation slice without connecting real WhatsApp, Telegram, Gemini, or real client health data.

## Success Criteria

- Every non-duplicate inbound simulator message creates exactly one risk assessment record.
- Duplicate simulator idempotency keys do not create extra messages, AI decisions, handoffs, risk assessments, audit events, or processed events.
- Preflight-blocked simulator messages still persist inbound message, AI decision, system/audit state, and risk assessment metadata.
- Supabase RLS integration tests fail closed unless they target local Supabase or explicitly opt into remote execution.
- Dev fallback mode can be forced with `MANU_DEV_FALLBACK_STORE=true`.
- Existing core tests, app tests, lint, RLS tests, build, and visual smoke checks pass.

## Implementation Notes

- Keep risk assessment persistence local to the existing simulator/store flow.
- Use the existing core classifier version and risk reasons; do not invent a second classifier.
- Keep real channel/provider integrations out of scope.
- Keep new files minimal and update the project handoff docs after implementation.

## Edge Cases

- Empty simulator body remains a no-op.
- Unknown client still errors before persistence.
- Duplicate idempotency key returns `duplicate_ignored` and skips persistence.
- Passive, scheduled inactive, human takeover, channel blocked, and incomplete autopilot safety profiles still avoid AI generation.
- Red risk still creates a handoff and no AI-generated message.

# MANU-AI Supabase Foundation Spec

## Goal

Move the local dashboard from browser-only demo state to a Supabase-backed SaaS foundation while keeping WhatsApp, Telegram, real LLMs, and real health data disconnected.

## Success Criteria

- Dashboard data is loaded through API routes, not directly from localStorage.
- When Supabase env vars are configured, clients, conversations, messages, AI decisions, handoff cases, and audit events persist in Supabase.
- When env vars are missing, the app remains usable in local demo fallback mode.
- Demo auth can create or reuse a local Supabase user and tenant bootstrap when service-role credentials exist.
- Simulator persists inbound, generated/draft/system messages, AI decisions, handoffs, audit events, and idempotency keys.
- Duplicate simulator keys do not create duplicate AI actions.
- Tenant access is enforced by Supabase RLS policies based on `tenant_memberships.user_id = auth.uid()`.

## Edge Cases

- Missing Supabase env vars: API returns seeded demo state and no production-like persistence.
- Duplicate idempotency key: return `duplicate_ignored` without inserting messages or decisions.
- Client not found or conversation missing: return a typed API error and do not call the core orchestrator.
- Channel permission blocked, human takeover locked, or autopilot safety fields incomplete: store inbound/system/decision records, but do not generate an AI reply.
- Red risk: create handoff/system records, no model call.
- Passive or scheduled-inactive client: create no AI-generated message.
- Manual reply with empty body: reject with validation error.
- Handoff resolve/dismiss for non-open case: keep operation idempotent and return current case state.

## Non-Goals

- No production WhatsApp or Telegram credentials.
- No real Gemini/API provider calls.
- No real client health data.
- No fine-tuning or dataset export.

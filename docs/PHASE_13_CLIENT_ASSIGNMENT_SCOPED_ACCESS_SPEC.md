# MANU-AI Phase 13 Client Assignment And Scoped Access Spec

## Goal

Add client assignment foundations and service-layer scoped access so production Supabase reads do not expose all tenant clients to every role.

## Scope

- Add a `client_assignments` table for explicit client-to-dietitian/profile access.
- Filter Supabase-loaded app state by role and assignment.
- Keep owner/admin able to see all tenant data.
- Keep dietitian able to see owned clients plus assigned clients.
- Keep assistant able to see assigned clients only.
- Keep auditor from receiving raw client/message state until a minimized auditor view exists.

## Non-Goals

- No team-management UI.
- No invitation flow.
- No assistant assignment UI.
- No minimized auditor dashboard yet.
- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data.

## Access Rules

- `owner`, `admin`: all tenant clients and related records.
- `dietitian`: clients where `clients.dietitian_id = context.dietitianId`, plus assigned clients.
- `assistant`: assigned clients only.
- `auditor`: no raw clients, messages, handoffs, notifications, risk assessments, or AI decisions in app-state.

## Edge Cases

- Assignment to another tenant's client or dietitian must be blocked by foreign keys and RLS.
- Unassigned assistant gets an empty app state rather than tenant-wide data.
- Auditor app state must not include raw message bodies.
- Notifications tied to hidden handoffs must be hidden.
- Audit events tied to hidden clients/conversations/messages/decisions/handoffs must be hidden.
- Fallback demo mode remains unchanged.

## Verification

- Unit tests cover owner/admin, dietitian, assistant, and auditor scoping.
- RLS integration covers `client_assignments` tenant isolation.
- Existing app tests, lint, and production build pass.

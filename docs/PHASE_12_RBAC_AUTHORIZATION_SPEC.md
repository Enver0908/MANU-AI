# MANU-AI Phase 12 RBAC Authorization Spec

## Goal

Add fail-closed role-based authorization to production Supabase API paths before assistant/auditor access is expanded.

## Scope

- Add a typed tenant role to app auth context.
- Add a small capability helper for production API routes.
- Keep owner/admin/dietitian able to perform existing clinical workflow actions.
- Keep assistant/auditor restricted to read-only app-state access until client assignments and minimized auditor views exist.
- Preserve fallback local demo mode.

## Non-Goals

- No client assignment model yet.
- No auditor-specific minimized dashboard yet.
- No billing, team management, or invitation UI.
- No real WhatsApp, Telegram, Gemini, push/email provider, or real client health data.

## Authorization Rules

- `owner`, `admin`, `dietitian`: current authenticated Supabase behavior remains available.
- `assistant`, `auditor`: only `read_app_state` is allowed in this phase.
- Unknown roles or missing roles are forbidden.
- Fallback mode remains unchanged because it is local demo state, not production Supabase access.

## Edge Cases

- Assistant/auditor attempts to create/update/export/anonymize clients must return a controlled 403.
- Assistant/auditor attempts to simulate inbound messages, approve drafts, resolve handoffs, acknowledge notifications, or release takeover must return a controlled 403.
- `resolveAppTenantContext()` must keep returning no-membership and no-dietitian-profile errors exactly as before.
- Existing Supabase tenant isolation remains the data boundary; this phase only adds role capability checks.

## Verification

- Unit tests cover capability allow/deny behavior.
- Existing app tests pass.
- App lint and production build pass.

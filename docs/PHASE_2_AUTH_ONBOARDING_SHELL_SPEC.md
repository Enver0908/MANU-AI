# MANU-AI Phase 2: Production-Style Auth And Onboarding Shell Spec

## Goal

Separate local demo auth from production-style tenant/dietitian onboarding behavior. Add controlled error/empty states for unauthenticated, missing membership, and missing dietitian profile scenarios. Keep demo sign-in and fallback mode working.

## Current State Analysis

- `proxy.ts` exports a `proxy()` function and `config` matcher, but no `middleware.ts` file exists. Dashboard route is unprotected at the middleware level.
- `auth-context.ts` has 3 error states in `resolveAppTenantContext()`: `unauthenticated` (401), `no_tenant_membership` (403), `no_dietitian_profile` (403). These only guard API routes.
- `dashboard/page.tsx` has zero server-side auth checks — it renders `DashboardApp` directly.
- `use-manu-state.ts` fetches `/api/app-state` on mount; on error it silently falls back to seed state without telling the user what happened.
- Fallback mode has no auth at all — API routes skip auth when `isSupabaseStoreConfigured()` is false.

## Scope

### In Scope

1. Create `middleware.ts` that actually uses the proxy logic for `/dashboard` routes.
2. Add a server-side auth gate to `dashboard/page.tsx` that resolves auth state and renders appropriate UI.
3. Add new API endpoint `/api/auth-state` that returns the user's auth/membership/profile state without loading full app state.
4. Update `use-manu-state.ts` to handle 401/403 responses by redirecting or showing controlled error state.
5. Add UI states for: unauthenticated redirect, no-membership forbidden, missing-dietitian-profile onboarding prompt.
6. Show role/membership indicator in dashboard header.
7. Preserve demo sign-in path for local testing.
8. Preserve fallback local mode.

### Out Of Scope

- Real OAuth/SSO providers.
- Production signup/registration flow.
- Multi-tenant switching UI.
- Real WhatsApp, Telegram, Gemini, or real health data.
- Complete RBAC access controls for assistant/auditor roles.

## Implementation Plan

### 1. `app/src/proxy.ts` already acts as middleware [CONFIRMED]

In Next.js 16, `proxy.ts` IS the native middleware file. No separate `middleware.ts` is needed — Next.js 16 errors if both exist. The existing `proxy.ts` with its `config.matcher` for `/dashboard/:path*` is already active.

### 2. Add `/api/auth-state` endpoint [NEW]

`app/src/app/api/auth-state/route.ts`

Returns JSON describing the user's current auth state:

```json
{ "status": "authenticated", "tenantId": "...", "dietitianId": "...", "role": "owner", "displayName": "..." }
{ "status": "no_membership" }
{ "status": "no_dietitian_profile", "tenantId": "..." }
{ "status": "unauthenticated" }
{ "status": "fallback_demo" }
```

### 3. Modify dashboard page [MODIFY]

`app/src/app/dashboard/page.tsx`

Add server-side auth state resolution. When Supabase is configured:
- Authenticated with full membership → render `DashboardApp`.
- No membership → render `NoMembershipState` component.
- No dietitian profile → render `NoDietitianProfileState` component.
- Unauthenticated → redirect to `/` (handled by middleware, but double-guard here).

When fallback mode → render `DashboardApp` as before.

### 4. Add auth state components [NEW]

`app/src/components/auth-states.tsx`

- `NoMembershipState`: card explaining user has no workspace membership, with sign-out button.
- `NoDietitianProfileState`: card explaining dietitian profile is missing, with sign-out button.
- `MembershipBadge`: small indicator showing role and tenant in dashboard header.

### 5. Update `use-manu-state.ts` [MODIFY]

Handle 401/403 from `/api/app-state`:
- 401 → set `authError = "unauthenticated"` instead of silently falling back.
- 403 → set `authError` with the specific error code.
- Expose `authError` to consuming components.

### 6. Update `DashboardApp` [MODIFY]

- Show `MembershipBadge` in the header when auth state is available.
- Handle `authError` from `useManuState` with appropriate UI.

## Success Criteria

- Authenticated tenant member can reach the dashboard.
- User without membership sees a controlled forbidden state.
- User with membership but no dietitian profile sees a controlled onboarding/error state.
- Fallback local mode still works.
- Demo auth still works.
- Middleware actually protects `/dashboard` routes.
- Existing Phase 1 tests pass.
- Demo and production auth behavior are documented.

## Edge Cases

- Fallback mode skips all auth gates; dashboard renders with seed data as before.
- `MANU_DEV_FALLBACK_STORE=true` forces fallback even when Supabase env vars exist.
- Expired Supabase session → middleware redirects to `/`.
- Demo sign-in always creates membership → should never hit no-membership state in demo flow.
- Auth state endpoint must not expose sensitive data.

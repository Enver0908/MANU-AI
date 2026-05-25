# MANU-AI Phase 3: Consent, Permission, And Channel Governance Spec

## Goal

Prepare safe channel permission enforcement before real WhatsApp or Telegram adapters. Ensure permission-blocked and pending clients cannot trigger AI generation, permission changes are audited, and unknown or ambiguous identities cannot reach the orchestrator.

## Current State Analysis

- `PermissionState = "ready" | "pending" | "blocked"` in `types.ts`.
- `getPreflightBlock()` in `simulator.ts` (line 483) blocks AI for `channelPermission === "blocked"` only.
- `channelPermission === "pending"` does NOT block AI generation — this is a safety gap.
- Permission changes via `updateClientInState()` are NOT audited.
- No opt-out state exists. No `opted_out` or `revoked` permission values.
- No identity quarantine — clients with empty `channelUserId` or `adultStatus === "unknown"` can reach the orchestrator.
- Seed data: Deniz Arslan has `channelPermission: "pending"` and `adultStatus: "unknown"`.
- New clients created via `createBlankClient()` start with `channelPermission: "pending"` and `adultStatus: "unknown"`.

## Scope

### In Scope

1. Extend `PermissionState` type with `opted_out` value.
2. Block AI generation for `pending` and `opted_out` permission states (only `ready` allows AI).
3. Add identity quarantine: block AI for clients with empty `channelUserId`.
4. Add identity quarantine: block AI for clients with `adultStatus === "unknown"`.
5. Audit permission changes: emit audit event when `channelPermission` changes.
6. Audit opt-out events separately.
7. Add tests for all new blocking paths.
8. Update the dashboard UI permission control to include the new `opted_out` option.

### Out Of Scope

- Client-facing consent/legal copy or KVKK/GDPR text.
- Real channel opt-in/opt-out webhook handling.
- Real WhatsApp/Telegram adapter integration.
- RBAC-based permission management.

## Implementation Plan

### 1. Extend `PermissionState` type [MODIFY]

`app/src/lib/types.ts`

Add `opted_out` to `PermissionState` union.

### 2. Strengthen `getPreflightBlock()` [MODIFY]

`app/src/lib/simulator.ts`

- Block AI for `channelPermission !== "ready"` (covers pending, blocked, opted_out).
- Add identity quarantine block for empty `channelUserId`.
- Add identity quarantine block for `adultStatus === "unknown"`.

### 3. Add permission change auditing [MODIFY]

`app/src/lib/simulator.ts`

- Add `updateClientWithAudit()` function that detects permission field changes and emits audit events.
- Export it for use by both fallback store and Supabase store.

### 4. Update fallback store [MODIFY]

`app/src/lib/app-state-store.ts`

- Use `updateClientWithAudit()` for permission changes.

### 5. Update dashboard UI [MODIFY]

`app/src/components/dashboard-app.tsx`

- Add `opted_out` option to permission select control.

### 6. Add tests [NEW/MODIFY]

`app/src/lib/simulator.test.ts`

- Test: pending permission blocks AI.
- Test: opted_out permission blocks AI.
- Test: empty channelUserId blocks AI (identity quarantine).
- Test: unknown adultStatus blocks AI (identity quarantine).
- Test: permission change creates audit event.

## Success Criteria

- Permission-blocked clients cannot trigger AI generation (already true).
- Permission-pending clients cannot trigger AI generation (NEW).
- Permission-opted-out clients cannot trigger AI generation (NEW).
- Permission changes are audited (NEW).
- Unknown or ambiguous identities (empty channelUserId, unknown adultStatus) cannot reach the orchestrator (NEW).
- Real WhatsApp and Telegram credentials remain disconnected.
- All existing tests continue to pass.

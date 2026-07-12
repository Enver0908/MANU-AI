# Phase 85 Stage 4B - Uyari ve Bildirimler Runtime Specification

Date: 2026-07-12
Status: implemented; conditional closure pending current RLS re-run
Canonical plan: `docs/PHASE_85_STAGE_4B_UYARI_VE_BILDIRIMLER_ACTION_PLAN.md`
Implementation evidence: `docs/PHASE_85_STAGE_4B_POST_CLOSURE_REMEDIATION_EVIDENCE.md`

## 1. Boundary

Stage 4B owns two separate dashboard views:

- **Uyarilar:** active clinical-operational projections from `yellowRiskHold` and `redRiskLock`.
- **Bildirimler:** structured system events with actor-scoped receipt state.

Stage 4B does not add an `alerts` table, does not expose raw message or health content, and does not implement the conversation inbox. Stage 4B-2 owns the conversation list/detail and the final messaging workflow; it is complete as of 2026-07-12. Stage 4C is next.

## 2. Alert contract

- Yellow source is `client.yellowRiskHold.status === "active"`.
- Red source is `client.redRiskLock.status === "locked"`.
- Red suppresses yellow for the same client.
- The list DTO contains safe ids, client display name, severity, mapped reason label, SLA presentation, and an allowlisted navigation target.
- Raw message bodies, health values, free-text clinical reasons, provider payloads, and trust/quarantine evidence are excluded.
- Clicking an alert opens the current conversation target and does not resolve the risk state.
- Red closure remains the existing expected-revision atomic AI activation transition.

## 3. Notification contract

Notifications use typed kinds, deterministic priority/category mapping, dedupe keys, occurrence counts, and separate lifecycle dimensions:

- actor receipt: `read`, `acknowledged`;
- domain state: `resolved`;
- history projection: resolved events and read informational events.

Clinical handoff events remain outside the system notification surface. Draft invalidation is emitted only for a client-specific supersession or non-manual domain reason; manual human handling reconciles the matching event. Unsupported-media completion is type-specific and requires the actor receipt to be read and acknowledged.

## 4. Persistence and Supabase path

The original Stage 4B migration remains unchanged and append-only. The remediation migration `20260712120000_phase_85_stage_4b_postclosure_remediation.sql` adds:

- actor-aware, tenant-composite v2 list/count/receipt RPCs;
- linked-client/conversation/message fail-closed projection checks;
- bounded keyset cursors with page-size caps;
- atomic unsupported-media review completion with read+ack precondition;
- dietitian form schema/response persistence used by the Supabase SLA reader.

The server-side Supabase store uses the actor-aware RPCs for Stage 4B resources and no longer loads the complete application state for alert or notification list reads. Service-role calls still validate the supplied tenant user, dietitian, and role against tenant membership before the RPC returns data or mutates a receipt.

## 5. Access contract

| Role | Alert/notification visibility | Receipt mutation |
| --- | --- | --- |
| owner/admin | tenant-wide, including tenant-operational events | allowed for own actor receipt |
| dietitian | primary and assigned clients | allowed for own actor receipt |
| assistant | assigned clients only | denied |
| auditor | empty | denied |
| cross-tenant/unassigned | empty or not found | denied |

The same rules are enforced in fallback code, API routes, actor-aware RPCs, and the targeted RLS integration matrix.

## 6. API and UI contract

- `GET /api/alerts` and `GET /api/notifications` are bounded, cursor-based resources with server-side filters.
- Notification receipt mutations are actor-scoped; read-all only marks unread receipts read.
- Generic resolve, bulk acknowledge, and bulk resolve are not exposed.
- URL state is used for dashboard navigation and filters.
- Uyarilar and Bildirimler have separate panels, sticky filters, keyboard focus states, 44px controls, safe empty/error states, and no horizontal overflow.

## 7. Verification boundary

The local code, fallback behavior, mock channel behavior, production-scale rehearsal, build, lint, release verification, and visual snapshots are verified. The current RLS suite is not claimed as passed because Docker Desktop's Supabase engine is unavailable. No provider, live channel, live billing, monitoring, backup, secret-manager, or real health-data path is opened by this specification.

## Stage 4B-2 Consumer Closure - 2026-07-12

Stage 4B-2 Mesajlaşma is complete. Runtime contract: `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_SPEC.md`. Closure evidence: `docs/PHASE_85_STAGE_4B_2_CLOSURE_EVIDENCE.md`. Stage 4C may begin; this boundary does not alter Stage 4B alert/notification lifecycle, non-green AI draft blocking, or red atomic activation.
## Stage 4B-2 Post-Closure Remediation R0 - 2026-07-12

Stage 4B-2 remediation is a consumer-track correction and does not change alert/notification ownership, red precedence, notification lifecycle, or the no-alert-table decision. Stage 4C remains blocked while remediation is active.

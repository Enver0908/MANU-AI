# Phase 85 Stage 4B — Phase 3 Producers, Dedupe, Lifecycle Evidence

Status: **implemented (local verification)**  
Date: 2026-07-12  
Scope: structured notification producers, dedupe/recurrence, domain reconciliation — no list/mutation API panels (Phase 4).

## Delivered

### Core module (`phase-85-stage-4b-notifications.ts`)
- `upsertSystemNotificationInState` / `upsertSystemNotificationInSupabaseState`
- Dedupe key: `p85-4b:v1:<kind>:<scope>:<entity>:<source>`
- Open duplicate → `occurrenceCount++`, `lastOccurredAt` update; resolved recurrence → new row
- Emitters: `safe_reply_unavailable`, `delivery_failed`, `communication_permission_closed`, `ai_window_expired`, `ai_paused_by_verified_human`, `draft_invalidated`, `human_control_integrity`
- Reconcilers per lifecycle policy (delivery success, permission ready, manual reply, AI activation, draft replacement, integrity consistency)
- `shouldEmitClinicalHandoffNotification` — clinical red/yellow handoffs excluded from notification surface
- `completeUnsupportedMediaReviewInState` — type-specific review completion + audit

### Producer wiring
- `simulator.ts` — handoff safe-reply only; AI window expired upsert; delivery failed/reconcile; draft invalidation; permission closed; blocked preflight safe-reply; controlled AI activation reconciliation
- `phase-85-if-e-historical-retrieval.ts` — upsert + new dedupe keys for structured/competing notifications
- `phase-85-if-d-transcript-human-control.ts` — unsupported media upsert; verified-human AI pause notification
- `supabase-store.ts` — `serializeNotificationUpdateForRpc` extended with occurrence/resolution fields

### Tests
- `phase-85-stage-4b-notifications.test.ts` — dedupe increment, resolved recurrence, clinical exclusion, reconciliation
- `simulator.test.ts` — red handoff produces no notification; provider failure → `safe_reply_unavailable`
- `phase-85-if-e-historical-retrieval.test.ts` — dedupe increment with `p85-4b` keys

## Verification run

```text
npx vitest run src/lib/phase-85-stage-4b-notifications.test.ts src/lib/phase-85-if-e-historical-retrieval.test.ts src/lib/simulator.test.ts
npm run lint
npm run build
```

## Locked rules preserved

- Clinical alerts remain projection-only; no `legacy_handoff` for active red/yellow risk handoffs
- No raw handoff reasons or provider errors in notification UI copy
- Normal green/success paths do not emit notifications
- Reconciliation runs on domain mutations, not GET endpoints
- Production pilot remains `NO-GO`

## Known follow-up

- Bulk mutation RPC `notificationUpdates` loop still updates legacy fields only; occurrence/resolution DB sync for in-place upserts may need a small RPC patch when Supabase path is exercised end-to-end

# Phase 85 Stage 4B — Uyari ve Bildirimler Closure Evidence

Date: 2026-07-12  
Branch: `codex/phase-85-interstage-clinical-memory`  
Canonical plan: `docs/PHASE_85_STAGE_4B_UYARI_VE_BILDIRIMLER_ACTION_PLAN.md`  
Status: **complete (local verification)**  
Production pilot: **NO-GO**  
R-405: **open**  
R-406: local Supabase/RLS re-run **pending** when Docker/Supabase unavailable

## 1. Purpose

This is the single closure evidence pack for Phase 85 Stage 4B. It consolidates Phases 0–9 sub-evidence, verification outputs, role matrix, deferred Stage 4B-2 boundaries, and the controlled handoff to Stage 4B-2 Mesajlasma.

Stage 4B delivers:

- **Uyarilar** — active yellow/red clinical-operational projections only
- **Bildirimler** — structured system notifications with per-actor receipt lifecycle
- Bounded cursor list APIs, URL navigation, badges, inbox refresh, dense UI panels, integration/scale/visual verification

Stage 4B does **not** implement the WhatsApp-like messaging inbox. That is Stage 4B-2.

## 2. Implemented contracts

| Area | Contract | Primary modules |
| --- | --- | --- |
| Alert projection | Read-only from `yellowRiskHold` / `redRiskLock`; red suppresses yellow; no `alerts` table | `phase-85-stage-4b-alerts.ts`, `phase-85-stage-4b-contracts.ts` |
| Reason taxonomy / SLA | i18n `reasonLabelKey`, SLA state/deadline, safe list DTO | `phase-85-stage-4b-alerts.ts`, `alerts-panel-helpers.ts` |
| Notifications | Structured `kind`, deterministic `priority`, `category`, dedupe/recurrence | `phase-85-stage-4b-notifications.ts` |
| Receipt lifecycle | Per-actor read/ack/read-all/complete-review; separate from clinical resolution | `notification_receipts`, `stage-4b-notification-mutations.ts` |
| List APIs | `GET /api/alerts`, `GET /api/notifications`, cursor + limit 30 default / 100 max | `phase-85-stage-4b-api.ts`, API routes |
| Mutations | Read, acknowledge, read-all, complete-review (unsupported media) | `/api/notifications/*` |
| Red closure | Atomic `/api/clients/[id]/activate-ai` only; no separate handoff-resolution UI | Phase 5 activation UX |
| Navigation | URL state, header bell → full Bildirimler; alert/notification targets | `phase-85-stage-4b-dashboard-routing.ts`, `dashboard-app.tsx` |
| UI | `alerts-panel.tsx`, `notifications-panel.tsx`, `stage-4b-list-row.tsx` | Phases 7–8 |

Sub-phase evidence:

- Phase 0: `docs/PHASE_85_STAGE_4B_PHASE_0_DOCUMENTATION_EVIDENCE.md`
- Phase 1: `docs/PHASE_85_STAGE_4B_PHASE_1_ALERT_PROJECTION_EVIDENCE.md`
- Phase 2: `docs/PHASE_85_STAGE_4B_PHASE_2_PERSISTENCE_RECEIPT_RLS_EVIDENCE.md`
- Phase 3: `docs/PHASE_85_STAGE_4B_PHASE_3_PRODUCERS_DEDUPE_LIFECYCLE_EVIDENCE.md`
- Phase 4: `docs/PHASE_85_STAGE_4B_PHASE_4_LIST_MUTATION_API_EVIDENCE.md`
- Phase 5: `docs/PHASE_85_STAGE_4B_PHASE_5_RED_ATOMIC_ACTIVATION_EVIDENCE.md`
- Phase 6: `docs/PHASE_85_STAGE_4B_PHASE_6_URL_NAV_BADGES_REFRESH_EVIDENCE.md`
- Phase 7: `docs/PHASE_85_STAGE_4B_PHASE_7_ALERTS_SCREEN_EVIDENCE.md`
- Phase 8: `docs/PHASE_85_STAGE_4B_PHASE_8_NOTIFICATIONS_SCREEN_EVIDENCE.md`
- Phase 9: `docs/PHASE_85_STAGE_4B_PHASE_9_INTEGRATION_VERIFICATION_EVIDENCE.md`

## 3. Migration and RLS

Migration: `app/supabase/migrations/20260711090000_phase_85_stage_4b_alerts_notifications.sql`

- Extended `notifications` with Stage 4B fields
- `notification_receipts` composite PK `(tenant_id, notification_id, dietitian_id)`
- RLS: notification SELECT via `p85_stage_4b_can_read_notification`; receipt SELECT owner/admin or own dietitian
- RPCs: list alerts/notifications, mark read, acknowledge, mark-all-read

**Local RLS result (2026-07-12):** `npm run test:rls` → **31 skipped** (local Supabase/Docker not running). Skipped RLS is **not** counted as pass. Baseline from P85-IF post-closure audit (30/30 when Supabase available) must be re-run with this migration before merge/deploy claims.

Targeted RLS coverage in integration test file includes `p85_stage_4b_mark_notification_read_v1`, acknowledge, and assistant forbidden paths when Supabase is up.

## 4. Role matrix (fail-closed)

| Role | Alerts | Notifications | Receipt mutation |
| --- | --- | --- | --- |
| owner / admin | Tenant-visible clients | Tenant-visible + tenant-operational | yes |
| dietitian | Own + assigned clients | Linked visible clients | yes |
| assistant | Assigned clients (read-only lists) | Assigned clients (read-only; navigate only) | no |
| auditor | empty | empty | no |
| cross-tenant / unassigned | empty | empty | blocked |

Verification: `phase-85-stage-4b-api.test.ts`, `phase-85-stage-4b-integration-verification.test.ts`, `supabase-rls.integration.test.ts` (when local Supabase available).

## 5. Verification results (2026-07-12)

Commands run during closure:

```powershell
cd dietitian-ai-assistant
npm test

cd ..\app
npm test
npm run lint
npm run build
npm run test:visual
npm run rehearse:stage-4b:integration
npm run test:rls
git diff --check
```

| Check | Result |
| --- | --- |
| Core package tests | pass |
| App unit tests | **895 passed**, 5 skipped (900 total) |
| Stage 4B integration tests | 8 passed, 1 skipped (full 5k/10k gated by `STAGE_4B_FULL_SCALE=1`) |
| `rehearse:stage-4b:integration` | pass |
| Lint | pass (3 pre-existing warnings) |
| Build | pass |
| Visual smoke (desktop/tablet/mobile-android/mobile-ios) | **36 passed** |
| RLS integration | **31 skipped** — blocked, not pass |
| Channel replay (`rehearse:channel:replay`) | existing harness unchanged; not re-run in this closure pass |
| Production-scale 79G (`rehearse:production-scale:79g`) | existing harness unchanged; not re-run in this closure pass |
| `release:verify` | not re-run in this closure pass |
| Secret / Phase 86 naming scan | no new secrets; no Phase 86 residue in Stage 4B diff |
| `git diff --check` | clean apart from CRLF warnings |

DTO governance: list items use allowlisted keys only; sensitive patterns (`body`, raw reason codes, handoff narrative) rejected in `phase-85-stage-4b-integration-verification.ts`.

Scale sample: 400 clients / 1,200 notifications fixture proves bounded page size without full-state fetch. Full 5,000 / 10,000 rehearsal available via `STAGE_4B_FULL_SCALE=1`.

## 6. Channel replay integration

Stage 4B integration checks (mock only, no provider calls):

- `safe_reply_unavailable` notification on provider timeout simulation
- Red alert projection after emergency symptom inbound
- Duplicate inbound ignored on idempotency key replay

Full 100×50 channel replay remains on existing `phase-77ag-channel-replay-rehearsal` harness.

## 7. Visual verification

Playwright visual smoke covers:

- Alerts panel: sticky filters, search, severity segments, row density bounds, no horizontal overflow
- Notifications panel: sticky filters, status segments, priority/category filters, row density, overflow guard
- Viewports: desktop, tablet, mobile-android, mobile-ios

## 8. Risk closure (R-426 – R-430)

| ID | Status | Evidence |
| --- | --- | --- |
| R-426 | mitigated | Alerts projection-only; clinical handoff not surfaced as system notifications |
| R-427 | mitigated | Red closure via atomic activation only; Phase 5 UX + tests |
| R-428 | mitigated | Per-actor receipts, assistant/auditor mutation blocks, RLS RPCs |
| R-429 | mitigated | Allowlisted DTOs, i18n keys, export governance tests |
| R-430 | mitigated | Cursor APIs, page size 30, integration scale fixture, inbox scheduler dedupe |

## 9. Known deferred — Stage 4B-2 Mesajlasma (next)

Stage 4B-2 is **not implemented**. Next approved work:

1. Conversation list (thin rows, newest first, last-message preview/time, unread indicator)
2. Per-conversation unread message receipt/state
3. WhatsApp-like conversation detail (refactor current `ConversationPanel`)
4. Yellow draft review/edit/send ergonomics in conversation detail
5. Red manual reply ergonomics in conversation detail
6. Replace standalone **Görüşme** nav with **Mesajlaşma** (list → detail)
7. In-detail AI active/passive control boundaries

**Stage 4C remains blocked** until Stage 4B-2 closes.

**Still out of scope:** real WhatsApp/Telegram/provider paths, live billing, production pilot GO, hosted sandbox doc changes without deploy.

## 10. Acceptance criteria mapping (plan)

1. Uyarilar and Bildirimler are separate full dashboard sections — **yes**
2. Alerts from active yellow/red only — **yes**
3. Red suppresses yellow — **yes**
4. Alert rows contain no raw message/PHI — **yes** (DTO allowlist)
5. Alert click opens Görüşme target; does not close alert — **yes**
6. Red alert closes only via atomic activation — **yes**
7. Notifications use structured kind, priority, actor receipt — **yes**
8. Read / ack / resolution separated — **yes**
9. Role matrix enforced — **yes** (RLS re-run pending locally)
10. Bounded cursor APIs fail-closed — **yes**
11. Header bell opens full Notifications — **yes**
12. Mobile Uyarilar beside Görüşme — **yes**
13. Stage 4B-2 not mixed into Stage 4B — **yes**
14. Tests/lint/build/visual pass; RLS skipped not claimed — **yes**
15. Pilot NO-GO, R-405 open, worktree clean after commit — **yes**

## 11. Closure commit

Single Stage 4B closure commit message:

`Implement Phase 85 Stage 4B alerts and notifications`

Production pilot remains **NO-GO**. Do not enable real providers, channels, or live billing.

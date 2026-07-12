# Phase 85 Stage 4B-2 — Phase 9 Lifecycle & Integration Evidence

## Scope delivered

- **`phase-85-stage-4b2-messaging-integration.ts`** — client-safe alert/notification navigation, refresh orchestration, target validity, export leak guards
- **`phase-85-stage-4b2-messaging-integration-evidence.ts`** — lifecycle evaluator, revoked-message projection checks, full integration evidence runner
- **`phase-85-stage-4b2-messaging-integration.test.ts`** — anchored navigation, broken target detection, export leak checks, anonymization + revoked message rendering
- **`dashboard-app.tsx`** — integration helpers for alert/notification deep links, unified `refreshStage4B2Surfaces` after send/activation/mutations, broken-source `detailUnavailable`
- **`phase-85-stage-4b-dashboard-routing.ts`** — `source=notification` deep-link allowlist
- **`phase-85-stage-4b-integration-verification.ts`** — conversation read-receipt export leak checks in Stage 4B governance evidence

## Integration contract

| Flow | Behavior |
| --- | --- |
| Alert click | Bounded `section=messages` navigation with `conversationId`, `messageId`, `source=alert` |
| Notification click | Messages target opens anchored detail; `ai-control` opens client AI tab; `clients` opens client panel |
| Post-mutation refresh | Mesajlaşma list/detail and Uyarılar/Bildirimler inbox refresh independently via `refreshStage4B2OperationalSurfaces` |
| Anonymization | `conversationReadReceipts` removed; message bodies redacted with `PHASE_74_REDACTION_MARKER` |
| Client export | Conversation read receipts excluded; leak guard rejects `conversationReadReceipts` / `lastReadSequence` markers |
| Broken source | `resolveMessagingTargetValidity` surfaces removed client, missing conversation, or stale message anchor |

## Verification

```powershell
cd app
npm run lint
npm test
npm run build
```

949 unit tests passed (5 skipped); lint and build succeeded locally.

## Notes

- Channel replay, yellow→red race, duplicate webhook and delivery-failure scenarios remain covered by existing Stage 4B integration verification and channel replay suites invoked from `evaluateStage4B2MessagingIntegrationEvidence`.
- Phase 10 will run full RLS, visual, scale and release verification gate.

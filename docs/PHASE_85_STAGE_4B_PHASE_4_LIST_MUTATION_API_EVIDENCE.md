# Phase 85 Stage 4B — Phase 4 List and Mutation API Evidence

Status: **implemented (local verification)**  
Date: 2026-07-12  
Scope: bounded alerts/notifications list APIs, receipt mutations, safe navigation targets — no dashboard UI panels (Phase 6).

## Delivered

### Core module (`phase-85-stage-4b-api.ts`)
- Versioned base64url cursors with malformed cursor `400`
- Default page size `30`, max `100`, search max `80` chars
- Alert list: severity/query filters, counts (`all/red/yellow`), cursor on severity rank + `startedAt` + `id`
- Notification list: `active` / `unread` / `history` buckets, priority/category/query filters
- Safe DTO projection (`titleKey` / `summaryKey`, no persisted title/body)
- Safe navigation target allowlist: `messages`, `clients`, `ai-control`
- Role matrix: owner/admin tenant-wide, dietitian primary+assigned, assistant read-only, auditor empty counts
- Mutation responses return refreshed counts + `target` (not full app state)

### API routes
- `GET /api/alerts`
- `GET /api/notifications`
- `POST /api/notifications/[id]/read` (mutation DTO)
- `POST /api/notifications/[id]/acknowledge` (mutation DTO)
- `POST /api/notifications/read-all`
- `POST /api/notifications/[id]/complete-review` (`unsupported_media_review` only)

### Store wiring
- `supabase-store.ts`: `listSupabaseClinicalAlerts`, `listSupabaseNotifications`, `markAllSupabaseNotificationsRead`, `completeSupabaseUnsupportedMediaReview`
- `app-state-store.ts`: fallback list/mutation helpers

### i18n
- `phase-85-stage-4b-notification-i18n.ts` merged into `dashboardMessages` (7 languages)

### Tests
- `phase-85-stage-4b-api.test.ts` — pagination, auditor empty, lifecycle buckets, Turkish search, safe targets
- Updated `api-errors.test.ts` — safe-reply mutation DTO contract

## Verification run

```text
npx vitest run src/lib/phase-85-stage-4b-api.test.ts src/app/api/api-errors.test.ts
npm run lint
npm run build
```

## Locked rules preserved

- Clinical alerts remain projection-only; notification list excludes `legacy_handoff`
- Inaccessible notification IDs return `404` (enumeration-safe)
- Read/ack/read-all mutate actor receipts only; read-all does not bulk acknowledge/resolve
- Production pilot remains `NO-GO`

## Post-closure remediation reconciliation - 2026-07-12

The Supabase implementation now uses actor-aware v2 bounded list/count RPCs rather than `loadSupabaseState` for Stage 4B resource reads. Service-role actor context is validated against tenant membership, translated notification title/summary search is mapped to stable kinds, and explicit foreign conversation/message links fail closed. Route query parsing is inside the controlled error boundary. See `docs/PHASE_85_STAGE_4B_POST_CLOSURE_REMEDIATION_EVIDENCE.md`.

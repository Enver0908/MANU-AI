# Phase 85 Stage 4B-2 — Phase 7 Messaging List and Navigation Evidence

## Scope delivered

- `messaging-panel.tsx` — split inbox shell (360px list + flexible detail on `lg+`, mobile drill-down with back)
- `conversation-list-row.tsx` — channel icon, name, single-line preview, time, personal unread badge
- `messaging-panel-helpers.ts` — formatting, empty-state keys, row guards
- `dashboard-navigation.tsx` — Mesajlaşma nav badge (`messages` unread total, `99+` cap via `formatStage4BBadgeCount`)
- `i18n.ts` — user-facing label **Mesajlaşma** (all languages), messaging panel strings
- `dashboard-app.tsx` — wires `useStage4B2Messaging` into `MessagingPanel`, passes nav badge count

## UX contract

| Surface | Behavior |
| --- | --- |
| Desktop/tablet | Fixed 360px conversation list + detail pane |
| Mobile | Full-width list; selecting a row opens detail; back returns to list |
| Nav | Single `messages` entry labeled Mesajlaşma; badge = sum of personal unread |
| Row | `min-h-11` (44px), keyboard focus ring, truncated preview |
| States | Loading skeleton, empty (all/unread/search), list error + retry, load-more |

## Verification

```powershell
cd app
npm run lint
npm test
npm run build
npm run test:visual
```

## Notes

- `ConversationPanel` remains unchanged (Phase 8 refactors detail UX).
- List/detail data still flows through Phase 6 hook and bounded APIs; no provider paths added.

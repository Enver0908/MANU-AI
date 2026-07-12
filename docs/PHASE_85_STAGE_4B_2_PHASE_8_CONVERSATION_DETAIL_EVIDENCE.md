# Phase 85 Stage 4B-2 — Phase 8 WhatsApp-Like Detail Evidence

## Scope delivered

- **`conversation-panel.tsx`** — WhatsApp-like transcript workspace: date separators, provenance bubbles, older/newer pagination, anchor scroll, sticky composer
- **`conversation-detail-helpers.ts`** — timeline merge, provenance/body helpers, role visibility matrix
- **`conversation-message-bubble.tsx`**, **`conversation-header.tsx`**, **`conversation-composer.tsx`**, **`conversation-draft-review-panel.tsx`**, **`conversation-ai-controls-strip.tsx`**
- **`use-stage-4b2-messaging.ts`** — `loadOlderMessages` / `loadNewerMessages`, accumulated `detailMessages`
- **`dashboard-app.tsx`** — bounded detail DTO wiring, `reviewSendManualFromDraft`, AI passive control
- **`i18n.ts`** — conversation detail strings (all languages)

## UX contract

| State | Behavior |
| --- | --- |
| Transcript | Chronological bubbles, date separators, provenance/status badges |
| Pagination | Load older/newer via bounded API cursors |
| Yellow hold | Reviewed-manual editor (`review_send_manual`); green approve path hidden on yellow draft rows |
| Red lock | Persistent banner after manual reply; separate atomic activation CTA; AI config locked |
| Assistant/viewer | Read-only notice; composer, draft and AI controls hidden |
| Mobile | Sticky composer via `MobileStickyActionBar` |

## Verification

```powershell
cd app
npm run lint
npm test
npm run build
```

945 unit tests passed; lint (0 errors) and build succeeded locally.

## Notes

- Detail messages come from `ConversationMessageDto[]` via Phase 6 hook, not full app-state transcript scans.
- Phase 9 will wire alert/notification targets and lifecycle refresh orchestration.

# Phase 85 Stage 5 Phase 8 Route Integration Dirty-State And Mobile Ergonomics Evidence

Date: 2026-08-02

Branch: `codex/stage-4c-remediation`

Status: **COMPLETE locally — Dashboard/AI Chat/Settings shell route integration, central dirty registry, navigation/logout/focus guards, and mobile keyboard/sticky ergonomics**.

This phase implements Stage 5 Faz 8 only. It does not implement Faz 9 a11y/perf/RLS closure work, Stage 6 interior redesigns, or production launch gates.

Production remains `NO-GO`. R-405 remains open. Push, PR, deploy, and production gates are out of scope.

## Scope

Implemented:

- Central in-memory dirty registry (`clean/dirty/saving/error`) with register/update/unregister, multi-label confirmation copy, `saveAll` / `discardAll`, and auto-unregister on unmount
- Shell provider navigation guard for destination changes, guarded href navigation, client switch, focus-mode enter/exit, optional SW update, logout (`/api/demo-logout` after dirty check), and `beforeunload`
- Confirmation actions: `Burada kal`, `Değişiklikleri bırak`, and `Kaydet ve devam et` only when every blocking entry is saveable; saving locks nav + client switch
- DashboardApp header stripped of logout / PWA / Supabase / subscription chips / duplicate bell; domain title + language + demo reset retained; assistant/auditor read-only label
- AI Chat uses layout shell; client-scoped chats report fixed client identity to shell; general chat stays unbound (`Genel sohbet — danışan bağlamı kullanılmıyor`); focus mode hides compact bottom nav with exit control
- Settings profile / security / workspace register separately; profile local `beforeunload` removed in favor of provider guard; settings tab changes go through dirty guard
- Message composer, AI draft edit, client form editor, AI Chat composer, and AI message edit report dirty state
- Compact nav items always use provider navigation (no raw Link bypass); logout uses `requestLogout`
- Mobile sticky bars / composers use Visual Viewport `--keyboard-inset` above bottom nav + safe-area; CSS fallback remains when keyboard events are absent

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Dirty registry Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-dirty-registry.test.ts` |
| Mobile ergonomics Vitest | PASS | `npx vitest run src/lib/phase-83e5-mobile-ergonomics.test.ts` |
| Combined targeted | PASS | 10 tests |
| Typecheck | PASS | `npx tsc --project tsconfig.production.json --pretty false` exited 0 |
| Local Supabase reset / RLS | BLOCKED | Docker Desktop unavailable |

## Completion Criteria

| Criterion | Status |
| --- | --- |
| Three route families without duplicate shell/header/PWA wrappers | Met |
| Defined dirty surfaces registered to central guard | Met (composer, AI draft/edit, form, profile, security, workspace) |
| Unsaved content cannot silently disappear on shell nav / logout / focus exit | Met |
| Mobile primary action / keyboard stay above bottom nav | Met (`bottom-above-nav` + `--keyboard-inset`) |
| Assistant/auditor mutation controls not rendered; explicit read-only label | Met |

## Next Phase Entry

Stage 5 Faz 9 (accessibility, language, performance, and closure evidence) may start after this commit and requires separate explicit approval.

## Changed Files

- `app/src/lib/phase-85-stage-5-shell-dirty-registry.ts` (+ tests)
- `app/src/lib/use-shell-dirty-registration.ts`
- `app/src/components/dashboard/shell-dirty-navigation-dialog.tsx`
- `app/src/components/dashboard/shell-provider.tsx`
- `app/src/components/dashboard/dashboard-shell.tsx`
- `app/src/components/dashboard/dashboard-navigation.tsx`
- `app/src/components/dashboard/active-client-control.tsx`
- `app/src/components/dashboard/mobile-ergonomics.tsx`
- `app/src/components/dashboard/conversation-panel.tsx`
- `app/src/components/dashboard/client-form-panel.tsx`
- `app/src/components/dashboard-app.tsx`
- `app/src/components/ai-chat/ai-chat-page-client.tsx`
- `app/src/components/ai-chat/ai-chat-workspace.tsx`
- `app/src/components/ai-chat/ai-chat-composer.tsx`
- `app/src/components/settings/settings-page-client.tsx`
- `app/src/components/settings/settings-profile-form.tsx`
- `app/src/components/settings/settings-security-form.tsx`
- `app/src/components/settings/settings-sections.tsx`
- `app/src/app/globals.css`
- Continuity docs

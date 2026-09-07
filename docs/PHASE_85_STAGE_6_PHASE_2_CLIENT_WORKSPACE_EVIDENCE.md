# Phase 85 Stage 6 Phase 2 Client Workspace Evidence

Date: 2026-08-19

Status: **PHASE 2 COMPLETE**

Stage 5 status: **STAGE_5_CLOSED**

Production status: **NO-GO**

## 1. Result

Dashboard home is an operational daily entry (active client, queue entries, direct actions) without invented KPI cards. Selecting a client runs the Stage 5 dirty guard, persists the active client, updates the URL, and opens that client's workspace. Mobile uses list → hub → full-width task with back reversing the stack. Desktop keeps the roster beside the workspace at `lg` (1024px) using CSS grid, not JavaScript viewport width.

Forms, nutrition, menu, and AI-control panels load lazily. Editors register `save` / `discard` / `focus` with `useShellDirtyRegistration`. Persist failure rolls back to the previous client and URL. Inaccessible deep links stay fail-closed.

Stage 5 shell navigation structure, service-worker cache, billing, provider egress, and `dietitian-ai-assistant/` were not changed. Production remains `NO-GO`.

## 2. Ergonomics sources

These sources refined interaction details only. They did not change locked security, dirty-guard, or data-boundary decisions.

- WCAG 2.2 Success Criterion 2.5.8 Target Size (Minimum), Level AA: pointer targets at least 24×24 CSS pixels, with documented exceptions. Source: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- WCAG 2.5.5 Target Size (Enhanced), Level AAA: 44×44 CSS pixels. Product workspace controls use `min-h-11` (44px) to match this enhanced size and Apple's 44pt hit target, not only the 24px AA floor.
- Apple Human Interface Guidelines / `NavigationSplitView`: compact width collapses columns into a single stack; regular width keeps list and detail side by side. Source: https://developer.apple.com/documentation/technotes/tn3154-adopting-swiftui-navigation-split-view
- Focus restoration: returning from a task restores roster/hub focus via `shouldRestoreClientRosterFocus` rather than inventing a new focus manager.

## 3. Implementation

- URL: `clientTask` on `DashboardUrlState`; `commitDashboardHref` plus `manu:dashboard-href-change` so same-page query updates re-render when App Router `useSearchParams` stays stale.
- Selection: `runStage6ClientActivation` → shell `selectActiveClient` → URL. Demo ids such as `client-mert` use `formatStage6ClientReferenceShort` and must not call UUID-only `encodeClientReferenceCode`.
- Surfaces: `client-workspace.tsx`, `client-task-hub.tsx`, `client-workspace-header.tsx`; roster-only `clients-panel.tsx`; operational `overview-panel.tsx`.
- Layout breakpoint: Tailwind `lg` / 1024px. Hub and tabs stay mounted; CSS hides one. Playwright clicks `:visible` test ids.
- Global bottom nav remains `Ana Sayfa / Danışanlar / Mesajlar / Uyarılar / Diğer`.

## 4. Verification

| Check | Result |
| --- | --- |
| Targeted Stage 6 unit tests (selection, routing, dirty editors) | PASS |
| `npm run typecheck` | PASS (exit 0) |
| `npm run lint` | PASS (0 errors; 69 pre-existing warnings) |
| `npm test` | 1541 passed / 9 skipped |
| `npm run build` | PASS (exit 0) |
| Playwright Chromium: `dashboard.visual.spec.ts` + `stage-6-workspace.visual.spec.ts` on desktop, desktop-xl, tablet, mobile-android, mobile-ios | 47 passed / 3 skipped (desktop-only roster assertion) |
| Playwright Chromium Stage 5 a11y/responsive (desktop/tablet/mobile projects) | PASS in the same local matrix |
| WebKit/Firefox Stage 5 projects | Not run; Playwright WebKit/Firefox binaries are not installed in this environment |
| `npm run test:rls` | not run; no schema/RLS migration |
| `git diff --check` | PASS (CRLF warnings only) |

Compact-shell messaging/simulator/alert continuation inside `dashboard.visual.spec.ts` is deferred to Phase 3 (viewport `< 1200`). Phase 2 workspace coverage on those viewports is `stage-6-workspace.visual.spec.ts`.

## 5. Open risks

- App Router same-page query updates still require native history + the dashboard href event; do not remove `commitDashboardHref`.
- Fallback mode copy `Yerel güvenli mod` lives in the wide sidebar (`min-[1200px]`) and is attached but hidden on compact shells.
- Shared fallback `POST /api/app-state` isolation can leave a red-risk lock across sequential visual projects; the diet-plan toggle is skipped when the control is disabled.
- Production remains `NO-GO`.

## 6. Next boundary

Phase 3 Communication and Operational Workflows requires separate explicit user approval and a separate commit.

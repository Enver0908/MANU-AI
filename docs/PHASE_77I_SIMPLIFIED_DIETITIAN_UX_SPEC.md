# Phase 77I: Simplified Dietitian UX

Date: 2026-06-10
Status: In progress.
Depends on: Phase 77H (PromptContext/answerability/output guard V2).
Production pilot: NO-GO.

## Goal

Make the dietitian app practical for real users by reorganizing the client detail into clear, non-technical sections while preserving the underlying safety architecture.

## Design

### Client Detail Tabs

When a client is selected in the clients view, the detail area shows a horizontal tab bar:

| Tab | Content |
| --- | --- |
| Overview | AI controls, status badges, safety checklist, quick stats |
| Personal Form | Profile/channel fields, dynamic form responses |
| Food Rules | FoodRulesPanel with conflict summaries in plain language |
| Menu | MenuPlanPanel with active menu status and conflict badges |
| Critical Context | Context update entry and history |
| AI Copilot | Client-scoped read-only copilot with quick prompts |
| Export | Read-only summary of exportable data and status |

### Status Summaries

Each tab header shows a brief status indicator:
- Food Rules: conflict count badge if any
- Menu: active/draft badge
- Critical Context: active entry count

### Progressive Disclosure

- Default view per tab is simple controls
- Conflict details and decision rationale are behind expandable sections
- No raw JSON or prompt-engine language visible by default

### Plain Language Conflicts

Conflict messages use dietitian-friendly language:
- "Bu yiyecek yasakli grup icerisinde" instead of technical codes
- "Aktif menu ile food-rule profili arasinda uyumsuzluk var" for menu conflicts

### Empty/Loading/Error States

Each section shows an appropriate empty state with guidance text when no data exists yet.

## Technical Scope

### dashboard-app.tsx Changes

1. Add `clientDetailTab` state with type union for tab keys.
2. Add `ClientDetailTabs` component with horizontal tab bar inside client detail.
3. Move `FoodRulesPanel` and `MenuPlanPanel` rendering from `FormsPanel` to dedicated client detail tabs.
4. Create `ClientOverviewTab` from existing AI control and safety checklist content.
5. Create `ClientPersonalFormTab` from profile/channel fields and dynamic form schema response.
6. Create `ClientExportTab` with read-only data summary.
7. Move `ClientContextUpdatePanel` to its own tab.
8. Add client-scoped copilot tab using existing copilot infrastructure.
9. `FormsPanel` becomes schema-management only (create/publish schemas).

### i18n.ts Changes

Add tab label keys for all seven tabs across all supported languages.

### Tests

- `phase-77i-simplified-ux.test.ts`: verify tab structure, status summaries, conflict display, export data.

## What This Phase Does NOT Do

- No new data models.
- No new API routes.
- No provider/channel changes.
- No new Supabase migrations.
- No production pilot GO.

## Verification

```text
git diff --check
npm run release:verify
```

### Results

- Core tests: 173/173
- App tests: 320/320 (50 test files)
- Lint: 2 pre-existing warnings only
- Production build: passed
- Phase 77I tests: 5/5 passed
- i18n completeness: all 7 tab labels present in all 7 languages
- `npm run release:verify`: passed

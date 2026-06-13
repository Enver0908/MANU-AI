# Phase 77E: Client Food Rule Profile V2

Date: 2026-06-10
Status: Implemented locally; production pilot remains NO-GO.

## Goal

Allow dietitians to configure client-specific allowed/forbidden rules and flexibility against the Phase 77D master food catalog. Client Food Rule Profile V2 becomes the manual source authority for food rules.

## Product Requirements

- Dietitian can mark catalog foods and groups as allowed or forbidden.
- Dietitian can set flexibility at global, meal, goal, and food-group levels.
- Flexibility values: `restricted`, `moderate`, `flexible` (most restrictive wins).
- UI stays practical with catalog search and conflict warnings, not technical engine language.
- Phase 76J technical fields are deprecated in the main UI but remain bridged for Phase 76 runtime compatibility.

## Technical Requirements

- Add `ClientFoodRuleProfileV2Record` as first-class app state with version, revision, status, and metadata.
- Lazy first-load migration from Phase 76D/77D embedded form answers and personal-form flexibility scores.
- Save path bridges profile into legacy form answers for `food-rule-runtime` compatibility.
- API: `GET` and `PUT` `/api/clients/[id]/food-rule-profile`.
- Supabase table `client_food_rule_profiles` with tenant RLS.
- Export/redaction coverage for profile records and catalog selections.
- Conflict detection for allow/forbid overlap, parent-category conflicts, flexible meal vs forbidden food, and diet-type conflicts.

## Edge Cases

- Unknown catalog ids on load are ignored with warnings, not crashes.
- Removed/anonymized clients cannot save profiles.
- Chat mutation remains blocked (Phase 77B).
- Stale revision returns `profile_stale_recreate_required`.
- Personal form `general_flexibility_score` / `goal_flexibility_score` map into profile flexibility on first migration only.

## Verification

```text
cd app
npx vitest run src/lib/phase-77e-client-food-rule-profile.test.ts
npm run release:verify
```

## Out Of Scope

- Food Decision Engine V2 (Phase 77G).
- Menu plan authority (Phase 77F).
- Real provider/channel connections.
- R-405 remediation.

# Phase 77F: Menu Plan V1 With Four Templates

Date: 2026-06-10
Status: Implemented locally; production pilot remains NO-GO.

## Goal

Give dietitians a client-specific menu plan authority with four templates, active-menu selection, food-profile conflict detection, and derived legacy `client.dietPlan.summary` compatibility.

## Product Requirements

Four template types:

1. `day_by_day_detailed` — day/meal grid with foods, portions, optional recipes.
2. `weekly_meal_framework` — weekly meal targets with flexible options.
3. `exchange_option_based` — meal slots with allowed alternatives and exchange guidance.
4. `simple_guidance` — high-level structure with preferred/avoid lists and notes.

Dietitian can create drafts, edit meal slots, preview export visibility, and activate one plan per client. Active menu is the primary plan authority; legacy diet plan summary is derived and cannot be patched directly while an active menu exists.

## Technical Requirements

- `ClientMenuPlanV1Record` in app state with version, revision, status (`draft` | `active` | `archived`), template type, meal slots, recipes, notes, export visibility, and catalog match metadata on free-text items.
- Lazy migration from legacy `client.dietPlan` into a draft `simple_guidance` plan on first load.
- Activate path archives other active plans, derives `dietPlan.summary` (+ breakfast/lunch/dinner when available), increments context revision, and audits `client_menu_plan_activated`.
- `patchClientInState` rejects direct `dietPlan.summary` edits when an active menu plan exists.
- Menu-food-rule conflict detection against Client Food Rule Profile V2.
- API:
  - `GET` `/api/clients/[id]/menu-plans`
  - `POST` `/api/clients/[id]/menu-plans`
  - `PUT` `/api/clients/[id]/menu-plans/[planId]`
  - `POST` `/api/clients/[id]/menu-plans/[planId]/activate`
- Supabase `client_menu_plans` with tenant RLS.
- Phase 74 export `menu_plans_v1.json` and transactional redaction coverage.

## Edge Cases

- Unknown catalog ids on load are ignored with warnings, not crashes.
- Removed/anonymized clients cannot save or activate plans.
- Stale revision returns `profile_stale_recreate_required`.
- Activate is blocked when hard menu-food-rule conflicts exist.
- Chat mutation remains blocked (Phase 77B).

## Verification

Completed 2026-06-10:

- `npx vitest run src/lib/phase-77f-client-menu-plan.test.ts` — 6/6 passed
- `npm run release:verify` — core tests 165/165, app tests 302/302, lint with two pre-existing warnings, production build, only documented R-405 findings

## Out Of Scope

- Food Decision Engine V2 (Phase 77G).
- DOCX/PDF export (Phase 77J).
- Real provider/channel connections.
- R-405 remediation.

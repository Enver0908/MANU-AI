# Phase 85 Stage 4A: Danisan Kontrol Paneli Mimari ve Hizmet Akisi Plani

Date: 2026-07-08
Status: Stage 4A.1, Stage 4A.2, Stage 4A.3, and Stage 4A.4 implemented (2026-07-08). Stage 4A Danisan Kontrol Paneli complete.
Production pilot: NO-GO.
Clinical production GO: not in scope.
Deployment: none.

Current supersession note, 2026-08-21: this file is historical Stage 4A planning evidence. The roadmap position below records the intended sequence at the Stage 4A checkpoint; later evidence closed Stage 4B, Stage 4B-2, Stage 4B-3, Stage 4B-4, Stage 4C, Stage 4D, Stage 5, and Stage 6 locally. Stage 7 is not started or authorized by the Stage 6 closure. R-405 is technically resolved locally under the current Stage 5 dependency report, while production remains `NO-GO`.

## Purpose

Stage 4A defines the code-grounded architecture and execution plan for the dietitian-facing danisan kontrol paneli. The priority is not a cosmetic dashboard pass; it is the quality of the actual service given to the dietitian for each client.

The panel must make four client-scoped workflows first-class:

1. Danisan formu.
2. Aktif beslenme plani.
3. Menu.
4. AI asistan kontrolu.

Each workflow was treated as a large implementation phase inside Stage 4A. Stage 4A.1 through Stage 4A.4 are complete.

## Phase 85 Roadmap Position

Stage 4A is one part of the restructured Phase 85 dashboard roadmap:

1. Stage 1 - Design system foundation: complete.
2. Stage 2 - Full component system: complete.
3. Stage 3 - Public/commercial entry surfaces: complete and deployed to the hosted sandbox.
4. Stage 4A - Danisan Kontrol Paneli Mimari ve Hizmet Akisi Plani: complete.
5. Stage 4B - Uyari ve Bildirimler: later closed locally.
6. Stage 4B-2 - Mesajlasma: later closed locally; owns conversation list/detail, unread message state, WhatsApp-like detail, yellow draft workflow, red manual reply, and in-detail AI control.
7. Stage 4C - Diyetisyen Icin AI Chat: later closed locally.
8. Stage 4D - Ayarlar / Hesap: later closed locally.
9. Stage 5 - Dashboard and Mobile PWA Shell: later closed locally.
10. Stage 6 - Dashboard Core Workflows: later closed locally with explicit iPhone validation waiver.
11. Stage 7 - Visual QA, Polish, Accessibility, and Closure: future work; requires separate user-approved plan before implementation.

At this historical checkpoint, Stage 4B was action-planned and approved. Later stages remained sequential, with explicit user approval at each stage boundary; later evidence records local closure through Stage 6.

## Non-Negotiable Boundaries

- Preserve Phase 83/84 auth, entitlement, invite, sandbox checkout, onboarding, admin, PWA, and service-worker behavior.
- Preserve all existing backend API contracts unless a later approved phase explicitly documents a compatible migration.
- Do not copy API routes from `public-website-redesign.zip`.
- Do not enable real WhatsApp, Telegram, Gemini/provider, live billing, monitoring, backup, secret-manager, or real health-data production paths.
- Keep Stripe in test/sandbox mode.
- Keep production pilot `NO-GO`.
- Keep R-405 status governed by the current dependency authority; it is now technically resolved locally.
- Keep R-406/current local Supabase RLS status governed by the latest zero-skip RLS authority.
- Use the Phase 85 palette and density direction: warm clinical SaaS, premium but operational, compact, readable, and scannable.
- Avoid heavy gradients, bright purple, pure black, blob/orb decoration, nested cards, and amateur dashboard composition.

## Code-Grounded Findings

### 1. Danisan Formu

Current system:

- Active client form schema is the Phase 77C personal form v2 registry.
- `app/src/lib/phase-70-form-registry.ts` defines the active schema, required autopilot field ids, prompt visibility, section structure, and answerability metadata.
- `app/src/lib/client-forms.ts` owns schema creation/publish, response save, response validation, prompt summary generation, client field sync, food-rule bridge sync, and pending draft invalidation.
- `POST /api/clients/forms` persists form responses through fallback or Supabase store with `update_client` capability.
- Dashboard `ClientsPanel` currently has a personal-form tab, but it edits only a small subset of `ClientRecord` fields instead of rendering the full active schema response.

Required product direction:

- Move the real Phase 77C client form into the danisan kontrol paneli.
- Render the active published schema section-by-section.
- Load the latest response for the selected client and let the dietitian edit it.
- Preserve prompt-visible vs dietitian-only semantics.
- Show autopilot-required fields and missing status.
- Save through the existing form response route so client sync, food-rule bridge sync, context revision updates, and draft invalidation remain intact.

### 2. Aktif Beslenme Plani

Current system:

- `ClientFoodRuleProfileV2Record` is the canonical active nutrition rule profile.
- `app/src/lib/phase-77d-master-food-catalog.ts` loads the master food catalog with 12 main categories, 113 subcategories, and 518 foods.
- `app/src/lib/phase-77e-client-food-rule-profile.ts` owns food-rule profile derivation, migration, conflict detection, save validation, revision control, form-response bridging, and audit.
- `app/src/components/food-rules-panel.tsx` already supports catalog search, allowed/forbidden catalog foods, allowed/forbidden free-text foods, food groups, diet type restrictions, flexibility controls, and forbidden main-category checkboxes.
- The type model already supports main category, subcategory, and food id selections for both allowed and forbidden sides.

Required product direction:

- Upgrade this into an "Aktif Beslenme Plani" workspace inside the danisan kontrol paneli.
- Provide a dense catalog browser with main category, subcategory, and food-level checkbox selection.
- Keep search for fast access to hundreds of foods.
- Make allowed vs forbidden selections explicit and fast to scan.
- Surface conflicts before save and preserve hard conflict blocking.
- Save through `/api/clients/[id]/food-rule-profile` with existing revision and capability rules.
- Keep Food Decision Engine V2 behavior unchanged.

### 3. Menu

Current system:

- `ClientMenuPlanV1Record` is the canonical menu-plan model.
- `app/src/lib/phase-77f-client-menu-plan.ts` supports four template types:
  - `day_by_day_detailed`
  - `weekly_meal_framework`
  - `exchange_option_based`
  - `simple_guidance`
- Active menu plans derive the legacy `client.dietPlan.summary` and lock direct summary patches.
- Menu activation checks food-rule conflicts.
- `app/src/components/menu-plan-panel.tsx` already supports create, edit, activate, meal slots, alternatives, preferred/avoid foods, notes, and `exportVisible`.
- `app/src/lib/phase-77j-menu-plan-export.ts` builds client-facing export payloads and excludes internal fields.
- `GET /api/clients/[id]/menu-plans/export` exports only eligible active and visible plans through the MANU app route with `export_client` capability and `Cache-Control: no-store`.

Required product direction:

- Make the Menu area a first-class panel with template selection, active-plan status, conflict state, save/activate actions, and export controls.
- Keep all four formats visible and understandable to the dietitian.
- Preserve active-menu conflict checks and legacy summary lock.
- Preserve export eligibility: active plan plus `exportVisible`.
- Preserve app-internal export only; no public/mock download path.

### 4. AI Asistan Kontrolu

Current system:

- Client AI fields live on `ClientRecord`: `selectedPersonaId`, `aiStatus`, `aiMode`, `aiActiveFrom`, `aiActiveUntil`, `mandatorySafetyComplete`, `safetyChecklist`, `humanTakeoverLocked`, red risk lock, and yellow hold.
- Personas come from `dietitian-ai-assistant/src/personas.js`: balanced coach, warm supporter, disciplined tracker, minimal reply, motivational partner, and clinical formal.
- `app/src/lib/safety-checklist.ts` defines required safety checklist items.
- `dietitian-ai-assistant/src/ai-activation.js` resolves active/passive/scheduled/expired activation windows.
- `dietitian-ai-assistant/src/inbound-preflight.js` blocks AI when permission, channel identity, adult status, human takeover, red lock, or autopilot safety requirements are missing.
- `app/src/lib/simulator.ts` treats AI control fields as prompt-affecting, increments context revision, and invalidates pending drafts. Red-risk reactivation is blocked unless the dedicated reactivation path is used.
- `PATCH /api/clients/[id]` is the current AI-control patch route and is capability-gated.

Required product direction:

- Move AI controls out of the generic overview feel and into a dedicated client control module.
- Make AI active/passive, mode, persona, activation window, human takeover, safety checklist, and preflight blockers visible together.
- Represent autopilot readiness as a gate, not a simple toggle.
- Keep red/yellow lock semantics and reactivation restrictions unchanged.
- Preserve draft invalidation and context revision behavior on prompt-affecting changes.

## Target Information Architecture

The selected-client workspace should have one persistent client header and four primary modules.

Header:

- Client identity, channel, language, lifecycle, permission status.
- AI status/mode/persona badges.
- Safety/autopilot readiness.
- Active nutrition profile status.
- Active menu/export status.
- Risk locks and human takeover status.

Primary modules:

1. `Danisan Formu`
   - Full schema response editor.
   - Required/autopilot-required field status.
   - Prompt-visible vs dietitian-only cues.
   - Save through existing form response path.

2. `Aktif Beslenme Plani`
   - Catalog tree and search.
   - Allowed/forbidden selections.
   - Food groups, diet type restrictions, flexibilities.
   - Conflict review and save.

3. `Menu`
   - Four template workflow.
   - Draft/active/archived state.
   - Meal-slot editor.
   - Activation checks.
   - MANU-only DOCX/PDF export when eligible.

4. `AI Asistan Kontrolu`
   - Persona selection.
   - Active/passive and mode control.
   - Activation schedule.
   - Safety checklist and blockers.
   - Human takeover and lock status.

Supporting information such as critical context, export, and scoped copilot can remain available, but the four service-critical modules must become the main organizing structure.

## Stage 4A Implementation Modules

### Stage 4A.1: Danisan Formu Paneli

Status: **Implemented 2026-07-08.**

Goal: replace the partial personal-form editor with a full active-schema response editor inside the danisan kontrol paneli.

Delivered:

- `app/src/components/dashboard/client-form-panel.tsx` renders the active Phase 77C schema section-by-section inside the client `tab_personal_form` workspace.
- `app/src/lib/client-form-panel-helpers.ts` groups sections, maps prompt-access cues, tracks autopilot-required missing fields, and normalizes save payloads.
- `app/src/components/dashboard/clients-panel.tsx` replaces the partial profile/channel editor with the full schema editor and shows autopilot missing counts on the tab badge.
- Save uses the existing `POST /api/clients/forms` path via dashboard `saveFormResponse`, preserving client sync, food-rule bridge sync, context revision updates, and draft invalidation.

Verification (2026-07-08): `npm run lint` 0 errors (3 pre-existing warnings), targeted helper tests 5/5, full app suite 117 files passed, `npm run build` passed, Playwright visual 36/36, `git diff --check` clean. No hosted deploy. Production pilot remains `NO-GO`; R-405 open; R-406 current local Supabase/RLS re-run pending.

Expected files:

- `app/src/components/dashboard/clients-panel.tsx`
- New focused client-form editor component under `app/src/components/dashboard/`
- Possible small helpers in `app/src/lib/` only if needed
- Targeted tests around save behavior and UI contracts

### Stage 4A.2: Aktif Beslenme Plani

Status: **Implemented 2026-07-08.**

Goal: upgrade food rules into a dense active nutrition plan workspace with main/subcategory/food checkbox selection.

Delivered:

- `app/src/components/food-rules-panel.tsx` rebranded and upgraded as **Aktif Beslenme Plani** with selection summary, conflict review, and save hard-block on `food_allowed_and_forbidden` / `group_allowed_and_forbidden`.
- `app/src/components/dashboard/catalog-tree-browser.tsx` adds dense main/sub/food Izinli/Yasak toggles across the Phase 77D catalog.
- `app/src/lib/active-nutrition-plan-helpers.ts` normalizes hierarchical catalog selection, inheritance resolution, tree filtering, and hard-conflict detection helpers.
- `app/src/components/dashboard/active-nutrition-plan-panel.tsx` wires the upgraded panel into the danisan kontrol paneli tab.
- Save continues through `/api/clients/[id]/food-rule-profile` with existing revision and capability rules; Food Decision Engine V2 unchanged.

Verification (2026-07-08): `npm run lint` 0 errors (3 pre-existing warnings), targeted helper tests 5/5, full app suite 726 passed / 4 skipped, `npm run build` passed, Playwright visual 36/36, `git diff --check` clean. No hosted deploy. Production pilot remains `NO-GO`; R-405 open; R-406 current local Supabase/RLS re-run pending.

Expected files:

- `app/src/components/food-rules-panel.tsx`
- Possible catalog tree helper/component
- Existing food-rule profile lib/routes preserved
- Targeted tests for selection normalization/conflict UX helpers

### Stage 4A.3: Menu

Status: **Implemented 2026-07-08.**

Goal: polish menu creation/edit/activation/export around the four existing template types.

Delivered:

- `app/src/components/menu-plan-panel.tsx` rebranded as the **Menu** workflow panel with four template picker cards, Turkish template labels/descriptions, plan status badges (Taslak/Aktif/Arsiv), conflict display, and activation hard-block on `menu_item_forbidden_food` / `menu_item_forbidden_category` / `menu_item_forbidden_group`.
- `app/src/lib/menu-workflow-panel-helpers.ts` adds template/status labels, export eligibility, hard-conflict detection, and workflow summary helpers.
- `app/src/components/dashboard/menu-workflow-export-section.tsx` integrates MANU-only DOCX/PDF export via `/api/clients/[id]/menu-plans/export` when the active plan is eligible (`exportVisible` + active status).
- `app/src/components/dashboard/menu-workflow-panel.tsx` wires the upgraded panel into the danisan kontrol paneli tab.
- Create/save/activate continue through existing menu plan routes; legacy `client.dietPlan.summary` lock and food-rule conflict checks on activation are unchanged.

Verification (2026-07-08): `npm run lint` 0 errors (3 pre-existing warnings), targeted helper tests 4/4, full app suite 730 passed / 4 skipped, `npm run build` passed, Playwright visual 36/36, `git diff --check` clean. No hosted deploy. Production pilot remains `NO-GO`; R-405 open; R-406 current local Supabase/RLS re-run pending.

Expected files:

- `app/src/components/menu-plan-panel.tsx`
- `app/src/components/dashboard/clients-panel.tsx`
- Existing menu plan/export routes preserved
- Targeted tests for UI helper behavior and export eligibility display

### Stage 4A.4: AI Asistan Kontrolu

Status: **Implemented 2026-07-08.**

Goal: create a dedicated safe activation console for per-client AI behavior.

Delivered:

- `app/src/components/dashboard/ai-assistant-control-panel.tsx` adds the **AI Asistan Kontrolu** workspace with persona, status/mode, activation window, safety checklist, autopilot readiness gate, lock status, and preflight blockers in one panel.
- `app/src/lib/ai-assistant-control-panel-helpers.ts` summarizes activation window state, autopilot qualification, inbound preflight blockers, channel rollback blocks, and red/yellow lock visibility using existing core/simulator contracts.
- `app/src/components/dashboard/clients-panel.tsx` adds `tab_ai_assistant`, moves AI controls out of overview into the dedicated tab, and keeps a compact AI summary card on overview with navigation into the control panel.
- Patch/save continues through existing `PATCH /api/clients/[id]` / dashboard `onUpdateClient`; red-risk reactivation restrictions, draft invalidation, and preflight semantics unchanged.

Verification (2026-07-08): `npm run lint` 0 errors (3 pre-existing warnings), targeted helper tests 4/4, full app suite 734 passed / 4 skipped, `npm run build` passed, Playwright visual 36/36, `git diff --check` clean. No hosted deploy. Production pilot remains `NO-GO`; R-405 open; R-406 current local Supabase/RLS re-run pending.

Expected files:

- `app/src/components/dashboard/clients-panel.tsx`
- Possible focused AI-control component under `app/src/components/dashboard/`
- Existing simulator/auth/preflight logic preserved
- Targeted tests for readiness/blocker display helpers

## Verification Plan For Each Implementation Phase

Minimum local verification after each approved implementation phase:

- `npm run build`
- `npm run lint`
- Targeted Vitest files for changed helpers/components/contracts
- `npm run test:visual` when dashboard/mobile layout or responsive behavior changes
- `git diff --check`
- Secret/token scan using repository grep patterns

If a hosted sandbox deploy happens:

- PM2 online check
- `https://siriusai.store` HTTP 200
- Relevant route 200 checks
- Browser computed style/basic UI verification
- Hosted sandbox note added to Phase 84 commercial spec only when deployment occurs

## Acceptance Criteria For Stage 4A

- The danisan kontrol paneli scope is documented from actual code, not only handoff docs.
- The four required product modules are mapped to current domain models, APIs, and safety rules.
- Implementation is split into user-approved sub-phases; Stage 4A.1 through Stage 4A.4 are complete; Stage 4A Danisan Kontrol Paneli is closed.
- Stage 4A.1/4A.2/4A.3/4A.4 changed dashboard client-form, active-nutrition, menu workflow, and AI assistant control UI only; backend form/food-rule/menu/AI patch contracts and clinical safety paths are unchanged.
- Production pilot remains `NO-GO`; R-405 was open at that checkpoint; R-406 remains pending when local Supabase is unavailable.

## Stage 4B Integration Addendum - 2026-07-11

Stage 4B is now decision-complete in `docs/PHASE_85_STAGE_4B_UYARI_VE_BILDIRIMLER_ACTION_PLAN.md`. Its red-alert lifecycle reuses Stage 4A's atomic `/api/clients/[id]/activate-ai` path. During Stage 4B implementation, red lock must continue to disable AI mode/persona/schedule configuration but must not disable the direct activation command. Successful activation is the complete red-alert closure action; no separate handoff-resolution UI or free-text closure reason is permitted.

Stage 4A remains closed. This addendum defines its integration contract with Stage 4B and does not reopen Stage 4A scope.

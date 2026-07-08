# Phase 85 Stage 4A: Client Control Panel Architecture Plan

Date: 2026-07-08
Status: Planning/spec complete; implementation pending explicit user approval.
Production pilot: NO-GO.
Clinical production GO: not in scope.
Deployment: none.

## Purpose

Stage 4A defines the code-grounded architecture and execution plan for the dietitian-facing client control panel. The priority is not a cosmetic dashboard pass; it is the quality of the actual service given to the dietitian for each client.

The panel must make four client-scoped workflows first-class:

1. Client form.
2. Active nutrition plan.
3. Menu.
4. AI assistant control.

Each workflow is treated as a large implementation phase. No implementation starts until the user approves the relevant phase plan.

## Non-Negotiable Boundaries

- Preserve Phase 83/84 auth, entitlement, invite, sandbox checkout, onboarding, admin, PWA, and service-worker behavior.
- Preserve all existing backend API contracts unless a later approved phase explicitly documents a compatible migration.
- Do not copy API routes from `public-website-redesign.zip`.
- Do not enable real WhatsApp, Telegram, Gemini/provider, live billing, monitoring, backup, secret-manager, or real health-data production paths.
- Keep Stripe in test/sandbox mode.
- Keep production pilot `NO-GO`.
- Keep R-405 open.
- Keep R-406/current local Supabase RLS re-run pending when local Supabase is unavailable.
- Use the Phase 85 palette and density direction: warm clinical SaaS, premium but operational, compact, readable, and scannable.
- Avoid heavy gradients, bright purple, pure black, blob/orb decoration, nested cards, and amateur dashboard composition.

## Code-Grounded Findings

### 1. Client Form

Current system:

- Active client form schema is the Phase 77C personal form v2 registry.
- `app/src/lib/phase-70-form-registry.ts` defines the active schema, required autopilot field ids, prompt visibility, section structure, and answerability metadata.
- `app/src/lib/client-forms.ts` owns schema creation/publish, response save, response validation, prompt summary generation, client field sync, food-rule bridge sync, and pending draft invalidation.
- `POST /api/clients/forms` persists form responses through fallback or Supabase store with `update_client` capability.
- Dashboard `ClientsPanel` currently has a personal-form tab, but it edits only a small subset of `ClientRecord` fields instead of rendering the full active schema response.

Required product direction:

- Move the real Phase 77C client form into the client control panel.
- Render the active published schema section-by-section.
- Load the latest response for the selected client and let the dietitian edit it.
- Preserve prompt-visible vs dietitian-only semantics.
- Show autopilot-required fields and missing status.
- Save through the existing form response route so client sync, food-rule bridge sync, context revision updates, and draft invalidation remain intact.

### 2. Active Nutrition Plan

Current system:

- `ClientFoodRuleProfileV2Record` is the canonical active nutrition rule profile.
- `app/src/lib/phase-77d-master-food-catalog.ts` loads the master food catalog with 12 main categories, 113 subcategories, and 518 foods.
- `app/src/lib/phase-77e-client-food-rule-profile.ts` owns food-rule profile derivation, migration, conflict detection, save validation, revision control, form-response bridging, and audit.
- `app/src/components/food-rules-panel.tsx` already supports catalog search, allowed/forbidden catalog foods, allowed/forbidden free-text foods, food groups, diet type restrictions, flexibility controls, and forbidden main-category checkboxes.
- The type model already supports main category, subcategory, and food id selections for both allowed and forbidden sides.

Required product direction:

- Upgrade this into an "Aktif Beslenme Plani" workspace inside the client control panel.
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

### 4. AI Assistant Control

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

## Implementation Phases Pending Approval

### DCP-1: Client Form Panel

Goal: replace the partial personal-form editor with a full active-schema response editor inside the client control panel.

Expected files:

- `app/src/components/dashboard/clients-panel.tsx`
- New focused client-form editor component under `app/src/components/dashboard/`
- Possible small helpers in `app/src/lib/` only if needed
- Targeted tests around save behavior and UI contracts

### DCP-2: Active Nutrition Plan Panel

Goal: upgrade food rules into a dense active nutrition plan workspace with main/subcategory/food checkbox selection.

Expected files:

- `app/src/components/food-rules-panel.tsx`
- Possible catalog tree helper/component
- Existing food-rule profile lib/routes preserved
- Targeted tests for selection normalization/conflict UX helpers

### DCP-3: Menu Workflow Panel

Goal: polish menu creation/edit/activation/export around the four existing template types.

Expected files:

- `app/src/components/menu-plan-panel.tsx`
- `app/src/components/dashboard/clients-panel.tsx`
- Existing menu plan/export routes preserved
- Targeted tests for UI helper behavior and export eligibility display

### DCP-4: AI Assistant Control Panel

Goal: create a dedicated safe activation console for per-client AI behavior.

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

- The client control panel scope is documented from actual code, not only handoff docs.
- The four required product modules are mapped to current domain models, APIs, and safety rules.
- Implementation is split into user-approved sub-phases.
- No runtime code changes are made in Stage 4A.
- Production pilot remains `NO-GO`; R-405 remains open; R-406 remains pending when local Supabase is unavailable.

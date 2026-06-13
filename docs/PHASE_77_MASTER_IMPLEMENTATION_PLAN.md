# Phase 77 Master Implementation Plan

Date: 2026-06-10
Status: Canonical detailed implementation plan for the manual source authority rebaseline.
Production pilot: NO-GO.

## Purpose

This document is the detailed execution plan for the MANU-AI product rebaseline requested after the Phase 76 food-rule track. It expands the shorter Phase 77A roadmap/spec into a full implementation plan.

The product direction is:

- The dietitian manually manages the client personal form, food rules, and menu plan.
- Chat must no longer mutate the personal form, food rules, or menu plan.
- AI answer quality must improve because the model receives cleaner, structured, manually approved source authority.
- The dietitian app must stay simple, usable, and non-technical even though the underlying model contains many safety and decision signals.
- WhatsApp production adapter work is deferred until the Phase 77B-77K manual source authority track is complete.

This document does not approve production launch, connect real WhatsApp/Gemini/provider paths, process real client health data, resolve R-405, or close any launch gate.

## Canonical Decisions

### Product Decisions

1. The dietitian is the only actor who can edit:
   - client personal form v2;
   - client food-rule profile;
   - client menu plan;
   - export-ready menu content.

2. AI/internal copilot can still:
   - summarize recent client status;
   - answer dietitian questions about the client using the database;
   - explain why a food decision was allowed, discouraged, forbidden, or escalated;
   - draft client-facing text when permitted by risk/source/decision guards.

3. AI/internal copilot must not:
   - update form fields from chat;
   - update food rules from chat;
   - update menu plan from chat;
   - silently change source authority;
   - infer clinical ground truth from AI-generated text.

4. WhatsApp-external client events are entered through a dedicated panel as Critical Context, not by a chat mutation command.

5. The user-supplied food list becomes a global master food catalog v1. Dietitians configure client-specific allowed/forbidden and flexibility rules against that catalog.

6. v1 out-of-catalog food understanding is deterministic only: exact match, alias match, normalized keyword match, food group match, and ingredient keyword match. LLM-based food classification remains future gated work.

7. Active menu becomes the primary plan authority. Legacy `client.dietPlan.summary` becomes a derived summary for backward compatibility and prompt compatibility, not an independent authority that can override an active menu.

8. Export output must support DOCX and PDF, with Turkish rendering verified before release.

### Decision Semantics

Food Decision V2 must return one of:

| Decision | Meaning | Client-facing eligibility |
| --- | --- | --- |
| `allow` | The request fits the client rules and flexibility context. | Green send/draft eligible. |
| `discourage` | The food is not forbidden but is not ideal for the active menu/flexibility/goal context. | Green send/draft eligible with soft guidance. |
| `forbid` | The food, group, ingredient, or diet-type conflicts with client restrictions. | Green rejection eligible; approval language blocked. |
| `needs_label` | Product/food may contain restricted ingredients and written ingredient text is needed. | Ask only for written ingredient text. |
| `needs_review` | The system cannot safely decide or the request touches sensitive/clinical territory. | No client-facing AI reply; internal review/handoff. |
| `not_applicable` | Food/menu engine does not apply. | Existing risk/answerability flow continues. |

Hard precedence:

1. Red/yellow clinical safety remains monotonic and cannot be downgraded.
2. Forbidden food/group/ingredient/diet-type conflict beats allowed status and menu content.
3. Active menu beats derived legacy diet plan summary.
4. Most restrictive flexibility wins: `restricted > moderate > flexible`.
5. Flexibility modifies a decision; it is not source authority by itself.
6. AI-generated text is never source authority.

## Source Authority Model

Approved source authority for client-facing AI decisions after Phase 77 must be:

- client personal form v2 fields marked prompt-allowed;
- active client food-rule profile;
- active menu plan;
- dietitian-authored Critical Context entries;
- pinned notes if still allowed by the existing source policy;
- dietitian manual messages only where existing answerability rules permit them;
- official regulation/corpus rules only after their own gates approve them.

Non-authoritative sources:

- AI-generated messages;
- stale rejected proposals;
- deprecated chat-to-form/chat-to-food proposal records;
- inactive menu versions;
- historical form snapshots except audit/export/history;
- user-uploaded food catalog drafts before QA approval.

## UX Principles

The dietitian app must not expose the dietitian to a technical rule engine. The target surfaces are:

- Personal Form: clear client profile sections, simple fields, autosave/revision status, no prompt-engine language.
- Food Rules: searchable catalog, allowed/forbidden toggles, group controls, flexibility controls, conflict warnings.
- Menu Plan: four practical templates, simple meal rows, optional recipe fields, export preview, version/publish status.
- Critical Context: quick entry for WhatsApp-external events and important updates.
- AI Copilot: read-only question answering about the client, recent status, food decision rationale, and drafts where allowed.

Avoid:

- exposing raw JSON;
- requiring dietitians to understand model prompts;
- making every metric visible by default;
- hiding safety blockers without explanation;
- allowing chat to become a second editing surface for structured source authority.

## Architecture Overview

The target architecture has five manual source layers feeding the AI decision pipeline:

1. Personal Client Form V2
2. Master Food Catalog V1
3. Client Food Rule Profile V2
4. Client Menu Plan V1
5. Critical Context / approved manual notes

The client message flow becomes:

1. Inbound message is classified by existing risk system.
2. Red/yellow remains internal-only.
3. Green/non-sensitive food/menu requests are evaluated by Food Decision V2.
4. Food Decision V2 returns a typed decision and evidence manifest.
5. PromptContext receives bounded source segments only.
6. Provider may be called only for eligible decisions.
7. Output guard enforces the decision, covenant, answerability, and safety constraints.
8. Send/draft/handoff follows existing permission graph and launch gates.

## Phase 77A: Manual Source Authority Rebaseline

Status: Completed on 2026-06-10.

Purpose:

- Rebaseline the roadmap before WhatsApp adapter work.
- Record manual source authority decisions.
- Define Phase 77B-77K order.
- Record Phase 76D-76O artifact disposition.

Scope:

- Documentation only.
- No runtime, schema, provider, channel, or launch-gate change.

Verification:

- `git diff --check`
- `npm run release:verify`

Done:

- Phase 77A spec exists.
- Continuity/evidence/risk docs reference the new order.
- Production pilot remains NO-GO.

## Phase 77B: Manual Source Boundary And Chat Mutation Removal

Status: Implemented locally on 2026-06-10 through `docs/PHASE_77B_MANUAL_SOURCE_BOUNDARY_SPEC.md`.

Goal:

Remove chat-based mutation for form, food rules, and future menu while preserving a read-only AI copilot and panel-only Critical Context updates.

PRD requirements:

- Dietitian can still ask the internal copilot about a client.
- Dietitian cannot update personal form, food rules, or menu by typing a chat instruction.
- Critical Context remains easy and quick but is entered through an explicit form/panel.
- Historical chat-to-update proposal records remain readable/exportable/redactable but deprecated.

Technical scope:

- Disable creation/apply paths for chat-to-form and chat-to-food proposal flows.
- Preserve historical proposal data for audit and lifecycle.
- Add explicit deprecated state and UI copy for old proposal artifacts.
- Ensure internal copilot routes are read-only.
- Ensure API routes cannot mutate protected manual source authorities through chat payloads.
- Add tests proving chat cannot mutate form/food/menu sources.
- Keep existing manual message entry behavior where it is only a message, not a source-authority mutation.

Data and lifecycle:

- No destructive deletion of historical proposals.
- Exports must include deprecated proposal history where existing policy requires it.
- Removed-client redaction must continue to cover proposal history.

Tests:

- API tests for blocked mutation.
- UI/state tests for no proposal creation/apply controls.
- Regression tests for read-only copilot still answering.
- Lifecycle/export tests if any proposal serialization changes.

Docs:

- PRD/tech spec for Phase 77B.
- Update handoff, direct plan, next phase plan, README/app README, evidence pack, gate dossier, final readiness summary, risk register.

Done criteria:

- No chat path can update form, food profile, or menu source authority.
- Critical Context is still panel-only.
- Release verification passes.
- Commit is created.

## Phase 77C: Client Personal Form V2

Status: Implemented locally on 2026-06-10 through `docs/PHASE_77C_CLIENT_PERSONAL_FORM_V2_SPEC.md`.

Goal:

Implement the new client personal form model after the user supplies final form content.

Input dependency:

- The user must provide the final form fields, sections, labels, required/optional status, and any clinical/safety constraints.

PRD requirements:

- Dietitian-facing form must be simple, sectioned, and quick to complete.
- Fields needed for AI answer quality must exist but must not feel technical.
- Each field must have prompt visibility rules.
- Some fields may be internal-only, export-only, or prompt-allowed.
- Form versioning must preserve old snapshots.

Technical scope:

- Define Personal Form V2 schema.
- Implement form schema versioning.
- Add fallback store model updates.
- Add Supabase migration/RLS plan if persistent model changes are required.
- Implement API read/write with tenant isolation.
- Implement optimistic revision/concurrency protection.
- Implement UI editor with validation and unsaved/error states.
- Add export/redaction handling.
- Add prompt segment builder for prompt-allowed fields only.

Potential field categories:

- identity and demographics;
- goal: weight loss, weight gain, maintenance, clinical support, sports/performance;
- diet flexibility global value;
- meal-specific flexibility;
- goal-specific flexibility;
- food-group flexibility;
- allergies/intolerances;
- dietary patterns;
- medical/safety flags;
- lifestyle and schedule;
- preferences and dislikes;
- measurement/tracking preferences;
- dietitian notes and client-facing notes.

Tests:

- Schema validation.
- Prompt visibility filtering.
- Tenant isolation.
- Concurrency/stale revision.
- Export/redaction.
- UI form save and validation.
- Regression tests that chat cannot mutate the form.

Done criteria:

- User-approved form structure is implemented.
- Existing client form functionality has a migration/compatibility path.
- Release verification passes.
- Commit is created.

## Phase 77D: Master Food Catalog V1

Status: Implemented locally on 2026-06-10 through `docs/PHASE_77D_MASTER_FOOD_CATALOG_SPEC.md`.

Goal:

Ingest and QA the user-supplied comprehensive food list as a global versioned master catalog, then expose main-category, subcategory, and food-level forbidden checkbox controls for dietitian use.

Input dependency:

- Completed: user supplied `C:\Users\Dell\Downloads\manual.xlsx`.
- Completed: only the `Besin Veritabani` sheet is in scope for Phase 77D.

PRD requirements:

- Catalog should be understandable by dietitians as a three-level hierarchy: main category, subcategory, food.
- Dietitian can mark an entire main category forbidden.
- Dietitian can mark an entire subcategory forbidden.
- Dietitian can mark a single food forbidden.
- Parent selections expand to all child foods for existing Phase 76 food-rule runtime compatibility.
- Raw selected catalog ids are preserved as source provenance.
- Catalog must be versioned and QA checked before it becomes active.

Technical scope:

- Define catalog file format and ingestion rules for the supplied workbook shape.
- Add catalog QA validation and checksum/version metadata.
- Normalize names and Turkish characters for stable ids and exact lookup.
- Model:
  - main category id and display name;
  - subcategory id and display name;
  - food id and display name;
  - source/version metadata.
- Add deterministic helper coverage:
  - hierarchy validation;
  - exact normalized name lookup;
  - forbidden selection normalization;
  - main category expansion;
  - subcategory expansion;
  - single-food expansion;
  - overlap dedupe;
  - stale expanded-name removal from manual token fields.
- Add dashboard controls under the existing food-rule panel.
- Keep global catalog read-only for dietitian users in v1.

Persistence:

- Prefer repo-versioned catalog v1 with checksum for initial implementation.
- Future Supabase system table is a separate gated phase if needed.

Tests:

- Catalog QA.
- Duplicate detection.
- Exact lookup.
- Turkish normalization.
- No cross-tenant client state in global catalog.
- Main-category, subcategory, and food-level expansion.
- Runtime compatibility path through existing forbidden food answers.

Done criteria:

- Catalog can be ingested and QA accepted.
- Food hierarchy selection foundation exists.
- Release verification passes.
- Commit is created.

## Phase 77E: Client Food Rule Profile V2

Status: Implemented locally on 2026-06-10 through `docs/PHASE_77E_CLIENT_FOOD_RULE_PROFILE_V2_SPEC.md`.

Goal:

Allow dietitians to configure client-specific allowed/forbidden rules and flexibility against the master catalog.

PRD requirements:

- Dietitian can mark foods as allowed or forbidden.
- Dietitian can mark food groups as allowed or forbidden.
- Dietitian can set flexibility at:
  - global level;
  - meal level;
  - goal level;
  - food group level.
- Flexibility values are:
  - restricted;
  - moderate;
  - flexible.
- UI must stay practical and searchable, not technical.

Technical scope:

- Add Client Food Rule Profile V2 model.
- Include:
  - allowed food ids;
  - forbidden food ids;
  - allowed groups;
  - forbidden groups;
  - forbidden ingredient keywords;
  - diet-type restrictions;
  - flexibility map;
  - notes/reason fields where useful;
  - status/version/revision;
  - created/updated/published metadata.
- Implement fallback store, Supabase migration, API, RLS, export/redaction.
- Add first-edit copy/adaptation from Phase 76D fields if needed.
- Deprecate old technical food-rule UI.
- Add conflict detection:
  - food allowed but group forbidden;
  - menu item contains forbidden ingredient;
  - flexible meal but forbidden food;
  - diet-type conflict.

Tests:

- Rule profile CRUD.
- Tenant isolation.
- Conflict detection.
- Flexibility precedence.
- Export/redaction.
- Chat mutation blocked.
- Migration/compatibility tests.

Done criteria:

- Dietitian can manage client food rules manually.
- Food Rule Profile V2 becomes source authority.
- Release verification passes.
- Commit is created.

## Phase 77F: Menu Plan V1 With Four Templates

Goal:

Implement a client-specific menu plan system with four dietitian-facing templates and export-ready content.

PRD requirements:

Dietitians need different menu styles depending on client and workflow:

1. Day-by-day detailed plan:
   - each day;
   - each meal;
   - specific foods/portions;
   - optional recipes.

2. Weekly meal framework:
   - weekly meal targets;
   - flexible options per meal;
   - less strict day assignment.

3. Exchange/option based plan:
   - meal slots;
   - allowed alternatives;
   - portion/exchange guidance.

4. Simple guidance plan:
   - high-level meal structure;
   - preferred/avoid lists;
   - lightweight recipes or notes.

Technical scope:

- Add Menu Plan V1 model.
- Fields:
  - template type;
  - status: draft/active/archived;
  - effective date;
  - meal slots;
  - food references to catalog where possible;
  - free-text meal item with deterministic catalog matching metadata;
  - recipe title/ingredients/instructions;
  - dietitian notes;
  - client-facing notes;
  - export visibility;
  - revision/version.
- Implement active menu selection.
- Generate derived `client.dietPlan.summary` from active menu for legacy compatibility.
- Add menu-food-rule conflict detection.
- Add fallback store, Supabase migration, API, RLS, export/redaction.
- Ensure old diet plan summary cannot override active menu.

UX:

- Template selector.
- Meal grid/list editor.
- Recipe editor.
- Conflict badges.
- Publish/activate action.
- Export preview state.

Tests:

- CRUD/versioning.
- Active menu precedence.
- Derived legacy summary generation.
- Conflict detection against food profile.
- Export/redaction.
- UI editor flows.
- Tenant isolation.

Done criteria:

- Dietitian can create and activate one of four menu templates.
- Active menu is primary plan authority.
- Release verification passes.
- Commit is created.

## Phase 77G: Food Decision Engine V2 And Phase 68 Recalibration

Goal:

Build Food Decision Engine V2 so client food/menu questions can be answered or escalated using personal form, food catalog, food profile, menu, and flexibility.

PRD requirements:

- If a client asks to eat a food:
  - forbidden food/group/ingredient returns `forbid`;
  - allowed food with sufficient flexibility returns `allow`;
  - non-forbidden off-menu food with restricted/moderate flexibility may return `discourage`;
  - product/unknown ingredient risk returns `needs_label`;
  - sensitive/clinical context returns `needs_review`.

- If the food is not in the menu but fits the rules:
  - AI may allow or discourage depending on flexibility and goal.

- If the food is not in the catalog:
  - v1 deterministic matching only;
  - no LLM food classification;
  - uncertain match fails to `needs_review` or `needs_label`.

Technical scope:

- Implement Food Decision V2 input contract:
  - client message;
  - risk classification;
  - personal form v2 fields;
  - active food profile;
  - active menu;
  - catalog match candidates;
  - product ingredient evidence;
  - conversation context where allowed.
- Implement output contract:
  - decision;
  - reason codes;
  - evidence manifest;
  - source references;
  - blocked phrases/guard requirements;
  - provider eligibility.
- Recalibrate Phase 68:
  - separate blocked sensitive active-plan conflicts from safe food/menu flexibility conflicts;
  - let safe food/menu conflicts reach Food Decision V2.
- Reuse Phase 76H ingredient verification.
- Replace/adapt Phase 76E engine through a V2 wrapper.

Decision examples:

- "Kahvaltida yumurta yerine peynir yiyebilir miyim?"
  - check menu;
  - check forbidden dairy;
  - check meal flexibility;
  - return allow/discourage/forbid.

- "Bir tane cikolata yiyebilir miyim?"
  - check goal/flexibility;
  - check dairy/milk ingredient risk;
  - if product ingredient unknown, ask for written ingredients or review.

- "Bugun diyeti bozup hamburger yiyebilir miyim?"
  - check flexibility;
  - check forbidden ingredients/groups;
  - likely discourage or forbid depending rules.

Tests:

- Golden decision matrix.
- Forbidden beats allowed/menu.
- Flexibility precedence.
- Goal-specific behavior: weight loss, weight gain, maintenance.
- Product ingredient label paths.
- Out-of-catalog deterministic behavior.
- Mixed-intent fail-closed.
- Phase 68 active-plan conflict recalibration.

Done criteria:

- Food Decision V2 can safely classify common green food/menu questions.
- Sensitive cases still route yellow/red/internal.
- Release verification passes.
- Commit is created.

## Phase 77H: PromptContext, Answerability, Permission Graph, And Output Guard V2

Goal:

Adapt the AI pipeline to use Food Decision V2 and manual source authority without leaking raw data or allowing provider output to contradict decisions.

Technical scope:

- Adapt PromptContext bounded segments:
  - personal form summary;
  - food decision evidence;
  - menu authority;
  - flexibility modifier;
  - ingredient evidence;
  - source manifest.
- Adapt answerability:
  - food profile/menu/catalog are approved sources;
  - flexibility is a modifier;
  - AI-generated messages are not sources;
  - deprecated proposal records are not sources.
- Adapt permission graph:
  - map Food Decision V2 to send/draft/handoff.
- Adapt output guard:
  - `forbid` cannot produce approval;
  - `discourage` cannot become strong approval;
  - `needs_label` cannot answer the food as allowed;
  - `needs_review` cannot call provider for a client-facing reply;
  - covenant remains enforced.
- Adapt clinical second-layer:
  - allergies, symptoms, pregnancy/minor/eating-disorder contexts, lab/medication/supplement remain protected.

Tests:

- Prompt segment allowlist.
- No raw label leakage into manifest.
- Provider eligibility matrix.
- Output guard contradiction tests.
- Covenant tests.
- Permission graph routing tests.
- Regression for non-food green flows.

Done criteria:

- Provider can only style an already-permitted decision.
- Output cannot override structured source authority.
- Release verification passes.
- Commit is created.

## Phase 77I: Simplified Dietitian UX

Goal:

Make the dietitian app practical for real users while preserving the underlying safety architecture.

UX scope:

- Client profile page organized into:
  - Overview;
  - Personal Form;
  - Food Rules;
  - Menu;
  - Critical Context;
  - AI Copilot;
  - Export.
- Replace technical rule surfaces with plain language controls.
- Use progressive disclosure:
  - default simple controls;
  - advanced details hidden behind "details" or review views.
- Show clear conflict explanations:
  - "This food is forbidden for this client";
  - "This meal is restricted";
  - "This product may contain milk; ask for written ingredients";
  - avoid model/prompt jargon.
- Add empty/loading/error states.
- Ensure mobile/tablet usability where applicable.

Technical scope:

- Update dashboard navigation and client detail layout.
- Add form/food/menu status summaries.
- Add conflict review panels.
- Add read-only AI decision rationale display where useful.
- Ensure no nested card-heavy clutter.

Tests:

- Component tests.
- API integration tests for UI flows.
- Visual smoke if existing tooling supports it.
- Accessibility basics for labels/buttons/errors.

Done criteria:

- Dietitian can complete core workflows without using chat mutation.
- UX is clear and non-technical.
- Release verification passes.
- Commit is created.

## Phase 77J: DOCX/PDF Export And Data Lifecycle V1.2

Goal:

Enable dietitians to download client-specific menu plans as DOCX and PDF, and extend lifecycle/export/redaction coverage.

PRD requirements:

- Export active menu as DOCX.
- Export active menu as PDF.
- Include optional recipes where selected.
- Include client-facing notes, not internal-only safety details.
- Turkish characters render correctly.
- No sensitive internal metadata leaks.

Technical scope:

- Audit export dependency options.
- Do not weaken production audit allowlist.
- Generate export binaries in memory.
- Do not commit generated exports.
- Add template rendering for all four menu types.
- Add export preview or summary.
- Add data inventory/lifecycle update.
- Extend DSAR/export/redaction to:
  - personal form v2;
  - food rule profile v2;
  - menu plan v1;
  - deprecated proposal history;
  - catalog version references.

Tests:

- DOCX generation.
- PDF generation.
- Turkish text rendering.
- No internal-only fields in client export.
- Removed-client redaction.
- Dependency audit remains acceptable.
- Release verification.

Done criteria:

- Export is usable for dietitian/client delivery.
- Lifecycle v1.2 coverage is documented and tested.
- Release verification passes.
- Commit is created.

## Phase 77K: Calibration, 100x50 Rehearsal, And Evidence Closure

Goal:

Close the manual source authority track with calibration, synthetic scale rehearsal, evidence updates, and final readiness status.

Technical scope:

- Regenerate golden cases for:
  - allowed food;
  - forbidden food;
  - forbidden group;
  - forbidden ingredient;
  - menu substitution;
  - off-menu but allowed;
  - off-menu discouraged;
  - out-of-catalog uncertain;
  - product label needs written ingredients;
  - weight loss flexibility;
  - weight gain flexibility;
  - mixed clinical intent;
  - allergy/acute ingestion;
  - pregnancy/minor/eating disorder contexts.
- Run 100 dietitian x 50 client synthetic rehearsal with menu/food/form diversity.
- Track:
  - unsafe green count;
  - inappropriate approval count;
  - forbidden-food approval count;
  - needs_label correctness;
  - needs_review correctness;
  - false-yellow/false-review rate;
  - source manifest completeness;
  - export coverage.
- Update evidence/gate/risk docs.
- Confirm WhatsApp adapter can become next only after this track closes.

Tests:

- Full release verification.
- Targeted food decision golden suite.
- Scale rehearsal.
- Lifecycle/export tests.
- RLS tests if local Supabase is available.

Done criteria:

- Phase 77B-77J implementation evidence is complete.
- Food Decision V2 is calibrated enough for local prototype readiness.
- Production pilot remains NO-GO unless external gates separately close.
- WhatsApp adapter can be reintroduced as the next implementation track.
- Commit is created.

## Cross-Phase Engineering Rules

Every Phase 77B-77K phase must:

- start with its own PRD/tech spec;
- keep scope limited to that phase;
- avoid unrelated refactors;
- preserve user changes;
- include fallback state and Supabase persistence when adding models;
- include migration/RLS/export/redaction considerations in the same phase as the model;
- update continuity and evidence docs;
- run `git diff --check`;
- run `npm run release:verify`;
- commit only that phase's files;
- keep production pilot NO-GO unless explicit launch gates close.

## Risk Register Requirements

The following risk families must be tracked through Phase 77:

- chat mutation accidentally remains active;
- personal form v2 fields are too complex for dietitians;
- food catalog has wrong aliases/groups/ingredients;
- food group and exchange group are conflated;
- menu conflicts with forbidden foods;
- out-of-catalog deterministic match produces false confidence;
- provider output contradicts Food Decision V2;
- DOCX/PDF export leaks internal-only fields;
- Turkish PDF rendering fails;
- deprecated proposal history is accidentally treated as source authority;
- RLS/export/redaction misses new models;
- R-405 remains unresolved.

## Open Product Inputs Needed From User

Before implementation can complete:

1. Client food-rule profile v2 details beyond forbidden hierarchy, including allowed semantics and food-group flexibility UX.
2. Menu template details and export layout preferences.
3. Any brand/style requirements for DOCX/PDF output.
4. Any future catalog metadata beyond the supplied workbook hierarchy:
   - groups;
   - aliases;
   - ingredient keywords;
   - exchange groups if available;
   - allergen/diet-type tags if available.

## Current Final State After Phase 77L

- Detailed master plan exists in this document.
- Phase 77A short roadmap/spec exists separately.
- Phase 77C client personal form v2 is loaded locally in the dynamic form registry.
- Phase 77D master food catalog hierarchy is loaded locally from the user-supplied `Besin Veritabani` sheet.
- Phase 77E Client Food Rule Profile V2 is the manual source authority for food rules with API, Supabase persistence, export/redaction, and simplified dashboard UI.
- Phase 77F Menu Plan V1 is the primary plan authority with four templates, active-menu selection, food-profile conflict detection, derived legacy `dietPlan.summary`, API/Supabase persistence, `MenuPlanPanel` dashboard UI, export/redaction, and direct summary patch lock.
- Phase 77G Food Decision Engine V2 classifies green food/menu questions using profile V2, active menu, catalog matching, flexibility precedence, and Phase 76H product verification, with Phase 68 recalibration and legacy 76E fallback. Mixed/clinical early-exit paths now include `food_profile_v2` source references when a profile is present.
- Phase 77H PromptContext/answerability/output guard V2 binds provider styling to Food Decision V2 through bounded prompt segments, source-backed answerability, contradiction output guard, and permission-graph routing metadata.
- Phase 77I Simplified Dietitian UX restructures the client detail into seven tabs (Overview, Personal Form, Food Rules, Menu, Critical Context, AI Copilot, Export) with status summaries, conflict review, progressive disclosure, empty/error states, and i18n across all seven supported languages. FoodRulesPanel and MenuPlanPanel moved from Forms view to dedicated client detail tabs.
- Phase 77J DOCX/PDF export generates client-facing menu documents (DOCX/PDF) from active export-visible menu plans, strips internal fields (`dietitianNotes`, catalog checksums, revision metadata), supports optional recipe inclusion, exposes `GET /api/clients/[id]/menu-plans/export`, and wires Export tab preview/download controls. Phase 74 export is bumped to `phase74-export-v1.2` with `personal_form_v2.json`, `catalog_version_refs.json`, and deprecated proposal export sections.
- Phase 77K closes the manual source authority track with Food Decision V2 golden calibration (`food-decision-v2-golden-cases.jsonl`, 14 categories), deterministic 100x50 V2 rehearsal (`phase-77k-food-mix-rehearsal.ts`, `unsafe_green_count = 0`), Phase 76O integration checks, export coverage verification for `phase74-export-v1.2`, and operational-health closure signals (`manualSourceAuthorityTrackClosed`, `whatsappAdapterNext`).
- Phase 77L reconciles continuity and evidence documentation to the Phase 77K baseline, preserves the historical Phase 76E spec, records the `agent.md` -> `codex.md` project-rule filename migration, stabilizes local verification without reducing coverage, and closes the dirty Phase 77E-77K worktree into a clean continuation point. `git diff --check`, app `npm test`, and `npm run release:verify` passed on 2026-06-13.
- Phase 77M closes the AI Quality Program master rebaseline and spec through `docs/PHASE_77M_MASTER_REBASELINE_AND_SPEC.md` and `docs/PHASE_77M_77Y_AI_QUALITY_MASTER_PLAN.md`. It locks core-owned `responsePlan`, deterministic templates, manifest-first grounding, fail-closed unknown-intent handling, and `normalize-safety-text.js` as the single normalization source to extend. `git diff --check`, app `npm test`, and `npm run release:verify` passed on 2026-06-13.
- Providers/channels remain disconnected.
- Production pilot remains NO-GO.
- Next implementation phase is Phase 77N Canonical Intent Understanding V2; WhatsApp production adapter remains deferred until Phase 77M-77Y is complete.

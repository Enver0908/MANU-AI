# Phase 77A: Manual Source Authority Rebaseline

Date: 2026-06-10

## Goal

Rebaseline the MANU-AI roadmap before WhatsApp production adapter work so AI client replies are governed by dietitian-managed manual source authorities:

- Client personal form v2
- Global master food catalog supplied by the user
- Client-level allowed/forbidden food rule profile
- Client menu plan with four dietitian-facing templates

This phase is documentation and continuity only. It does not implement runtime behavior, schema, provider, channel, launch-gate approval, real-data handling, or R-405 remediation.

## Product Decisions

- Dietitians must not feel they are operating a rule engine. The app should expose simple client-planning surfaces: personal form, food rules, menu, and exports.
- Chat-based form/food-rule/menu mutation will be removed in the downstream track. The internal copilot remains read-only for questions about client state, recent status, form responses, decisions, and handoffs.
- WhatsApp-external client events remain panel-only Critical Context entries. No new chat command will mutate client context in this rebaseline.
- The food list supplied by the user becomes a global master catalog in v1. Dietitians configure client-level allowed/forbidden status and flexibility against that catalog.
- v1 out-of-catalog inference is deterministic only: alias, food-group, and ingredient-keyword matching with confidence thresholds. LLM-based classification remains out of scope until provider/legal/privacy gates close.
- `needs_label` means asking for written ingredient text only. Photo, image, PDF, voice, and label-image interpretation remain unsupported.
- Active menu becomes the primary plan authority. `client.dietPlan.summary` remains as a derived legacy summary, not an independent source that can override an active menu.

## Decision Semantics

The downstream Food Decision V2 contract will use:

| Decision | Client-facing behavior | Provider behavior |
| --- | --- | --- |
| `allow` | Green approval is eligible. | Provider may generate style/persona text. |
| `discourage` | Green reply advises staying close to plan. | Provider may generate style/persona text but cannot approve strongly. |
| `forbid` | Green rejection is eligible. | Provider may explain that this does not fit the plan; approval language is blocked. |
| `needs_label` | Ask for written ingredient text only. | Provider may ask for text ingredients; no clinical or product advice. |
| `needs_review` | No client-facing AI reply. | Provider is not called; internal handoff/draft path. |
| `not_applicable` | Food/menu engine does not apply. | Existing risk/answerability flow continues. |

Source precedence:

1. Red/yellow clinical safety decisions remain monotonic and cannot be downgraded.
2. Forbidden food, forbidden group, forbidden ingredient, and diet-type conflict beat allowed status and menu content.
3. Active menu beats the derived legacy `dietPlan.summary`.
4. If flexibility rules conflict, the most restrictive value wins: `restricted > moderate > flexible`.
5. Flexibility is a decision modifier, not an answerability source.

## Phase 68 Recalibration Requirement

The existing Phase 68 green intent taxonomy blocks active-plan conflict before the food-rule engine can produce a `discourage` decision. The downstream implementation must split active-plan conflicts into:

- blocked sensitive conflicts: calorie, macro, portion target changes, medical/clinical contexts, medication, supplement, lab, symptom, pregnancy/minor/eating-disorder contexts;
- safe food/menu flexibility conflicts: catalog-backed, non-clinical food requests that may proceed to Food Decision V2 and return `allow`, `discourage`, `forbid`, `needs_label`, or `needs_review`.

Without this recalibration, Food Decision V2 would be unreachable for key client substitution and off-menu food questions.

## 76D-76O Artifact Disposition

| Artifact | Disposition |
| --- | --- |
| Phase 76D structured food-rule form fields | Adapt through lazy-read and first-edit copy into Client Food Rule Profile V2. Immutable old form snapshots remain historical. |
| Phase 76E food-rule engine | Replace with V2 wrapper and decision mapping. |
| Phase 76F intent-specific answerability | Adapt source categories to active menu, food profile, catalog match metadata, and keep flexibility as a modifier. |
| Phase 76G clinical second-layer carve-outs | Adapt to explicit Food Decision V2; severe allergy profiles, ingestion reactions, and acute markers remain yellow/red. |
| Phase 76H product ingredient verification | Keep and reuse; do not create a second ingredient-keyword system. |
| Phase 76I PromptContext/output guard | Adapt bounded segments and contradiction guards to V2 decisions. |
| Phase 76J dashboard food-rule management | Replace the technical food-rule UI with a simplified client food profile UI. |
| Phase 76K chat-to-food-rule proposals | Deprecate runtime creation/application; keep historical read/export/redaction. |
| Phase 76L permission graph bridge | Adapt food-rule maps to V2 decision families. |
| Phase 76M calibration metrics | Adapt metrics and golden categories to V2 decisions. |
| Phase 76N lifecycle/export/RPC coverage | Bump export lifecycle to v1.2; keep proposal RPC history immutable and deprecated. |
| Phase 76O food-mix rehearsal | Regenerate scenarios for catalog, menu, flexibility, and Food Decision V2. |

## Downstream Phase Map

- Phase 77B: remove chat mutation and lock manual context boundary.
- Phase 77C: implement Client Personal Form V2 after the user supplies final form fields.
- Phase 77D: ingest and QA the user-supplied master food catalog.
- Phase 77E: implement Client Food Rule Profile V2 with allowed/forbidden and flexibility controls.
- Phase 77F: implement Menu Plan V1 with four templates and derived legacy plan summary.
- Phase 77G: implement Food Decision Engine V2 and Phase 68 taxonomy recalibration.
- Phase 77H: adapt PromptContext, answerability, permission graph, clinical second-layer contract, and output guard.
- Phase 77I: simplify dietitian UX around personal form, food rules, menu, and exports.
- Phase 77J: add DOCX/PDF menu export and data lifecycle/export v1.2 coverage.
- Phase 77K: recalibrate metrics, regenerate 100x50 rehearsal, update evidence, and close the rebaseline track.

Each downstream phase must include its own PRD/tech spec, implementation, focused tests, continuity/evidence updates, `npm run release:verify`, and commit. Large uncommitted multi-phase work is not allowed.

## Data And Persistence Rules

- New persistent models must include fallback state, Supabase store mapping, migrations, RLS considerations, export/redaction coverage, and removed-client exclusions in the same phase that introduces the model.
- Phase 77A does not add migrations.
- RLS evidence narrative must track Phase 76N plus later Phase 77 migrations when local Supabase is unavailable.
- Global food catalog v1 is repo-versioned with checksum and QA evidence. A Supabase system table may be considered later as a separate gated phase.

## Export And Dependency Rules

- DOCX/PDF export is deferred to Phase 77J.
- Any new export dependency must be checked for production audit impact before acceptance.
- `npm run release:verify` audit allowlist must not be weakened.
- Export binaries must be generated in memory and not stored in the repo or database.
- Turkish text rendering must be verified before export delivery.

## Non-Goals

- No runtime code changes in Phase 77A.
- No chat mutation removal implementation in this phase.
- No user form schema implementation until the user supplies final fields.
- No food catalog ingestion until the user supplies the list.
- No menu UI, engine V2, export generation, provider change, WhatsApp adapter, Gemini egress, monitoring, secret manager, launch-gate closure, or real health-data processing.
- No R-405 technical remediation.

## Verification

Required after this documentation phase:

```text
cd app
npm run release:verify
```

Result on 2026-06-10: `git diff --check` passed. `npm run release:verify` passed with core tests 165/165, app tests 284/284, lint with two pre-existing warnings, production build, and only documented R-405 findings. `npm run test:rls` remains optional and should be rerun when local Supabase is available for Phase 76N and future Phase 77 migrations.

## Done Criteria

- This spec exists and is referenced from continuity/evidence docs.
- Canonical next work changes from WhatsApp adapter to Phase 77B manual source boundary work.
- Direct 100 dietitian plan records the Phase 77A-77K rebaseline track before WhatsApp adapter.
- Risk register records the new catalog/menu/export/out-of-catalog risks without claiming runtime mitigation.
- Production pilot remains `NO-GO`.
- No real provider/channel/data path is connected.

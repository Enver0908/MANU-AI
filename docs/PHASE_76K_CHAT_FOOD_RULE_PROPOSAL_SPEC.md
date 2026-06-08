# Phase 76K — Chat-to-Food-Rule Proposal Expansion Spec

**Status:** Implemented (2026-06-08)  
**Depends on:** Phase 76A/76B chat update proposals, Phase 76D structured food-rule fields, Phase 76J dashboard food-rule UX  
**Feeds:** Phase 76L permission graph runtime bridge

## Goal

Expand dietitian chat update proposals so natural-language notes can produce deterministic structured food-rule patches that a dietitian explicitly applies or rejects.

## Scope

### In scope

- Deterministic extraction for forbidden/allowed foods and groups, equivalent exchange groups, optional meals, skip tolerance, diet type, and ingredient allergen keywords
- `food_rule` proposal patch category and dashboard grouping
- Apply path updates structured Phase 76D form fields, mirrors allergies/restricted foods via `syncClientRecordFromFoodRuleAnswers`, increments context revision, invalidates drafts, and records audit/context evidence
- Stale context revision rejection and patch target identity lock remain mandatory
- Clinical review and production-activation warnings as proposal safety flags when food-rule patches are present

### Out of scope

- Real Gemini extraction
- Internal copilot mutation
- New proposal API endpoints or Supabase schema changes
- Production pilot GO or launch-gate closure

## Proposal contract

- Chat text never mutates form/context until explicit dietitian apply.
- Deterministic patches only; no LLM extraction.
- Patch target identity (`target`, `fieldId`, `operation`) is not editable on apply.
- Proposal source text and applied patches remain in export/redaction scope per Phase 74.

## Done criteria

- Example Turkish food-rule chat inputs produce pending structured patches.
- Apply/reject flow works with stale revision fail-closed behavior.
- Export manifest still includes applied proposal records.
- Verification passes with only documented R-405 findings.

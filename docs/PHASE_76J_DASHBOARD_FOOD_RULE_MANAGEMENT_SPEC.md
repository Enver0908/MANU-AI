# Phase 76J — Dashboard Food Rule Management UX Spec

**Status:** Implemented (2026-06-08)  
**Depends on:** Phase 76D structured food-rule data model, Phase 76E food rule engine  
**Feeds:** Phase 76K chat-to-food-rule proposals

## Goal

Let dietitians manage structured food rules from the dashboard without editing raw JSON for critical food fields.

## Scope

### In scope

- `FoodRulesPanel` structured controls for forbidden/allowed foods and groups, diet type, exchange groups, mandatory/optional meals, skip tolerance, portion boundaries, ingredient keywords, and product-label policies
- `phase-76j-food-rule-dashboard.ts` load/merge/save helpers on top of existing `saveClientFormResponseInState`
- Context revision increment and draft invalidation via existing form-save path
- Manual-only warnings for clinical review and external production approval dependencies
- App unit tests and dashboard visual smoke coverage

### Out of scope

- Chat-to-food-rule proposals (Phase 76K)
- New API endpoints when existing `/api/clients/forms` suffices
- Production pilot GO or launch-gate closure

## UX contract

- Food-rule edits merge into the active published client form response answers.
- Saving increments `contextRevision`, syncs allergies/restricted foods, invalidates pending drafts, and emits `client_food_rules_updated` audit metadata.
- Warnings remain visible: clinical review may be required; production activation requires external approval.

## Done criteria

- Dietitian can configure structured food rules in the dashboard.
- Prompt-affecting edits are audited and invalidate stale drafts.
- Mobile/desktop layout remains usable without horizontal overflow.

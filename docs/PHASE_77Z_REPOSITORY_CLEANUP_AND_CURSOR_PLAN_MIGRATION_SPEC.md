# Phase 77Z: Repository Cleanup And Cursor Plan Migration

Date: 2026-06-22
Status: Completed locally.
Production pilot: NO-GO.
R-405: Open.

## Goal

Clean the tracked repository tree after the Phase 77M-77Y AI Quality Program by removing obsolete editor-local planning artifacts and recording where their content now lives in canonical project documentation.

## PRD

The project should continue from canonical Markdown documentation under `docs/`, root continuity files, and app/core source files. The tracked `.cursor/plans/food_green_expansion_7671797e.plan.md` file is an editor-local planning artifact from the Phase 76C-76Q food-rule green capacity track. Its content has already been implemented and preserved through phase specs, continuity plans, pilot evidence, gate interpretation, and risk-register narratives.

This cleanup must:

- Preserve the audit trail in canonical docs.
- Remove the tracked `.cursor` plan artifact from the repository.
- Avoid deleting historical phase specs, review packets, evidence packs, JSONL datasets, runtime JSON imports, source code, migrations, or tests.
- Keep production pilot `NO-GO`.
- Keep R-405 open.
- Avoid real provider/channel connections.

## Technical Scope

In scope:

- Add this Phase 77Z cleanup spec.
- Delete `.cursor/plans/food_green_expansion_7671797e.plan.md` from tracked files.
- Update `docs/PHASE_76P_CONTINUITY_EVIDENCE_GATE_UPDATE_SPEC.md` so it references the canonical Phase 76C-76Q docs instead of the `.cursor` plan.
- Update continuity docs to record the cleanup and next step.
- Run required verification.
- Commit the cleanup.
- Attempt push to the configured remote.

Out of scope:

- Runtime behavior changes.
- Feature work.
- Removing historical phase specs or evidence docs.
- Removing JSON/JSONL datasets used by tests or runtime.
- R-405 remediation.
- Real WhatsApp, Telegram, Gemini, provider, monitoring, secret-manager, or real health-data connections.

## Cursor Plan Content Disposition

The removed `.cursor` plan content is represented by these canonical artifacts:

- `docs/PHASE_76C_STRUCTURED_FOOD_RULE_GREEN_CAPACITY_SPEC.md`
- `docs/PHASE_76D_STRUCTURED_FOOD_RULE_DATA_MODEL_SPEC.md`
- `docs/PHASE_76E_FOOD_RULE_ENGINE_SPEC.md`
- `docs/PHASE_76F_INTENT_SPECIFIC_ANSWERABILITY_SPEC.md`
- `docs/PHASE_76G_CLINICAL_SECOND_LAYER_FALSE_YELLOW_CALIBRATION_SPEC.md`
- `docs/PHASE_76H_PRODUCT_INGREDIENT_VERIFICATION_SPEC.md`
- `docs/PHASE_76I_PROMPTCONTEXT_PROVIDER_OUTPUT_GUARD_SPEC.md`
- `docs/PHASE_76J_DASHBOARD_FOOD_RULE_MANAGEMENT_SPEC.md`
- `docs/PHASE_76K_CHAT_FOOD_RULE_PROPOSAL_SPEC.md`
- `docs/PHASE_76L_PERMISSION_GRAPH_RUNTIME_BRIDGE_SPEC.md`
- `docs/PHASE_76M_CALIBRATION_METRICS_EXPANSION_SPEC.md`
- `docs/PHASE_76N_SUPABASE_RLS_EXPORT_REDACTION_TRANSACTIONAL_COVERAGE_SPEC.md`
- `docs/PHASE_76O_100X50_SYNTHETIC_FOOD_MIX_REHEARSAL_SPEC.md`
- `docs/PHASE_76P_CONTINUITY_EVIDENCE_GATE_UPDATE_SPEC.md`
- `docs/PHASE_76Q_VERIFICATION_AND_COMMIT_PROTOCOL_SPEC.md`

## Cleanup Findings

- `.cursor/plans/food_green_expansion_7671797e.plan.md` is the only tracked `.cursor` file.
- The alias JSON and JSONL files are intentionally retained: `food-alias-dictionary-v3.json` is imported at runtime, and `food-alias-dictionary-v3.jsonl` is the dataset mirror.
- Historical phase specs and evidence docs are retained because they are part of the project audit trail.

## Done Criteria

- The `.cursor` plan file is no longer tracked.
- Canonical docs state where the migrated content lives.
- `git diff --check` passes.
- App tests pass.
- `npm run release:verify` passes with only documented R-405 findings.
- Production pilot remains `NO-GO`.
- R-405 remains open.

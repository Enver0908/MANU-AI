# Phase 77V: Copilot Quality Workflow V1

Status: Implemented locally; production pilot remains NO-GO. Verified 2026-06-13.

## Goal

Make dietitian draft review more useful while keeping copilot metadata internal-only.

## Module

`dietitian-ai-assistant/src/copilot-quality-workflow-v1.js`

Version: `copilot-quality-workflow-v1-v0.1.0`

## Internal-only surfaces

Dietitian draft/copilot review may show:

- `responsePlan` summary
- `sourceRefs`
- `claimManifest` summary
- block/handoff reason
- suggested edit focus

## Client-facing exclusions

Client export and client-facing text must not include:

- raw `responsePlan` object
- raw `claimManifest` object
- internal `sourceRefs` metadata
- `blockedReason`
- `styleDna` / style metadata

## Style edit boundary

Dietitian draft edits may inform style learning (Phase 77S) but cannot mutate source authority or clinical decisions.

## Wiring

- Export sanitization: `exportClientInState`, `buildPhase74ExportPackage`, Supabase export path
- Draft review UI: `CopilotQualityReviewPanel` in conversation view
- Core tests: `dietitian-ai-assistant/tests/copilot-quality-workflow-v1.test.mjs`
- App tests: `app/src/lib/phase-77v-copilot-quality-workflow.test.ts`

## Acceptance

- Client export leak tests pass
- Copilot metadata appears only on internal surfaces

## Verification

```text
cd dietitian-ai-assistant
node --test tests/copilot-quality-workflow-v1.test.mjs
cd ../app
npx vitest run src/lib/phase-77v-copilot-quality-workflow.test.ts
npm run release:verify
```

## Out of scope

- Real provider/channel connections
- Production pilot GO approval
- R-405 remediation

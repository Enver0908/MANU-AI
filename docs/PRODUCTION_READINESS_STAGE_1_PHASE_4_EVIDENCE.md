# Production Readiness Stage 1 Phase 4 Evidence

Date: 2026-08-30

Status: `PHASE_4_LOCAL_COMPLETE`

## Scope

This evidence records Phase 4 of **Birinci Asama: Canli Hesaplari Beklemeden
Teknik Hazirlik**: real AI adapter contracts, visual/audio readiness, and file
security hardening.

Implemented scope:

- Added a fail-closed production AI adapter readiness contract for Z.ai GLM-5.3-Flash text, vision/OCR, and transcription operations.
- Real AI provider calls require production readiness boundary approval, server-authoritative launch gates, tenant entitlement, tenant permission, server-built context, and no demo/fixture flags.
- Real AI provider calls also require vendor-risk, clinical safety, privacy/legal, provider-training, retention, provider-native token counting, and safety-settings evidence.
- Red-risk payloads, raw clinical keys, raw message collections, channel identities, secrets, over-budget payloads, and non-ready attachments are blocked before provider egress.
- Z.ai GLM-5.3-Flash request parameters are represented as an explicit request contract.
- The real Z.ai GLM-5.3-Flash text adapter is present behind fail-closed launch gates and `ZAI_API_KEY`; no live HTTP call was executed.
- File upload admission is now bound to a production file-security contract for supported MIME, declared size, actual size, and SHA-256 shape.
- Upload bodies are rejected early when empty or above the existing total attachment byte ceiling.
- Database migration adds service-role-only provider egress audit and malware-scan/provider-egress eligibility fields for AI chat attachments.

Out of scope:

- No Z.ai API key was used.
- No live Z.ai, OCR, vision, transcription, or file API call was executed.
- No production deploy, remote migration, production schema rollout, or real client health-data processing was executed.
- Physical iPhone Safari/PWA validation remains `WAIVED_NOT_EXECUTED`, not `PASS`.
- Production remains `NO-GO`.

## Code Changes

- Added `app/src/lib/production-ai-adapter-contracts.ts`.
- Added `app/src/lib/production-ai-adapters.ts`.
- Added `app/src/lib/production-file-security-contracts.ts`.
- Updated AI Chat attachment create/upload paths to apply production file admission and early raw upload size rejection.
- Added migration `20260830200000_production_readiness_stage_1_phase_4_ai_media_security.sql`.
- Added contract tests for AI adapter readiness, file upload admission, and migration security.

## External Reference Check

Z.ai documentation was checked on 2026-08-31. The current docs list `glm-5.3-flash` as the API model code, the chat completion path under `https://api.z.ai/api/paas/v4/chat/completions`, and recommended request parameters `temperature: 1`, `top_p: 0.95`, `reasoning_effort: max`, and enabled thinking with `clear_thinking: false`. The implementation records these as local readiness contracts and keeps real provider egress behind production gates.

## Verification

Executed from `app/`:

```text
npx vitest run src/lib/production-ai-adapter-contracts.test.ts src/lib/production-file-security-contracts.test.ts src/lib/production-ai-media-security-migration-contract.test.ts --no-file-parallelism --maxWorkers=1
```

Result: passed, 3 test files, 9 tests.

```text
npx vitest run src/lib/production-ai-adapter-contracts.test.ts src/lib/production-file-security-contracts.test.ts src/lib/production-ai-media-security-migration-contract.test.ts src/lib/phase-85-stage-4c-attachments.test.ts src/lib/phase-85-stage-4b3-bounded-media.test.ts src/lib/phase-85-stage-4b4-voice-contracts.test.ts --no-file-parallelism --maxWorkers=1
```

Result: passed, 6 test files, 38 tests.

```text
npm run typecheck
```

Result: passed.

```text
npm run lint
```

Result: passed with 0 errors and the pre-existing 77 warnings.

## Current Decision

`PHASE_4_LOCAL_COMPLETE` is code and migration preparation only. It does not
authorize real AI provider egress, live multimodal processing, production deploy,
production schema rollout, or production `GO`.

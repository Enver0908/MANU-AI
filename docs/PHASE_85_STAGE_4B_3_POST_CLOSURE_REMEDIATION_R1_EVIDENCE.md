# Phase 85 Stage 4B-3 Post-Closure Remediation - R1 Evidence

Date: 2026-07-14
Status: **R1 complete; R2 is next; Stage 4C blocked**

## Scope

R1 defines fail-closed V2 domain, source-authority, correction-input, and runtime-validation contracts without changing database schema, API route behavior, workers, or Supabase persistence paths. V1 records remain readable through read-only adapters.

## Deliverables

- `app/src/lib/phase-85-stage-4b3-media-contracts-v2.ts`
- `app/src/lib/phase-85-stage-4b3-media-contracts-v2.test.ts`
- `dietitian-ai-assistant/src/visual-evidence-source-v2.js`
- `dietitian-ai-assistant/tests/visual-evidence-source-v2.test.mjs`
- `dietitian-ai-assistant/src/product-ingredient-verification.js` (`visual_label_ocr` source type registration)

## Contract Decisions Locked

- Bundle status V2 union: `open`, `ready`, `processing`, `decided`, `review_required`, `superseded`, `failed`, `cancelled`.
- Legacy V1 `completed` without `decisionId` maps to `failed` + `legacy_completed_without_decision`; with `decisionId` maps to `decided`.
- Bundle items require `actorType` (`client` | `dietitian` | `system`) and `senderId`.
- Visual evidence source types: `visual_label_ocr`, `visual_menu_match`, `visual_screenshot_query`; `user_label_text` elevation is rejected.
- `VisualEvidenceRefV2` requires `sourceType`, `authority`, `allowedUses`, `analysisId`, and `approvedSourceId` key.
- `VisualCorrectionRequestV2` strict parser enforces UUID `requestId`/`analysisId`, explanation 1-2,000 codepoints, OCR/entity limits, and unknown-key rejection.
- Client-safe DTO forbidden keys extended for snake_case and provider/raw observation variants.
- Raw OCR (`raw_visual_ocr`) is type-separated from `source_gated_visual_summary`; provider-context leak assertions fail closed.
- Retry ceiling constant `STAGE_4B3_MAX_RETRY_ATTEMPTS = 3`.
- Notification type constants added for `visual_message_review` and `visual_correction_follow_up` (contract only; producers unchanged in R1).

## Explicit Non-Changes

- No append-only migration.
- No webhook, media route, worker, or Supabase RPC behavior change.
- No Stage 4C authorization.
- Production remains `NO-GO`; R-405 remains open.

## Verification

- Targeted app Vitest: `phase-85-stage-4b3-media-contracts-v2.test.ts` + `phase-85-stage-4b3-media-contracts.test.ts` passed 17/17.
- Targeted core Node test: `tests/visual-evidence-source-v2.test.mjs` passed 3/3.
- App lint: passed with 0 errors and pre-existing warnings only.
- App production build: passed.
- `git diff --check`: passed.

## Next Phase

R2 is the next authorized phase: append-only DB, RLS, and durable queue foundation using the V2 contracts.

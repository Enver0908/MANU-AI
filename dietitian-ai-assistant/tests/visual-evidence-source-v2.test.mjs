import test from "node:test";
import assert from "node:assert/strict";
import {
  VISUAL_EVIDENCE_SOURCE_TYPES,
  VisualEvidenceSourceError,
  assertProviderContextExcludesRawOcr,
  assertVisualEvidenceSourceType,
  buildSourceGatedVisualSummary,
  createRawVisualOcrEvidence,
  mapVisualOcrIngredientSourceType,
  parseVisualEvidenceRefV2,
} from "../src/visual-evidence-source-v2.js";

const ANALYSIS_ID = "11111111-1111-4111-8111-111111111111";

test("visual evidence source types reject user_label_text elevation", () => {
  assert.throws(
    () => assertVisualEvidenceSourceType("user_label_text"),
    (error) => error instanceof VisualEvidenceSourceError && error.code === "visual_source_cannot_be_user_label_text",
  );
  assert.equal(mapVisualOcrIngredientSourceType(), "visual_label_ocr");
  assert.equal(VISUAL_EVIDENCE_SOURCE_TYPES.includes("visual_label_ocr"), true);
});

test("visual evidence ref parser is strict and preserves approved source key", () => {
  const ref = parseVisualEvidenceRefV2({
    sourceType: "visual_label_ocr",
    authority: "limited_visual_label_conflict",
    allowedUses: ["forbidden_conflict_only"],
    analysisId: ANALYSIS_ID,
    approvedSourceId: null,
  });
  assert.equal(ref.sourceType, "visual_label_ocr");

  assert.throws(
    () =>
      parseVisualEvidenceRefV2({
        sourceType: "visual_label_ocr",
        authority: "limited_visual_label_conflict",
        allowedUses: ["forbidden_conflict_only"],
        analysisId: ANALYSIS_ID,
        approvedSourceId: null,
        extra: true,
      }),
    /unknown_key/,
  );
});

test("source gate separates raw OCR from provider-safe summary", () => {
  const raw = createRawVisualOcrEvidence([{ text: "laktoz", confidence: 0.99, blockKind: "label" }]);
  assert.throws(() => assertProviderContextExcludesRawOcr(raw), /raw_ocr_forbidden/);

  const summary = buildSourceGatedVisualSummary({
    evidenceRef: {
      sourceType: "visual_label_ocr",
      authority: "limited_visual_label_conflict",
      allowedUses: ["forbidden_conflict_only"],
      analysisId: ANALYSIS_ID,
      approvedSourceId: null,
    },
    boundedTokens: ["forbidden:laktoz"],
  });
  assert.equal(summary.kind, "source_gated_visual_summary");
  assert.doesNotThrow(() => assertProviderContextExcludesRawOcr(summary));
});

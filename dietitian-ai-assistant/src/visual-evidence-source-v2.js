export const VISUAL_EVIDENCE_SOURCE_V2_VERSION = "visual-evidence-source-v2-v0.1.0";

export const VISUAL_EVIDENCE_SOURCE_TYPES = [
  "visual_label_ocr",
  "visual_menu_match",
  "visual_screenshot_query",
];

export const VISUAL_EVIDENCE_AUTHORITIES = [
  "untrusted_visual",
  "limited_visual_label_conflict",
  "approved_menu_exact",
  "approved_source_only",
  "no_authority",
];

export const VISUAL_EVIDENCE_ALLOWED_USES = [
  "forbidden_conflict_only",
  "menu_exact_match",
  "screenshot_query_untrusted",
  "approved_source_claim",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class VisualEvidenceSourceError extends Error {
  constructor(code) {
    super(code);
    this.name = "VisualEvidenceSourceError";
    this.code = code;
  }
}

export function isVisualEvidenceSourceType(value) {
  return typeof value === "string" && VISUAL_EVIDENCE_SOURCE_TYPES.includes(value);
}

export function assertVisualEvidenceSourceType(value) {
  if (value === "user_label_text") {
    throw new VisualEvidenceSourceError("visual_source_cannot_be_user_label_text");
  }
  if (!isVisualEvidenceSourceType(value)) {
    throw new VisualEvidenceSourceError("visual_source_type_invalid");
  }
  return value;
}

export function mapVisualOcrIngredientSourceType() {
  return "visual_label_ocr";
}

export function parseVisualEvidenceRefV2(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new VisualEvidenceSourceError("visual_evidence_ref_must_be_object");
  }

  const allowedKeys = new Set([
    "sourceType",
    "authority",
    "allowedUses",
    "analysisId",
    "approvedSourceId",
  ]);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      throw new VisualEvidenceSourceError(`visual_evidence_ref_unknown_key:${key}`);
    }
  }

  const sourceType = assertVisualEvidenceSourceType(input.sourceType);
  if (!VISUAL_EVIDENCE_AUTHORITIES.includes(input.authority)) {
    throw new VisualEvidenceSourceError("visual_evidence_authority_invalid");
  }
  if (!Array.isArray(input.allowedUses) || input.allowedUses.length === 0) {
    throw new VisualEvidenceSourceError("visual_evidence_allowed_uses_required");
  }
  for (const [index, use] of input.allowedUses.entries()) {
    if (!VISUAL_EVIDENCE_ALLOWED_USES.includes(use)) {
      throw new VisualEvidenceSourceError(`visual_evidence_allowed_use_invalid_${index}`);
    }
  }
  if (typeof input.analysisId !== "string" || !UUID_RE.test(input.analysisId.trim())) {
    throw new VisualEvidenceSourceError("visual_evidence_analysis_id_invalid");
  }
  if (
    input.approvedSourceId !== null &&
    (typeof input.approvedSourceId !== "string" || !input.approvedSourceId.trim())
  ) {
    throw new VisualEvidenceSourceError("visual_evidence_approved_source_id_invalid");
  }

  return {
    sourceType,
    authority: input.authority,
    allowedUses: [...input.allowedUses],
    analysisId: input.analysisId.trim(),
    approvedSourceId:
      input.approvedSourceId === null ? null : String(input.approvedSourceId).trim() || null,
  };
}

export function createRawVisualOcrEvidence(ocrBlocks) {
  if (!Array.isArray(ocrBlocks)) {
    throw new VisualEvidenceSourceError("raw_visual_ocr_blocks_must_be_array");
  }
  return { kind: "raw_visual_ocr", ocrBlocks };
}

export function buildSourceGatedVisualSummary({ evidenceRef, boundedTokens }) {
  const parsedRef = parseVisualEvidenceRefV2(evidenceRef);
  if (!Array.isArray(boundedTokens) || boundedTokens.length === 0) {
    throw new VisualEvidenceSourceError("source_gated_summary_tokens_required");
  }
  for (const [index, token] of boundedTokens.entries()) {
    if (typeof token !== "string" || !token.trim()) {
      throw new VisualEvidenceSourceError(`source_gated_summary_token_${index}_invalid`);
    }
  }

  return {
    kind: "source_gated_visual_summary",
    sourceType: parsedRef.sourceType,
    evidenceRef: parsedRef,
    boundedTokens: boundedTokens.map((token) => token.trim()),
  };
}

export function assertProviderContextExcludesRawOcr(value) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      assertProviderContextExcludesRawOcr(entry);
    }
    return;
  }

  if (value.kind === "raw_visual_ocr" || value.ocrBlocks !== undefined || value.ocr_blocks !== undefined) {
    throw new VisualEvidenceSourceError("provider_context_raw_ocr_forbidden");
  }

  for (const entry of Object.values(value)) {
    assertProviderContextExcludesRawOcr(entry);
  }
}

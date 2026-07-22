export const DIETITIAN_CHAT_ANSWERABILITY_VERSION = "dietitian-chat-answerability-v1";

const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const INSTRUCTION_INJECTION_PATTERNS = [
  /\bignore (all|previous|prior) instructions\b/i,
  /\bdisregard (the )?(system|developer) (prompt|message|instructions)\b/i,
  /\byou are now\b/i,
  /\bnew instructions?:\b/i,
  /\bönceki talimatları yok say\b/iu,
  /\bsistem talimatını yok say\b/iu,
];
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /\b(?:\+?\d[\d\s().-]{7,}\d)\b/;

/**
 * @typedef {{
 *   claimId: string;
 *   text: string;
 *   sourceRefIds: string[];
 *   uncertainty?: string | null;
 * }} DietitianChatStructuredClaim
 */

/**
 * @typedef {{
 *   directAnswer: string;
 *   verifiedFacts: DietitianChatStructuredClaim[];
 *   inferences: DietitianChatStructuredClaim[];
 *   recommendations: DietitianChatStructuredClaim[];
 *   missingData?: string[];
 *   conflictingData?: string[];
 *   riskContext?: string | null;
 *   answerability?: string | null;
 *   riskLevel?: string | null;
 * }} DietitianChatStructuredAnswer
 */

/**
 * @param {unknown} value
 * @returns {value is DietitianChatStructuredClaim}
 */
function isStructuredClaim(value) {
  if (!value || typeof value !== "object") return false;
  const claim = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof claim.claimId === "string" &&
    claim.claimId.trim().length > 0 &&
    typeof claim.text === "string" &&
    claim.text.trim().length > 0 &&
    Array.isArray(claim.sourceRefIds) &&
    claim.sourceRefIds.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

/**
 * @param {unknown} value
 */
export function validateDietitianChatStructuredAnswerSchema(value) {
  if (!value || typeof value !== "object") {
    return { ok: false, code: "structured_answer_missing", errors: ["structured_answer_missing"] };
  }

  const answer = /** @type {Record<string, unknown>} */ (value);
  const errors = [];

  if (typeof answer.directAnswer !== "string" || !answer.directAnswer.trim()) {
    errors.push("direct_answer_required");
  }

  for (const field of ["verifiedFacts", "inferences", "recommendations"]) {
    const claims = answer[field];
    if (claims == null) continue;
    if (!Array.isArray(claims)) {
      errors.push(`${field}_must_be_array`);
      continue;
    }
    for (const claim of claims) {
      if (!isStructuredClaim(claim)) {
        errors.push(`${field}_claim_invalid`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    code: errors[0] ?? null,
    errors,
    answer: errors.length === 0 ? /** @type {DietitianChatStructuredAnswer} */ (answer) : null,
  };
}

/**
 * @param {{
 *   answer: DietitianChatStructuredAnswer;
 *   allowedSourceIds: Set<string>;
 *   sourceTypesById?: Record<string, string>;
 *   runId?: string | null;
 *   clientId?: string | null;
 *   sourceOwnership?: Record<string, { runId?: string | null; clientId?: string | null }>;
 * }} input
 */
export function validateDietitianChatSourceScope(input) {
  const errors = [];
  const allClaims = [
    ...(input.answer.verifiedFacts ?? []),
    ...(input.answer.inferences ?? []),
    ...(input.answer.recommendations ?? []),
  ];

  for (const claim of allClaims) {
    for (const sourceRefId of claim.sourceRefIds) {
      if (!input.allowedSourceIds.has(sourceRefId)) {
        errors.push(`source_not_in_snapshot:${sourceRefId}`);
      }
      const ownership = input.sourceOwnership?.[sourceRefId];
      if (ownership?.runId && input.runId && ownership.runId !== input.runId) {
        errors.push(`cross_run_source:${sourceRefId}`);
      }
      if (ownership?.clientId && input.clientId && ownership.clientId !== input.clientId) {
        errors.push(`cross_client_source:${sourceRefId}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * @param {{
 *   answer: DietitianChatStructuredAnswer;
 *   sourceTypesById: Record<string, string>;
 *   sourceExcerptById?: Record<string, string>;
 * }} input
 */
export function validateDietitianChatClaimSupport(input) {
  const errors = [];
  const droppedClaimIds = [];

  const hasSupport = (claim, requiredTypes) => {
    const types = claim.sourceRefIds.map((id) => input.sourceTypesById[id]).filter(Boolean);
    return requiredTypes.some((type) => types.includes(type));
  };

  for (const claim of input.answer.verifiedFacts ?? []) {
    if (!claim.sourceRefIds.length) {
      errors.push(`verified_fact_without_source:${claim.claimId}`);
      droppedClaimIds.push(claim.claimId);
      continue;
    }
    for (const sourceRefId of claim.sourceRefIds) {
      const excerpt = input.sourceExcerptById?.[sourceRefId] ?? "";
      if (excerpt && claim.text && !excerpt.toLowerCase().includes(claim.text.slice(0, 24).toLowerCase())) {
        const tokens = claim.text.toLowerCase().split(/\s+/).filter((token) => token.length > 4);
        const supported = tokens.some((token) => excerpt.toLowerCase().includes(token));
        if (!supported) {
          errors.push(`claim_not_supported_by_source:${claim.claimId}:${sourceRefId}`);
        }
      }
    }
  }

  for (const claim of input.answer.recommendations ?? []) {
    const hasClient = hasSupport(claim, ["client_record"]);
    const hasClinical = hasSupport(claim, ["approved_clinical_source", "web_source"]);
    if (!hasClient || !hasClinical) {
      errors.push(`personalized_recommendation_missing_dual_source:${claim.claimId}`);
    }
    if (!claim.uncertainty?.trim()) {
      errors.push(`recommendation_missing_uncertainty:${claim.claimId}`);
    }
  }

  return { ok: errors.length === 0, errors, droppedClaimIds };
}

/**
 * @param {{
 *   answer: DietitianChatStructuredAnswer;
 *   scopeValidation: { ok: boolean; errors: string[] };
 *   claimValidation: { ok: boolean; errors: string[] };
 * }} input
 */
export function evaluateDietitianChatClinicalAnswerability(input) {
  if ((input.answer.conflictingData ?? []).length > 0) {
    return { answerability: "conflicting", reasons: ["conflicting_data_present"] };
  }

  if (input.scopeValidation.errors.some((error) => error.startsWith("cross_"))) {
    return { answerability: "not_authorized", reasons: input.scopeValidation.errors };
  }

  if (
    input.claimValidation.errors.some((error) => error.startsWith("verified_fact_without_source")) ||
    input.claimValidation.errors.some((error) => error.startsWith("personalized_recommendation_missing_dual_source"))
  ) {
    return { answerability: "insufficient", reasons: input.claimValidation.errors };
  }

  if (!input.scopeValidation.ok || !input.claimValidation.ok) {
    return { answerability: "partial", reasons: [...input.scopeValidation.errors, ...input.claimValidation.errors] };
  }

  if ((input.answer.missingData ?? []).length > 0) {
    return { answerability: "partial", reasons: input.answer.missingData };
  }

  return { answerability: "answerable", reasons: [] };
}

/**
 * @param {string} text
 */
export function detectDietitianChatPromptInjectionSignals(text) {
  const normalized = String(text ?? "");
  const reasons = [];
  if (CONTROL_CHAR_PATTERN.test(normalized)) {
    reasons.push("control_characters");
  }
  for (const pattern of INSTRUCTION_INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      reasons.push(`instruction_pattern:${pattern.source}`);
    }
  }
  return { flagged: reasons.length > 0, reasons };
}

/**
 * @param {string} text
 */
export function wrapUntrustedSourceContent(text) {
  const cleaned = String(text ?? "")
    .replace(CONTROL_CHAR_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `<<<UNTRUSTED_SOURCE_BEGIN>>>\n${cleaned}\n<<<UNTRUSTED_SOURCE_END>>>`;
}

/**
 * @param {{
 *   query: string;
 *   clientNames?: string[];
 * }} input
 */
export function buildDeidentifiedWebResearchQuery(input) {
  let query = String(input.query ?? "").trim();
  if (!query) return { ok: false, reason: "empty_query", query: "" };

  if (UUID_PATTERN.test(query)) return { ok: false, reason: "uuid_present", query: "" };
  if (EMAIL_PATTERN.test(query)) return { ok: false, reason: "email_present", query: "" };
  if (PHONE_PATTERN.test(query)) return { ok: false, reason: "phone_present", query: "" };

  for (const name of input.clientNames ?? []) {
    if (!name || name.length < 4) continue;
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "iu");
    if (pattern.test(query)) {
      return { ok: false, reason: "client_name_present", query: "" };
    }
  }

  query = query
    .replace(UUID_PATTERN, " ")
    .replace(EMAIL_PATTERN, " ")
    .replace(PHONE_PATTERN, " ")
    .replace(/\b\d{1,2}\s*(yaşında|yasinda|years old)\b/giu, "adult age range")
    .replace(/\s+/g, " ")
    .trim();

  if (!query) return { ok: false, reason: "deidentified_empty", query: "" };
  return { ok: true, reason: null, query };
}

/**
 * @param {{
 *   snippet?: string | null;
 *   publisher?: string | null;
 *   contentHash?: string | null;
 *   pageOpened?: boolean;
 * }} input
 */
export function validateDietitianChatWebResearchResult(input) {
  if (!input.pageOpened) {
    return { ok: false, reason: "snippet_only_rejected" };
  }
  if (!input.publisher?.trim()) {
    return { ok: false, reason: "publisher_missing" };
  }
  if (!input.contentHash?.trim()) {
    return { ok: false, reason: "content_hash_missing" };
  }
  if (!input.snippet?.trim()) {
    return { ok: false, reason: "verified_content_missing" };
  }
  return { ok: true, reason: null };
}

/**
 * @param {{
 *   structuredAnswer: DietitianChatStructuredAnswer | null;
 *   allowedSourceIds: string[];
 *   sourceTypesById?: Record<string, string>;
 *   sourceExcerptById?: Record<string, string>;
 *   runId?: string | null;
 *   clientId?: string | null;
 * }} input
 */
export function validateDietitianChatSourcedAnswer(input) {
  const schema = validateDietitianChatStructuredAnswerSchema(input.structuredAnswer);
  if (!schema.ok || !schema.answer) {
    return {
      ok: false,
      stage: "schema",
      code: schema.code ?? "structured_answer_invalid",
      answerability: "insufficient",
      errors: schema.errors,
    };
  }

  const allowedSourceIds = new Set(input.allowedSourceIds);
  const scopeValidation = validateDietitianChatSourceScope({
    answer: schema.answer,
    allowedSourceIds,
    sourceTypesById: input.sourceTypesById ?? {},
    runId: input.runId ?? null,
    clientId: input.clientId ?? null,
  });
  if (!scopeValidation.ok) {
    return {
      ok: false,
      stage: "source_scope",
      code: scopeValidation.errors[0] ?? "source_scope_invalid",
      answerability: scopeValidation.errors.some((error) => error.startsWith("cross_"))
        ? "not_authorized"
        : "insufficient",
      errors: scopeValidation.errors,
    };
  }

  const claimValidation = validateDietitianChatClaimSupport({
    answer: schema.answer,
    sourceTypesById: input.sourceTypesById ?? {},
    sourceExcerptById: input.sourceExcerptById ?? {},
  });

  const clinical = evaluateDietitianChatClinicalAnswerability({
    answer: schema.answer,
    scopeValidation,
    claimValidation,
  });

  if (clinical.answerability === "insufficient" || clinical.answerability === "not_authorized") {
    return {
      ok: false,
      stage: "clinical_answerability",
      code: clinical.reasons[0] ?? "insufficient_evidence",
      answerability: clinical.answerability,
      errors: clinical.reasons,
      answer: schema.answer,
    };
  }

  return {
    ok: clinical.answerability === "answerable" || clinical.answerability === "partial",
    stage: "complete",
    code: clinical.answerability === "partial" ? "partial_answerability" : null,
    answerability: clinical.answerability,
    errors: clinical.reasons,
    answer: schema.answer,
  };
}

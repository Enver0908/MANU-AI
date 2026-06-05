export const APPROVED_SOURCE_ANSWERABILITY_VERSION = "approved-source-answerability-v0.1.0";

const APPROVED_SOURCE_RULES = {
  diet_plan_summary: "active_diet_plan",
  client_form_summary: "prompt_allowed_form_response",
  dietitian_context_update: "dietitian_context_update",
  pinned_note: "pinned_note",
  allergies: "allergies_restricted_foods",
  restricted_foods: "allergies_restricted_foods",
};

const sensitiveAnswerabilityPattern =
  /\b(?:ilac|insulin|metformin|antibiyotik|takviye|supplement|medication|medicine|lab|tahlil|kan sonucu|symptom|belirti|hamile|pregnan|minor|cocuk|ergen|kus|purge|bayil|nefes|gogus|acil|emergency)\b/i;

export function evaluateApprovedSourceAnswerability({ promptContext, riskDecision }) {
  if (riskDecision?.level !== "green") {
    return buildDecision("source_backed_green", ["non_green_risk_not_answerability_gated"], []);
  }

  if (!promptContext || !Array.isArray(promptContext.segments)) {
    return buildDecision("blocked", ["prompt_context_missing"], []);
  }

  const currentMessage = currentMessageText(promptContext);
  if (sensitiveAnswerabilityPattern.test(normalize(currentMessage))) {
    return buildDecision("handoff_required", ["mixed_or_sensitive_answerability_marker"], []);
  }

  const sources = approvedSources(promptContext);
  if (sources.length === 0) {
    return buildDecision("handoff_required", ["approved_source_missing"], []);
  }

  return buildDecision("source_backed_green", ["approved_source_present"], sources);
}

function approvedSources(promptContext) {
  const sources = [];

  for (const segment of promptContext.segments || []) {
    const text = String(segment?.text || "").trim();
    if (!text) continue;

    const category = categoryForSegment(segment);
    if (!category) continue;

    sources.push({
      category,
      segmentType: segment.type,
      sourceId: segment.sourceId || null,
      authority: segment.authority || null,
      origin: segment.origin || null,
    });
  }

  return sources;
}

function categoryForSegment(segment) {
  if (segment.type === "recent_message") {
    if (segment.origin !== "dietitian_manual") return null;
    if (segment.authority !== "dietitian_authored" && segment.authority !== "newest_dietitian_authored") {
      return null;
    }
    return "dietitian_manual_message";
  }

  return APPROVED_SOURCE_RULES[segment.type] || null;
}

function currentMessageText(promptContext) {
  return (
    (promptContext.segments || []).find((segment) => segment.type === "current_message")?.text || ""
  );
}

function buildDecision(decision, reasons, sources) {
  return {
    version: APPROVED_SOURCE_ANSWERABILITY_VERSION,
    decision,
    allowed: decision === "source_backed_green",
    reasons,
    sourceCategories: Array.from(new Set(sources.map((source) => source.category))),
    sources,
  };
}

function normalize(text) {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c");
}

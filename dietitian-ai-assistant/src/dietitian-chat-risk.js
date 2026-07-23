import { createHash } from "node:crypto";
import { normalizeSafetyText } from "./normalize-safety-text.js";

export const DIETITIAN_CHAT_RISK_VERSION = "dietitian-chat-risk-v1";

const RISK_FIXTURE_PATTERN = /^__fixture:risk:(green|yellow|red)__$/i;

const RED_CLINICAL_PATTERNS =
  /\b(?:nefes darl|gogus agr|göğüs ağr|chest pain|anafilaks|anaphylaxis|intihar|suicidal|acil durum|emergency care|kanama|hemorrhage)\b/i;

const HYPOTHETICAL_MARKERS =
  /\b(?:ornek|örnek|hypothetical|scenario|what if|eger olursa|eğer olursa|varsayalim|varsayalım|kaynakta gecen|kaynakta geçen)\b/i;

const YELLOW_UNCERTAINTY_MARKERS =
  /\b(?:belirsiz|uncertain|partial|eksik veri|missing data|conflicting|celisk|çeliş)\b/i;

/**
 * @param {{
 *   triggerBody: string;
 *   verifiedFactTexts?: string[];
 *   attachmentExcerpts?: string[];
 *   sourceExcerptTexts?: string[];
 *   scopeType?: "general" | "client";
 *   answerability?: string | null;
 *   providerRiskLevel?: string | null;
 *   sourceRefIds?: string[];
 * }} input
 */
export function classifyDietitianChatRisk(input) {
  const triggerBody = String(input.triggerBody ?? "");
  const fixtureMatch = triggerBody.trim().match(RISK_FIXTURE_PATTERN);
  if (fixtureMatch) {
    const level = fixtureMatch[1].toLowerCase();
    return buildRiskResult({
      riskLevel: level,
      reasons: [`fixture:${level}`],
      sourceRefIds: input.sourceRefIds ?? [],
      confidenceClass: "deterministic_fixture",
      recommendedHumanAction: recommendedActionForLevel(level),
      hypotheticalRed: false,
      safeDraftBody: level === "red" ? null : buildSafeDraftBody(input),
    });
  }

  const verifiedFactTexts = (input.verifiedFactTexts ?? []).map((item) => String(item));
  const attachmentExcerpts = (input.attachmentExcerpts ?? []).map((item) => String(item));
  const sourceExcerptTexts = (input.sourceExcerptTexts ?? []).map((item) => String(item));
  const verifiedBlob = normalizeSafetyText(verifiedFactTexts.join(" "));
  const triggerNormalized = normalizeSafetyText(triggerBody);
  const attachmentBlob = normalizeSafetyText(attachmentExcerpts.join(" "));
  const sourceBlob = normalizeSafetyText(sourceExcerptTexts.join(" "));

  const redInVerified = RED_CLINICAL_PATTERNS.test(verifiedBlob);
  const redInTrigger =
    RED_CLINICAL_PATTERNS.test(triggerNormalized) && !HYPOTHETICAL_MARKERS.test(triggerNormalized);
  const redInSourcesOnly =
    (RED_CLINICAL_PATTERNS.test(attachmentBlob) || RED_CLINICAL_PATTERNS.test(sourceBlob)) &&
    !redInVerified &&
    !redInTrigger;

  if (redInSourcesOnly) {
    return buildRiskResult({
      riskLevel: "yellow",
      reasons: ["hypothetical_red_source_only"],
      sourceRefIds: input.sourceRefIds ?? [],
      confidenceClass: "source_hypothesis",
      recommendedHumanAction:
        "Review source wording; do not treat hypothetical examples in attachments or citations as verified client status.",
      hypotheticalRed: true,
      safeDraftBody: buildSafeDraftBody(input),
    });
  }

  if (redInVerified || redInTrigger) {
    return buildRiskResult({
      riskLevel: "red",
      reasons: uniqueReasons([
        redInVerified ? "verified_client_red_signal" : null,
        redInTrigger ? "dietitian_input_red_signal" : null,
      ]),
      sourceRefIds: input.sourceRefIds ?? [],
      confidenceClass: "verified_signal",
      recommendedHumanAction:
        "Review immediately. Use explicit handoff if urgent clinical escalation is required. Do not transfer routine drafts.",
      hypotheticalRed: false,
      safeDraftBody: null,
    });
  }

  if (
    input.providerRiskLevel === "red" ||
    input.answerability === "conflicting" ||
    YELLOW_UNCERTAINTY_MARKERS.test(triggerNormalized) ||
    input.providerRiskLevel === "yellow" ||
    input.answerability === "partial"
  ) {
    const riskLevel = input.providerRiskLevel === "red" ? "red" : "yellow";
    return buildRiskResult({
      riskLevel,
      reasons: uniqueReasons([
        input.providerRiskLevel === "yellow" || input.providerRiskLevel === "red"
          ? `provider_risk:${input.providerRiskLevel}`
          : null,
        input.answerability === "partial" ? "partial_answerability" : null,
        input.answerability === "conflicting" ? "conflicting_answerability" : null,
        YELLOW_UNCERTAINTY_MARKERS.test(triggerNormalized) ? "uncertainty_language" : null,
      ]),
      sourceRefIds: input.sourceRefIds ?? [],
      confidenceClass: riskLevel === "red" ? "model_escalation" : "bounded_uncertainty",
      recommendedHumanAction: recommendedActionForLevel(riskLevel),
      hypotheticalRed: false,
      safeDraftBody: riskLevel === "red" ? null : buildSafeDraftBody(input),
    });
  }

  return buildRiskResult({
    riskLevel: "green",
    reasons: ["bounded_green"],
    sourceRefIds: input.sourceRefIds ?? [],
    confidenceClass: "bounded_green",
    recommendedHumanAction: "Review sources and transfer safe draft manually if needed.",
    hypotheticalRed: false,
    safeDraftBody: buildSafeDraftBody(input),
  });
}

/**
 * @param {{
 *   riskLevel: string;
 *   reasons: string[];
 *   sourceRefIds: string[];
 *   confidenceClass: string;
 *   recommendedHumanAction: string;
 *   hypotheticalRed: boolean;
 *   safeDraftBody: string | null;
 * }} input
 */
function buildRiskResult(input) {
  return {
    version: DIETITIAN_CHAT_RISK_VERSION,
    riskLevel: input.riskLevel,
    reasons: input.reasons,
    sourceRefIds: input.sourceRefIds,
    confidenceClass: input.confidenceClass,
    recommendedHumanAction: input.recommendedHumanAction,
    hypotheticalRed: input.hypotheticalRed,
    safeDraft: input.safeDraftBody
      ? {
          body: input.safeDraftBody,
          riskLevel: input.riskLevel === "red" ? null : input.riskLevel,
          sourceRefIds: input.sourceRefIds,
        }
      : null,
  };
}

/**
 * @param {{ directAnswer?: string | null; triggerBody?: string }} input
 */
function buildSafeDraftBody(input) {
  const direct = typeof input.directAnswer === "string" ? input.directAnswer.trim() : "";
  if (direct) return direct;
  const trigger = typeof input.triggerBody === "string" ? input.triggerBody.trim() : "";
  return trigger || null;
}

function recommendedActionForLevel(level) {
  if (level === "red") {
    return "Review immediately and use explicit handoff if urgent clinical escalation is required.";
  }
  if (level === "yellow") {
    return "Review uncertainty in the yellow draft review flow before any client send.";
  }
  return "Review sources and transfer safe draft manually if needed.";
}

function uniqueReasons(reasons) {
  return [...new Set(reasons.filter(Boolean))];
}

/**
 * @param {{
 *   clientId: string;
 *   reasons: string[];
 *   sourceRevisionDigest: string;
 * }} input
 */
export function buildAiChatRedNotificationFingerprint(input) {
  const normalizedReasons = [...input.reasons].map((item) => item.trim().toLowerCase()).sort().join("|");
  return createHash("sha256")
    .update(`${input.clientId}:${normalizedReasons}:${input.sourceRevisionDigest}`)
    .digest("hex");
}

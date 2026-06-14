import { detectProductCommunicationCovenantIssues } from "./response-quality-guard.js";
import { defaultVoiceProfile } from "./voice-profile.js";

export const STYLE_DNA_V2_VERSION = "style-dna-v2-v0.1.0";
export const STYLE_DNA_SOFT_MISMATCH_THRESHOLD = 0.35;

const emojiPattern = /[\u{1F300}-\u{1FAFF}]/gu;

const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const HANDLE_PATTERN = /@[\w._-]{2,}/g;

export function buildStyleDnaScopeKey(tenantId, dietitianId) {
  const tenant = String(tenantId || "tenant_unknown").trim();
  const dietitian = String(dietitianId || "dietitian_unknown").trim();
  return `tenant:${tenant};dietitian:${dietitian}`;
}

export function mapSentenceLengthBand(averageMessageChars = 140) {
  if (averageMessageChars <= 120) return "short";
  if (averageMessageChars <= 200) return "medium";
  return "long";
}

export function computeStyleHardMaxChars(sentenceLengthBand, averageMessageChars = 140) {
  const baseline = Number.isFinite(averageMessageChars) ? averageMessageChars : 140;
  switch (sentenceLengthBand) {
    case "short":
      return Math.max(180, Math.round(baseline * 1.6));
    case "long":
      return Math.max(420, Math.round(baseline * 2.4));
    default:
      return Math.max(280, Math.round(baseline * 2));
  }
}

export function deriveWarmthTone(formality, warmthAdjustment = null) {
  if (warmthAdjustment === "warmer") return "warm";
  if (warmthAdjustment === "cooler") return "steady";
  if (formality === "informal") return "warm";
  if (formality === "formal") return "steady";
  return "balanced";
}

export function stripClientIdentifyingText(text, knownNames = []) {
  let sanitized = String(text || "");
  for (const name of knownNames) {
    const trimmed = String(name || "").trim();
    if (!trimmed || trimmed.length < 2) continue;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    sanitized = sanitized.replace(new RegExp(escaped, "gi"), "[client]");
  }
  return sanitized
    .replace(PHONE_PATTERN, "[phone]")
    .replace(EMAIL_PATTERN, "[email]")
    .replace(HANDLE_PATTERN, "[handle]")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterCandidateStylePhrases(phrases = [], options = {}) {
  const knownNames = options.knownClientNames || [];
  const accepted = [];
  const rejected = [];

  for (const phrase of phrases) {
    const cleaned = stripClientIdentifyingText(String(phrase || "").trim(), knownNames);
    if (!cleaned || cleaned.length > 72) {
      rejected.push({ phrase, reason: "empty_or_overlong" });
      continue;
    }
    const covenantIssues = detectProductCommunicationCovenantIssues(cleaned);
    if (covenantIssues.length > 0) {
      rejected.push({ phrase: cleaned, reason: covenantIssues[0] });
      continue;
    }
    if (/\[client\]|\[phone\]|\[email\]|\[handle\]/i.test(cleaned)) {
      rejected.push({ phrase: cleaned, reason: "client_identifying_residual" });
      continue;
    }
    accepted.push(cleaned);
  }

  return {
    accepted: [...new Set(accepted)],
    rejected,
  };
}

export function buildStyleEditHistoryRecord({
  tenantId,
  dietitianId,
  aiDraft,
  dietitianFinal,
  knownClientNames = [],
}) {
  const sanitizedDraft = stripClientIdentifyingText(aiDraft, knownClientNames);
  const sanitizedFinal = stripClientIdentifyingText(dietitianFinal, knownClientNames);
  const draftWords = tokenizeStyleWords(sanitizedDraft);
  const finalWords = tokenizeStyleWords(sanitizedFinal);

  return {
    tenantId,
    dietitianId,
    aiDraftHash: hashStyleText(sanitizedDraft),
    dietitianFinalHash: hashStyleText(sanitizedFinal),
    diffMetadata: {
      editDistance: Math.abs(sanitizedFinal.length - sanitizedDraft.length),
      lengthDelta: sanitizedFinal.length - sanitizedDraft.length,
      greetingChanged: extractGreeting(sanitizedDraft) !== extractGreeting(sanitizedFinal),
      closingChanged: extractClosing(sanitizedDraft) !== extractClosing(sanitizedFinal),
      wordOverlapRatio: computeWordOverlapRatio(draftWords, finalWords),
    },
  };
}

export function extractStyleSignalsFromEditHistory(records = []) {
  const scoped = records.filter((record) => record && record.diffMetadata);
  if (scoped.length === 0) {
    return {
      preferredGreeting: null,
      preferredClosing: null,
      warmthAdjustment: null,
      responseTimingStyle: null,
      sampleCount: 0,
    };
  }

  const greetingChanges = scoped.filter((record) => record.diffMetadata.greetingChanged).length;
  const closingChanges = scoped.filter((record) => record.diffMetadata.closingChanged).length;
  const avgLengthDelta =
    scoped.reduce((sum, record) => sum + (record.diffMetadata.lengthDelta || 0), 0) / scoped.length;

  return {
    preferredGreeting: null,
    preferredClosing: null,
    warmthAdjustment: avgLengthDelta > 24 ? "warmer" : avgLengthDelta < -24 ? "cooler" : "neutral",
    responseTimingStyle: greetingChanges + closingChanges > scoped.length / 2 ? "reflective" : "prompt",
    sampleCount: scoped.length,
  };
}

export function buildStyleDnaV2({
  tenantId = null,
  dietitianId = null,
  voiceProfile = null,
  editHistorySignals = null,
  knownClientNames = [],
} = {}) {
  const profile = voiceProfile || defaultVoiceProfile();
  const learned = editHistorySignals || extractStyleSignalsFromEditHistory([]);
  const sentenceLength = mapSentenceLengthBand(profile.averageMessageChars);
  const greetingPhrases = [...(profile.commonGreetings || []), learned.preferredGreeting].filter(Boolean);
  const closingPhrases = [...(profile.commonClosings || []), learned.preferredClosing].filter(Boolean);
  const filteredGreetings = filterCandidateStylePhrases(greetingPhrases, { knownClientNames });
  const filteredClosings = filterCandidateStylePhrases(closingPhrases, { knownClientNames });
  const boundaryPhrases = filterCandidateStylePhrases(
    [
      ...filteredClosings.accepted,
      profile.styleNotes ? String(profile.styleNotes).slice(0, 72) : null,
    ].filter(Boolean),
    { knownClientNames },
  );

  return {
    version: STYLE_DNA_V2_VERSION,
    scope: buildStyleDnaScopeKey(tenantId, dietitianId),
    tenantId,
    dietitianId,
    sentenceLength,
    greetingStyle: filteredGreetings.accepted[0] || "neutral",
    formality: profile.formality || "balanced",
    emojiPolicy: profile.emojiPolicy || "limited",
    warmthTone: deriveWarmthTone(profile.formality, learned.warmthAdjustment),
    boundaryPhrasing: boundaryPhrases.accepted[0] || "practical_neutral",
    responseTimingStyle: learned.responseTimingStyle || "prompt",
    candidatePhrases: [...new Set([...filteredGreetings.accepted, ...boundaryPhrases.accepted])].slice(0, 8),
    rejectedPhraseCount: filteredGreetings.rejected.length + filteredClosings.rejected.length + boundaryPhrases.rejected.length,
    hardGuards: {
      maxChars: computeStyleHardMaxChars(sentenceLength, profile.averageMessageChars),
      emojiAllowed: (profile.emojiPolicy || "limited") !== "none",
    },
    softMismatchThreshold: STYLE_DNA_SOFT_MISMATCH_THRESHOLD,
    clinicalIsolation: true,
    editHistorySampleCount: learned.sampleCount || 0,
  };
}

export function detectHardStyleGuardViolations(text, styleDna = null) {
  if (!styleDna || !text) return [];

  const issues = [];
  const normalized = String(text);

  if (styleDna.hardGuards?.emojiAllowed === false && emojiPattern.test(normalized)) {
    issues.push("style_hard_emoji_forbidden");
  }

  if (styleDna.hardGuards?.maxChars && normalized.length > styleDna.hardGuards.maxChars) {
    issues.push("style_hard_length_exceeded");
  }

  for (const phrase of styleDna.candidatePhrases || []) {
    const covenantIssues = detectProductCommunicationCovenantIssues(phrase);
    if (covenantIssues.length > 0) {
      issues.push("style_hard_candidate_phrase_covenant");
      break;
    }
  }

  return [...new Set(issues)];
}

export function measureSoftStyleMismatch(text, styleDna = null) {
  if (!styleDna || !text) {
    return { score: 0, exceedsThreshold: false, hardBlock: false };
  }

  const normalized = String(text);
  let score = 0;
  const checks = [];

  const targetLength = styleDna.hardGuards?.maxChars ? styleDna.hardGuards.maxChars * 0.65 : 200;
  const lengthDelta = Math.abs(normalized.length - targetLength) / Math.max(targetLength, 1);
  if (lengthDelta > 0.45) {
    score += Math.min(0.4, lengthDelta * 0.25);
    checks.push("length_band");
  }

  if (styleDna.formality === "formal" && /\b(?:canim|tatlim|harika|super)\b/i.test(normalized)) {
    score += 0.2;
    checks.push("formality_informal_drift");
  }
  if (styleDna.formality === "informal" && /\b(?:sayin|rica ederim|uygundur)\b/i.test(normalized)) {
    score += 0.2;
    checks.push("formality_formal_drift");
  }

  if (styleDna.emojiPolicy === "none" && emojiPattern.test(normalized)) {
    score += 0.15;
    checks.push("emoji_soft");
  }

  const boundedScore = Math.min(1, Number(score.toFixed(3)));
  return {
    score: boundedScore,
    exceedsThreshold: boundedScore > (styleDna.softMismatchThreshold ?? STYLE_DNA_SOFT_MISMATCH_THRESHOLD),
    hardBlock: false,
    checks,
  };
}

export function extractClinicalDecisionSnapshot(responsePlan = null) {
  if (!responsePlan) return null;
  return {
    replyMode: responsePlan.replyMode || null,
    templateId: responsePlan.templateId || null,
    riskClass: responsePlan.riskClass || null,
    intentFamily: responsePlan.intentFamily || null,
    foodDecision: responsePlan.foodDecision?.decision || null,
    providerEligible: responsePlan.providerEligible === true,
  };
}

export function clinicalSnapshotsEqual(left, right) {
  if (!left || !right) return false;
  return (
    left.replyMode === right.replyMode &&
    left.templateId === right.templateId &&
    left.riskClass === right.riskClass &&
    left.intentFamily === right.intentFamily &&
    left.foodDecision === right.foodDecision &&
    left.providerEligible === right.providerEligible
  );
}

function tokenizeStyleWords(text) {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
}

function computeWordOverlapRatio(leftWords, rightWords) {
  if (leftWords.length === 0 || rightWords.length === 0) return 0;
  const rightSet = new Set(rightWords);
  const overlap = leftWords.filter((word) => rightSet.has(word)).length;
  return overlap / Math.max(leftWords.length, rightWords.length);
}

function extractGreeting(text) {
  return String(text || "")
    .split(/[,.!\n]/)[0]
    ?.trim()
    .slice(0, 32);
}

function extractClosing(text) {
  return String(text || "")
    .split(/[.!?\n]/)
    .filter(Boolean)
    .at(-1)
    ?.trim()
    .slice(0, 48);
}

function hashStyleText(text) {
  const normalized = String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR");
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

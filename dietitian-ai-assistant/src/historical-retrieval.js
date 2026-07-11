import { normalizeSafetyText } from "./normalize-safety-text.js";

export const HISTORICAL_RETRIEVAL_VERSION = "historical-retrieval-v1";

const GENERIC_GREETING_PATTERN =
  /^(?:merhaba|selam|selamlar|gunaydin|iyi gunler|iyi aksamlar|hello|hi|hey|tesekkur(?:ler)?|sagol|ok|tamam)\.?$/i;

const TEMPORAL_UNTIL_PATTERN =
  /\b(?:until|kadar|tarihine|tarihine kadar|bitis|son(?:ra| gunu)?)\b/i;
const TEMPORAL_TODAY_PATTERN = /\b(?:bugun|today|bu aksam|bu ogle)\b/i;
const TEMPORAL_TOMORROW_PATTERN = /\b(?:yarin|tomorrow)\b/i;
const TEMPORAL_EXPLICIT_DATE_PATTERN =
  /\b(?:until|kadar|tarihine(?: kadar)?|bitis|son(?:ra| gunu)?)\s*(?:is|:|-)?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\b/i;
const TEMPORAL_EXPLICIT_DATE_PREFIX_PATTERN =
  /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\s*(?:tarihine(?: kadar)?|until|bitis|son(?:ra| gunu)?)\b/i;

const STRUCTURED_IMPACT_PATTERN =
  /\b(?:menu|plan|beslenme|ogun|kahvalti|ogle|aksam|yasak|izinli|form|alerji|diyet|kalori|porsiyon|substitution|degistir)\b/i;

export function tokenizeTranscriptText(text) {
  return normalizeSafetyText(String(text || ""))
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 2);
}

export function scoreLexicalRelevance(query, candidateBody) {
  const queryTokens = tokenizeTranscriptText(query);
  const candidateTokens = tokenizeTranscriptText(candidateBody);
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;

  const querySet = new Set(queryTokens);
  const candidateSet = new Set(candidateTokens);
  let intersection = 0;
  for (const token of querySet) {
    if (candidateSet.has(token)) intersection += 1;
  }

  const denominator = Math.min(querySet.size, candidateSet.size);
  return denominator === 0 ? 0 : intersection / denominator;
}

export function isGenericGreeting(text) {
  const normalized = normalizeSafetyText(String(text || "")).trim();
  if (!normalized) return true;
  if (normalized.length > 40) return false;
  return GENERIC_GREETING_PATTERN.test(normalized);
}

export function isRetrievalEligibleMessage(message) {
  if (!message || !String(message.body || "").trim()) return false;
  if (message.origin === "imported_unknown") return false;
  if (message.contentStatus === "revoked" || message.contentStatus === "content_unavailable" || message.contentStatus === "redacted") {
    return false;
  }
  if (message.status === "blocked" || message.status === "draft") return false;
  if (message.retrievalEligibility && message.retrievalEligibility !== "eligible") return false;
  if (message.actorType === "unknown") return false;
  return true;
}

export function evaluateTemporalInstruction(message, timezone = "UTC", now = new Date().toISOString()) {
  const body = String(message?.body || "");
  const observedAt = message?.providerSentAt || message?.createdAt || now;
  const reference = new Date(observedAt);
  const current = new Date(now);
  if (!Number.isFinite(reference.getTime()) || !Number.isFinite(current.getTime())) {
    return { expired: false, hasExplicitTemporal: false };
  }

  const normalized = normalizeSafetyText(body);
  const hasExplicitTemporal =
    TEMPORAL_UNTIL_PATTERN.test(normalized) ||
    TEMPORAL_TODAY_PATTERN.test(normalized) ||
    TEMPORAL_TOMORROW_PATTERN.test(normalized);

  if (!hasExplicitTemporal) {
    return { expired: false, hasExplicitTemporal: false };
  }

  if (TEMPORAL_TODAY_PATTERN.test(normalized)) {
    const referenceDay = formatDateInTimeZone(reference, timezone);
    const currentDay = formatDateInTimeZone(current, timezone);
    return { expired: referenceDay !== currentDay, hasExplicitTemporal: true };
  }

  if (TEMPORAL_TOMORROW_PATTERN.test(normalized)) {
    const expectedDay = shiftDateInTimeZone(reference, timezone, 1);
    const currentDay = formatDateInTimeZone(current, timezone);
    return { expired: currentDay !== expectedDay, hasExplicitTemporal: true };
  }

  const untilDay = parseExplicitUntilDay(body, reference, timezone);
  if (!untilDay) {
    return { expired: true, hasExplicitTemporal: true, temporalParseFailed: true };
  }

  return {
    expired: formatDateInTimeZone(current, timezone) > untilDay,
    hasExplicitTemporal: true,
  };
}

export function retrieveHistoricalMessages({
  query,
  messages = [],
  recentMessageIds = [],
  timezone = "UTC",
  now = new Date().toISOString(),
  policy,
}) {
  const currentMessageId = policy?.currentMessageId || null;
  const eligible = (messages || []).filter((message) => {
    if (!isRetrievalEligibleMessage(message)) return false;
    if (currentMessageId && message.id === currentMessageId) return false;
    if (recentMessageIds.includes(message.id)) return false;
    const temporal = evaluateTemporalInstruction(message, timezone, now);
    if (temporal.expired) return false;
    return true;
  });

  const scored = eligible
    .map((message) => {
      const score = scoreLexicalRelevance(query, message.body);
      const dietitianAuthored = message.origin === "dietitian_manual";
      const supporting = message.origin === "client_inbound" || (message.origin === "ai_generated" && message.status === "sent");
      return {
        message,
        score,
        dietitianAuthored,
        supporting,
        relevanceReason: buildRelevanceReason(query, message.body, score),
        tokenEstimate: policy.estimateTokens(message.body),
        observedAt: message.providerSentAt || message.createdAt || null,
        conversationSequence: message.conversationSequence ?? null,
      };
    })
    .filter((item) => item.score >= (policy.minRelevanceScore ?? 0.2));

  const dietitianRanked = scored
    .filter((item) => item.dietitianAuthored && !isGenericGreeting(item.message.body))
    .sort(compareRetrievalCandidates)
    .slice(0, policy.maxHistoricalDietitianSources);

  const supportingRanked = scored
    .filter((item) => item.supporting)
    .sort(compareRetrievalCandidates)
    .slice(0, policy.maxHistoricalSupportingSources);

  let selected = [...dietitianRanked, ...supportingRanked];
  let usedTokens = 0;
  const accepted = [];
  const droppedForBudget = [];

  for (const candidate of selected) {
    if (accepted.length >= policy.maxHistoricalSources) break;
    if (usedTokens + candidate.tokenEstimate > policy.maxHistoricalTokens) {
      droppedForBudget.push(candidate);
      continue;
    }
    accepted.push(candidate);
    usedTokens += candidate.tokenEstimate;
  }

  const requiredDietitian = dietitianRanked.find((item) => item.score >= policy.minRelevanceScore);
  const requiredDropped =
    requiredDietitian &&
    !accepted.some((item) => item.message.id === requiredDietitian.message.id) &&
    droppedForBudget.some((item) => item.message.id === requiredDietitian.message.id);

  return {
    version: HISTORICAL_RETRIEVAL_VERSION,
    selected: accepted.map(toRetrievedSource),
    droppedForBudget: droppedForBudget.map(toRetrievedSource),
    overflowRequiredDietitian: Boolean(requiredDropped),
    totalTokenEstimate: usedTokens,
  };
}

export function detectStructuredRecordUpdateSignals({
  retrievedSources = [],
  structuredBaseline = {},
}) {
  const dietitianSources = retrievedSources.filter((source) => source.origin === "dietitian_manual");
  if (dietitianSources.length === 0) return [];

  const newest = [...dietitianSources].sort((left, right) => {
    const leftTime = new Date(left.providerSentAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.providerSentAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  })[0];

  if (!newest || !STRUCTURED_IMPACT_PATTERN.test(normalizeSafetyText(newest.body || ""))) {
    return [];
  }

  const newestTime = new Date(newest.providerSentAt || newest.createdAt || 0).getTime();
  const signals = [];

  if (structuredBaseline.menuPlanRevision != null && newestTime > Date.parse(structuredBaseline.menuPlanUpdatedAt || 0)) {
    signals.push({
      kind: "structured_record_update_required",
      targetPanel: "menu",
      sourceMessageId: newest.sourceId,
      baselineRevision: structuredBaseline.menuPlanRevision,
      reason: "newer_dietitian_whatsapp_instruction",
    });
  }
  if (structuredBaseline.foodRuleRevision != null && newestTime > Date.parse(structuredBaseline.foodRuleUpdatedAt || 0)) {
    signals.push({
      kind: "structured_record_update_required",
      targetPanel: "active_nutrition_plan",
      sourceMessageId: newest.sourceId,
      baselineRevision: structuredBaseline.foodRuleRevision,
      reason: "newer_dietitian_whatsapp_instruction",
    });
  }
  if (structuredBaseline.formRevision != null && newestTime > Date.parse(structuredBaseline.formUpdatedAt || 0)) {
    signals.push({
      kind: "structured_record_update_required",
      targetPanel: "client_form",
      sourceMessageId: newest.sourceId,
      baselineRevision: structuredBaseline.formRevision,
      reason: "newer_dietitian_whatsapp_instruction",
    });
  }
  if (
    structuredBaseline.dietPlanRevision != null &&
    structuredBaseline.dietPlanUpdatedAt &&
    newestTime > Date.parse(structuredBaseline.dietPlanUpdatedAt)
  ) {
    signals.push({
      kind: "structured_record_update_required",
      targetPanel: "diet_plan",
      sourceMessageId: newest.sourceId,
      baselineRevision: structuredBaseline.dietPlanRevision,
      reason: "newer_dietitian_whatsapp_instruction",
    });
  }

  return signals;
}

export function detectAmbiguousCompetingDietitianSources(retrievedSources = []) {
  const dietitianSources = retrievedSources.filter(
    (source) => source.origin === "dietitian_manual" && source.relevanceScore >= 0.35,
  );
  if (dietitianSources.length < 2) return [];

  const competing = [];
  for (let index = 0; index < dietitianSources.length; index += 1) {
    for (let inner = index + 1; inner < dietitianSources.length; inner += 1) {
      const left = dietitianSources[index];
      const right = dietitianSources[inner];
      const overlap = scoreLexicalRelevance(left.body, right.body);
      if (overlap < 0.15) {
        competing.push({
          kind: "ambiguous_competing_authoritative_source",
          sourceMessageIds: [left.sourceId, right.sourceId],
          reason: "competing_dietitian_instructions",
        });
      }
    }
  }
  return competing;
}

export function isRetrievalEvidencedDietitianMessage(query, message, minScore = 0.2) {
  if (message?.origin !== "dietitian_manual") return false;
  if (isGenericGreeting(message.body)) return false;
  return scoreLexicalRelevance(query, message.body) >= minScore;
}

function compareRetrievalCandidates(left, right) {
  if (right.score !== left.score) return right.score - left.score;
  const leftTime = new Date(left.observedAt || 0).getTime();
  const rightTime = new Date(right.observedAt || 0).getTime();
  if (rightTime !== leftTime) return rightTime - leftTime;
  return (right.conversationSequence || 0) - (left.conversationSequence || 0);
}

function buildRelevanceReason(query, body, score) {
  const overlap = tokenizeTranscriptText(query).filter((token) => tokenizeTranscriptText(body).includes(token));
  if (overlap.length === 0) return "actor_trust";
  if (score >= 0.5) return "shared_clinical_entity";
  return "lexical_overlap";
}

function parseExplicitUntilDay(body, reference, timezone) {
  const text = String(body || "");
  const match = text.match(TEMPORAL_EXPLICIT_DATE_PATTERN) || text.match(TEMPORAL_EXPLICIT_DATE_PREFIX_PATTERN);
  if (!match?.[1]) return null;

  const raw = match[1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parts = raw.split(/[./-]/).map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  const [day, month, suppliedYear] = parts;
  const year = suppliedYear == null ? Number(formatDateInTimeZone(reference, timezone).slice(0, 4)) : normalizeYear(suppliedYear);
  if (!isValidCalendarDay(year, month, day)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeYear(value) {
  return value < 100 ? 2000 + value : value;
}

function isValidCalendarDay(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

function toRetrievedSource(candidate) {
  return {
    sourceId: candidate.message.id,
    origin: candidate.message.origin,
    actorType: candidate.message.actorType || null,
    actorResolutionBasis: candidate.message.actorResolutionBasis || null,
    providerSentAt: candidate.message.providerSentAt || null,
    createdAt: candidate.message.createdAt || null,
    conversationSequence: candidate.conversationSequence,
    contentStatus: candidate.message.contentStatus || "available",
    relevanceReason: candidate.relevanceReason,
    relevanceScore: candidate.score,
    tokenEstimate: candidate.tokenEstimate,
    body: candidate.message.body,
    retrievalEvidenced: candidate.dietitianAuthored
      ? candidate.score >= 0.2 && !isGenericGreeting(candidate.message.body)
      : candidate.score > 0,
  };
}

function formatDateInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDateInTimeZone(date, timeZone, dayOffset) {
  const shifted = new Date(date.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  return formatDateInTimeZone(shifted, timeZone);
}

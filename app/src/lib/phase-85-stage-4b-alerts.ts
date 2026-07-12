import type {
  ClientRecord,
  ConversationRecord,
  DietitianFormResponseRecord,
  HandoffCaseRecord,
  MessageRecord,
} from "./types";
import {
  CLINICAL_ALERT_KIND_TO_REASON_LABEL_KEY,
  CLINICAL_ALERT_SEVERITY_RANK,
  type ClinicalAlertKind,
  type ClinicalAlertListItem,
  type ClinicalAlertReasonLabelKey,
  type ClinicalAlertSeverity,
  type ClinicalAlertSlaState,
  type Stage4BNavigationTarget,
} from "./phase-85-stage-4b-contracts";

export const PHASE_85_STAGE_4B_ALERTS_VERSION = "p85-stage-4b-alerts-v1";

const REASON_CODE_PRIORITY: ReadonlyArray<{ kind: ClinicalAlertKind; codes: readonly string[] }> = [
  {
    kind: "emergency_symptom",
    codes: ["possible_emergency_symptom"],
  },
  {
    kind: "severe_allergic_reaction",
    codes: ["possible_severe_allergic_reaction"],
  },
  {
    kind: "glucose_or_medication_safety",
    codes: ["critical_glucose_issue", "medication_or_insulin_dosing"],
  },
  {
    kind: "crisis_or_self_harm",
    codes: [
      "possible_eating_disorder_crisis",
      "self_harm_or_suicidal_language",
      "cumulative_body_image_weight_loss_pattern",
    ],
  },
  {
    kind: "pregnancy_or_lactation",
    codes: [
      "pregnancy_complication",
      "pregnancy_or_lactation_context",
      "profile_pregnancy_or_breastfeeding_context",
    ],
  },
  {
    kind: "symptom_or_condition",
    codes: [
      "symptom_question",
      "medical_condition_context",
      "profile_diagnosed_condition_context",
      "cumulative_repeated_symptom_pattern",
    ],
  },
  {
    kind: "medication_or_supplement",
    codes: ["supplement_or_medication_question", "profile_medication_or_supplement_context"],
  },
  {
    kind: "lab_result",
    codes: ["lab_or_diagnostic_result"],
  },
  {
    kind: "nutrition_plan_change",
    codes: ["plan_change_request", "cumulative_meal_restriction_pattern"],
  },
  {
    kind: "minor_or_body_image",
    codes: ["minor_or_body_image_weight_loss", "profile_eating_disorder_risk_context"],
  },
  {
    kind: "allergy_restriction_or_product",
    codes: [
      "food_rule_forbidden_food_approved",
      "food_rule_unauthorized_skip_relaxation",
      "food_rule_unauthorized_substitution",
      "food_rule_portion_or_macro_change",
      "food_rule_uncertain_review",
      "food_rule_mixed_intent",
      "food_rule_clinical_review_recommended",
      "food_rule_production_approval_required",
      "food_rule_structured_rules_missing",
      "food_decision_v2_product_label_required",
      "food_decision_v2_non_green_risk",
      "food_understanding_v3_mixed_dish_no_recipe",
      "food_understanding_v3_alias_pending_qa",
    ],
  },
  {
    kind: "context_ambiguity",
    codes: [
      "pending_context",
      "yellow_hold_pending_context",
      "client_marked_high_risk",
      "competing_authoritative_instructions",
      "missing_authoritative_context",
      "food_decision_v2_profile_missing",
    ],
  },
  {
    kind: "security_review",
    codes: ["prompt_injection_attempt"],
  },
];

const RED_SLA_MINUTES: Record<string, number> = {
  "15dk": 15,
  "30dk": 30,
  "1s": 60,
};

const YELLOW_SLA_MINUTES: Record<string, number> = {
  "1s": 60,
  "2s": 120,
  "4s": 240,
};

export type ClinicalAlertProjectionInput = {
  now: string;
  defaultTimezone: string;
  visibleClientIds: ReadonlySet<string>;
  clients: ClientRecord[];
  conversations: ConversationRecord[];
  handoffCases: HandoffCaseRecord[];
  messages: MessageRecord[];
  dietitianFormResponses: DietitianFormResponseRecord[];
  dietitianTimezones?: ReadonlyMap<string, string>;
};

export type ClinicalAlertFilterSeverity = "all" | ClinicalAlertSeverity;

export function buildRedClinicalAlertId(handoffId: string) {
  return `red:${handoffId}`;
}

export function buildYellowClinicalAlertId(clientId: string, firstMessageId: string) {
  return `yellow:${clientId}:${firstMessageId}`;
}

export function resolveClinicalAlertKind(reasonCodes: string[]): {
  kind: ClinicalAlertKind;
  reasonLabelKey: ClinicalAlertReasonLabelKey;
  additionalReasonCount: number;
} {
  const normalized = new Set(reasonCodes.filter((code) => typeof code === "string" && code.length > 0));
  let selectedKind: ClinicalAlertKind = "clinical_review_required";
  let matchedCount = 0;

  for (const entry of REASON_CODE_PRIORITY) {
    const matches = entry.codes.filter((code) => normalized.has(code));
    if (matches.length > 0) {
      selectedKind = entry.kind;
      matchedCount = matches.length;
      break;
    }
  }

  if (matchedCount === 0 && normalized.size > 0) {
    matchedCount = 1;
  }

  const additionalReasonCount = Math.max(0, normalized.size - matchedCount);
  return {
    kind: selectedKind,
    reasonLabelKey: CLINICAL_ALERT_KIND_TO_REASON_LABEL_KEY[selectedKind],
    additionalReasonCount,
  };
}

export function resolveDietitianClinicalSla(input: {
  severity: ClinicalAlertSeverity;
  startedAt: string;
  now: string;
  timezone: string;
  redResponseSla?: string | null;
  yellowReviewSla?: string | null;
}): {
  elapsedMinutes: number;
  slaDeadline: string | null;
  slaState: ClinicalAlertSlaState;
} {
  const startedMs = Date.parse(input.startedAt);
  const nowMs = Date.parse(input.now);
  const elapsedMinutes =
    Number.isFinite(startedMs) && Number.isFinite(nowMs)
      ? Math.max(0, Math.floor((nowMs - startedMs) / 60_000))
      : 0;

  const configuredValue =
    input.severity === "red" ? input.redResponseSla?.trim() : input.yellowReviewSla?.trim();
  if (!configuredValue) {
    return { elapsedMinutes, slaDeadline: null, slaState: "unconfigured" };
  }

  const minuteBudget =
    input.severity === "red"
      ? RED_SLA_MINUTES[configuredValue]
      : YELLOW_SLA_MINUTES[configuredValue];

  let slaDeadline: string | null = null;
  if (typeof minuteBudget === "number" && Number.isFinite(minuteBudget)) {
    slaDeadline = new Date(startedMs + minuteBudget * 60_000).toISOString();
  } else if (configuredValue.toLowerCase() === "ayni gun") {
    const calendarDeadline = resolveCalendarDayEndIso(input.startedAt, input.timezone);
    if (!calendarDeadline) {
      return { elapsedMinutes, slaDeadline: null, slaState: "unconfigured" };
    }
    slaDeadline = calendarDeadline;
  } else {
    return { elapsedMinutes, slaDeadline: null, slaState: "unconfigured" };
  }

  const deadlineMs = Date.parse(slaDeadline);
  const slaState: ClinicalAlertSlaState =
    Number.isFinite(deadlineMs) && nowMs > deadlineMs ? "overdue" : "within_sla";

  return { elapsedMinutes, slaDeadline, slaState };
}

export function sortClinicalAlerts(alerts: ClinicalAlertListItem[]): ClinicalAlertListItem[] {
  return [...alerts].sort((left, right) => {
    const severityDelta =
      CLINICAL_ALERT_SEVERITY_RANK[left.severity] - CLINICAL_ALERT_SEVERITY_RANK[right.severity];
    if (severityDelta !== 0) return severityDelta;

    const startedDelta = Date.parse(right.startedAt) - Date.parse(left.startedAt);
    if (startedDelta !== 0) return startedDelta;

    return left.id.localeCompare(right.id);
  });
}

export function filterClinicalAlerts(
  alerts: ClinicalAlertListItem[],
  input: { severity?: ClinicalAlertFilterSeverity; query?: string },
): ClinicalAlertListItem[] {
  const severity = input.severity ?? "all";
  const query = normalizeAlertQuery(input.query);
  return alerts.filter((alert) => {
    if (severity !== "all" && alert.severity !== severity) return false;
    if (!query) return true;
    return normalizeAlertQuery(alert.clientFullName).includes(query);
  });
}

export function projectClinicalAlerts(input: ClinicalAlertProjectionInput): ClinicalAlertListItem[] {
  const visibleClientIds = input.visibleClientIds;
  const conversationByClientId = new Map<string, ConversationRecord>();
  const conversationById = new Map(input.conversations.map((conversation) => [conversation.id, conversation]));
  for (const conversation of input.conversations) {
    const current = conversationByClientId.get(conversation.clientId);
    if (!current || conversation.id.localeCompare(current.id) < 0) {
      conversationByClientId.set(conversation.clientId, conversation);
    }
  }
  const handoffById = new Map(input.handoffCases.map((handoff) => [handoff.id, handoff]));
  const messageById = new Map(input.messages.map((message) => [message.id, message]));
  const alerts: ClinicalAlertListItem[] = [];

  for (const client of input.clients) {
    if (!visibleClientIds.has(client.id)) continue;
    if (client.lifecycleStatus !== "active") continue;

    const timezone = resolveClientDietitianTimezone(client.dietitianId, input);
    const slaConfig = resolveLatestDietitianSlaConfig(client.dietitianId, input.dietitianFormResponses);
    const conversation = conversationByClientId.get(client.id) ?? null;

    if (client.redRiskLock.status === "locked") {
      const redAlert = projectRedClinicalAlert({
        client,
        conversation,
        conversationById,
        handoffById,
        messageById,
        now: input.now,
        timezone,
        slaConfig,
      });
      if (redAlert) alerts.push(redAlert);
      continue;
    }

    if (client.yellowRiskHold.status === "active") {
      const yellowAlert = projectYellowClinicalAlert({
        client,
        conversation,
        messageById,
        now: input.now,
        timezone,
        slaConfig,
      });
      if (yellowAlert) alerts.push(yellowAlert);
    }
  }

  return sortClinicalAlerts(alerts);
}

function projectRedClinicalAlert(input: {
  client: ClientRecord;
  conversation: ConversationRecord | null;
  conversationById: ReadonlyMap<string, ConversationRecord>;
  handoffById: ReadonlyMap<string, HandoffCaseRecord>;
  messageById: ReadonlyMap<string, MessageRecord>;
  now: string;
  timezone: string;
  slaConfig: DietitianSlaConfig;
}): ClinicalAlertListItem | null {
  const lock = input.client.redRiskLock;
  if (lock.status !== "locked") return null;

  const handoff = input.handoffById.get(lock.handoffId);
  if (!handoff || handoff.clientId !== input.client.id) {
    return buildFallbackClinicalAlert({
      client: input.client,
      severity: "red",
      startedAt: lock.lockedAt,
      now: input.now,
      timezone: input.timezone,
      slaConfig: input.slaConfig,
      handoffId: lock.handoffId,
      sourceMessageId: null,
      activeDraftMessageId: null,
      alertId: buildRedClinicalAlertId(lock.handoffId),
    });
  }

  const handoffConversation = input.conversationById.get(handoff.conversationId);
  const conversation =
    handoffConversation && handoffConversation.clientId === input.client.id
      ? handoffConversation
      : null;
  const sourceMessageId = resolveSafeSourceMessageId(
    handoff.triggeringMessageId,
    lock.reasons,
    input.messageById,
    conversation?.id ?? null,
  );
  const taxonomy = resolveClinicalAlertKind(lock.reasons);
  const sla = resolveDietitianClinicalSla({
    severity: "red",
    startedAt: lock.lockedAt,
    now: input.now,
    timezone: input.timezone,
    redResponseSla: input.slaConfig.redResponseSla,
    yellowReviewSla: input.slaConfig.yellowReviewSla,
  });

  return {
    id: buildRedClinicalAlertId(lock.handoffId),
    clientId: input.client.id,
    conversationId: conversation?.id ?? null,
    clientFullName: input.client.fullName,
    severity: "red",
    kind: taxonomy.kind,
    reasonLabelKey: taxonomy.reasonLabelKey,
    additionalReasonCount: taxonomy.additionalReasonCount,
    sourceMessageId,
    activeDraftMessageId: null,
    handoffId: lock.handoffId,
    startedAt: lock.lockedAt,
    elapsedMinutes: sla.elapsedMinutes,
    slaDeadline: sla.slaDeadline,
    slaState: sla.slaState,
    target: buildClinicalAlertTarget({
      alertId: buildRedClinicalAlertId(lock.handoffId),
      clientId: input.client.id,
      conversationId: conversation?.id ?? null,
      messageId: sourceMessageId,
    }),
  };
}

function projectYellowClinicalAlert(input: {
  client: ClientRecord;
  conversation: ConversationRecord | null;
  messageById: ReadonlyMap<string, MessageRecord>;
  now: string;
  timezone: string;
  slaConfig: DietitianSlaConfig;
}): ClinicalAlertListItem | null {
  const hold = input.client.yellowRiskHold;
  if (hold.status !== "active") return null;

  const sourceMessageId = resolveSafeSourceMessageId(
    hold.latestMessageId || hold.firstMessageId,
    hold.messageIds,
    input.messageById,
    input.conversation?.id ?? null,
  );
  const activeDraftMessageId =
    hold.activeDraftMessageId && isMessageForConversation(input.messageById, hold.activeDraftMessageId, input.conversation?.id ?? null)
      ? hold.activeDraftMessageId
      : null;
  const taxonomy = resolveClinicalAlertKind(hold.reasons);
  const sla = resolveDietitianClinicalSla({
    severity: "yellow",
    startedAt: hold.startedAt,
    now: input.now,
    timezone: input.timezone,
    redResponseSla: input.slaConfig.redResponseSla,
    yellowReviewSla: input.slaConfig.yellowReviewSla,
  });
  const alertId = buildYellowClinicalAlertId(input.client.id, hold.firstMessageId);

  return {
    id: alertId,
    clientId: input.client.id,
    conversationId: input.conversation?.id ?? null,
    clientFullName: input.client.fullName,
    severity: "yellow",
    kind: taxonomy.kind,
    reasonLabelKey: taxonomy.reasonLabelKey,
    additionalReasonCount: taxonomy.additionalReasonCount,
    sourceMessageId,
    activeDraftMessageId,
    handoffId: null,
    startedAt: hold.startedAt,
    elapsedMinutes: sla.elapsedMinutes,
    slaDeadline: sla.slaDeadline,
    slaState: sla.slaState,
    target: buildClinicalAlertTarget({
      alertId,
      clientId: input.client.id,
      conversationId: input.conversation?.id ?? null,
      messageId: sourceMessageId ?? activeDraftMessageId,
    }),
  };
}

function buildFallbackClinicalAlert(input: {
  client: ClientRecord;
  severity: ClinicalAlertSeverity;
  startedAt: string;
  now: string;
  timezone: string;
  slaConfig: DietitianSlaConfig;
  handoffId: string | null;
  sourceMessageId: string | null;
  activeDraftMessageId: string | null;
  alertId: string;
}): ClinicalAlertListItem {
  const sla = resolveDietitianClinicalSla({
    severity: input.severity,
    startedAt: input.startedAt,
    now: input.now,
    timezone: input.timezone,
    redResponseSla: input.slaConfig.redResponseSla,
    yellowReviewSla: input.slaConfig.yellowReviewSla,
  });

  return {
    id: input.alertId,
    clientId: input.client.id,
    conversationId: null,
    clientFullName: input.client.fullName,
    severity: input.severity,
    kind: "clinical_review_required",
    reasonLabelKey: "alertReasonClinicalReviewRequired",
    additionalReasonCount: 0,
    sourceMessageId: input.sourceMessageId,
    activeDraftMessageId: input.activeDraftMessageId,
    handoffId: input.handoffId,
    startedAt: input.startedAt,
    elapsedMinutes: sla.elapsedMinutes,
    slaDeadline: sla.slaDeadline,
    slaState: sla.slaState,
    target: buildClinicalAlertTarget({
      alertId: input.alertId,
      clientId: input.client.id,
      conversationId: null,
      messageId: input.sourceMessageId ?? input.activeDraftMessageId,
    }),
  };
}

function buildClinicalAlertTarget(input: {
  alertId: string;
  clientId: string;
  conversationId: string | null;
  messageId: string | null;
}): Stage4BNavigationTarget {
  if (!input.conversationId) {
    return {
      section: "clients",
      clientId: input.clientId,
      source: "alert",
      sourceId: input.alertId,
    };
  }

  return {
    section: "messages",
    clientId: input.clientId,
    conversationId: input.conversationId,
    messageId: input.messageId ?? undefined,
    source: "alert",
    sourceId: input.alertId,
  };
}

function resolveSafeSourceMessageId(
  preferredMessageId: string | null | undefined,
  relatedIds: string[],
  visibleMessages: ReadonlyMap<string, MessageRecord>,
  conversationId: string | null,
): string | null {
  if (preferredMessageId && isMessageForConversation(visibleMessages, preferredMessageId, conversationId)) {
    return preferredMessageId;
  }
  for (const candidate of relatedIds) {
    if (isMessageForConversation(visibleMessages, candidate, conversationId)) return candidate;
  }
  return null;
}

function isMessageForConversation(
  messages: ReadonlyMap<string, MessageRecord>,
  messageId: string,
  conversationId: string | null,
) {
  const message = messages.get(messageId);
  return Boolean(message && conversationId && message.conversationId === conversationId);
}

type DietitianSlaConfig = {
  redResponseSla: string | null;
  yellowReviewSla: string | null;
};

function resolveLatestDietitianSlaConfig(
  dietitianId: string,
  responses: DietitianFormResponseRecord[],
): DietitianSlaConfig {
  const latest = responses
    .filter((response) => response.dietitianId === dietitianId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];

  if (!latest) {
    return { redResponseSla: null, yellowReviewSla: null };
  }

  return {
    redResponseSla: readStringAnswer(latest.answers.red_response_sla),
    yellowReviewSla: readStringAnswer(latest.answers.yellow_review_sla),
  };
}

function readStringAnswer(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveClientDietitianTimezone(
  dietitianId: string,
  input: ClinicalAlertProjectionInput,
) {
  return input.dietitianTimezones?.get(dietitianId) || input.defaultTimezone;
}

function normalizeAlertQuery(value: string | undefined) {
  return (value || "")
    .trim()
    .slice(0, 80)
    .toLocaleLowerCase("tr");
}

function resolveCalendarDayEndIso(startedAt: string, timezone: string) {
  const startedMs = Date.parse(startedAt);
  if (!Number.isFinite(startedMs)) return null;

  const local = readZonedDateTimeParts(new Date(startedMs), timezone);
  let low = startedMs;
  let high = startedMs + 36 * 60 * 60 * 1000;

  while (high - low > 1_000) {
    const mid = Math.floor((low + high) / 2);
    const parts = readZonedDateTimeParts(new Date(mid), timezone);
    const sameDay =
      parts.year === local.year && parts.month === local.month && parts.day === local.day;
    const afterTarget =
      parts.year > local.year ||
      (parts.year === local.year && parts.month > local.month) ||
      (parts.year === local.year && parts.month === local.month && parts.day > local.day) ||
      (sameDay && (parts.hour > 23 || (parts.hour === 23 && parts.minute >= 59)));

    if (afterTarget) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return new Date(high).toISOString();
}

function readZonedDateTimeParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

export function buildClinicalAlertProjectionInputFromState(
  state: {
    dietitian: { timezone: string };
    clients: ClientRecord[];
    conversations: ConversationRecord[];
    handoffCases: HandoffCaseRecord[];
    messages: MessageRecord[];
    dietitianFormResponses: DietitianFormResponseRecord[];
  },
  input: {
    now?: string;
    visibleClientIds?: ReadonlySet<string>;
    dietitianTimezones?: ReadonlyMap<string, string>;
  } = {},
): ClinicalAlertProjectionInput {
  return {
    now: input.now ?? new Date().toISOString(),
    defaultTimezone: state.dietitian.timezone,
    visibleClientIds: input.visibleClientIds ?? new Set(state.clients.map((client) => client.id)),
    clients: state.clients,
    conversations: state.conversations,
    handoffCases: state.handoffCases,
    messages: state.messages,
    dietitianFormResponses: state.dietitianFormResponses,
    dietitianTimezones: input.dietitianTimezones,
  };
}

export function projectClinicalAlertsFromState(
  state: {
    dietitian: { timezone: string };
    clients: ClientRecord[];
    conversations: ConversationRecord[];
    handoffCases: HandoffCaseRecord[];
    messages: MessageRecord[];
    dietitianFormResponses: DietitianFormResponseRecord[];
  },
  input: {
    now?: string;
    visibleClientIds?: ReadonlySet<string>;
    dietitianTimezones?: ReadonlyMap<string, string>;
  } = {},
) {
  return projectClinicalAlerts(buildClinicalAlertProjectionInputFromState(state, input));
}

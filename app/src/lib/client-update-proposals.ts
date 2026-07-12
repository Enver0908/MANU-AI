import { AppDomainError } from "./app-errors";
import { emitDraftInvalidatedNotifications } from "./phase-85-stage-4b-notifications";
import { assertChatSourceMutationAllowed } from "./phase-77b-chat-mutation-boundary";
import {
  parseEquivalentExchangeGroups,
  syncClientRecordFromFoodRuleAnswers,
} from "./phase-76d-food-rule-model";
import { serializeEquivalentExchangeGroups } from "./phase-76j-food-rule-dashboard";
import {
  extractFoodRuleProposalPatches,
  foodRuleProposalSafetyFlags,
  hasFoodRuleProposalPatch,
  PHASE_76K_FOOD_RULE_MULTISELECT_FIELD_IDS,
} from "./phase-76k-food-rule-proposal-patches";
import type {
  ClientFormResponseRecord,
  ClientUpdateProposalPatch,
  ClientUpdateProposalRecord,
  ManuAppState,
  MessageRecord,
} from "./types";

export type CreateClientUpdateProposalInput = {
  sourceText: string;
};

export type ApplyClientUpdateProposalInput = {
  proposedPatches?: ClientUpdateProposalPatch[];
};

const MAX_SOURCE_TEXT_CHARS = 1200;

const MANUAL_CONTROL_BLOCKERS = [
  "ai mode",
  "ai status",
  "ai aktif",
  "ai pasif",
  "autopilot",
  "copilot",
  "manual",
  "kanal izin",
  "channel permission",
  "opt out",
  "opt-out",
  "cikis",
  "red lock",
  "red risk",
  "yellow hold",
  "yellow lock",
];

export function createClientUpdateProposalInState(
  state: ManuAppState,
  clientId: string,
  input: CreateClientUpdateProposalInput,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");
  if (client.lifecycleStatus === "removed_anonymized") throw new AppDomainError(409, "client_removed_anonymized");

  const sourceText = input.sourceText.trim().slice(0, MAX_SOURCE_TEXT_CHARS);
  if (!sourceText) throw new AppDomainError(400, "client_update_proposal_source_required");

  assertChatSourceMutationAllowed();

  const proposedPatches = buildPatches(sourceText);
  const safetyFlags = dedupeFlags([
    ...detectSafetyFlags(sourceText),
    ...foodRuleProposalSafetyFlags(proposedPatches),
  ]);
  const status =
    proposedPatches.length > 0 ? "pending" : safetyFlags.length > 0 ? "unsupported" : "needs_clarification";
  const proposal: ClientUpdateProposalRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId: client.id,
    dietitianId: state.dietitian.id,
    sourceText,
    proposedPatches,
    safetyFlags,
    status,
    expectedContextRevision: client.contextRevision,
    createdAt,
    resolvedAt: status === "pending" ? null : createdAt,
  };

  return {
    ...state,
    clientUpdateProposals: [...state.clientUpdateProposals, proposal],
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "client_update_proposal_created",
        entityType: "client_update_proposal",
        entityId: proposal.id,
        metadata: {
          source: "dietitian_chat_update_proposal",
          clientId: client.id,
          status: proposal.status,
          patchCount: proposal.proposedPatches.length,
          minimized: true,
        },
        createdAt,
      },
    ],
  };
}

export function applyClientUpdateProposalInState(
  state: ManuAppState,
  clientId: string,
  proposalId: string,
  createdAt = new Date().toISOString(),
  input: ApplyClientUpdateProposalInput = {},
): ManuAppState {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");
  if (client.lifecycleStatus === "removed_anonymized") throw new AppDomainError(409, "client_removed_anonymized");

  assertChatSourceMutationAllowed();

  const proposal = state.clientUpdateProposals.find((item) => item.id === proposalId && item.clientId === clientId);
  if (!proposal) throw new AppDomainError(404, "client_update_proposal_not_found");
  if (proposal.status !== "pending") throw new AppDomainError(409, "client_update_proposal_not_pending");
  if (proposal.expectedContextRevision !== client.contextRevision) {
    throw new AppDomainError(409, "proposal_stale_recreate_required");
  }

  const response = findEditablePhase70Response(state, clientId);
  if (!response) throw new AppDomainError(409, "client_update_proposal_form_response_required");

  const proposedPatches = resolveApplicablePatches(proposal, input);
  const appliedProposal: ClientUpdateProposalRecord = { ...proposal, proposedPatches };
  const nextResponse = applyPatchesToFormResponse(response, proposedPatches, createdAt);
  let nextClient = applyPatchesToClient(client, proposedPatches, createdAt);
  if (hasFoodRuleProposalPatch(proposedPatches)) {
    nextClient = syncClientRecordFromFoodRuleAnswers(nextClient, nextResponse.answers);
  }
  const contextUpdate = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId: client.id,
    dietitianId: state.dietitian.id,
    source: "other" as const,
    occurredAt: createdAt,
    title: "Dietitian chat form update",
    summary: summarizeProposal(appliedProposal),
    details: "",
    importance: hasClinicalSafetyPatch(proposal.proposedPatches) ? ("critical" as const) : ("important" as const),
    status: "active" as const,
    supersedesUpdateId: null,
    createdAt,
  };

  const nextState: ManuAppState = {
    ...state,
    clientFormResponses: state.clientFormResponses.map((item) => (item.id === nextResponse.id ? nextResponse : item)),
    clients: state.clients.map((item) =>
      item.id === clientId ? { ...nextClient, contextRevision: item.contextRevision + 1 } : item,
    ),
    clientContextUpdates: [...state.clientContextUpdates, contextUpdate],
    clientUpdateProposals: state.clientUpdateProposals.map((item) =>
      item.id === proposal.id ? { ...item, proposedPatches, status: "applied" as const, resolvedAt: createdAt } : item,
    ),
    messages: [
      ...state.messages,
      ...buildSystemMessagesForClient(state, clientId, "Dietitian chat update applied to client context.", createdAt),
    ],
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "client_update_proposal_applied",
        entityType: "client_update_proposal",
        entityId: proposal.id,
        metadata: {
          source: "dietitian_chat_update_proposal",
          clientId,
          patchCount: proposedPatches.length,
          hasClinicalSafetyPatch: hasClinicalSafetyPatch(proposedPatches),
          hasFoodRulePatch: hasFoodRuleProposalPatch(proposedPatches),
          minimized: true,
        },
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "client_context_update_created",
        entityType: "client_context_update",
        entityId: contextUpdate.id,
        metadata: { source: "dietitian_chat_update_proposal", clientId, importance: contextUpdate.importance, minimized: true },
        createdAt,
      },
    ],
  };

  return invalidatePendingDrafts(nextState, clientId, createdAt);
}

function resolveApplicablePatches(proposal: ClientUpdateProposalRecord, input: ApplyClientUpdateProposalInput) {
  if (!input.proposedPatches) return proposal.proposedPatches;
  if (!Array.isArray(input.proposedPatches)) throw new AppDomainError(400, "client_update_proposal_patches_invalid");
  const originalByKey = new Map(proposal.proposedPatches.map((patch) => [patchIdentity(patch), patch]));
  const resolved = input.proposedPatches.map((patch) => {
    const original = originalByKey.get(patchIdentity(patch));
    if (!original) throw new AppDomainError(400, "client_update_proposal_patch_not_editable");
    const value = String(patch.value || "").trim().slice(0, 500);
    if (!value) throw new AppDomainError(400, "client_update_proposal_patch_value_required");
    return { ...original, value };
  });
  const deduped = dedupePatches(resolved);
  if (deduped.length === 0) throw new AppDomainError(400, "client_update_proposal_no_patches_to_apply");
  return deduped;
}

function patchIdentity(patch: Pick<ClientUpdateProposalPatch, "target" | "fieldId" | "operation">) {
  return `${patch.target}:${patch.fieldId}:${patch.operation}`;
}

export function rejectClientUpdateProposalInState(
  state: ManuAppState,
  clientId: string,
  proposalId: string,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const proposal = state.clientUpdateProposals.find((item) => item.id === proposalId && item.clientId === clientId);
  if (!proposal) throw new AppDomainError(404, "client_update_proposal_not_found");
  if (proposal.status !== "pending") throw new AppDomainError(409, "client_update_proposal_not_pending");

  return {
    ...state,
    clientUpdateProposals: state.clientUpdateProposals.map((item) =>
      item.id === proposal.id ? { ...item, status: "rejected" as const, resolvedAt: createdAt } : item,
    ),
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "client_update_proposal_rejected",
        entityType: "client_update_proposal",
        entityId: proposal.id,
        metadata: { source: "dietitian_chat_update_proposal", clientId, minimized: true },
        createdAt,
      },
    ],
  };
}

function detectSafetyFlags(sourceText: string) {
  const normalized = normalizeText(sourceText);
  return MANUAL_CONTROL_BLOCKERS.filter((item) => normalized.includes(normalizeText(item))).map(
    (item) => `manual_control_required_${normalizeText(item).replace(/\s+/g, "_")}`,
  );
}

function buildPatches(sourceText: string): ClientUpdateProposalPatch[] {
  const patches: ClientUpdateProposalPatch[] = [];
  for (const clause of splitClauses(sourceText)) {
    patches.push(...extractFoodRuleProposalPatches(clause));

    const forbidden = extractTerm(clause, /(yemesin|yememeli|yasak|olmasin|olmasin|listeden cikar|listeden cikar)/i);
    if (forbidden) {
      patches.push(formPatch("forbidden_substitutions", "Yasak alternatifler", forbidden, "append_unique", "nutrition"));
      patches.push(formPatch("restricted_foods_medical", "Tibbi kisitli besinler", forbidden, "append_unique", "nutrition"));
      patches.push(clientPatch("restrictedFoods", "Restricted foods", forbidden, "append_unique", "nutrition"));
      continue;
    }

    const allowed = extractTerm(clause, /(serbest|olabilir|uygun|izinli)/i);
    if (allowed) {
      patches.push(formPatch("allowed_substitutions", "Izinli alternatifler", allowed, "append_unique", "nutrition"));
      continue;
    }

    const safetyPatches = buildClinicalSafetyPatches(clause);
    if (safetyPatches.length > 0) {
      patches.push(...safetyPatches);
      continue;
    }

    const planNote = /\b(plan|liste|diyet)\b/i.test(clause) && clause.length >= 8 ? clause.trim() : "";
    if (planNote) {
      patches.push(formPatch("active_diet_plan_summary", "Aktif plan ozeti", planNote, "append_note", "nutrition"));
      patches.push(clientPatch("dietPlan.summary", "Diet plan summary", planNote, "append_note", "nutrition"));
    }
  }

  return dedupePatches(patches);
}

function buildClinicalSafetyPatches(clause: string): ClientUpdateProposalPatch[] {
  const normalized = normalizeText(clause);
  const patches: ClientUpdateProposalPatch[] = [];

  if (hasAny(normalized, ["hamile", "gebe", "gebelik"])) {
    patches.push(formPatch("pregnancy_or_breastfeeding_flag", "Gebelik/emzirme", "Gebe", "set_value", "clinical_safety"));
  } else if (hasAny(normalized, ["emziriyor", "emzirme", "emzir"])) {
    patches.push(formPatch("pregnancy_or_breastfeeding_flag", "Gebelik/emzirme", "Emziriyor", "set_value", "clinical_safety"));
  }

  if (hasAny(normalized, ["minor", "cocuk", "cocuktur", "resit degil"])) {
    patches.push(formPatch("adult_status", "Yetiskin/minor", "Minor", "set_value", "clinical_safety"));
  } else if (hasAny(normalized, ["yetiskin", "adult", "resit"])) {
    patches.push(formPatch("adult_status", "Yetiskin/minor", "Adult", "set_value", "clinical_safety"));
  }

  if (hasAny(normalized, ["tani", "tanili", "hastalik", "diyabet", "glukoz"])) {
    patches.push(formPatch("diagnosed_condition_flag", "Tanili hastalik", "Evet", "set_value", "clinical_safety"));
    patches.push(formPatch("diagnosed_condition_details", "Tani detaylari", clause.trim(), "append_note", "sensitive_detail"));
  }

  if (hasAny(normalized, ["ilac", "insulin", "doz", "medikasyon"])) {
    patches.push(formPatch("medication_or_insulin_flag", "Ilac/insulin", "Evet", "set_value", "clinical_safety"));
    patches.push(formPatch("medication_details", "Ilac detaylari", clause.trim(), "append_note", "sensitive_detail"));
  }

  if (hasAny(normalized, ["lab", "kan tahlili", "tahlil", "sonuc", "sonucu"])) {
    patches.push(formPatch("lab_result_available", "Lab sonucu var mi", "Evet", "set_value", "clinical_safety"));
    patches.push(formPatch("lab_result_details", "Lab detaylari", clause.trim(), "append_note", "sensitive_detail"));
  }

  if (hasAny(normalized, ["semptom", "belirti", "bas donmesi", "bas agrisi", "mide bulantisi", "halsizlik"])) {
    patches.push(formPatch("recent_symptom_flag", "Son donem belirti", "Evet", "set_value", "clinical_safety"));
    patches.push(formPatch("symptom_details", "Belirti detaylari", clause.trim(), "append_note", "sensitive_detail"));
  }

  if (hasAny(normalized, ["yeme bozuklugu", "kusma", "purge", "binging", "tikinti"])) {
    patches.push(formPatch("eating_disorder_risk_flag", "Yeme bozuklugu riski", "Evet", "set_value", "clinical_safety"));
  }

  return patches;
}

function hasAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(normalizeText(needle)));
}

function formPatch(
  fieldId: string,
  label: string,
  value: string,
  operation: ClientUpdateProposalPatch["operation"] = "append_unique",
  category: ClientUpdateProposalPatch["category"] = "nutrition",
): ClientUpdateProposalPatch {
  return { target: "client_form_answer", fieldId, label, operation, value, category, editable: true, impactLabel: impactFor(category) };
}

function clientPatch(
  fieldId: string,
  label: string,
  value: string,
  operation: ClientUpdateProposalPatch["operation"] = "append_unique",
  category: ClientUpdateProposalPatch["category"] = "nutrition",
): ClientUpdateProposalPatch {
  return { target: "client_record", fieldId, label, operation, value, category, editable: true, impactLabel: impactFor(category) };
}

function impactFor(category: ClientUpdateProposalPatch["category"]) {
  if (category === "clinical_safety") return "Updates safety routing context after dietitian approval.";
  if (category === "sensitive_detail") return "Stored in form only; not a direct prompt source.";
  if (category === "food_rule") return "Updates structured food-rule fields after dietitian approval.";
  return "Updates dietitian-approved nutrition context.";
}

function splitClauses(sourceText: string) {
  return sourceText
    .split(/[.,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractTerm(clause: string, marker: RegExp) {
  const markerMatch = clause.match(marker);
  if (!markerMatch || markerMatch.index === undefined) return "";
  const before = clause.slice(0, markerMatch.index).replace(/\bartik\b|\bbu\b|\bdanisan\b/gi, "").trim();
  const after = clause.slice(markerMatch.index + markerMatch[0].length).replace(/^[:\s]+/, "").trim();
  const raw = before || after;
  return cleanTerm(raw);
}

function cleanTerm(value: string) {
  const words = value
    .replace(/["'`]/g, "")
    .split(/\s+/)
    .filter((word) => !["icin", "musteri", "artik"].includes(normalizeText(word)));
  if (words.length > 1 && /^[A-Z]/.test(words[0])) {
    words.shift();
  }
  return words.slice(-4).join(" ").trim();
}

function findEditablePhase70Response(state: ManuAppState, clientId: string) {
  const activeSchema = [...state.clientFormSchemas]
    .filter(
      (schema) =>
        schema.status === "published" &&
        (schema.registryVersion === "phase-70-form-registry-v1" ||
          schema.registryVersion === "phase-76d-food-rule-registry-v1" ||
          schema.registryVersion === "phase-77c-client-personal-form-v2"),
    )
    .sort((a, b) => b.version - a.version)[0];
  if (!activeSchema) return null;
  return (
    state.clientFormResponses.find((response) => response.clientId === clientId && response.schemaId === activeSchema.id) || null
  );
}

function applyPatchesToFormResponse(
  response: ClientFormResponseRecord,
  patches: ClientUpdateProposalPatch[],
  createdAt: string,
): ClientFormResponseRecord {
  const answers = { ...response.answers };
  for (const patch of patches.filter((item) => item.target === "client_form_answer")) {
    if (patch.operation === "set_value") {
      answers[patch.fieldId] = patch.value;
      continue;
    }
    if (patch.operation === "append_note") {
      answers[patch.fieldId] = appendNote(answers[patch.fieldId], patch.value, createdAt);
      continue;
    }
    if (patch.operation === "merge_exchange_group") {
      answers[patch.fieldId] = mergeExchangeGroupValue(answers[patch.fieldId], patch.value);
      continue;
    }
    if (PHASE_76K_FOOD_RULE_MULTISELECT_FIELD_IDS.has(patch.fieldId)) {
      answers[patch.fieldId] = appendUniqueMultiselect(answers[patch.fieldId], patch.value);
      continue;
    }
    answers[patch.fieldId] = appendUniqueLine(answers[patch.fieldId], patch.value);
  }
  return { ...response, answers, updatedAt: createdAt };
}

function applyPatchesToClient(
  client: ManuAppState["clients"][number],
  patches: ClientUpdateProposalPatch[],
  createdAt: string,
): ManuAppState["clients"][number] {
  let next = {
    ...client,
    healthProfile: { ...client.healthProfile },
    dietPlan: { ...client.dietPlan },
    allergies: [...client.allergies],
    restrictedFoods: [...client.restrictedFoods],
    pinnedNotes: [...client.pinnedNotes],
  };
  for (const patch of patches.filter((item) => item.target === "client_record")) {
    if (patch.fieldId === "restrictedFoods") {
      next = { ...next, restrictedFoods: appendUniqueArray(next.restrictedFoods, patch.value) };
    } else if (patch.fieldId === "allergies") {
      next = { ...next, allergies: appendUniqueArray(next.allergies, patch.value) };
    } else if (patch.fieldId === "pinnedNotes") {
      next = { ...next, pinnedNotes: appendUniqueArray(next.pinnedNotes, patch.value) };
    } else if (patch.fieldId === "dietPlan.summary") {
      next = { ...next, dietPlan: { ...next.dietPlan, summary: appendNote(next.dietPlan.summary, patch.value, createdAt) } };
    }
  }
  for (const patch of patches.filter((item) => item.target === "client_form_answer" && item.operation === "set_value")) {
    if (patch.fieldId === "adult_status") {
      next = { ...next, healthProfile: { ...next.healthProfile, adultStatus: mapAdultStatus(patch.value) } };
    } else if (patch.fieldId === "diagnosed_condition_flag") {
      next = { ...next, healthProfile: { ...next.healthProfile, diagnosedConditionFlag: isAffirmative(patch.value) } };
    } else if (patch.fieldId === "medication_or_insulin_flag") {
      next = { ...next, healthProfile: { ...next.healthProfile, medicationOrSupplementFlag: isAffirmative(patch.value) } };
    } else if (patch.fieldId === "pregnancy_or_breastfeeding_flag") {
      next = { ...next, healthProfile: { ...next.healthProfile, pregnancyOrBreastfeedingFlag: normalizeText(patch.value) !== "hayir" } };
    } else if (patch.fieldId === "eating_disorder_risk_flag") {
      next = { ...next, healthProfile: { ...next.healthProfile, eatingDisorderRiskFlag: isAffirmative(patch.value) } };
    }
  }
  return next;
}

function mapAdultStatus(value: string): ManuAppState["clients"][number]["healthProfile"]["adultStatus"] {
  const normalized = normalizeText(value);
  if (normalized.includes("minor")) return "minor";
  if (normalized.includes("adult") || normalized.includes("yetiskin")) return "adult";
  return "unknown";
}

function isAffirmative(value: string) {
  const normalized = normalizeText(value);
  return normalized === "evet" || normalized === "yes" || normalized === "var" || normalized === "true";
}

function appendUniqueLine(current: unknown, value: string) {
  const existing = String(current || "").trim();
  if (!existing) return value;
  const normalizedValue = normalizeText(value);
  const lines = existing.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return lines.some((line) => normalizeText(line) === normalizedValue) ? existing : `${existing}\n${value}`;
}

function appendNote(current: unknown, value: string, createdAt: string) {
  const note = `[${createdAt.slice(0, 10)}] ${value}`;
  return appendUniqueLine(current, note);
}

function appendUniqueArray(current: string[], value: string) {
  return current.some((item) => normalizeText(item) === normalizeText(value)) ? current : [...current, value];
}

function appendUniqueMultiselect(current: unknown, value: string) {
  const existing = Array.isArray(current)
    ? current.map((item) => String(item).trim()).filter(Boolean)
    : String(current || "")
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
  return appendUniqueArray(existing, value);
}

function mergeExchangeGroupValue(current: unknown, value: string) {
  const [rawGroupId, rawItems] = value.split(":");
  const groupId = rawGroupId.trim();
  const items = String(rawItems || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!groupId || items.length === 0) return current;

  const groups = parseEquivalentExchangeGroups(current);
  const existing = groups.find((group) => group.groupId === groupId);
  if (existing) {
    existing.items = [...new Set([...existing.items, ...items])];
  } else {
    groups.push({ groupId, items });
  }
  return serializeEquivalentExchangeGroups(groups);
}

function dedupeFlags(flags: string[]) {
  return [...new Set(flags)];
}

function summarizeProposal(proposal: ClientUpdateProposalRecord) {
  return proposal.proposedPatches
    .map((patch) => `${patch.label}: ${patch.value}`)
    .filter(Boolean)
    .join("; ");
}

function hasClinicalSafetyPatch(patches: ClientUpdateProposalPatch[]) {
  return patches.some((patch) => patch.category === "clinical_safety" || patch.category === "sensitive_detail");
}

function buildSystemMessagesForClient(state: ManuAppState, clientId: string, body: string, createdAt: string): MessageRecord[] {
  const conversation = state.conversations.find((item) => item.clientId === clientId);
  if (!conversation) return [];
  return [
    {
      id: crypto.randomUUID(),
      tenantId: state.tenant.id,
      conversationId: conversation.id,
      sender: "system",
      origin: "system_event",
      body,
      status: "stored",
      createdAt,
    },
  ];
}

function invalidatePendingDrafts(state: ManuAppState, clientId: string, createdAt: string): ManuAppState {
  const conversationIds = new Set(
    state.conversations.filter((conversation) => conversation.clientId === clientId).map((conversation) => conversation.id),
  );
  const draftMessages = state.messages.filter(
    (message) =>
      message.origin === "ai_generated" &&
      message.status === "draft" &&
      conversationIds.has(message.conversationId),
  );
  if (draftMessages.length === 0) return state;

  const decisionIds = new Set(draftMessages.map((message) => message.generatedByAiDecisionId).filter(Boolean));
  const next = {
    ...state,
    messages: state.messages.map((message) =>
      draftMessages.some((draft) => draft.id === message.id) ? { ...message, status: "blocked" as const } : message,
    ),
    aiDecisions: state.aiDecisions.map((decision) =>
      decisionIds.has(decision.id)
        ? { ...decision, sendStatus: "draft_invalidated" as const, blockedReason: "client_update_proposal_applied" }
        : decision,
    ),
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "draft_context_invalidated",
        entityType: "client",
        entityId: clientId,
        metadata: { source: "client_update_proposal", minimized: true },
        createdAt,
      },
    ],
  };
  const client = state.clients.find((item) => item.id === clientId);
  const conversation = state.conversations.find((item) => item.clientId === clientId);
  return client && conversation
    ? emitDraftInvalidatedNotifications(next, {
        clientId,
        conversationId: conversation.id,
        clientName: client.fullName,
        decisionIds: [...decisionIds].filter((id): id is string => Boolean(id)),
        reason: "client_update_proposal_applied",
        now: createdAt,
      })
    : next;
}

function dedupePatches(patches: ClientUpdateProposalPatch[]) {
  return [...new Map(patches.map((patch) => [`${patch.target}:${patch.fieldId}:${normalizeText(patch.value)}`, patch])).values()];
}

function normalizeText(value: string) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

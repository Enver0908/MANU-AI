import { AppDomainError } from "./app-errors";
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

const MAX_SOURCE_TEXT_CHARS = 1200;

const SENSITIVE_BLOCKERS = [
  "ilac",
  "ilaç",
  "insulin",
  "insülin",
  "doz",
  "tani",
  "tanı",
  "lab",
  "kan tahlili",
  "semptom",
  "belirti",
  "gebelik",
  "hamile",
  "emzir",
  "minor",
  "cocuk",
  "çocuk",
  "yeme bozuklugu",
  "yeme bozukluğu",
  "ai mode",
  "ai status",
  "kanal izin",
  "channel permission",
  "red lock",
  "yellow hold",
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

  const safetyFlags = detectSafetyFlags(sourceText);
  const proposedPatches = safetyFlags.length > 0 ? [] : buildPatches(sourceText);
  const status =
    safetyFlags.length > 0 ? "unsupported" : proposedPatches.length > 0 ? "pending" : "needs_clarification";
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
): ManuAppState {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");
  if (client.lifecycleStatus === "removed_anonymized") throw new AppDomainError(409, "client_removed_anonymized");

  const proposal = state.clientUpdateProposals.find((item) => item.id === proposalId && item.clientId === clientId);
  if (!proposal) throw new AppDomainError(404, "client_update_proposal_not_found");
  if (proposal.status !== "pending") throw new AppDomainError(409, "client_update_proposal_not_pending");
  if (proposal.expectedContextRevision !== client.contextRevision) {
    throw new AppDomainError(409, "proposal_stale_recreate_required");
  }

  const response = findEditablePhase70Response(state, clientId);
  if (!response) throw new AppDomainError(409, "client_update_proposal_form_response_required");

  const nextResponse = applyPatchesToFormResponse(response, proposal.proposedPatches, createdAt);
  const nextClient = applyPatchesToClient(client, proposal.proposedPatches, createdAt);
  const contextUpdate = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId: client.id,
    dietitianId: state.dietitian.id,
    source: "other" as const,
    occurredAt: createdAt,
    title: "Dietitian chat form update",
    summary: summarizeProposal(proposal),
    details: "",
    importance: "important" as const,
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
      item.id === proposal.id ? { ...item, status: "applied" as const, resolvedAt: createdAt } : item,
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
        metadata: { source: "dietitian_chat_update_proposal", clientId, patchCount: proposal.proposedPatches.length, minimized: true },
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
  return SENSITIVE_BLOCKERS.filter((item) => normalized.includes(normalizeText(item))).map((item) => `unsupported_${item}`);
}

function buildPatches(sourceText: string): ClientUpdateProposalPatch[] {
  const patches: ClientUpdateProposalPatch[] = [];
  for (const clause of splitClauses(sourceText)) {
    const forbidden = extractTerm(clause, /(yemesin|yememeli|yasak|olmasin|olmasın|listeden cikar|listeden çıkar)/i);
    if (forbidden) {
      patches.push(formPatch("forbidden_substitutions", "Yasak alternatifler", forbidden));
      patches.push(formPatch("restricted_foods_medical", "Tibbi kisitli besinler", forbidden));
      patches.push(clientPatch("restrictedFoods", "Restricted foods", forbidden));
      continue;
    }

    const allowed = extractTerm(clause, /(serbest|olabilir|uygun|izinli)/i);
    if (allowed) {
      patches.push(formPatch("allowed_substitutions", "Izinli alternatifler", allowed));
      continue;
    }

    const planNote = clause.match(/\b(plan|liste|diyet)\b/i) && clause.length >= 8 ? clause.trim() : "";
    if (planNote) {
      patches.push(formPatch("active_diet_plan_summary", "Aktif plan ozeti", planNote, "append_note"));
      patches.push(clientPatch("dietPlan.summary", "Diet plan summary", planNote, "append_note"));
    }
  }

  return dedupePatches(patches);
}

function formPatch(
  fieldId: string,
  label: string,
  value: string,
  operation: ClientUpdateProposalPatch["operation"] = "append_unique",
): ClientUpdateProposalPatch {
  return { target: "client_form_answer", fieldId, label, operation, value };
}

function clientPatch(
  fieldId: string,
  label: string,
  value: string,
  operation: ClientUpdateProposalPatch["operation"] = "append_unique",
): ClientUpdateProposalPatch {
  return { target: "client_record", fieldId, label, operation, value };
}

function splitClauses(sourceText: string) {
  return sourceText
    .split(/[.,;\n]+|\s+ve\s+/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractTerm(clause: string, marker: RegExp) {
  const markerMatch = clause.match(marker);
  if (!markerMatch || markerMatch.index === undefined) return "";
  const before = clause.slice(0, markerMatch.index).replace(/\bartik\b|\bartık\b|\bbu\b|\bdanisan\b|\bdanışan\b/gi, "").trim();
  const after = clause.slice(markerMatch.index + markerMatch[0].length).replace(/^[:\s]+/, "").trim();
  const raw = before || after;
  return cleanTerm(raw);
}

function cleanTerm(value: string) {
  const words = value
    .replace(/["'`]/g, "")
    .split(/\s+/)
    .filter((word) => !["icin", "için", "musteri", "müşteri", "artik", "artık"].includes(normalizeText(word)));
  if (words.length > 1 && /^[A-ZÇĞİÖŞÜ]/.test(words[0])) {
    words.shift();
  }
  return words.slice(-4).join(" ").trim();
}

function findEditablePhase70Response(state: ManuAppState, clientId: string) {
  const activeSchema = [...state.clientFormSchemas]
    .filter((schema) => schema.status === "published" && schema.registryVersion === "phase-70-form-registry-v1")
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
    answers[patch.fieldId] =
      patch.operation === "append_note"
        ? appendNote(answers[patch.fieldId], patch.value, createdAt)
        : appendUniqueLine(answers[patch.fieldId], patch.value);
  }
  return { ...response, answers, updatedAt: createdAt };
}

function applyPatchesToClient(
  client: ManuAppState["clients"][number],
  patches: ClientUpdateProposalPatch[],
  createdAt: string,
): ManuAppState["clients"][number] {
  let next = { ...client, dietPlan: { ...client.dietPlan }, allergies: [...client.allergies], restrictedFoods: [...client.restrictedFoods], pinnedNotes: [...client.pinnedNotes] };
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
  return next;
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

function summarizeProposal(proposal: ClientUpdateProposalRecord) {
  return proposal.proposedPatches
    .map((patch) => `${patch.label}: ${patch.value}`)
    .filter(Boolean)
    .join("; ");
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
  return {
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

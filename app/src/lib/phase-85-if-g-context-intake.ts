import { AppDomainError } from "./app-errors";
import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import { createClientContextUpdateInState } from "./client-context-updates";
import { normalizeE164Phone } from "./languages";
import type {
  ClientContextUpdateImportance,
  ClientContextUpdateSource,
  ClientRecord,
  ContextIntakeProposalRecord,
  ContextIntakeProposalStatus,
  ManuAppState,
} from "./types";

export const PHASE_85_IF_G_CONTEXT_INTAKE_VERSION = "p85-if-g-context-intake-v1";
export const CONTEXT_INTAKE_PROPOSAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ContextIntakeStructuredImpactFlag = "form" | "active_plan" | "food_rules" | "menu_plan";

export const CONTEXT_INTAKE_STRUCTURED_PANEL_LINKS: Record<ContextIntakeStructuredImpactFlag, string> = {
  form: "tab_personal_form",
  active_plan: "tab_critical_context",
  food_rules: "tab_food_rules",
  menu_plan: "tab_menu",
};

export type ResolveContextIntakeClientInput = {
  fullName?: string;
  phoneE164?: string;
  clientId?: string;
  confirmFullName?: string;
  confirmPhoneE164?: string;
};

export type CreateContextIntakeProposalInput = {
  sourceText: string;
  intakeSource: ClientContextUpdateSource;
  occurredAt?: string | null;
  title?: string;
  summary?: string;
  details?: string;
  importance?: ClientContextUpdateImportance;
  rawSourceReference?: string | null;
};

export type ContextIntakeClientResolution =
  | { status: "resolved"; client: ClientRecord }
  | { status: "not_found" }
  | { status: "ambiguous"; clients: ClientRecord[] }
  | { status: "mismatch" }
  | { status: "removed" };

export type ContextIntakePreview = {
  clientId: string;
  clientFullName: string;
  clientPhoneE164: string;
  title: string;
  summary: string;
  details: string;
  importance: ClientContextUpdateImportance;
  intakeSource: ClientContextUpdateSource;
  occurredAt: string;
  structuredImpactFlags: ContextIntakeStructuredImpactFlag[];
  requiredPanels: Array<{ flag: ContextIntakeStructuredImpactFlag; deepLink: string }>;
  status: ContextIntakeProposalStatus;
};

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export function digestContextIntakeSourceText(sourceText: string) {
  let hash = 2166136261;
  for (let index = 0; index < sourceText.length; index += 1) {
    hash ^= sourceText.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function resolveContextIntakeClient(
  state: ManuAppState,
  input: ResolveContextIntakeClientInput,
): ContextIntakeClientResolution {
  const visibleClients = state.clients.filter((client) => client.lifecycleStatus !== "removed_anonymized");

  if (input.clientId) {
    const client = visibleClients.find((item) => item.id === input.clientId);
    if (!client) {
      const removed = state.clients.find((item) => item.id === input.clientId);
      return removed?.lifecycleStatus === "removed_anonymized" ? { status: "removed" } : { status: "not_found" };
    }

    if (!input.confirmFullName?.trim() || !input.confirmPhoneE164?.trim()) {
      return { status: "mismatch" };
    }

    const confirmName = normalizeSearch(input.confirmFullName);
    const confirmPhone = normalizeE164Phone(input.confirmPhoneE164);

    if (normalizeSearch(client.fullName) !== confirmName) return { status: "mismatch" };
    if (client.primaryPhoneE164 !== confirmPhone) return { status: "mismatch" };
    return { status: "resolved", client };
  }

  const fullName = input.fullName?.trim();
  const phoneE164 = input.phoneE164 ? normalizeE164Phone(input.phoneE164) : null;
  if (!fullName || !phoneE164) return { status: "not_found" };

  const normalizedName = normalizeSearch(fullName);
  const matches = visibleClients.filter(
    (client) => normalizeSearch(client.fullName) === normalizedName && client.primaryPhoneE164 === phoneE164,
  );

  if (matches.length === 1) return { status: "resolved", client: matches[0]! };
  if (matches.length > 1) return { status: "ambiguous", clients: matches };
  return { status: "not_found" };
}

export function detectContextIntakeStructuredImpact(sourceText: string): ContextIntakeStructuredImpactFlag[] {
  const normalized = normalizeSearch(sourceText);
  const flags = new Set<ContextIntakeStructuredImpactFlag>();

  if (hasAny(normalized, ["form", "anket", "intake", "kisisel bilgi", "boy", "kilo", "alerji alan"])) {
    flags.add("form");
  }
  if (hasAny(normalized, ["besin kural", "food rule", "yasak gida", "izinli gida", "gluten", "laktoz"])) {
    flags.add("food_rules");
  }
  if (hasAny(normalized, ["menu plan", "ogun plan", "haftalik menu", "menuyu guncelle", "menu degis"])) {
    flags.add("menu_plan");
  }
  if (
    hasAny(normalized, [
      "aktif plan",
      "diyet plan",
      "beslenme plan",
      "kalori hedef",
      "makro",
      "ogun duzeni",
      "plan guncelle",
    ])
  ) {
    flags.add("active_plan");
  }

  return Array.from(flags);
}

export function captureContextIntakeBaselines(state: ManuAppState, clientId: string) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");

  const latestForm = state.clientFormResponses
    .filter((response) => response.clientId === clientId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  const publishedFoodRule = state.clientFoodRuleProfiles
    .filter((profile) => profile.clientId === clientId && profile.status === "published")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  const activeMenu = state.clientMenuPlans
    .filter((plan) => plan.clientId === clientId && plan.status === "active")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  return {
    baselineContextRevision: client.contextRevision,
    baselineFormRevision: latestForm?.schemaVersion ?? null,
    baselineFoodRuleRevision: publishedFoodRule?.revision ?? null,
    baselineMenuPlanRevision: activeMenu?.revision ?? null,
  };
}

export function buildContextIntakePreview(proposal: ContextIntakeProposalRecord, client: ClientRecord): ContextIntakePreview {
  const structuredImpactFlags = proposal.structuredImpactFlags as ContextIntakeStructuredImpactFlag[];
  return {
    clientId: client.id,
    clientFullName: client.fullName,
    clientPhoneE164: client.primaryPhoneE164 || "",
    title: proposal.title,
    summary: proposal.summary,
    details: proposal.details,
    importance: proposal.importance,
    intakeSource: proposal.intakeSource,
    occurredAt: proposal.occurredAt,
    structuredImpactFlags,
    requiredPanels: structuredImpactFlags.map((flag) => ({
      flag,
      deepLink: CONTEXT_INTAKE_STRUCTURED_PANEL_LINKS[flag],
    })),
    status: proposal.status,
  };
}

export function getPendingContextIntakeStructuredBlocks(state: ManuAppState, clientId: string) {
  return state.contextIntakeProposals
    .filter(
      (proposal) =>
        proposal.clientId === clientId &&
        (proposal.status === "blocked_structured_impact" || proposal.status === "pending_confirmation") &&
        proposal.structuredImpactFlags.length > 0,
    )
    .flatMap((proposal) => proposal.structuredImpactFlags as ContextIntakeStructuredImpactFlag[]);
}

export function createContextIntakeProposalInState(
  state: ManuAppState,
  resolution: ResolveContextIntakeClientInput,
  input: CreateContextIntakeProposalInput,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const resolved = resolveContextIntakeClient(state, resolution);
  if (resolved.status === "not_found") throw new AppDomainError(404, "context_intake_client_not_found");
  if (resolved.status === "ambiguous") throw new AppDomainError(409, "context_intake_client_ambiguous");
  if (resolved.status === "mismatch") throw new AppDomainError(409, "context_intake_client_confirmation_mismatch");
  if (resolved.status === "removed") throw new AppDomainError(409, "client_removed_anonymized");

  const client = resolved.client;
  const sourceText = input.sourceText.trim();
  if (!sourceText) throw new AppDomainError(400, "context_intake_source_text_required");
  if (!isValidIntakeSource(input.intakeSource)) throw new AppDomainError(400, "context_intake_source_invalid");

  const duplicate = state.contextIntakeProposals.find(
    (proposal) =>
      proposal.clientId === client.id &&
      proposal.sourceTextDigest === digestContextIntakeSourceText(sourceText) &&
      proposal.status !== "applied" &&
      proposal.status !== "rejected" &&
      proposal.status !== "stale" &&
      proposal.status !== "expired",
  );
  if (duplicate) throw new AppDomainError(409, "context_intake_duplicate_proposal");

  const structuredImpactFlags = detectContextIntakeStructuredImpact(sourceText);
  const parsed = parseContextIntakeFields(sourceText, input);
  const baselines = captureContextIntakeBaselines(state, client.id);
  const status: ContextIntakeProposalStatus =
    structuredImpactFlags.length > 0 ? "blocked_structured_impact" : "pending_confirmation";

  const proposal: ContextIntakeProposalRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId: client.id,
    dietitianId: state.dietitian.id,
    sourceChannel: "internal_copilot",
    intakeSource: input.intakeSource,
    sourceTextDigest: digestContextIntakeSourceText(sourceText),
    sourceText,
    rawSourceReference: input.rawSourceReference?.trim() || null,
    occurredAt: normalizeOccurredAt(input.occurredAt, createdAt),
    title: parsed.title,
    summary: parsed.summary,
    details: parsed.details,
    importance: parsed.importance,
    structuredImpactFlags,
    ...baselines,
    status,
    confirmationCount: 0,
    appliedContextUpdateId: null,
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(new Date(createdAt).getTime() + CONTEXT_INTAKE_PROPOSAL_TTL_MS).toISOString(),
  };

  return {
    ...state,
    contextIntakeProposals: [...state.contextIntakeProposals, proposal],
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, "context_intake_proposal_created", "context_intake_proposal", proposal.id, createdAt, {
        clientId: client.id,
        status: proposal.status,
        structuredImpactCount: structuredImpactFlags.length,
        minimized: true,
      }),
    ],
  };
}

export function confirmContextIntakeProposalInState(
  state: ManuAppState,
  clientId: string,
  proposalId: string,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const proposal = requireMutableProposal(state, clientId, proposalId, createdAt);
  if (proposal.status === "blocked_structured_impact") {
    return updateProposal(state, proposal, {
      status: "blocked_structured_impact",
      confirmationCount: proposal.confirmationCount + 1,
      updatedAt: createdAt,
    }, "context_intake_proposal_confirmed_blocked", createdAt);
  }

  if (proposal.status !== "pending_confirmation" && proposal.status !== "confirmed") {
    throw new AppDomainError(409, "context_intake_proposal_not_confirmable");
  }

  return updateProposal(
    state,
    proposal,
    {
      status: "confirmed",
      confirmationCount: proposal.confirmationCount + 1,
      updatedAt: createdAt,
    },
    "context_intake_proposal_confirmed",
    createdAt,
  );
}

export function recheckContextIntakeProposalInState(
  state: ManuAppState,
  clientId: string,
  proposalId: string,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const proposal = requireMutableProposal(state, clientId, proposalId, createdAt);
  if (proposal.status !== "blocked_structured_impact") {
    throw new AppDomainError(409, "context_intake_proposal_not_blocked");
  }

  const revisionCheck = evaluateStructuredRevisionEvidence(state, proposal);
  if (!revisionCheck.ready) {
    throw new AppDomainError(409, "context_intake_structured_revision_pending");
  }

  const refreshedBaselines = captureContextIntakeBaselines(state, proposal.clientId);

  return updateProposal(
    state,
    proposal,
    {
      status: "confirmed",
      ...refreshedBaselines,
      updatedAt: createdAt,
    },
    "context_intake_structured_revision_rechecked",
    createdAt,
    {
      pendingFlags: revisionCheck.pendingFlags,
      ready: true,
    },
  );
}

export function applyContextIntakeProposalInState(
  state: ManuAppState,
  clientId: string,
  proposalId: string,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const proposal = requireMutableProposal(state, clientId, proposalId, createdAt);
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");
  if (client.lifecycleStatus === "removed_anonymized") throw new AppDomainError(409, "client_removed_anonymized");

  if (proposal.baselineContextRevision !== client.contextRevision) {
    throw new AppDomainError(409, "context_intake_proposal_stale");
  }

  if (proposal.structuredImpactFlags.length > 0) {
    if (proposal.confirmationCount < 2) {
      throw new AppDomainError(409, "context_intake_second_confirmation_required");
    }
  } else if (proposal.confirmationCount < 1) {
    throw new AppDomainError(409, "context_intake_confirmation_required");
  }

  if (proposal.status !== "confirmed") {
    throw new AppDomainError(409, "context_intake_proposal_not_ready_to_apply");
  }

  const withUpdate = createClientContextUpdateInState(
    state,
    clientId,
    {
      source: proposal.intakeSource,
      occurredAt: proposal.occurredAt,
      title: proposal.title,
      summary: proposal.summary,
      details: proposal.details,
      importance: proposal.importance,
    },
    createdAt,
  );

  const contextUpdate = withUpdate.clientContextUpdates.at(-1);
  if (!contextUpdate) throw new AppDomainError(409, "context_intake_apply_failed");

  return updateProposal(
    withUpdate,
    proposal,
    {
      status: "applied",
      appliedContextUpdateId: contextUpdate.id,
      updatedAt: createdAt,
    },
    "context_intake_proposal_applied",
    createdAt,
    {
      clientId,
      contextUpdateId: contextUpdate.id,
      structuredImpactFlags: proposal.structuredImpactFlags,
      intakeSource: proposal.intakeSource,
      minimized: true,
    },
  );
}

export function rejectContextIntakeProposalInState(
  state: ManuAppState,
  clientId: string,
  proposalId: string,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const proposal = findProposal(state, clientId, proposalId);
  if (!proposal) throw new AppDomainError(404, "context_intake_proposal_not_found");
  if (proposal.status === "applied" || proposal.status === "rejected" || proposal.status === "stale" || proposal.status === "expired") {
    throw new AppDomainError(409, "context_intake_proposal_not_rejectable");
  }

  return updateProposal(
    state,
    proposal,
    {
      status: "rejected",
      updatedAt: createdAt,
    },
    "context_intake_proposal_rejected",
    createdAt,
  );
}

export function expireContextIntakeProposalsInState(state: ManuAppState, now = new Date().toISOString()): ManuAppState {
  const expiredIds = state.contextIntakeProposals
    .filter(
      (proposal) =>
        proposal.expiresAt &&
        new Date(proposal.expiresAt).getTime() <= new Date(now).getTime() &&
        proposal.status !== "applied" &&
        proposal.status !== "rejected" &&
        proposal.status !== "stale" &&
        proposal.status !== "expired",
    )
    .map((proposal) => proposal.id);

  if (expiredIds.length === 0) return state;

  const expiredIdSet = new Set(expiredIds);
  return {
    ...state,
    contextIntakeProposals: state.contextIntakeProposals.map((proposal) =>
      expiredIdSet.has(proposal.id) ? { ...proposal, status: "expired" as const, updatedAt: now } : proposal,
    ),
    auditEvents: [
      ...state.auditEvents,
      ...expiredIds.map((proposalId) =>
        buildAudit(state, "context_intake_proposal_expired", "context_intake_proposal", proposalId, now, {
          minimized: true,
        }),
      ),
    ],
  };
}

export function redactContextIntakeProposalsForAnonymization(state: ManuAppState, clientId: string): ManuAppState {
  const now = new Date().toISOString();
  return {
    ...state,
    contextIntakeProposals: state.contextIntakeProposals.map((proposal) =>
      proposal.clientId === clientId
        ? {
            ...proposal,
            sourceText: null,
            sourceTextDigest: PHASE_74_REDACTION_MARKER,
            rawSourceReference: null,
            title: PHASE_74_REDACTION_MARKER,
            summary: PHASE_74_REDACTION_MARKER,
            details: "",
            status:
              proposal.status === "pending_confirmation" ||
              proposal.status === "confirmed" ||
              proposal.status === "blocked_structured_impact"
                ? ("rejected" as const)
                : proposal.status,
            updatedAt: now,
          }
        : proposal,
    ),
  };
}

function evaluateStructuredRevisionEvidence(state: ManuAppState, proposal: ContextIntakeProposalRecord) {
  const current = captureContextIntakeBaselines(state, proposal.clientId);
  const pendingFlags: ContextIntakeStructuredImpactFlag[] = [];

  for (const flag of proposal.structuredImpactFlags as ContextIntakeStructuredImpactFlag[]) {
    if (flag === "form") {
      if ((current.baselineFormRevision ?? 0) <= (proposal.baselineFormRevision ?? 0)) pendingFlags.push(flag);
      continue;
    }
    if (flag === "food_rules") {
      if ((current.baselineFoodRuleRevision ?? 0) <= (proposal.baselineFoodRuleRevision ?? 0)) pendingFlags.push(flag);
      continue;
    }
    if (flag === "menu_plan") {
      if ((current.baselineMenuPlanRevision ?? 0) <= (proposal.baselineMenuPlanRevision ?? 0)) pendingFlags.push(flag);
      continue;
    }
    if (flag === "active_plan") {
      if (current.baselineContextRevision <= proposal.baselineContextRevision) pendingFlags.push(flag);
    }
  }

  return { ready: pendingFlags.length === 0, pendingFlags };
}

function requireMutableProposal(
  state: ManuAppState,
  clientId: string,
  proposalId: string,
  now: string,
): ContextIntakeProposalRecord {
  const proposal = findProposal(state, clientId, proposalId);
  if (!proposal) throw new AppDomainError(404, "context_intake_proposal_not_found");
  if (proposal.expiresAt && new Date(proposal.expiresAt).getTime() <= new Date(now).getTime()) {
    throw new AppDomainError(409, "context_intake_proposal_expired");
  }
  if (proposal.status === "applied" || proposal.status === "rejected" || proposal.status === "stale" || proposal.status === "expired") {
    throw new AppDomainError(409, "context_intake_proposal_not_mutable");
  }
  return proposal;
}

function findProposal(state: ManuAppState, clientId: string, proposalId: string) {
  return state.contextIntakeProposals.find((item) => item.id === proposalId && item.clientId === clientId);
}

function updateProposal(
  state: ManuAppState,
  proposal: ContextIntakeProposalRecord,
  patch: Partial<ContextIntakeProposalRecord>,
  eventType: string,
  createdAt: string,
  metadata: Record<string, unknown> = {},
): ManuAppState {
  const nextProposal = { ...proposal, ...patch };
  return {
    ...state,
    contextIntakeProposals: state.contextIntakeProposals.map((item) => (item.id === proposal.id ? nextProposal : item)),
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, eventType, "context_intake_proposal", proposal.id, createdAt, metadata),
    ],
  };
}

function parseContextIntakeFields(sourceText: string, input: CreateContextIntakeProposalInput) {
  const firstLine = sourceText.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || sourceText.trim();
  const remainder = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .slice(1)
    .filter(Boolean)
    .join("\n");

  return {
    title: (input.title || firstLine).trim().slice(0, 120),
    summary: (input.summary || firstLine).trim().slice(0, 500),
    details: (input.details || remainder || sourceText).trim().slice(0, 3000),
    importance: input.importance || inferImportance(sourceText),
  };
}

function inferImportance(sourceText: string): ClientContextUpdateImportance {
  const normalized = normalizeSearch(sourceText);
  if (hasAny(normalized, ["acil", "kritik", "ciddi", "hemen", "urgent"])) return "critical";
  if (hasAny(normalized, ["onemli", "dikkat", "important"])) return "important";
  return "routine";
}

function normalizeOccurredAt(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function isValidIntakeSource(value: string): value is ClientContextUpdateSource {
  return ["phone", "zoom", "in_person", "other"].includes(value);
}

function hasAny(normalized: string, needles: string[]) {
  return needles.some((needle) => normalized.includes(needle));
}

function buildAudit(
  state: ManuAppState,
  eventType: string,
  entityType: string,
  entityId: string,
  createdAt: string,
  metadata: Record<string, unknown> = {},
) {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    eventType,
    entityType,
    entityId,
    metadata: { source: "context_intake_workflow", ...metadata },
    createdAt,
  };
}

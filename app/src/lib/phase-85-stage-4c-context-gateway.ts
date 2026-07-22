import {
  classifyDietitianChatIntentFromSignals,
  planDietitianChatContextTools,
} from "dietitian-ai-assistant-architecture";
import {
  AI_CHAT_CONTEXT_FORBIDDEN_TOOL_ARG_KEYS,
  AI_CHAT_CONTEXT_MAX_EVIDENCE_CHARS,
  AI_CHAT_CONTEXT_MAX_PARALLEL_TOOL_CALLS,
  AI_CHAT_CONTEXT_MAX_PROVIDER_SERIALIZED_CHARS,
  AI_CHAT_CONTEXT_MAX_SOURCE_REFS,
  AI_CHAT_CONTEXT_MAX_TOOL_CALLS_PER_RUN,
  AI_CHAT_CONTEXT_MAX_UNSTRUCTURED_EXCERPTS,
  AI_CHAT_CONTEXT_TOOL_TIMEOUT_MS,
  AI_CHAT_SOURCE_EXCERPT_MAX_LENGTH,
  type AiChatContextTool,
  type AiChatScopeType,
  type AiChatSourceType,
  type DietitianChatIntent,
} from "./phase-85-stage-4c-contracts";
import {
  computeEvidenceContentHash,
  dedupeEvidenceBySourceId,
  formatUnknownDateLabel,
  sortEvidenceByTemporalPriority,
  truncateEvidenceExcerpt,
  type AiChatSemanticRetriever,
  type CanonicalEvidenceRow,
  verifyCanonicalEvidenceRow,
} from "./phase-85-stage-4c-retrieval";

export type AccessibleClientIdentity = {
  id: string;
  fullName: string;
  referenceCode: string;
  referenceShort: string;
};

export type ContextGatewayAccessState = {
  authorized: boolean;
  clientId: string | null;
  revisionToken: string;
  checkedAt: string;
};

export type ContextToolExecutionResult = {
  tool: AiChatContextTool;
  ok: boolean;
  errorCode?: string;
  rows: CanonicalEvidenceRow[];
  categoryFailed?: boolean;
  categoryCritical?: boolean;
};

export type AiChatEvidenceExcerpt = {
  sourceId: string;
  sourceType: AiChatSourceType;
  locator: string | null;
  excerpt: string;
  contentHash: string;
  sourceDate: string | null;
  updatedAt: string | null;
  occurredAt: string | null;
  dateLabel: string | null;
};

export type AiChatContextRevisionManifest = {
  revisionToken: string;
  profileRevision: string | null;
  messageRevision: string | null;
  capturedAt: string;
};

export type AiChatEvidencePackage = {
  intent: DietitianChatIntent;
  sourceRefs: AiChatEvidenceExcerpt[];
  unstructuredExcerpts: AiChatEvidenceExcerpt[];
  structuredFacts: Array<{
    section: string;
    facts: string[];
    isAiSynthesis: boolean;
  }>;
  serializedEvidence: string;
  serializedCharCount: number;
  partialEvidence: boolean;
  insufficientEvidence: boolean;
  conflictingEvidence: boolean;
  missingCategories: string[];
  revisionManifest: AiChatContextRevisionManifest;
};

export type ClientContextGatewayResult =
  | {
      blocked: true;
      blockReason: "second_client_reference" | "unsupported_write_action" | "not_authorized";
      intent: DietitianChatIntent;
      evidencePackage: null;
      revisionManifest: null;
    }
  | {
      blocked: false;
      intent: DietitianChatIntent;
      evidencePackage: AiChatEvidencePackage;
      revisionManifest: AiChatContextRevisionManifest;
      toolCalls: AiChatContextTool[];
    };

export type BuildClientContextInput = {
  scopeType: AiChatScopeType;
  clientId: string | null;
  triggerBody: string;
  accessCheck: () => Promise<ContextGatewayAccessState>;
  listAccessibleClients: () => Promise<AccessibleClientIdentity[]>;
  executeTool: (tool: AiChatContextTool, args: Record<string, unknown>) => Promise<ContextToolExecutionResult>;
  semanticRetriever?: AiChatSemanticRetriever;
  now?: string;
};

export type GatewayRecheckResult =
  | { ok: true; revisionToken: string }
  | { ok: false; reason: "not_authorized" | "stale_context" };

export type AiChatContextSnapshotInput = {
  tenantId: string;
  runId: string;
  conversationId: string;
  createdByUserId: string;
  sourceIdentityRefs: Array<Record<string, unknown>>;
  freshnessMetadata: Record<string, unknown>;
  evidenceExcerpts: Array<Record<string, unknown>>;
};

const BROAD_SUMMARY_SECTIONS = [
  "profile",
  "form",
  "nutrition_plan",
  "messages",
  "risk",
  "documents",
] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesFullClientName(body: string, fullName: string) {
  const normalizedName = fullName.trim();
  if (normalizedName.length < 4) return false;
  const pattern = new RegExp(`\\b${escapeRegExp(normalizedName)}\\b`, "iu");
  return pattern.test(body);
}

export function detectSecondClientReference(input: {
  triggerBody: string;
  conversationClientId: string | null;
  accessibleClients: AccessibleClientIdentity[];
}) {
  if (!input.conversationClientId) {
    return { blocked: false as const };
  }

  for (const client of input.accessibleClients) {
    if (client.id === input.conversationClientId) continue;

    if (input.triggerBody.includes(client.id)) {
      return { blocked: true as const, matchedClientId: client.id, matchType: "uuid" as const };
    }
    if (client.referenceCode && input.triggerBody.toUpperCase().includes(client.referenceCode.toUpperCase())) {
      return { blocked: true as const, matchedClientId: client.id, matchType: "reference_code" as const };
    }
    if (client.referenceShort && input.triggerBody.toUpperCase().includes(client.referenceShort.toUpperCase())) {
      return { blocked: true as const, matchedClientId: client.id, matchType: "reference_short" as const };
    }
    if (matchesFullClientName(input.triggerBody, client.fullName)) {
      return { blocked: true as const, matchedClientId: client.id, matchType: "full_name" as const };
    }
  }

  return { blocked: false as const };
}

export function parseContextToolArgs(rawArgs: Record<string, unknown> | null | undefined) {
  const args = rawArgs ?? {};
  for (const key of AI_CHAT_CONTEXT_FORBIDDEN_TOOL_ARG_KEYS) {
    if (key in args) {
      throw new Error("forbidden_tool_arg");
    }
  }
  return args;
}

export function planContextTools(intent: DietitianChatIntent, scopeType: AiChatScopeType) {
  return planDietitianChatContextTools(intent, scopeType) as AiChatContextTool[];
}

export function classifyDietitianChatIntent(triggerBody: string, scopeType: AiChatScopeType) {
  return classifyDietitianChatIntentFromSignals({ triggerBody, scopeType }) as DietitianChatIntent;
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutHandle: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("tool_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function executeToolPlan(
  tools: AiChatContextTool[],
  executeTool: BuildClientContextInput["executeTool"],
  triggerBody: string,
) {
  const limitedTools = tools.slice(0, AI_CHAT_CONTEXT_MAX_TOOL_CALLS_PER_RUN);
  const results: ContextToolExecutionResult[] = [];
  let index = 0;

  async function worker() {
    while (index < limitedTools.length) {
      const currentIndex = index;
      index += 1;
      const tool = limitedTools[currentIndex]!;
      const args =
        tool === "search_client_messages" || tool === "search_approved_sources"
          ? parseContextToolArgs({ query: triggerBody })
          : parseContextToolArgs({});
      try {
        const result = await runWithTimeout(executeTool(tool, args), AI_CHAT_CONTEXT_TOOL_TIMEOUT_MS);
        results.push(result);
      } catch (error) {
        results.push({
          tool,
          ok: false,
          errorCode: error instanceof Error ? error.message : "tool_failed",
          rows: [],
          categoryFailed: true,
          categoryCritical: tool === "load_client_risk_timeline",
        });
      }
    }
  }

  const workerCount = Math.min(AI_CHAT_CONTEXT_MAX_PARALLEL_TOOL_CALLS, limitedTools.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function rowsToExcerpts(rows: CanonicalEvidenceRow[]): AiChatEvidenceExcerpt[] {
  return rows.map((row) => {
    const excerpt = truncateEvidenceExcerpt(row.excerpt, AI_CHAT_SOURCE_EXCERPT_MAX_LENGTH);
    return {
      sourceId: row.sourceId,
      sourceType: row.sourceType,
      locator: row.locator,
      excerpt,
      contentHash: row.contentHash ?? computeEvidenceContentHash(excerpt),
      sourceDate: row.sourceDate,
      updatedAt: row.updatedAt,
      occurredAt: row.occurredAt,
      dateLabel: formatUnknownDateLabel(row.sourceDate, row.updatedAt, row.occurredAt),
    };
  });
}

function applyEvidenceBudget(excerpts: AiChatEvidenceExcerpt[]) {
  const deduped = dedupeEvidenceBySourceId(
    sortEvidenceByTemporalPriority(
      excerpts.map((item) => ({
        ...item,
        authorityWeight: item.sourceType === "client_record" ? 3 : 2,
        updatedAt: item.updatedAt,
        occurredAt: item.occurredAt,
        sourceDate: item.sourceDate,
      })),
    ),
  );

  const sourceRefs: AiChatEvidenceExcerpt[] = [];
  const unstructuredExcerpts: AiChatEvidenceExcerpt[] = [];
  let totalChars = 0;

  for (const item of deduped) {
    if (sourceRefs.length >= AI_CHAT_CONTEXT_MAX_SOURCE_REFS) break;
    const nextChars = totalChars + item.excerpt.length;
    if (nextChars > AI_CHAT_CONTEXT_MAX_EVIDENCE_CHARS) break;
    sourceRefs.push(item);
    totalChars = nextChars;
    if (unstructuredExcerpts.length < AI_CHAT_CONTEXT_MAX_UNSTRUCTURED_EXCERPTS) {
      unstructuredExcerpts.push(item);
    }
  }

  return { sourceRefs, unstructuredExcerpts, totalChars };
}

function buildStructuredFacts(
  intent: DietitianChatIntent,
  toolResults: ContextToolExecutionResult[],
) {
  if (!["client_longitudinal_summary", "client_period_comparison", "client_trend"].includes(intent)) {
    return [];
  }

  const sectionMap = new Map<string, string[]>();
  for (const section of BROAD_SUMMARY_SECTIONS) {
    sectionMap.set(section, []);
  }

  for (const result of toolResults) {
    const section = mapToolToSection(result.tool);
    const facts = result.rows.map((row) => `${row.sourceId}: ${truncateEvidenceExcerpt(row.excerpt, 240)}`);
    sectionMap.set(section, [...(sectionMap.get(section) ?? []), ...facts]);
  }

  return BROAD_SUMMARY_SECTIONS.map((section) => ({
    section,
    facts: (sectionMap.get(section) ?? []).slice(0, 12),
    isAiSynthesis: true,
  }));
}

function mapToolToSection(tool: AiChatContextTool) {
  switch (tool) {
    case "load_client_profile":
      return "profile";
    case "load_client_active_form":
      return "form";
    case "load_client_menu_plans":
    case "load_client_food_rule_profile":
      return "nutrition_plan";
    case "load_client_recent_messages":
    case "search_client_messages":
      return "messages";
    case "load_client_risk_timeline":
    case "load_client_handoffs":
    case "load_client_ai_decisions":
      return "risk";
    default:
      return "documents";
  }
}

function serializeEvidencePackage(input: {
  intent: DietitianChatIntent;
  sourceRefs: AiChatEvidenceExcerpt[];
  structuredFacts: AiChatEvidencePackage["structuredFacts"];
  visibleMessages?: Array<{ role: string; body: string }>;
  rollingSummary?: string;
}) {
  const lines: string[] = [`intent:${input.intent}`];
  for (const section of input.structuredFacts) {
    lines.push(`section:${section.section}`);
    for (const fact of section.facts) {
      lines.push(`fact:${fact}`);
    }
    lines.push("synthesis_label:ai_synthesis_non_authoritative");
  }
  for (const ref of input.sourceRefs) {
    lines.push(`source:${ref.sourceId}|${ref.excerpt}`);
  }
  if (input.rollingSummary) {
    lines.push(`rolling_summary:${input.rollingSummary}`);
  }
  for (const message of input.visibleMessages ?? []) {
    lines.push(`${message.role}:${message.body}`);
  }

  let serialized = lines.join("\n");
  if (serialized.length > AI_CHAT_CONTEXT_MAX_PROVIDER_SERIALIZED_CHARS) {
    const trimmedRefs = [...input.sourceRefs].sort((left, right) => {
      const leftWeight = left.sourceType === "approved_clinical_source" ? 1 : 3;
      const rightWeight = right.sourceType === "approved_clinical_source" ? 1 : 3;
      return leftWeight - rightWeight;
    });
    while (trimmedRefs.length > 0 && serialized.length > AI_CHAT_CONTEXT_MAX_PROVIDER_SERIALIZED_CHARS) {
      trimmedRefs.pop();
      const nextLines = [
        `intent:${input.intent}`,
        ...trimmedRefs.map((ref) => `source:${ref.sourceId}|${ref.excerpt}`),
      ];
      if (input.rollingSummary) nextLines.push(`rolling_summary:${input.rollingSummary}`);
      for (const message of input.visibleMessages ?? []) {
        nextLines.push(`${message.role}:${message.body}`);
      }
      serialized = nextLines.join("\n");
    }
  }

  return {
    serializedEvidence: serialized,
    serializedCharCount: serialized.length,
  };
}

export function buildContextSnapshotFromPackage(
  evidencePackage: AiChatEvidencePackage,
): Pick<AiChatContextSnapshotInput, "sourceIdentityRefs" | "freshnessMetadata" | "evidenceExcerpts"> {
  return {
    sourceIdentityRefs: evidencePackage.sourceRefs.map((item) => ({
      sourceId: item.sourceId,
      sourceType: item.sourceType,
      contentHash: item.contentHash,
      locator: item.locator,
    })),
    freshnessMetadata: {
      revisionToken: evidencePackage.revisionManifest.revisionToken,
      capturedAt: evidencePackage.revisionManifest.capturedAt,
      intent: evidencePackage.intent,
    },
    evidenceExcerpts: evidencePackage.unstructuredExcerpts.map((item) => ({
      sourceId: item.sourceId,
      excerpt: item.excerpt,
      contentHash: item.contentHash,
      sourceDate: item.sourceDate,
      updatedAt: item.updatedAt,
    })),
  };
}

export async function buildClientContext(input: BuildClientContextInput): Promise<ClientContextGatewayResult> {
  const now = input.now ?? new Date().toISOString();
  const intent = classifyDietitianChatIntent(input.triggerBody, input.scopeType);
  const access = await input.accessCheck();

  if (!access.authorized) {
    return {
      blocked: true,
      blockReason: "not_authorized",
      intent,
      evidencePackage: null,
      revisionManifest: null,
    };
  }

  if (input.scopeType === "client" && input.clientId) {
    const secondClient = detectSecondClientReference({
      triggerBody: input.triggerBody,
      conversationClientId: input.clientId,
      accessibleClients: await input.listAccessibleClients(),
    });
    if (secondClient.blocked) {
      return {
        blocked: true,
        blockReason: "second_client_reference",
        intent: "second_client_reference",
        evidencePackage: null,
        revisionManifest: null,
      };
    }
  }

  if (intent === "unsupported_write_action") {
    return {
      blocked: true,
      blockReason: "unsupported_write_action",
      intent,
      evidencePackage: null,
      revisionManifest: null,
    };
  }

  const toolPlan = planContextTools(intent, input.scopeType);
  const toolResults = toolPlan.length
    ? await executeToolPlan(toolPlan, input.executeTool, input.triggerBody)
    : [];

  const verifiedRows: CanonicalEvidenceRow[] = [];
  for (const result of toolResults) {
    if (!result.ok) continue;
    for (const row of result.rows) {
      if (!input.clientId) continue;
      const verification = verifyCanonicalEvidenceRow(row, input.clientId);
      if (verification.ok) {
        verifiedRows.push(row);
      }
    }
  }

  const semanticRetriever = input.semanticRetriever;
  if (semanticRetriever && semanticRetriever.status !== "disabled" && input.clientId) {
    const semantic = await semanticRetriever.search({ query: input.triggerBody, limit: 5 });
    if (semantic.status === "fixture") {
      for (const hit of semantic.hits) {
        verifiedRows.push({
          sourceId: hit.sourceId,
          clientId: input.clientId,
          sourceType: "client_record",
          locator: hit.locator ?? null,
          excerpt: hit.excerpt,
          contentHash: computeEvidenceContentHash(hit.excerpt),
          sourceDate: null,
          updatedAt: null,
          occurredAt: null,
          lifecycleStatus: "current",
          retrievalEligible: true,
          authorityWeight: 1,
        });
      }
    }
  }

  const excerpts = rowsToExcerpts(verifiedRows);
  const budgeted = applyEvidenceBudget(excerpts);
  const structuredFacts = buildStructuredFacts(intent, toolResults);
  const missingCategories = toolResults
    .filter((result) => result.categoryFailed)
    .map((result) => result.tool);
  const criticalFailure = toolResults.some((result) => result.categoryCritical && result.categoryFailed);
  const partialEvidence = missingCategories.length > 0;
  const insufficientEvidence = criticalFailure || (input.scopeType === "client" && budgeted.sourceRefs.length === 0);
  const hashBySource = new Map<string, string>();
  let conflictingEvidence = false;
  for (const ref of budgeted.sourceRefs) {
    const prior = hashBySource.get(ref.sourceId);
    if (prior && prior !== ref.contentHash) {
      conflictingEvidence = true;
      break;
    }
    hashBySource.set(ref.sourceId, ref.contentHash);
  }

  const revisionManifest: AiChatContextRevisionManifest = {
    revisionToken: access.revisionToken,
    profileRevision: access.revisionToken,
    messageRevision: access.revisionToken,
    capturedAt: now,
  };

  const serialized = serializeEvidencePackage({
    intent,
    sourceRefs: budgeted.sourceRefs,
    structuredFacts,
  });

  const evidencePackage: AiChatEvidencePackage = {
    intent,
    sourceRefs: budgeted.sourceRefs,
    unstructuredExcerpts: budgeted.unstructuredExcerpts,
    structuredFacts,
    serializedEvidence: serialized.serializedEvidence,
    serializedCharCount: serialized.serializedCharCount,
    partialEvidence,
    insufficientEvidence,
    conflictingEvidence,
    missingCategories,
    revisionManifest,
  };

  return {
    blocked: false,
    intent,
    evidencePackage,
    revisionManifest,
    toolCalls: toolPlan,
  };
}

export function recheckGatewayAccessBeforeCommit(input: {
  capturedRevisionToken: string;
  currentAccess: ContextGatewayAccessState;
}): GatewayRecheckResult {
  if (!input.currentAccess.authorized) {
    return { ok: false, reason: "not_authorized" };
  }
  if (input.currentAccess.revisionToken !== input.capturedRevisionToken) {
    return { ok: false, reason: "stale_context" };
  }
  return { ok: true, revisionToken: input.currentAccess.revisionToken };
}

export function buildProviderContextEnvelope(evidencePackage: AiChatEvidencePackage | null) {
  if (!evidencePackage) return null;
  return {
    intent: evidencePackage.intent,
    evidenceText: evidencePackage.serializedEvidence,
    sourceRefCount: evidencePackage.sourceRefs.length,
    partialEvidence: evidencePackage.partialEvidence,
    insufficientEvidence: evidencePackage.insufficientEvidence,
    conflictingEvidence: evidencePackage.conflictingEvidence,
    serializedCharCount: evidencePackage.serializedCharCount,
  };
}

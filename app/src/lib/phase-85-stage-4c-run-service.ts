import { createHash } from "node:crypto";
import {
  createDietitianChatRunPlan,
  finalizeDietitianChatRun,
  shouldAbortDietitianChatRun,
  validateDietitianChatSourcedAnswer,
} from "dietitian-ai-assistant-architecture";
import { classifyDietitianChatRisk } from "dietitian-ai-assistant-architecture/risk";
import type { AppTenantContext } from "./auth-context";
import { AppRequestError } from "./app-errors";
import {
  AI_CHAT_AUTO_TITLE_MAX_LENGTH,
  AI_CHAT_JOB_HEARTBEAT_MS,
  AI_CHAT_JOB_LEASE_MS,
  AI_CHAT_MAX_USER_ACTIVE_RUNS,
  AI_CHAT_MESSAGE_BODY_MAX_LENGTH,
  AI_CHAT_PROVIDER_TIMEOUT_MS,
  AI_CHAT_RUN_EVENT_RETENTION_HOURS,
  AI_CHAT_RUN_TIMEOUT_MS,
  type AiChatCompletionState,
  type AiChatJobRecord,
  type AiChatAnswerability,
  type AiChatRiskLevel,
  type AiChatRunDto,
  type AiChatRunEventDto,
  type AiChatRunStatus,
  type AiChatScopeType,
  isNonTerminalAiChatRunStatus,
} from "./phase-85-stage-4c-contracts";
import {
  resolveAiChatGenerationProvider,
  type AiChatGenerationProvider,
} from "./phase-85-stage-4c-provider";
import {
  buildClientContext,
  buildContextSnapshotFromPackage,
  buildProviderContextEnvelope,
  mergeMessageAttachmentDerivativesIntoEvidencePackage,
  normalizeContextToolExecutionResult,
  recheckGatewayAccessBeforeCommit,
  type ClientContextGatewayResult,
} from "./phase-85-stage-4c-context-gateway";
import { buildAttachmentDerivativeEvidenceRows } from "./phase-85-stage-4c-attachments";
import { createDisabledSemanticRetriever } from "./phase-85-stage-4c-retrieval";
import {
  processAttachmentCleanupJob,
  processAttachmentParseJob,
  processAttachmentScanJob,
} from "./phase-85-stage-4c-attachment-workers";
import type { AiChatStructuredAnswer } from "./phase-85-stage-4c-provider";
import type { AiChatRunSourceClaimDto } from "./phase-85-stage-4c-sources";
import type { AiChatStore } from "./phase-85-stage-4c-store";

function buildSourceMapsFromGateway(evidencePackage: {
  sourceRefs: Array<{ sourceId: string; sourceType: string; excerpt: string }>;
}) {
  const allowedSourceIds = evidencePackage.sourceRefs.map((item) => item.sourceId);
  const sourceTypesById = Object.fromEntries(
    evidencePackage.sourceRefs.map((item) => [item.sourceId, item.sourceType]),
  );
  const sourceExcerptById = Object.fromEntries(
    evidencePackage.sourceRefs.map((item) => [item.sourceId, item.excerpt]),
  );
  return { allowedSourceIds, sourceTypesById, sourceExcerptById };
}

function flattenStructuredClaims(answer: AiChatStructuredAnswer): AiChatRunSourceClaimDto[] {
  const claims: AiChatRunSourceClaimDto[] = [];
  for (const claim of answer.verifiedFacts ?? []) {
    claims.push({
      claimId: claim.claimId,
      kind: "verified_fact",
      text: claim.text,
      label: null,
      uncertainty: null,
      sourceRefIds: claim.sourceRefIds,
    });
  }
  for (const claim of answer.inferences ?? []) {
    claims.push({
      claimId: claim.claimId,
      kind: "inference",
      text: claim.text,
      label: "AI çıkarımı",
      uncertainty: null,
      sourceRefIds: claim.sourceRefIds,
    });
  }
  for (const claim of answer.recommendations ?? []) {
    claims.push({
      claimId: claim.claimId,
      kind: "recommendation",
      text: claim.text,
      label: null,
      uncertainty: claim.uncertainty ?? null,
      sourceRefIds: claim.sourceRefIds,
    });
  }
  return claims;
}

async function generateWithOptionalRepair(
  provider: AiChatGenerationProvider,
  request: Parameters<AiChatGenerationProvider["generate"]>[0],
) {
  const first = await provider.generate(request);
  if (first.schemaValid === false && !request.repairAttempt) {
    return provider.generate({ ...request, repairAttempt: true });
  }
  return first;
}

async function finalizeGatewayBlockedRun(
  store: AiChatStore,
  tenantId: string,
  runId: string,
  blockReason: Extract<ClientContextGatewayResult, { blocked: true }>["blockReason"],
) {
  if (blockReason === "general_scope_phi_leak") {
    await finalizeStaleContextRun(store, tenantId, runId, "not_authorized");
    return;
  }
  const errorCode =
    blockReason === "not_authorized"
      ? "not_authorized"
      : blockReason === "second_client_reference"
        ? "second_client_reference"
        : "unsupported_write_action";
  await store.finalizeRun(tenantId, runId, {
    status: "failed",
    errorCode,
    answerability: blockReason === "not_authorized" ? "not_authorized" : null,
  });
  await store.appendRunEvent(tenantId, runId, {
    eventType: "run.failed",
    payload: { errorCode, retryable: true },
  });
}

async function finalizeStaleContextRun(
  store: AiChatStore,
  tenantId: string,
  runId: string,
  errorCode: "stale_context" | "not_authorized",
) {
  await store.finalizeRun(tenantId, runId, {
    status: "superseded",
    errorCode,
    answerability: errorCode === "not_authorized" ? "not_authorized" : "insufficient",
  });
  await store.appendRunEvent(tenantId, runId, {
    eventType: "run.failed",
    payload: { errorCode, retryable: true },
  });
}

function asAnswerability(value: string | null | undefined): AiChatAnswerability | null {
  if (
    value === "answerable" ||
    value === "partial" ||
    value === "insufficient" ||
    value === "conflicting" ||
    value === "not_authorized"
  ) {
    return value;
  }
  return null;
}

function asRiskLevel(value: string | null | undefined): AiChatRiskLevel | null {
  if (value === "green" || value === "yellow" || value === "red") return value;
  return null;
}

export const STAGE_4C_RUN_SERVICE_VERSION = "p85-stage-4c-run-service-v2";

type GatewayAccessInput = Parameters<AiChatStore["getContextGatewayAccess"]>[0];

type FinalizeRunConversationContext = {
  scopeType: AiChatScopeType;
  clientId: string | null;
  id: string;
  createdByDietitianId: string;
  revision: number;
};

export type FinalizeRunOutcomeInput = {
  store: AiChatStore;
  tenantId: string;
  runId: string;
  run: { conversationId: string; createdByUserId: string };
  triggerBody: string;
  conversation: FinalizeRunConversationContext;
  gatewayAccessInput: GatewayAccessInput;
  capturedRevisionToken: string | null;
  outcome:
    | {
        kind: "gateway_blocked";
        blockReason: Extract<ClientContextGatewayResult, { blocked: true }>["blockReason"];
      }
    | { kind: "insufficient_evidence" }
    | {
        kind: "failed";
        errorCode: string;
        answerability?: AiChatAnswerability | null;
        riskLevel?: AiChatRiskLevel | null;
        retryable?: boolean;
      }
    | { kind: "conflicting_evidence"; riskLevel?: AiChatRiskLevel | null }
    | {
        kind: "stopped";
        partialText: string;
        providerRiskLevel?: AiChatRiskLevel | null;
        answerability?: AiChatAnswerability | null;
      }
    | {
        kind: "completed";
        directAnswer: string;
        completionState: AiChatCompletionState;
        answerability: AiChatAnswerability;
        riskLevel: AiChatRiskLevel | null;
        providerRiskLevel?: AiChatRiskLevel | null;
        gateway: Extract<ClientContextGatewayResult, { blocked: false }>;
        sourceMaps: ReturnType<typeof buildSourceMapsFromGateway>;
        providerResult: {
          structuredAnswer?: AiChatStructuredAnswer | null;
          riskLevel?: AiChatRiskLevel | null;
        };
        sourcedValidation: ReturnType<typeof validateDietitianChatSourcedAnswer> | null;
      };
};

function mergeRiskLevels(
  classified: AiChatRiskLevel,
  providerRiskLevel?: AiChatRiskLevel | null,
): AiChatRiskLevel {
  const order: Record<AiChatRiskLevel, number> = { green: 0, yellow: 1, red: 2 };
  const providerLevel = providerRiskLevel ?? "green";
  return order[classified] >= order[providerLevel] ? classified : providerLevel;
}

export async function finalizeRunOutcome(input: FinalizeRunOutcomeInput): Promise<void> {
  const { store, tenantId, runId, triggerBody, conversation, gatewayAccessInput, capturedRevisionToken, outcome } =
    input;

  if (capturedRevisionToken) {
    const recheck = recheckGatewayAccessBeforeCommit({
      capturedRevisionToken,
      currentAccess: await store.getContextGatewayAccess(gatewayAccessInput),
    });
    if (!recheck.ok) {
      await finalizeStaleContextRun(store, tenantId, runId, recheck.reason);
      return;
    }
  }

  if (outcome.kind === "gateway_blocked") {
    await finalizeGatewayBlockedRun(store, tenantId, runId, outcome.blockReason);
    return;
  }

  if (outcome.kind === "insufficient_evidence") {
    await store.finalizeRun(tenantId, runId, {
      status: "failed",
      errorCode: "insufficient_evidence",
      answerability: "insufficient",
      riskLevel: "green",
    });
    await store.appendRunEvent(tenantId, runId, {
      eventType: "run.failed",
      payload: { errorCode: "insufficient_evidence", retryable: true },
    });
    return;
  }

  if (outcome.kind === "failed") {
    await store.finalizeRun(tenantId, runId, {
      status: "failed",
      errorCode: outcome.errorCode,
      answerability: outcome.answerability ?? null,
      riskLevel: outcome.riskLevel ?? null,
    });
    await store.appendRunEvent(tenantId, runId, {
      eventType: "run.failed",
      payload: { errorCode: outcome.errorCode, retryable: outcome.retryable ?? true },
    });
    return;
  }

  if (outcome.kind === "conflicting_evidence") {
    await store.finalizeRun(tenantId, runId, {
      status: "failed",
      errorCode: "conflicting_evidence",
      answerability: "conflicting",
      riskLevel: outcome.riskLevel ?? null,
    });
    await store.appendRunEvent(tenantId, runId, {
      eventType: "run.failed",
      payload: { errorCode: "conflicting_evidence", retryable: true },
    });
    return;
  }

  if (outcome.kind === "stopped") {
    const trimmed = outcome.partialText.trim();
    const riskAssessment = classifyDietitianChatRisk({
      triggerBody,
      directAnswer: trimmed || null,
      scopeType: conversation.scopeType,
      answerability: trimmed ? outcome.answerability ?? "partial" : "insufficient",
      providerRiskLevel: outcome.providerRiskLevel ?? null,
      verifiedFactTexts: [],
      attachmentExcerpts: [],
      sourceExcerptTexts: [],
      sourceRefIds: [],
    });
    const riskLevel = mergeRiskLevels(riskAssessment.riskLevel as AiChatRiskLevel, outcome.providerRiskLevel);

    if (trimmed) {
      await store.commitAssistantMessage(tenantId, runId, {
        body: trimmed,
        answerability: outcome.answerability ?? "partial",
        riskLevel,
        completionState: "incomplete",
      });
    }

    await store.finalizeRun(tenantId, runId, {
      status: "stopped",
      answerability: trimmed ? outcome.answerability ?? "partial" : null,
      riskLevel,
    });
    await store.appendRunEvent(tenantId, runId, {
      eventType: "response.stopped",
      payload: {
        completionState: "incomplete",
        answerability: trimmed ? outcome.answerability ?? "partial" : null,
        riskLevel,
      },
    });
    return;
  }

  const {
    directAnswer,
    completionState,
    answerability,
    riskLevel: initialRiskLevel,
    providerRiskLevel,
    gateway,
    providerResult,
    sourcedValidation,
  } = outcome;

  let finalRiskLevel = initialRiskLevel;

  if (completionState === "complete" && directAnswer) {
    if (providerResult.structuredAnswer && sourcedValidation?.answer) {
      const claims = flattenStructuredClaims(sourcedValidation.answer as AiChatStructuredAnswer);
      await store.persistRunAnswerArtifacts(tenantId, runId, {
        conversationId: input.run.conversationId,
        createdByUserId: input.run.createdByUserId,
        clientId: conversation.clientId,
        directAnswer,
        answerability,
        riskLevel: finalRiskLevel,
        claims,
        sourceRefs: gateway.evidencePackage.sourceRefs.map((item) => ({
          sourceRefId: item.sourceId,
          sourceType: item.sourceType,
          canonicalEntityId: item.sourceId,
          locator: item.locator,
          sourceDate: item.sourceDate,
          contentHash: item.contentHash,
          excerpt: item.excerpt,
        })),
      });
    }

    if (conversation.scopeType === "client" && conversation.clientId) {
      const structuredAnswer = sourcedValidation?.answer as AiChatStructuredAnswer | null | undefined;
      const verifiedFactTexts = structuredAnswer?.verifiedFacts?.map((item) => item.text) ?? [];
      const attachmentExcerpts = gateway.evidencePackage.unstructuredExcerpts
        .filter((item) => String(item.sourceType ?? "").includes("attachment"))
        .map((item) => item.excerpt);
      const sourceExcerptTexts = gateway.evidencePackage.sourceRefs.map((item) => item.excerpt);
      const sourceRefIds = gateway.evidencePackage.sourceRefs.map((item) => item.sourceId);

      await store.applyRunRiskPipeline({
        tenantId,
        runId,
        conversationId: input.run.conversationId,
        createdByUserId: input.run.createdByUserId,
        scopeType: conversation.scopeType,
        clientId: conversation.clientId,
        triggerBody,
        directAnswer,
        answerability,
        providerRiskLevel: providerRiskLevel ?? null,
        verifiedFactTexts,
        attachmentExcerpts,
        sourceExcerptTexts,
        sourceRefIds,
        revisionToken: capturedRevisionToken ?? "",
      });
      const riskSummary = await store.getRunRiskSummary(tenantId, runId, input.run.createdByUserId);
      if (riskSummary) {
        finalRiskLevel = mergeRiskLevels(riskSummary.riskLevel, providerRiskLevel);
      }
    } else {
      const classified = classifyDietitianChatRisk({
        triggerBody,
        directAnswer,
        scopeType: conversation.scopeType,
        answerability,
        providerRiskLevel: providerRiskLevel ?? null,
        verifiedFactTexts: [],
        attachmentExcerpts: [],
        sourceExcerptTexts: gateway.evidencePackage.sourceRefs.map((item) => item.excerpt),
        sourceRefIds: gateway.evidencePackage.sourceRefs.map((item) => item.sourceId),
      });
      finalRiskLevel = mergeRiskLevels(classified.riskLevel as AiChatRiskLevel, providerRiskLevel);
    }

    await store.commitAssistantMessage(tenantId, runId, {
      body: directAnswer,
      answerability,
      riskLevel: finalRiskLevel,
    });
  } else if (directAnswer) {
    const classified = classifyDietitianChatRisk({
      triggerBody,
      directAnswer,
      scopeType: conversation.scopeType,
      answerability,
      providerRiskLevel: providerRiskLevel ?? null,
      verifiedFactTexts: [],
      attachmentExcerpts: [],
      sourceExcerptTexts: gateway.evidencePackage.sourceRefs.map((item) => item.excerpt),
      sourceRefIds: gateway.evidencePackage.sourceRefs.map((item) => item.sourceId),
    });
    finalRiskLevel = mergeRiskLevels(classified.riskLevel as AiChatRiskLevel, providerRiskLevel);
    await store.commitAssistantMessage(tenantId, runId, {
      body: directAnswer,
      answerability,
      riskLevel: finalRiskLevel,
      completionState: "incomplete",
    });
  }

  const terminalStatus = completionState === "complete" ? "completed" : "stopped";
  await store.finalizeRun(tenantId, runId, {
    status: terminalStatus,
    answerability,
    riskLevel: finalRiskLevel,
  });
  await store.appendRunEvent(tenantId, runId, {
    eventType: completionState === "complete" ? "response.completed" : "response.stopped",
    payload: {
      completionState,
      answerability,
      riskLevel: finalRiskLevel,
    },
  });

  if (completionState === "complete") {
    await store.enqueueTitleJob(tenantId, input.run.conversationId, input.run.createdByUserId);
  }
}

export type AiChatSendMessageInput = {
  requestId: string;
  expectedRevision: number;
  body: string;
  branchId?: string | null;
  attachmentIds?: string[];
};

export type AiChatEditMessageInput = {
  requestId: string;
  expectedRevision: number;
  body: string;
};

export type AiChatRegenerateMessageInput = {
  requestId: string;
  expectedRevision: number;
};

export type AiChatStopRunInput = {
  requestId: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function runEventExpiryIso() {
  return new Date(Date.now() + AI_CHAT_RUN_EVENT_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
}

export function parseAiChatSendMessageBody(body: unknown): AiChatSendMessageInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppRequestError(400, "invalid_request_body");
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!["requestId", "expectedRevision", "body", "branchId", "attachmentIds"].includes(key)) {
      throw new AppRequestError(400, "invalid_request_body", key);
    }
  }
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  if (!requestId) throw new AppRequestError(400, "invalid_request_body", "requestId");
  const expectedRevision = Number(record.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision <= 0) {
    throw new AppRequestError(400, "invalid_request_body", "expectedRevision");
  }
  const messageBody = typeof record.body === "string" ? record.body : "";
  const attachmentIds = Array.isArray(record.attachmentIds)
    ? record.attachmentIds
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim())
    : undefined;
  if (!messageBody.trim() && (!attachmentIds || attachmentIds.length === 0)) {
    throw new AppRequestError(400, "ai_chat_message_body_required", "body");
  }
  if (messageBody.trim() && Array.from(messageBody).length > AI_CHAT_MESSAGE_BODY_MAX_LENGTH) {
    throw new AppRequestError(400, "ai_chat_message_body_too_long", "body");
  }
  const branchId =
    record.branchId == null
      ? null
      : typeof record.branchId === "string" && record.branchId.trim()
        ? record.branchId.trim()
        : null;
  return { requestId, expectedRevision, body: messageBody, branchId, attachmentIds };
}

export function parseAiChatEditMessageBody(body: unknown): AiChatEditMessageInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppRequestError(400, "invalid_request_body");
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!["requestId", "expectedRevision", "body"].includes(key)) {
      throw new AppRequestError(400, "invalid_request_body", key);
    }
  }
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  if (!requestId) throw new AppRequestError(400, "invalid_request_body", "requestId");
  const expectedRevision = Number(record.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision <= 0) {
    throw new AppRequestError(400, "invalid_request_body", "expectedRevision");
  }
  const messageBody = typeof record.body === "string" ? record.body : "";
  if (!messageBody.trim()) throw new AppRequestError(400, "ai_chat_message_body_required", "body");
  if (Array.from(messageBody).length > AI_CHAT_MESSAGE_BODY_MAX_LENGTH) {
    throw new AppRequestError(400, "ai_chat_message_body_too_long", "body");
  }
  return { requestId, expectedRevision, body: messageBody };
}

export function parseAiChatRegenerateMessageBody(body: unknown): AiChatRegenerateMessageInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppRequestError(400, "invalid_request_body");
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!["requestId", "expectedRevision"].includes(key)) {
      throw new AppRequestError(400, "invalid_request_body", key);
    }
  }
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  if (!requestId) throw new AppRequestError(400, "invalid_request_body", "requestId");
  const expectedRevision = Number(record.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision <= 0) {
    throw new AppRequestError(400, "invalid_request_body", "expectedRevision");
  }
  return { requestId, expectedRevision };
}

export function parseAiChatStopRunBody(body: unknown): AiChatStopRunInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppRequestError(400, "invalid_request_body");
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "requestId") throw new AppRequestError(400, "invalid_request_body", key);
  }
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  if (!requestId) throw new AppRequestError(400, "invalid_request_body", "requestId");
  return { requestId };
}

export function parseRunEventsAfterParam(value: string | null) {
  if (!value?.trim()) return 0;
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new AppRequestError(400, "ai_chat_cursor_invalid", "after");
  }
  return parsed;
}

export async function maybeProcessDeterministicAiChatJobs(store: AiChatStore, workerId = "inline-deterministic") {
  if (process.env.AI_CHAT_DETERMINISTIC_MODE !== "true" && process.env.NODE_ENV !== "test") {
    return;
  }
  await processAiChatWorkerBatch(store, workerId, 4);
}

export async function processAiChatWorkerBatch(
  store: AiChatStore,
  workerId: string,
  batchLimit = 4,
  provider: AiChatGenerationProvider = resolveAiChatGenerationProvider(),
) {
  for (let index = 0; index < batchLimit; index += 1) {
    const job = await store.claimNextAiChatJob(workerId, AI_CHAT_JOB_LEASE_MS);
    if (!job) break;
    try {
      if (job.jobType === "generation") {
        await processGenerationJob(store, job, provider, workerId);
      } else if (job.jobType === "title") {
        await processTitleJob(store, job);
      } else if (job.jobType === "attachment_scan") {
        const attachmentId = String(job.payload.attachmentId ?? "");
        await processAttachmentScanJob(store, attachmentId, (objectKey) => store.getAttachmentObjectBytes(objectKey));
      } else if (job.jobType === "attachment_parse") {
        const attachmentId = String(job.payload.attachmentId ?? "");
        await processAttachmentParseJob(store, attachmentId, (objectKey) => store.getAttachmentObjectBytes(objectKey));
      } else if (job.jobType === "attachment_cleanup") {
        const attachmentId = String(job.payload.attachmentId ?? "");
        await processAttachmentCleanupJob(store, attachmentId, async (objectKey) => {
          void objectKey;
        });
      }
      await store.completeAiChatJob(job.id, workerId, job.leaseToken!);
    } catch (error) {
      await store.failAiChatJob(job.id, workerId, job.leaseToken!, String(error));
    }
  }
}

async function processTitleJob(store: AiChatStore, job: AiChatJobRecord) {
  await store.applyAutoTitleIfEligible(job.tenantId, job.conversationId, AI_CHAT_AUTO_TITLE_MAX_LENGTH);
}

async function processGenerationJob(
  store: AiChatStore,
  job: AiChatJobRecord,
  provider: AiChatGenerationProvider,
  workerId: string,
) {
  const run = await store.getRunById(job.tenantId, job.runId!);
  if (!run || !isNonTerminalAiChatRunStatus(run.status)) {
    return;
  }

  const triggerVersion = await store.getMessageVersionById(job.tenantId, run.triggerMessageVersionId);
  if (!triggerVersion) {
    await store.finalizeRun(job.tenantId, run.id, {
      status: "failed",
      errorCode: "trigger_version_missing",
    });
    return;
  }

  const conversation = await store.getConversationRecord(job.tenantId, run.conversationId);
  if (!conversation) {
    await store.finalizeRun(job.tenantId, run.id, {
      status: "failed",
      errorCode: "conversation_missing",
    });
    return;
  }

  const branchMessages = await store.getBranchMessageChain(job.tenantId, triggerVersion.branchId);
  const plan = createDietitianChatRunPlan({
    triggerBody: triggerVersion.body,
    scopeType: conversation.scopeType,
    messages: branchMessages.map((item) => ({
      role: item.role,
      body: item.activeBody,
    })),
  });

  const startedAt = Date.now();
  let sawFirstDelta = false;
  const abortController = new AbortController();
  const providerTimeout = setTimeout(() => abortController.abort(), AI_CHAT_PROVIDER_TIMEOUT_MS);

  const appendStatus = async (status: AiChatRunStatus) => {
    await store.updateRunStatus(job.tenantId, run.id, status);
    await store.appendRunEvent(job.tenantId, run.id, {
      eventType: "run.status",
      payload: { status },
    });
    await store.renewJobLease(job.id, workerId, job.leaseToken!, AI_CHAT_JOB_HEARTBEAT_MS);
  };

  const gatewayAccessInput = {
    tenantId: job.tenantId,
    userId: run.createdByUserId,
    dietitianId: conversation.createdByDietitianId,
    role: "dietitian",
    scopeType: conversation.scopeType,
    clientId: conversation.clientId,
    conversationRevision: conversation.revision,
  };

  const buildFinalizeBase = (capturedRevisionToken: string | null) => ({
    store,
    tenantId: job.tenantId,
    runId: run.id,
    run: { conversationId: run.conversationId, createdByUserId: run.createdByUserId },
    triggerBody: triggerVersion.body,
    conversation: {
      scopeType: conversation.scopeType,
      clientId: conversation.clientId,
      id: conversation.id,
      createdByDietitianId: conversation.createdByDietitianId,
      revision: conversation.revision,
    },
    gatewayAccessInput,
    capturedRevisionToken,
  });

  await appendStatus("retrieving");
  if (await store.shouldAbortRun(job.tenantId, run.id)) {
    await finalizeRunOutcome({
      ...buildFinalizeBase(null),
      outcome: { kind: "stopped", partialText: "" },
    });
    return;
  }

  const gateway = await buildClientContext({
    scopeType: conversation.scopeType,
    clientId: conversation.clientId,
    triggerBody: triggerVersion.body,
    accessCheck: () => store.getContextGatewayAccess(gatewayAccessInput),
    listAccessibleClients: () => store.listContextGatewayAccessibleClients(job.tenantId),
    executeTool: (tool, args) => {
      if (conversation.scopeType === "general") {
        if (tool !== "search_approved_sources") {
          return Promise.resolve(
            normalizeContextToolExecutionResult(tool, {
              status: "failed",
              ok: false,
              errorCode: "context_tool_not_allowed_in_general_scope",
              rows: [],
              categoryFailed: true,
            }),
          );
        }
        return store.executeContextGatewayTool({
          tenantId: job.tenantId,
          clientId: null,
          tool,
          args,
        });
      }
      if (!conversation.clientId) {
        return Promise.resolve(
          normalizeContextToolExecutionResult(tool, {
            status: "failed",
            ok: false,
            errorCode: "context_tool_client_required",
            rows: [],
            categoryFailed: true,
          }),
        );
      }
      return store.executeContextGatewayTool({
        tenantId: job.tenantId,
        clientId: conversation.clientId,
        tool,
        args,
      });
    },
    semanticRetriever: createDisabledSemanticRetriever(),
  });

  if (gateway.blocked) {
    await finalizeRunOutcome({
      ...buildFinalizeBase(null),
      outcome: { kind: "gateway_blocked", blockReason: gateway.blockReason },
    });
    return;
  }

  const attachmentDerivativeItems = await store.listMessageAttachmentDerivatives(
    job.tenantId,
    triggerVersion.id,
  );
  const evidencePackage = mergeMessageAttachmentDerivativesIntoEvidencePackage(
    gateway.evidencePackage,
    buildAttachmentDerivativeEvidenceRows(conversation.clientId, attachmentDerivativeItems),
    { scopeType: conversation.scopeType, clientId: conversation.clientId },
  );

  const capturedRevisionToken = gateway.revisionManifest.revisionToken;
  await store.saveContextSnapshot({
    tenantId: job.tenantId,
    runId: run.id,
    conversationId: run.conversationId,
    createdByUserId: run.createdByUserId,
    ...buildContextSnapshotFromPackage(evidencePackage),
  });

  for (const sourceRef of evidencePackage.sourceRefs) {
    await store.appendRunEvent(job.tenantId, run.id, {
      eventType: "source.available",
      payload: {
        sourceId: sourceRef.sourceId,
        sourceType: sourceRef.sourceType,
        locator: sourceRef.locator,
      },
    });
  }

  if (evidencePackage.insufficientEvidence) {
    await finalizeRunOutcome({
      ...buildFinalizeBase(capturedRevisionToken),
      outcome: { kind: "insufficient_evidence" },
    });
    return;
  }

  await appendStatus("generating");

  const sourceMaps = buildSourceMapsFromGateway(evidencePackage);
  const providerRequestBase = {
    triggerBody: triggerVersion.body,
    messages: plan.context.visibleMessages,
    contextEnvelope: buildProviderContextEnvelope(evidencePackage),
    allowedSourceIds: sourceMaps.allowedSourceIds,
    sourceTypesById: sourceMaps.sourceTypesById,
    sourceExcerptById: sourceMaps.sourceExcerptById,
    signal: abortController.signal,
  };

  let streamedText = "";
  try {
    const providerResult = await generateWithOptionalRepair(provider, providerRequestBase);

    for (const delta of providerResult.deltas) {
      if (Date.now() - startedAt > AI_CHAT_RUN_TIMEOUT_MS) {
        throw new Error("run_timeout");
      }
      if (await store.shouldAbortRun(job.tenantId, run.id)) {
        streamedText = providerResult.deltas.slice(0, delta.sequence).map((item) => item.text).join("");
        await finalizeRunOutcome({
          ...buildFinalizeBase(capturedRevisionToken),
          outcome: {
            kind: "stopped",
            partialText: streamedText,
            providerRiskLevel: providerResult.riskLevel,
            answerability: providerResult.answerability,
          },
        });
        return;
      }
      sawFirstDelta = true;
      streamedText += delta.text;
      await store.appendRunEvent(job.tenantId, run.id, {
        eventType: "response.delta",
        payload: { text: delta.text, offset: streamedText.length - delta.text.length },
      });
      await store.renewJobLease(job.id, workerId, job.leaseToken!, AI_CHAT_JOB_HEARTBEAT_MS);
    }

    if (await store.shouldAbortRun(job.tenantId, run.id)) {
      await finalizeRunOutcome({
        ...buildFinalizeBase(capturedRevisionToken),
        outcome: {
          kind: "stopped",
          partialText: streamedText || providerResult.directAnswer || "",
          providerRiskLevel: providerResult.riskLevel,
          answerability: providerResult.answerability,
        },
      });
      return;
    }

    await appendStatus("validating");
    const currentStatus = (await store.getRunById(job.tenantId, run.id))?.status ?? run.status;

    let sourcedValidation: ReturnType<typeof validateDietitianChatSourcedAnswer> | null = null;
    if (providerResult.structuredAnswer) {
      sourcedValidation = validateDietitianChatSourcedAnswer({
        structuredAnswer: providerResult.structuredAnswer,
        allowedSourceIds: sourceMaps.allowedSourceIds,
        sourceTypesById: sourceMaps.sourceTypesById,
        sourceExcerptById: sourceMaps.sourceExcerptById,
        runId: run.id,
        clientId: conversation.clientId,
      });
      if (!sourcedValidation.ok) {
        await finalizeRunOutcome({
          ...buildFinalizeBase(capturedRevisionToken),
          outcome: {
            kind: "failed",
            errorCode: sourcedValidation.code ?? "structured_answer_invalid",
            answerability: asAnswerability(sourcedValidation.answerability),
            riskLevel: asRiskLevel(providerResult.riskLevel),
          },
        });
        return;
      }
    }

    const finalized = finalizeDietitianChatRun({
      runStatus: currentStatus,
      providerResult: {
        directAnswer: providerResult.directAnswer,
        answerability: sourcedValidation?.answerability ?? providerResult.answerability,
        riskLevel: providerResult.riskLevel,
        completionState: providerResult.completionState,
        structuredAnswer: providerResult.structuredAnswer ?? null,
      },
      sourcedValidation,
    });

    if (shouldAbortDietitianChatRun(currentStatus)) {
      await finalizeRunOutcome({
        ...buildFinalizeBase(capturedRevisionToken),
        outcome: {
          kind: "stopped",
          partialText: finalized.validation.directAnswer ?? streamedText,
          providerRiskLevel: asRiskLevel(finalized.validation.riskLevel) ?? providerResult.riskLevel,
          answerability: asAnswerability(finalized.validation.answerability) ?? providerResult.answerability,
        },
      });
      return;
    }

    if (!finalized.validation.ok && finalized.terminalStatus === "failed") {
      await finalizeRunOutcome({
        ...buildFinalizeBase(capturedRevisionToken),
        outcome: {
          kind: "failed",
          errorCode: finalized.validation.code ?? "output_validation_failed",
          answerability: asAnswerability(finalized.validation.answerability),
          riskLevel: asRiskLevel(finalized.validation.riskLevel),
        },
      });
      return;
    }

    const completionState = finalized.validation.completionState as AiChatCompletionState;
    const directAnswer = finalized.validation.directAnswer ?? streamedText;

    if (evidencePackage.conflictingEvidence) {
      await finalizeRunOutcome({
        ...buildFinalizeBase(capturedRevisionToken),
        outcome: {
          kind: "conflicting_evidence",
          riskLevel: asRiskLevel(finalized.validation.riskLevel),
        },
      });
      return;
    }

    await finalizeRunOutcome({
      ...buildFinalizeBase(capturedRevisionToken),
      outcome: {
        kind: "completed",
        directAnswer,
        completionState,
        answerability: asAnswerability(finalized.validation.answerability) ?? "answerable",
        riskLevel: asRiskLevel(finalized.validation.riskLevel),
        providerRiskLevel: providerResult.riskLevel,
        gateway,
        sourceMaps,
        providerResult,
        sourcedValidation,
      },
    });
  } catch (error) {
    if (!sawFirstDelta) {
      await finalizeRunOutcome({
        ...buildFinalizeBase(capturedRevisionToken ?? null),
        outcome: {
          kind: "failed",
          errorCode: String(error),
        },
      });
      throw error;
    }
    await finalizeRunOutcome({
      ...buildFinalizeBase(capturedRevisionToken ?? null),
      outcome: {
        kind: "stopped",
        partialText: streamedText,
      },
    });
  } finally {
    clearTimeout(providerTimeout);
  }
}

export function mapRunDto(row: Record<string, unknown>): AiChatRunDto {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id ?? row.tenantId),
    conversationId: String(row.conversation_id ?? row.conversationId),
    createdByUserId: String(row.created_by_user_id ?? row.createdByUserId),
    triggerMessageVersionId: String(row.trigger_message_version_id ?? row.triggerMessageVersionId),
    status: (row.status as AiChatRunStatus) ?? "queued",
    answerability: (row.answerability as AiChatRunDto["answerability"]) ?? null,
    riskLevel: (row.risk_level as AiChatRunDto["riskLevel"]) ?? null,
    safetyOutcome: (row.safety_outcome as string | null) ?? null,
    cancelRequestedAt: (row.cancel_requested_at as string | null) ?? null,
    errorCode: (row.error_code as string | null) ?? null,
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  };
}

export function mapRunEventDto(row: Record<string, unknown>): AiChatRunEventDto {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id ?? row.tenantId),
    runId: String(row.run_id ?? row.runId),
    conversationId: String(row.conversation_id ?? row.conversationId),
    sequenceNumber: Number(row.sequence_number ?? row.sequenceNumber),
    eventType: String(row.event_type ?? row.eventType),
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? row.createdAt),
  };
}

export function buildAcceptedRunEvent(run: AiChatRunDto) {
  return {
    eventType: "run.accepted",
    payload: {
      runId: run.id,
      status: run.status,
    },
  };
}

export function hashMessageBody(body: string) {
  return sha256(body);
}

export function assertUserActiveRunBudget(activeCount: number) {
  if (activeCount >= AI_CHAT_MAX_USER_ACTIVE_RUNS) {
    throw new AppRequestError(409, "ai_chat_user_run_limit");
  }
}

export async function assertRunOwnedByUser(
  store: AiChatStore,
  context: AppTenantContext,
  runId: string,
) {
  const run = await store.getRunById(context.tenantId, runId);
  if (!run || run.createdByUserId !== context.userId) {
    throw new AppRequestError(404, "ai_chat_run_not_found");
  }
  return run;
}

export function createHeartbeatRunEvent() {
  return {
    eventType: "heartbeat",
    payload: { at: new Date().toISOString() },
  };
}

export function runEventsToSseChunk(event: AiChatRunEventDto) {
  return `id: ${event.sequenceNumber}\nevent: ${event.eventType}\ndata: ${JSON.stringify({
    ...event.payload,
    sequenceNumber: event.sequenceNumber,
    eventType: event.eventType,
    eventId: event.id,
  })}\n\n`;
}

export { runEventExpiryIso };

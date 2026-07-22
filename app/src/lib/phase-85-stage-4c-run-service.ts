import { createHash } from "node:crypto";
import {
  createDietitianChatRunPlan,
  finalizeDietitianChatRun,
  shouldAbortDietitianChatRun,
} from "dietitian-ai-assistant-architecture";
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
  isNonTerminalAiChatRunStatus,
} from "./phase-85-stage-4c-contracts";
import {
  resolveAiChatGenerationProvider,
  type AiChatGenerationProvider,
} from "./phase-85-stage-4c-provider";
import type { AiChatStore } from "./phase-85-stage-4c-store";

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

export const STAGE_4C_RUN_SERVICE_VERSION = "p85-stage-4c-run-service-v1";

export type AiChatSendMessageInput = {
  requestId: string;
  expectedRevision: number;
  body: string;
  branchId?: string | null;
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
    if (!["requestId", "expectedRevision", "body", "branchId"].includes(key)) {
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
  const branchId =
    record.branchId == null
      ? null
      : typeof record.branchId === "string" && record.branchId.trim()
        ? record.branchId.trim()
        : null;
  return { requestId, expectedRevision, body: messageBody, branchId };
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

  const branchMessages = await store.getBranchMessageChain(job.tenantId, triggerVersion.branchId);
  const plan = createDietitianChatRunPlan({
    triggerBody: triggerVersion.body,
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

  await appendStatus("retrieving");
  if (await store.shouldAbortRun(job.tenantId, run.id)) {
    await finalizeStoppedRun(store, job.tenantId, run.id, "");
    return;
  }

  await appendStatus("generating");

  let streamedText = "";
  try {
    const providerResult = await provider.generate({
      triggerBody: triggerVersion.body,
      messages: plan.context.visibleMessages,
      signal: abortController.signal,
    });

    for (const delta of providerResult.deltas) {
      if (Date.now() - startedAt > AI_CHAT_RUN_TIMEOUT_MS) {
        throw new Error("run_timeout");
      }
      if (await store.shouldAbortRun(job.tenantId, run.id)) {
        streamedText = providerResult.deltas.slice(0, delta.sequence).map((item) => item.text).join("");
        await finalizeStoppedRun(store, job.tenantId, run.id, streamedText);
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

    if (providerResult.riskLevel) {
      await store.appendRunEvent(job.tenantId, run.id, {
        eventType: "risk.updated",
        payload: { riskLevel: providerResult.riskLevel },
      });
    }

    if (await store.shouldAbortRun(job.tenantId, run.id)) {
      await finalizeStoppedRun(store, job.tenantId, run.id, streamedText || providerResult.directAnswer || "");
      return;
    }

    await appendStatus("validating");
    const currentStatus = (await store.getRunById(job.tenantId, run.id))?.status ?? run.status;
    const finalized = finalizeDietitianChatRun({
      runStatus: currentStatus,
      providerResult: {
        directAnswer: providerResult.directAnswer,
        answerability: providerResult.answerability,
        riskLevel: providerResult.riskLevel,
        completionState: providerResult.completionState,
      },
    });

    if (shouldAbortDietitianChatRun(currentStatus)) {
      await finalizeStoppedRun(
        store,
        job.tenantId,
        run.id,
        finalized.validation.directAnswer ?? streamedText,
      );
      return;
    }

    if (!finalized.validation.ok && finalized.terminalStatus === "failed") {
      await store.finalizeRun(job.tenantId, run.id, {
        status: "failed",
        errorCode: finalized.validation.code ?? "output_validation_failed",
        answerability: asAnswerability(finalized.validation.answerability),
        riskLevel: asRiskLevel(finalized.validation.riskLevel),
      });
      await store.appendRunEvent(job.tenantId, run.id, {
        eventType: "run.failed",
        payload: { errorCode: finalized.validation.code ?? "output_validation_failed" },
      });
      return;
    }

    const completionState = finalized.validation.completionState as AiChatCompletionState;
    const directAnswer = finalized.validation.directAnswer ?? streamedText;

    if (completionState === "complete" && directAnswer) {
      await store.commitAssistantMessage(job.tenantId, run.id, {
        body: directAnswer,
        answerability: asAnswerability(finalized.validation.answerability),
        riskLevel: asRiskLevel(finalized.validation.riskLevel),
      });
    } else if (directAnswer) {
      await store.commitAssistantMessage(job.tenantId, run.id, {
        body: directAnswer,
        answerability: asAnswerability(finalized.validation.answerability),
        riskLevel: asRiskLevel(finalized.validation.riskLevel),
        completionState: "incomplete",
      });
    }

    const terminalStatus = completionState === "complete" ? "completed" : finalized.terminalStatus;
    await store.finalizeRun(job.tenantId, run.id, {
      status: terminalStatus === "stopped" ? "stopped" : completionState === "complete" ? "completed" : "stopped",
      answerability: asAnswerability(finalized.validation.answerability),
      riskLevel: asRiskLevel(finalized.validation.riskLevel),
    });

    await store.appendRunEvent(job.tenantId, run.id, {
      eventType: completionState === "complete" ? "response.completed" : "response.stopped",
      payload: {
        completionState,
        answerability: asAnswerability(finalized.validation.answerability),
        riskLevel: asRiskLevel(finalized.validation.riskLevel),
      },
    });

    if (completionState === "complete") {
      await store.enqueueTitleJob(job.tenantId, run.conversationId, run.createdByUserId);
    }
  } catch (error) {
    if (!sawFirstDelta) {
      await store.finalizeRun(job.tenantId, run.id, {
        status: "failed",
        errorCode: String(error),
      });
      await store.appendRunEvent(job.tenantId, run.id, {
        eventType: "run.failed",
        payload: { errorCode: String(error), retryable: true },
      });
      throw error;
    }
    await finalizeStoppedRun(store, job.tenantId, run.id, streamedText);
  } finally {
    clearTimeout(providerTimeout);
  }
}

async function finalizeStoppedRun(
  store: AiChatStore,
  tenantId: string,
  runId: string,
  partialText: string,
) {
  if (partialText.trim()) {
    await store.commitAssistantMessage(tenantId, runId, {
      body: partialText,
      answerability: "partial",
      riskLevel: "green",
      completionState: "incomplete",
    });
  }
  await store.finalizeRun(tenantId, runId, {
    status: "stopped",
    answerability: "partial",
    riskLevel: "green",
  });
  await store.appendRunEvent(tenantId, runId, {
    eventType: "response.stopped",
    payload: { completionState: "incomplete" },
  });
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

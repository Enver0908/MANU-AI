import { randomUUID } from "node:crypto";
import type { AppTenantContext } from "./auth-context";
import { AppRequestError } from "./app-errors";
import type {
  AiChatDraftTransferDto,
  AiChatHandoffLinkDto,
  AiChatRunRiskSummaryDto,
} from "./phase-85-stage-4c-contracts";
import {
  applyClientChatRedNotification,
  assertClientChatRiskBridgeAllowed,
  commitFallbackMessagingState,
  consumeAiChatDraftTransfer,
  createAiChatDraftTransfer,
  createEmptyRiskBridgeState,
  createExplicitAiChatHandoff,
  evaluateAiChatRunRisk,
  getActiveRunRiskAssessment,
  getPendingAiChatDraftTransfer,
  listMessagingDestinationsForClient,
  persistAiChatRiskAssessment,
  requireHandoffCapability,
  resolveFallbackMessagingState,
  supersedeAiChatRiskArtifacts,
  type AiChatRiskBridgeRunContext,
  type InMemoryRiskBridgeState,
} from "./phase-85-stage-4c-risk-bridge";

export type { InMemoryRiskBridgeState };

export function createRiskBridgeStoreSlice() {
  return createEmptyRiskBridgeState();
}

export function applyInMemoryRunRiskPipeline(
  bridgeState: InMemoryRiskBridgeState,
  input: AiChatRiskBridgeRunContext & { revisionToken?: string | null },
) {
  const assessment = evaluateAiChatRunRisk(input);
  const handoffConfirmationToken = randomUUID();
  const record = persistAiChatRiskAssessment(bridgeState, {
    ...input,
    assessment,
    handoffConfirmationToken,
  });
  if (input.scopeType === "client" && input.clientId && assessment.riskLevel === "red" && !assessment.hypotheticalRed) {
    const next = applyClientChatRedNotification(resolveFallbackMessagingState(), {
      tenantId: input.tenantId,
      clientId: input.clientId,
      conversationId: input.conversationId,
      runId: input.runId,
      createdByUserId: input.createdByUserId,
      reasons: assessment.reasons,
      sourceRevisionDigest: record.sourceRevisionDigest,
    });
    commitFallbackMessagingState(next);
  }
  return record;
}

export function getInMemoryRunRiskSummary(
  bridgeState: InMemoryRiskBridgeState,
  tenantId: string,
  runId: string,
): AiChatRunRiskSummaryDto | null {
  const assessment = getActiveRunRiskAssessment(bridgeState, tenantId, runId);
  if (!assessment) return null;
  const safeDraft = bridgeState.safeDrafts.get(runId) ?? null;
  const client = assessment.clientId
    ? resolveFallbackMessagingState().clients.find((item) => item.id === assessment.clientId)
    : null;
  return {
    runId,
    riskLevel: assessment.riskLevel,
    reasons: assessment.reasons,
    confidenceClass: assessment.confidenceClass,
    recommendedHumanAction: assessment.recommendedHumanAction,
    hypotheticalRed: assessment.hypotheticalRed,
    safeDraft,
    handoffConfirmationToken: assessment.handoffConfirmationToken,
    canTransferDraft: assessment.riskLevel !== "red" && Boolean(safeDraft?.body),
    canCreateHandoff: assessment.riskLevel === "red" && Boolean(assessment.clientId),
    clientContextRevision: client?.contextRevision ?? null,
  } as AiChatRunRiskSummaryDto;
}

export function transferInMemoryRunDraft(
  bridgeState: InMemoryRiskBridgeState,
  context: AppTenantContext,
  input: {
    runId: string;
    sourceConversationId: string;
    destinationConversationId: string;
    destinationRevision: number;
    clientContextRevision: number;
    scopeType: "general" | "client";
  },
): AiChatDraftTransferDto {
  assertClientChatRiskBridgeAllowed(input.scopeType);
  const appState = resolveFallbackMessagingState();
  const { transfer, nextAppState } = createAiChatDraftTransfer(bridgeState, appState, {
    tenantId: context.tenantId,
    runId: input.runId,
    sourceConversationId: input.sourceConversationId,
    destinationConversationId: input.destinationConversationId,
    createdByUserId: context.userId,
    destinationRevision: input.destinationRevision,
    clientContextRevision: input.clientContextRevision,
  });
  commitFallbackMessagingState(nextAppState);
  return transfer;
}

export function createInMemoryRunHandoff(
  bridgeState: InMemoryRiskBridgeState,
  context: AppTenantContext,
  input: {
    runId: string;
    conversationId: string;
    clientId: string;
    confirmationToken: string;
    expectedClientContextRevision: number;
    scopeType: "general" | "client";
  },
): { handoffId: string; link: AiChatHandoffLinkDto } {
  assertClientChatRiskBridgeAllowed(input.scopeType);
  requireHandoffCapability(context);
  const appState = resolveFallbackMessagingState();
  const { handoff, link, nextAppState } = createExplicitAiChatHandoff(bridgeState, appState, {
    tenantId: context.tenantId,
    runId: input.runId,
    conversationId: input.conversationId,
    clientId: input.clientId,
    createdByUserId: context.userId,
    dietitianId: context.dietitianId,
    confirmationToken: input.confirmationToken,
    expectedClientContextRevision: input.expectedClientContextRevision,
  });
  commitFallbackMessagingState(nextAppState);
  return { handoffId: handoff.id, link };
}

export function listInMemoryDraftDestinations(tenantId: string, clientId: string) {
  return listMessagingDestinationsForClient(resolveFallbackMessagingState(), tenantId, clientId);
}

export function getInMemoryPendingComposerTransfer(bridgeState: InMemoryRiskBridgeState, tenantId: string, conversationId: string) {
  return getPendingAiChatDraftTransfer(bridgeState, tenantId, conversationId);
}

export function consumeInMemoryDraftTransfer(
  bridgeState: InMemoryRiskBridgeState,
  input: {
    tenantId: string;
    transferId: string;
    destinationConversationId: string;
    destinationClientId: string;
  },
) {
  return consumeAiChatDraftTransfer(bridgeState, input);
}

export function supersedeInMemoryConversationRisk(
  bridgeState: InMemoryRiskBridgeState,
  input: { tenantId: string; conversationId: string; runId?: string | null },
) {
  const next = supersedeAiChatRiskArtifacts(bridgeState, resolveFallbackMessagingState(), input);
  commitFallbackMessagingState(next);
}

export function parseAiChatTransferDraftBody(body: unknown) {
  if (!body || typeof body !== "object") throw new AppRequestError(400, "ai_chat_invalid_body");
  const record = body as Record<string, unknown>;
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  const destinationConversationId =
    typeof record.destinationConversationId === "string" ? record.destinationConversationId.trim() : "";
  const destinationRevision = Number(record.destinationRevision);
  const clientContextRevision = Number(record.clientContextRevision);
  if (!requestId || !destinationConversationId || !Number.isFinite(destinationRevision) || !Number.isFinite(clientContextRevision)) {
    throw new AppRequestError(400, "ai_chat_invalid_body");
  }
  return { requestId, destinationConversationId, destinationRevision, clientContextRevision };
}

export function parseAiChatCreateHandoffBody(body: unknown) {
  if (!body || typeof body !== "object") throw new AppRequestError(400, "ai_chat_invalid_body");
  const record = body as Record<string, unknown>;
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  const confirmationToken = typeof record.confirmationToken === "string" ? record.confirmationToken.trim() : "";
  const expectedClientContextRevision = Number(record.expectedClientContextRevision);
  if (!requestId || !confirmationToken || !Number.isFinite(expectedClientContextRevision)) {
    throw new AppRequestError(400, "ai_chat_invalid_body");
  }
  return { requestId, confirmationToken, expectedClientContextRevision };
}

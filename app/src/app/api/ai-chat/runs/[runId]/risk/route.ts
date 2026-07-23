import { aiChatJsonResponse } from "@/lib/phase-85-stage-4c-service";
import { getFallbackState } from "@/lib/app-state-store";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { runId } = await context.params;

  return withAiChatRoute("read", async (tenantContext, store) => {
    const summary = await store.getRunRiskSummary(tenantContext.tenantId, runId, tenantContext.userId);
    if (!summary) {
      const { AppRequestError } = await import("@/lib/app-errors");
      throw new AppRequestError(404, "ai_chat_risk_assessment_missing");
    }
    const destinations =
      summary.canTransferDraft && summary.riskLevel !== "red"
        ? await store.listRunDraftDestinations(tenantContext, runId)
        : [];
    const run = await store.getRunById(tenantContext.tenantId, runId);
    const conversation = run
      ? await store.getConversationRecord(tenantContext.tenantId, run.conversationId)
      : null;
    const clientContextRevision =
      conversation?.clientId != null
        ? (getFallbackState().clients.find((item) => item.id === conversation.clientId)?.contextRevision ??
          null)
        : null;
    return aiChatJsonResponse({ ...summary, destinations, clientContextRevision });
  });
}

import { aiChatErrorResponse, aiChatJsonResponse } from "@/lib/phase-85-stage-4c-service";
import { parseAiChatCreateHandoffBody } from "@/lib/phase-85-stage-4c-risk-store";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { runId } = await context.params;
  let requestId: string | null = null;

  try {
    const body = await request.json();
    const input = parseAiChatCreateHandoffBody(body);
    requestId = input.requestId;
    return await withAiChatRoute("mutation", async (tenantContext, store) => {
      const run = await store.getRunById(tenantContext.tenantId, runId);
      if (!run || run.createdByUserId !== tenantContext.userId) {
        const { AppRequestError } = await import("@/lib/app-errors");
        throw new AppRequestError(404, "ai_chat_run_not_found");
      }
      const conversation = await store.getConversationRecord(tenantContext.tenantId, run.conversationId);
      if (!conversation?.clientId) {
        const { AppRequestError } = await import("@/lib/app-errors");
        throw new AppRequestError(409, "ai_chat_destination_conversation_missing");
      }
      const result = await store.createRunHandoff(tenantContext, runId, {
        conversationId: run.conversationId,
        clientId: conversation.clientId,
        confirmationToken: input.confirmationToken,
        expectedClientContextRevision: input.expectedClientContextRevision,
      });
      return aiChatJsonResponse(result);
    }, requestId);
  } catch (error) {
    return aiChatErrorResponse(error, requestId);
  }
}

import {
  aiChatJsonResponse,
  assertAiChatId,
  parseAiChatDeleteConversationBody,
  parseAiChatLoadQuery,
  parseAiChatRenameBody,
} from "@/lib/phase-85-stage-4c-service";
import { maybeProcessDeterministicAiChatJobs } from "@/lib/phase-85-stage-4c-run-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { chatId } = await context.params;
  const url = new URL(request.url);
  const query = parseAiChatLoadQuery({ limit: url.searchParams.get("limit") });
  const normalizedChatId = assertAiChatId(chatId);

  return withAiChatRoute("read", async (tenantContext, store) =>
    aiChatJsonResponse(await store.loadConversation(tenantContext, normalizedChatId, query)),
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const { chatId } = await context.params;
  const normalizedChatId = assertAiChatId(chatId);
  let requestId: string | null = null;

  try {
    const body = await request.json();
    const input = parseAiChatRenameBody(body);
    requestId = input.requestId;
    return await withAiChatRoute(
      "mutation",
      async (tenantContext, store) =>
        aiChatJsonResponse(await store.renameConversation(tenantContext, normalizedChatId, input)),
      requestId,
    );
  } catch (error) {
    const { aiChatErrorResponse } = await import("@/lib/phase-85-stage-4c-service");
    return aiChatErrorResponse(error, requestId);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { chatId } = await context.params;
  const normalizedChatId = assertAiChatId(chatId);
  let requestId: string | null = null;

  try {
    const body = await request.json();
    const input = parseAiChatDeleteConversationBody(body);
    requestId = input.requestId;
    return await withAiChatRoute(
      "mutation",
      async (tenantContext, store) => {
        const result = await store.deleteConversation(tenantContext, normalizedChatId, input);
        await store.processLifecycleDeletionBatch(4);
        await maybeProcessDeterministicAiChatJobs(store);
        return new Response(JSON.stringify(result), {
          status: 202,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        });
      },
      requestId,
    );
  } catch (error) {
    const { aiChatErrorResponse } = await import("@/lib/phase-85-stage-4c-service");
    return aiChatErrorResponse(error, requestId);
  }
}

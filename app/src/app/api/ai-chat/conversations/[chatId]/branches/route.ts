import { aiChatJsonResponse, assertAiChatId } from "@/lib/phase-85-stage-4c-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { chatId } = await context.params;
  const normalizedChatId = assertAiChatId(chatId);

  return withAiChatRoute("read", async (tenantContext, store) =>
    aiChatJsonResponse(await store.listBranches(tenantContext, normalizedChatId)),
  );
}

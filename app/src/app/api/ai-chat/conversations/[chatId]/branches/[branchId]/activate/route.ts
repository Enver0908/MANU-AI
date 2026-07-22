import {
  aiChatJsonResponse,
  assertAiChatId,
  parseAiChatActivateBranchBody,
} from "@/lib/phase-85-stage-4c-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = {
  params: Promise<{ chatId: string; branchId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { chatId, branchId } = await context.params;
  const normalizedChatId = assertAiChatId(chatId);
  let requestId: string | null = null;

  try {
    const body = await request.json();
    const input = parseAiChatActivateBranchBody({ ...body, branchId });
    requestId = input.requestId;
    return await withAiChatRoute(
      "mutation",
      async (tenantContext, store) =>
        aiChatJsonResponse(await store.activateBranch(tenantContext, normalizedChatId, input)),
      requestId,
    );
  } catch (error) {
    const { aiChatErrorResponse } = await import("@/lib/phase-85-stage-4c-service");
    return aiChatErrorResponse(error, requestId);
  }
}

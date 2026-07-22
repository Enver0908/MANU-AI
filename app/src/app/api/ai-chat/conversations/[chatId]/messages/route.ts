import { assertAiChatId } from "@/lib/phase-85-stage-4c-service";
import {
  maybeProcessDeterministicAiChatJobs,
  parseAiChatSendMessageBody,
} from "@/lib/phase-85-stage-4c-run-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { chatId } = await context.params;
  const normalizedChatId = assertAiChatId(chatId);
  let requestId: string | null = null;

  try {
    const body = await request.json();
    const input = parseAiChatSendMessageBody(body);
    requestId = input.requestId;
    return await withAiChatRoute(
      "mutation",
      async (tenantContext, store) => {
        const result = await store.sendMessage(tenantContext, normalizedChatId, input);
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

import {
  maybeProcessDeterministicAiChatJobs,
  parseAiChatEditMessageBody,
} from "@/lib/phase-85-stage-4c-run-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { messageId } = await context.params;
  let requestId: string | null = null;

  try {
    const body = await request.json();
    const input = parseAiChatEditMessageBody(body);
    requestId = input.requestId;
    return await withAiChatRoute(
      "mutation",
      async (tenantContext, store) => {
        const result = await store.editMessage(tenantContext, messageId, input);
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

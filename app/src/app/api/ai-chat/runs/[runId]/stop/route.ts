import { aiChatJsonResponse } from "@/lib/phase-85-stage-4c-service";
import { parseAiChatStopRunBody } from "@/lib/phase-85-stage-4c-run-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { runId } = await context.params;
  let requestId: string | null = null;

  try {
    const body = await request.json();
    const input = parseAiChatStopRunBody(body);
    requestId = input.requestId;
    return await withAiChatRoute(
      "mutation",
      async (tenantContext, store) =>
        aiChatJsonResponse(await store.stopRun(tenantContext, runId, input)),
      requestId,
    );
  } catch (error) {
    const { aiChatErrorResponse } = await import("@/lib/phase-85-stage-4c-service");
    return aiChatErrorResponse(error, requestId);
  }
}

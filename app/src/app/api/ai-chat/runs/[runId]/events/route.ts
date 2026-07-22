import {
  AI_CHAT_SSE_HEARTBEAT_MS,
  AI_CHAT_SSE_WINDOW_MS,
  isNonTerminalAiChatRunStatus,
} from "@/lib/phase-85-stage-4c-contracts";
import {
  assertRunOwnedByUser,
  createHeartbeatRunEvent,
  parseRunEventsAfterParam,
  runEventsToSseChunk,
} from "@/lib/phase-85-stage-4c-run-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const url = new URL(request.url);
  const afterSequence = parseRunEventsAfterParam(url.searchParams.get("after"));

  return withAiChatRoute("read", async (tenantContext, store) => {
    await assertRunOwnedByUser(store, tenantContext, runId);
    const encoder = new TextEncoder();
    const startedAt = Date.now();
    let lastSequence = afterSequence;
    let lastHeartbeatAt = Date.now();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (Date.now() - startedAt < AI_CHAT_SSE_WINDOW_MS) {
            const events = await store.listRunEvents(tenantContext, runId, lastSequence);
            for (const event of events) {
              if (event.sequenceNumber <= lastSequence) continue;
              lastSequence = event.sequenceNumber;
              controller.enqueue(encoder.encode(runEventsToSseChunk(event)));
            }

            const latestRun = await store.getRunById(tenantContext.tenantId, runId);
            if (!latestRun || !isNonTerminalAiChatRunStatus(latestRun.status)) {
              break;
            }

            if (Date.now() - lastHeartbeatAt >= AI_CHAT_SSE_HEARTBEAT_MS) {
              const heartbeat = await store.appendRunEvent(
                tenantContext.tenantId,
                runId,
                createHeartbeatRunEvent(),
              );
              controller.enqueue(encoder.encode(runEventsToSseChunk(heartbeat)));
              lastHeartbeatAt = Date.now();
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        connection: "keep-alive",
      },
    });
  });
}

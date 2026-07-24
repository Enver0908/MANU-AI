import {
  assertRunOwnedByUser,
  parseRunEventsAfterParam,
} from "@/lib/phase-85-stage-4c-run-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";
import { createAiChatRunEventSseStream } from "@/lib/phase-85-stage-4c-run-event-stream";
import {
  createInMemoryRunEventMultiplexerDeps,
  createSupabaseRunEventMultiplexerDeps,
} from "@/lib/phase-85-stage-4c-run-event-multiplexer";
import { getSupabaseAdminClient } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const url = new URL(request.url);
  const afterSequence = parseRunEventsAfterParam(url.searchParams.get("after"));

  return withAiChatRoute("read", async (tenantContext, store) => {
    await assertRunOwnedByUser(store, tenantContext, runId);
    const supabase = getSupabaseAdminClient();
    const deps = supabase
      ? createSupabaseRunEventMultiplexerDeps(supabase, {
          tenantId: tenantContext.tenantId,
          userId: tenantContext.userId,
          dietitianId: tenantContext.dietitianId,
          role: tenantContext.role,
          runId,
        })
      : createInMemoryRunEventMultiplexerDeps((after) =>
          store.listRunEvents(tenantContext, runId, after),
        );

    const stream = createAiChatRunEventSseStream({
      tenantId: tenantContext.tenantId,
      runId,
      afterSequence,
      signal: request.signal,
      getRunStatus: async () => {
        const run = await store.getRunById(tenantContext.tenantId, runId);
        return run?.status ?? null;
      },
      deps,
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

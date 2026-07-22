import { assertRunOwnedByUser } from "@/lib/phase-85-stage-4c-run-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { runId } = await context.params;

  return withAiChatRoute("read", async (tenantContext, store) => {
    await assertRunOwnedByUser(store, tenantContext, runId);
    const sources = await store.listRunSources(tenantContext.tenantId, runId, tenantContext.userId);
    return Response.json(sources);
  });
}

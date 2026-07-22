import { aiChatJsonResponse, parseAiChatClientSearchQuery } from "@/lib/phase-85-stage-4c-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseAiChatClientSearchQuery({
    query: url.searchParams.get("query"),
    limit: url.searchParams.get("limit"),
  });

  return withAiChatRoute("read", async (context, store) =>
    aiChatJsonResponse({ items: await store.searchAccessibleClients(context, query) }),
  );
}

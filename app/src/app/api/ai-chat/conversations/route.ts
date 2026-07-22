import {
  aiChatJsonResponse,
  parseAiChatCreateBody,
  parseAiChatListQuery,
} from "@/lib/phase-85-stage-4c-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseAiChatListQuery({
    scope: url.searchParams.get("scope"),
    query: url.searchParams.get("query"),
    cursor: url.searchParams.get("cursor"),
    limit: url.searchParams.get("limit"),
  });

  return withAiChatRoute("read", async (context, store) =>
    aiChatJsonResponse(await store.listConversations(context, query)),
  );
}

export async function POST(request: Request) {
  let requestId: string | null = null;
  try {
    const body = await request.json();
    const input = parseAiChatCreateBody(body);
    requestId = input.requestId;
    return await withAiChatRoute(
      "mutation",
      async (context, store) => aiChatJsonResponse(await store.createConversation(context, input)),
      requestId,
    );
  } catch (error) {
    const { aiChatErrorResponse } = await import("@/lib/phase-85-stage-4c-service");
    return aiChatErrorResponse(error, requestId);
  }
}
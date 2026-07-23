import { assertAiChatId } from "@/lib/phase-85-stage-4c-service";
import { parseAttachmentTransferBody } from "@/lib/phase-85-stage-4c-attachment-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = { params: Promise<{ attachmentId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { attachmentId } = await context.params;
  const normalizedId = assertAiChatId(attachmentId);
  let requestId: string | null = null;
  try {
    const body = await request.json();
    const input = parseAttachmentTransferBody(body);
    requestId = input.requestId;
    return await withAiChatRoute(
      "mutation",
      async (tenantContext, store) => {
        const result = await store.transferAttachmentToClientRecord(tenantContext, normalizedId, input);
        return Response.json(result, { headers: { "cache-control": "no-store" } });
      },
      requestId,
    );
  } catch (error) {
    const { aiChatErrorResponse } = await import("@/lib/phase-85-stage-4c-service");
    return aiChatErrorResponse(error, requestId);
  }
}

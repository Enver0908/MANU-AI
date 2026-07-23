import { assertAiChatId } from "@/lib/phase-85-stage-4c-service";
import { parseAttachmentCreateBody } from "@/lib/phase-85-stage-4c-attachment-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

export async function POST(request: Request) {
  let requestId: string | null = null;
  try {
    const body = await request.json();
    const input = parseAttachmentCreateBody(body);
    requestId = input.requestId;
    return await withAiChatRoute(
      "mutation",
      async (tenantContext, store) => {
        const result = await store.createAttachmentUploadSession(tenantContext, {
          conversationId: assertAiChatId(input.conversationId),
          fileName: input.fileName,
          mimeType: input.mimeType,
          byteSize: input.byteSize,
          contentSha256: input.contentSha256,
        });
        return Response.json(result, { status: 201, headers: { "cache-control": "no-store" } });
      },
      requestId,
    );
  } catch (error) {
    const { aiChatErrorResponse } = await import("@/lib/phase-85-stage-4c-service");
    return aiChatErrorResponse(error, requestId);
  }
}

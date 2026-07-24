import { assertAiChatId } from "@/lib/phase-85-stage-4c-service";
import { parseAttachmentCompleteBody } from "@/lib/phase-85-stage-4c-attachment-service";
import { maybeProcessDeterministicAiChatJobs } from "@/lib/phase-85-stage-4c-run-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = { params: Promise<{ attachmentId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { attachmentId } = await context.params;
  const normalizedId = assertAiChatId(attachmentId);
  let requestId: string | null = null;
  try {
    const body = await request.json();
    const input = parseAttachmentCompleteBody(body);
    requestId = input.requestId;
    return await withAiChatRoute(
      "mutation",
      async (tenantContext, store) => {
        const attachment = await store.completeAttachmentUpload(tenantContext, normalizedId, {
          contentSha256: input.contentSha256,
          uploadToken: input.uploadToken,
        });
        await maybeProcessDeterministicAiChatJobs(store);
        return Response.json(attachment, { status: 200, headers: { "cache-control": "no-store" } });
      },
      requestId,
    );
  } catch (error) {
    const { aiChatErrorResponse } = await import("@/lib/phase-85-stage-4c-service");
    return aiChatErrorResponse(error, requestId);
  }
}

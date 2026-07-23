import { assertAiChatId } from "@/lib/phase-85-stage-4c-service";
import { parseAttachmentCorrectionBody } from "@/lib/phase-85-stage-4c-attachment-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = { params: Promise<{ attachmentId: string; derivativeId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { attachmentId, derivativeId } = await context.params;
  const normalizedAttachmentId = assertAiChatId(attachmentId);
  const normalizedDerivativeId = assertAiChatId(derivativeId);
  let requestId: string | null = null;
  try {
    const body = await request.json();
    const input = parseAttachmentCorrectionBody(body);
    requestId = input.requestId;
    return await withAiChatRoute(
      "mutation",
      async (tenantContext, store) => {
        const attachment = await store.acceptAttachmentDerivativeCorrection(
          tenantContext,
          normalizedAttachmentId,
          normalizedDerivativeId,
          { correctedText: input.correctedText },
        );
        return Response.json(attachment, { headers: { "cache-control": "no-store" } });
      },
      requestId,
    );
  } catch (error) {
    const { aiChatErrorResponse } = await import("@/lib/phase-85-stage-4c-service");
    return aiChatErrorResponse(error, requestId);
  }
}

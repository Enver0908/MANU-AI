import { assertAiChatId } from "@/lib/phase-85-stage-4c-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";
import { AppRequestError } from "@/lib/app-errors";
import { AI_CHAT_ATTACHMENT_MAX_TOTAL_BYTES } from "@/lib/phase-85-stage-4c-attachments";

type RouteContext = { params: Promise<{ attachmentId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { attachmentId } = await context.params;
  const normalizedId = assertAiChatId(attachmentId);
  const uploadToken = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!uploadToken) {
    throw new AppRequestError(400, "ai_chat_invalid_body");
  }
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.byteLength <= 0 || bytes.byteLength > AI_CHAT_ATTACHMENT_MAX_TOTAL_BYTES) {
    throw new AppRequestError(400, "ai_chat_attachment_actual_size_invalid");
  }
  try {
    return await withAiChatRoute("mutation", async (tenantContext, store) => {
      await store.putAttachmentObjectBytes(tenantContext, normalizedId, uploadToken, bytes);
      return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
    });
  } catch (error) {
    const { aiChatErrorResponse } = await import("@/lib/phase-85-stage-4c-service");
    return aiChatErrorResponse(error, null);
  }
}

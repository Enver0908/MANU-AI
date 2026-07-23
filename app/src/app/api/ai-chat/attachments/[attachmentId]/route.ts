import { assertAiChatId } from "@/lib/phase-85-stage-4c-service";
import { withAiChatRoute } from "@/lib/phase-85-stage-4c-route";

type RouteContext = { params: Promise<{ attachmentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { attachmentId } = await context.params;
  const normalizedId = assertAiChatId(attachmentId);
  return withAiChatRoute("read", async (tenantContext, store) => {
    const attachment = await store.getAttachmentById(tenantContext, normalizedId);
    return Response.json(attachment, { headers: { "cache-control": "no-store" } });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { attachmentId } = await context.params;
  const normalizedId = assertAiChatId(attachmentId);
  return withAiChatRoute("mutation", async (tenantContext, store) => {
    await store.deleteAttachment(tenantContext, normalizedId);
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  });
}

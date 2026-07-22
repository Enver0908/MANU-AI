import { requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  AI_CHAT_MUTATION_RATE_LIMIT,
  AI_CHAT_READ_RATE_LIMIT,
} from "@/lib/phase-85-stage-4c-contracts";
import { resolveAiChatStore, type AiChatStore } from "@/lib/phase-85-stage-4c-store";
import { aiChatErrorResponse } from "@/lib/phase-85-stage-4c-service";
import type { AppTenantContext } from "@/lib/auth-context";

type AiChatRouteKind = "read" | "mutation";

export async function withAiChatRoute<T>(
  kind: AiChatRouteKind,
  handler: (context: AppTenantContext, store: AiChatStore) => Promise<T>,
  requestId: string | null = null,
) {
  try {
    const context = await resolveAppTenantContext();
    requireCapability(context, "dietitian_ai_chat");
    await assertRateLimit({
      key: `${context.tenantId}:ai-chat:${context.userId}:${kind}`,
      tenantId: context.tenantId,
      scope: "dietitian_ai_chat",
      limit: kind === "mutation" ? AI_CHAT_MUTATION_RATE_LIMIT : AI_CHAT_READ_RATE_LIMIT,
      windowMs: 60_000,
    });
    const store = resolveAiChatStore();
    return await handler(context, store);
  } catch (error) {
    return aiChatErrorResponse(error, requestId);
  }
}

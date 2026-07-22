import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AiChatPageClient } from "@/components/ai-chat/ai-chat-page-client";
import { DashboardGatedState } from "@/components/auth-states";
import { PwaSubscriberShell } from "@/components/pwa-subscriber-shell";
import { resolveMobileInstallAccess } from "@/lib/commercial-install-access";
import { deriveDashboardAccessGate, type DashboardAccessGate } from "@/lib/phase-83e3-app-shell";
import { resolveDashboardAuth } from "@/lib/dashboard-server-auth";
import { isAiChatUiEnabled } from "@/lib/phase-85-stage-4b-dashboard-routing";
import { normalizeLanguageCode } from "@/lib/languages";

// Force dynamic rendering so the `AI_CHAT_UI_ENABLED` runtime env var (and
// auth cookies) are re-evaluated on every request instead of being baked
// into a static build artifact.
export const dynamic = "force-dynamic";

export default async function AiChatConversationPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  if (!isAiChatUiEnabled()) {
    notFound();
  }

  const { chatId } = await params;
  const auth = await resolveDashboardAuth();

  if (auth.gate === "fallback") {
    return (
      <PwaSubscriberShell registerServiceWorker={false}>
        <Suspense fallback={null}>
          <AiChatPageClient activeChatId={chatId} uiLanguage={normalizeLanguageCode(undefined)} canAccessAiChat />
        </Suspense>
      </PwaSubscriberShell>
    );
  }

  const gate: DashboardAccessGate = deriveDashboardAccessGate({
    hasTenantMembership: auth.hasTenantMembership,
    hasDietitianProfile: auth.hasDietitianProfile,
    entitlementStatus: auth.entitlementStatus,
  });

  if (gate !== "ok") {
    return <DashboardGatedState gate={gate} />;
  }

  const installAccess = await resolveMobileInstallAccess();

  return (
    <PwaSubscriberShell registerServiceWorker={installAccess.gate === "granted"}>
      <Suspense fallback={null}>
        <AiChatPageClient
          activeChatId={chatId}
          uiLanguage={auth.uiLanguage}
          canAccessAiChat={auth.role !== "assistant" && auth.role !== "auditor"}
        />
      </Suspense>
    </PwaSubscriberShell>
  );
}

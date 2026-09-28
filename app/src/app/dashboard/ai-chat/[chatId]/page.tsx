import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AiChatPageClient } from "@/components/ai-chat/ai-chat-page-client";
import { DashboardGatedState } from "@/components/auth-states";
import { DashboardRscAuthDiagnosticMarker } from "@/components/dashboard/authenticated-shell-boundary";
import { deriveDashboardAccessGate, type DashboardAccessGate } from "@/lib/phase-83e3-app-shell";
import { resolveDashboardAuth } from "@/lib/dashboard-server-auth";
import { isAiChatUiEnabled } from "@/lib/phase-85-stage-4b-dashboard-routing";
import { normalizeLanguageCode } from "@/lib/languages";

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
      <>
        <DashboardRscAuthDiagnosticMarker
          scope="page"
          timing={undefined}
        />
        <Suspense fallback={null}>
          <AiChatPageClient activeChatId={chatId} uiLanguage={normalizeLanguageCode(undefined)} canAccessAiChat />
        </Suspense>
      </>
    );
  }

  const gate: DashboardAccessGate = deriveDashboardAccessGate({
    hasTenantMembership: auth.hasTenantMembership,
    hasDietitianProfile: auth.hasDietitianProfile,
    entitlementStatus: auth.entitlementStatus,
  });

  if (gate !== "ok") {
    return (
      <>
        <DashboardRscAuthDiagnosticMarker
          scope="page"
          timing={auth.gate === "resolved" ? auth.authTiming : undefined}
        />
        <DashboardGatedState gate={gate} />
      </>
    );
  }

  return (
    <>
      <DashboardRscAuthDiagnosticMarker
        scope="page"
        timing={auth.gate === "resolved" ? auth.authTiming : undefined}
      />
      <Suspense fallback={null}>
        <AiChatPageClient
          activeChatId={chatId}
          uiLanguage={auth.uiLanguage}
          canAccessAiChat={auth.role !== "assistant" && auth.role !== "auditor"}
        />
      </Suspense>
    </>
  );
}

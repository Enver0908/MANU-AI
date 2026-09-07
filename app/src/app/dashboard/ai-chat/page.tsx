import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AiChatPageClient } from "@/components/ai-chat/ai-chat-page-client";
import { DashboardGatedState } from "@/components/auth-states";
import { deriveDashboardAccessGate, type DashboardAccessGate } from "@/lib/phase-83e3-app-shell";
import { resolveDashboardAuth } from "@/lib/dashboard-server-auth";
import { isAiChatUiEnabled } from "@/lib/phase-85-stage-4b-dashboard-routing";
import { normalizeLanguageCode } from "@/lib/languages";

export const dynamic = "force-dynamic";

export default async function AiChatRootPage() {
  if (!isAiChatUiEnabled()) {
    notFound();
  }

  const auth = await resolveDashboardAuth();

  if (auth.gate === "fallback") {
    return (
      <Suspense fallback={null}>
        <AiChatPageClient activeChatId={null} uiLanguage={normalizeLanguageCode(undefined)} canAccessAiChat />
      </Suspense>
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

  return (
    <Suspense fallback={null}>
      <AiChatPageClient
        activeChatId={null}
        uiLanguage={auth.uiLanguage}
        canAccessAiChat={auth.role !== "assistant" && auth.role !== "auditor"}
      />
    </Suspense>
  );
}

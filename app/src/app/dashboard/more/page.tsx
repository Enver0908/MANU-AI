import { Suspense } from "react";
import { DashboardGatedState } from "@/components/auth-states";
import { MorePageClient } from "@/components/dashboard/more-page-client";
import {
  deriveDashboardAccessGate,
  type DashboardAccessGate,
} from "@/lib/phase-83e3-app-shell";
import { resolveDashboardAuth } from "@/lib/dashboard-server-auth";
import { isAiChatUiEnabled } from "@/lib/phase-85-stage-4b-dashboard-routing";
import { normalizeLanguageCode } from "@/lib/languages";
import type { TenantRole } from "@/lib/types";

export const dynamic = "force-dynamic";

function asTenantRole(role: string | undefined): TenantRole {
  if (
    role === "owner" ||
    role === "admin" ||
    role === "dietitian" ||
    role === "assistant" ||
    role === "auditor"
  ) {
    return role;
  }
  return "dietitian";
}

/**
 * Stage 5 Faz 5: role-aware More route under the canonical shell.
 */
export default async function MorePage() {
  const auth = await resolveDashboardAuth();
  const aiChatEnabled = isAiChatUiEnabled();

  if (auth.gate === "fallback") {
    return (
      <Suspense fallback={null}>
        <MorePageClient
          uiLanguage={normalizeLanguageCode(undefined)}
          aiChatEnabled={aiChatEnabled}
          role="dietitian"
        />
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
      <MorePageClient
        uiLanguage={auth.uiLanguage}
        aiChatEnabled={aiChatEnabled}
        role={asTenantRole(auth.role)}
      />
    </Suspense>
  );
}

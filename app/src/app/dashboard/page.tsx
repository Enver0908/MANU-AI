import { Suspense } from "react";
import { DashboardApp } from "@/components/dashboard-app";
import { DashboardGatedState } from "@/components/auth-states";
import { resolveMobileInstallAccess } from "@/lib/commercial-install-access";
import {
  deriveDashboardAccessGate,
  type DashboardAccessGate,
} from "@/lib/phase-83e3-app-shell";
import { resolveDashboardAuth } from "@/lib/dashboard-server-auth";
import { isAiChatUiEnabled } from "@/lib/phase-85-stage-4b-dashboard-routing";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";

export default async function DashboardPage() {
  const auth = await resolveDashboardAuth();
  const aiChatEnabled = isAiChatUiEnabled();

  if (auth.gate === "fallback" || !isSupabaseStoreConfigured()) {
    return (
      <Suspense fallback={null}>
        <DashboardApp aiChatEnabled={aiChatEnabled} />
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

  const installAccess = await resolveMobileInstallAccess();

  return (
    <Suspense fallback={null}>
      <DashboardApp
        authInfo={{ displayName: auth.displayName, role: auth.role }}
        commercialInfo={{
          subscriptionStatus: auth.entitlementStatus,
          installReady: installAccess.gate === "granted",
        }}
        aiChatEnabled={aiChatEnabled}
      />
    </Suspense>
  );
}

import type { ReactNode } from "react";
import { AuthenticatedShellBoundary } from "@/components/dashboard/authenticated-shell-boundary";
import { resolveMobileInstallAccess } from "@/lib/commercial-install-access";
import { resolveDashboardAuth } from "@/lib/dashboard-server-auth";
import { isAiChatUiEnabled } from "@/lib/phase-85-stage-4b-dashboard-routing";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";

/**
 * Shared authenticated shell layout for all `/dashboard/*` routes.
 * Visual chrome and bootstrap provider live here; each page retains its own
 * server-side auth/entitlement gate and clinical authorization.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const auth = await resolveDashboardAuth();
  const fallbackMode = auth.gate === "fallback" || !isSupabaseStoreConfigured();

  let registerServiceWorker = false;
  if (!fallbackMode && auth.gate === "resolved") {
    const installAccess = await resolveMobileInstallAccess();
    registerServiceWorker = installAccess.gate === "granted";
  }

  return (
    <AuthenticatedShellBoundary
      registerServiceWorker={registerServiceWorker}
      mode={fallbackMode ? "fallback" : "live"}
      fallbackDisplayName={auth.gate === "resolved" ? auth.displayName : undefined}
      fallbackUiLanguage={auth.gate === "resolved" ? auth.uiLanguage : undefined}
      fallbackAiChatEnabled={fallbackMode && isAiChatUiEnabled()}
    >
      {children}
    </AuthenticatedShellBoundary>
  );
}

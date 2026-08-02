import { Suspense } from "react";
import { DashboardGatedState } from "@/components/auth-states";
import { SettingsPageClient } from "@/components/settings/settings-page-client";
import { isAiChatUiEnabled } from "@/lib/phase-85-stage-4b-dashboard-routing";
import { resolveSettingsTab } from "@/lib/phase-85-stage-4d-settings-contracts";
import { resolveSettingsAccountReadModel } from "@/lib/settings-server-read";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const activeTab = resolveSettingsTab(rawTab);
  const aiChatEnabled = isAiChatUiEnabled();
  const read = await resolveSettingsAccountReadModel();

  if (read.kind === "gate") {
    return <DashboardGatedState gate={read.gate} />;
  }

  return (
    <Suspense fallback={null}>
      <SettingsPageClient model={read.model} activeTab={activeTab} aiChatEnabled={aiChatEnabled} />
    </Suspense>
  );
}

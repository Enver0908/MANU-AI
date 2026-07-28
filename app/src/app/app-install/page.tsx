import { redirect } from "next/navigation";
import { CommercialInstallBlockedState } from "@/components/commercial-install-blocked-state";
import { resolveMobileInstallAccess } from "@/lib/commercial-install-access";

export default async function AppInstallPage() {
  const access = await resolveMobileInstallAccess();

  if (access.gate === "granted") {
    redirect("/dashboard/settings?tab=application");
  }

  if (access.gate === "unauthenticated") {
    redirect("/");
  }

  if (access.gate === "fallback_demo") {
    return (
      <CommercialInstallBlockedState
        title="Mobil kurulum kapalı"
        description="Mobil uygulama kurulumu yalnızca aktif abonelikli Supabase hesapları için kullanılabilir."
      />
    );
  }

  return (
    <CommercialInstallBlockedState
      title="Mobil kurulum için erişim yok"
      description="SiriusAI mobil uygulamasını yalnızca aktif aboneler kurabilir."
      blockingReasons={access.blockingReasons}
    />
  );
}

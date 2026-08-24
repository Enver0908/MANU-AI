import { redirect } from "next/navigation";
import { CheckCircle, Download, Settings } from "lucide-react";
import { CommercialShell } from "@/components/public/CommercialShell";
import { CommercialInstallBlockedState } from "@/components/commercial-install-blocked-state";
import { resolveMobileInstallAccess } from "@/lib/commercial-install-access";
import { readStage7ScenarioState } from "@/lib/stage-7-request";

export default async function AppInstallPage() {
  const stage7State = await readStage7ScenarioState();
  if (stage7State?.startsWith("install-")) {
    if (stage7State === "install-eligible") {
      return (
        <CommercialShell>
          <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
            <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <Download size={22} aria-hidden />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-foreground">Mobil uygulamayı yükleyin</h1>
                  <p className="free-text mt-1 text-sm leading-relaxed text-muted-foreground">
                    PWA kurulumu için tarayıcı menüsünden ana ekrana ekle seçeneğini kullanın.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                <Download size={16} aria-hidden />
                Kurulum adımlarını göster
              </button>
            </div>
          </div>
        </CommercialShell>
      );
    }

    if (stage7State === "install-installed") {
      return (
        <CommercialShell>
          <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
            <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-sage/15 p-2 text-sage">
                  <CheckCircle size={22} aria-hidden />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-foreground">Mobil uygulama kurulu</h1>
                  <p className="free-text mt-1 text-sm leading-relaxed text-muted-foreground">
                    Ayarlar sayfasından PWA ve bildirim tercihlerinizi yönetebilirsiniz.
                  </p>
                </div>
              </div>
              <a
                href="/dashboard/settings?tab=application"
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-foreground"
              >
                <Settings size={16} aria-hidden />
                Ayarlara git
              </a>
            </div>
          </div>
        </CommercialShell>
      );
    }

    return (
      <CommercialInstallBlockedState
        title="Mobil kurulum için erişim engellendi"
        description="Mobil PWA kurulumu aktif abonelik, oturum ve çalışma alanı erişimi gerektirir."
      />
    );
  }

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

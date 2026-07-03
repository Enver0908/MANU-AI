import Link from "next/link";
import { redirect } from "next/navigation";
import { AppInstallCenter } from "@/components/app-install-center";
import { CommercialInstallBlockedState } from "@/components/commercial-install-blocked-state";
import { PwaSubscriberShell } from "@/components/pwa-subscriber-shell";
import { resolveMobileInstallAccess } from "@/lib/commercial-install-access";

export default async function AppInstallPage() {
  const access = await resolveMobileInstallAccess();

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

  if (access.gate === "blocked") {
    return (
      <CommercialInstallBlockedState
        title="Mobil kurulum için erişim yok"
        description="MANU-AI mobil uygulamasını yalnızca aktif aboneler kurabilir."
        blockingReasons={access.blockingReasons}
      />
    );
  }

  return (
    <PwaSubscriberShell registerServiceWorker>
      <main className="min-h-screen bg-[#f7f5ef] px-4 py-6 text-stone-950 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">MANU-AI</p>
              <h1 className="mt-2 text-3xl font-semibold">Mobil uygulama kurulumu</h1>
              <p className="mt-2 text-sm text-stone-600">
                Hoş geldiniz, {access.displayName}. Bu kurulum güvenli PWA olarak çalışır.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-800"
            >
              Dashboard
            </Link>
          </div>
          <AppInstallCenter displayName={access.displayName} />
        </div>
      </main>
    </PwaSubscriberShell>
  );
}

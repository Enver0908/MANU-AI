import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, Bell, Download, Lock, WifiOff } from "lucide-react";
import { AppInstallCenter } from "@/components/app-install-center";
import { CommercialInstallBlockedState } from "@/components/commercial-install-blocked-state";
import { CommercialShell } from "@/components/public/CommercialShell";
import { PwaSubscriberShell } from "@/components/pwa-subscriber-shell";
import { resolveMobileInstallAccess } from "@/lib/commercial-install-access";

const FEATURES = [
  {
    icon: Bell,
    title: "Anlık bildirimler",
    desc: "Danışan mesajları için push bildirimi desteği.",
  },
  {
    icon: Lock,
    title: "Güvenli oturum",
    desc: "Her erişimde auth doğrulaması; cihazda PHI cache yok.",
  },
  {
    icon: WifiOff,
    title: "Subscriber-only",
    desc: "Yalnızca aktif abonelik sahipleri PWA kurabilir.",
  },
] as const;

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
        description="SiriusAI mobil uygulamasını yalnızca aktif aboneler kurabilir."
        blockingReasons={access.blockingReasons}
      />
    );
  }

  return (
    <PwaSubscriberShell registerServiceWorker>
      <CommercialShell>
        <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
          <div className="w-full max-w-lg">
            <div className="mb-8 text-center">
              <p className="mb-2 text-xs font-semibold uppercase text-primary">Mobil Kurulum</p>
              <h1 className="mb-2 font-display text-2xl font-bold text-off-black">SiriusAI PWA kurulumu</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Hoş geldiniz, {access.displayName}. Bu kurulum yalnızca aktif abonelik sahibi hesaplar için mümkündür.
              </p>
            </div>

            <div className="mb-6 flex flex-col gap-5 rounded-lg border border-border bg-surface p-6">
              <p className="text-sm font-semibold text-foreground">PWA avantajları</p>
              <ul className="flex flex-col gap-4">
                {FEATURES.map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Icon size={15} className="text-primary" />
                    </div>
                    <div>
                      <p className="mb-0.5 text-sm font-semibold text-foreground">{title}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <AppInstallCenter displayName={access.displayName} />

            <div className="mt-6 rounded-md border-l-4 border-l-sage bg-muted/40 px-4 py-3">
              <div className="flex items-start gap-2">
                <Download size={15} className="mt-0.5 shrink-0 text-sage" />
                <div>
                  <p className="mb-0.5 text-xs font-semibold text-foreground">Abonelik gereksinimi</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    PWA kurulumu dashboard erişiminiz onaylandıktan sonra etkinleşir.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-destructive" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Bu kurulum sadece davetli ve onaylı hesaplar içindir. Dashboard&apos;a erişiminiz yoksa PWA kurulumu
                  yapılamaz.
                </p>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link href="/dashboard" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Dashboard&apos;a dön
              </Link>
            </div>
          </div>
        </div>
      </CommercialShell>
    </PwaSubscriberShell>
  );
}

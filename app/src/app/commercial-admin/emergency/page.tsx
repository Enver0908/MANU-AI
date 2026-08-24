import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { CommercialAdminConsole } from "@/components/commercial-admin-console";
import { isCommercialAdminConfigured } from "@/lib/commercial-admin-request";
import { PUBLIC_MARKETING_COPY } from "@/lib/phase-84b-public-website";
import { readStage7ScenarioState } from "@/lib/stage-7-request";

export const metadata: Metadata = {
  title: `Acil yönetim | ${PUBLIC_MARKETING_COPY.brand}`,
  description: "Token tabanlı acil durum ticari yönetim girişi.",
  robots: { index: false, follow: false },
};

export default async function CommercialAdminEmergencyPage() {
  const stage7State = await readStage7ScenarioState();
  if (stage7State === "emergency-invalid-token" || stage7State === "emergency-secure-failure") {
    return (
      <main className="min-h-screen bg-paper px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
            <div>
              <h1 className="font-display text-2xl font-bold text-off-black">Acil yönetim girişi başarısız</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Token doğrulanamadı veya güvenli bağlantı failed. Production pilot hâlâ NO-GO.
              </p>
              <a
                href="/admin"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-foreground"
              >
                Yönetim girişine dön
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto mb-6 max-w-6xl rounded-md border border-line bg-surface-muted px-4 py-3 text-sm text-ink-muted">
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            Bu acil durum token panelidir. Normal operasyonlar için{" "}
            <Link href="/admin" className="font-medium underline underline-offset-2">
              /admin
            </Link>{" "}
            üzerinden Supabase oturumu ile giriş yapın.
          </p>
        </div>
      </div>
      <CommercialAdminConsole
        variant="token"
        initiallyConfigured={isCommercialAdminConfigured()}
      />
    </main>
  );
}

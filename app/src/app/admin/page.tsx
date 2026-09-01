import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AdminLoginForm } from "@/components/admin-login-form";
import { CommercialAdminConsole } from "@/components/commercial-admin-console";
import { CommercialShell } from "@/components/public/CommercialShell";
import { resolveAdminSessionEmail } from "@/lib/commercial-admin-access";
import { AIYA_BRAND_NAME } from "@/lib/brand";
import { PUBLIC_MARKETING_COPY } from "@/lib/phase-84b-public-website";
import { isSupabaseConfigured } from "@/lib/supabase";
import { readStage7ScenarioState } from "@/lib/stage-7-request";

export const metadata: Metadata = {
  title: `Yönetim | ${PUBLIC_MARKETING_COPY.brand}`,
  description: "Ticari operasyon paneli: lead, davet, abonelik ve billing ledger.",
};

type AdminPageProps = {
  searchParams: Promise<{ error?: string }>;
};

function describeAdminError(error?: string) {
  switch (error) {
    case "auth_not_configured":
      return "Kimlik doğrulama yapılandırılmamış. Supabase ortamını kontrol edin.";
    case "auth_callback_failed":
      return "Giriş bağlantısı doğrulanamadı. Yeni bir bağlantı isteyin.";
    case "admin_access_denied":
      return "Bu oturum yönetim allowlist'inde değil.";
    default:
      return null;
  }
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const stage7State = await readStage7ScenarioState();

  if (stage7State?.startsWith("admin-") && stage7State !== "admin-login") {
    return <Stage7AdminState state={stage7State} />;
  }

  const initialError = describeAdminError(params.error);
  const sessionEmail = isSupabaseConfigured() ? await resolveAdminSessionEmail() : null;

  if (sessionEmail) {
    return (
      <main className="min-h-screen bg-paper px-4 py-8 sm:px-6 lg:px-8">
        <CommercialAdminConsole variant="session" sessionEmail={sessionEmail} initiallyConfigured />
      </main>
    );
  }

  return (
    <CommercialShell>
      <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-semibold uppercase text-primary">Yönetim</p>
            <h1 className="mb-2 font-display text-2xl font-bold text-off-black">{AIYA_BRAND_NAME} yönetim girişi</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Bu yüzey yalnızca allowlist&apos;teki operasyon/admin e-postaları için açılır.
            </p>
          </div>

          {initialError ? (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-destructive" />
              <p className="text-xs leading-relaxed text-destructive">{initialError}</p>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-surface p-6">
            <AdminLoginForm initialError={null} />
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Acil durum token girişi yalnızca{" "}
            <Link href="/commercial-admin/emergency" className="text-primary underline underline-offset-2">
              /commercial-admin/emergency
            </Link>{" "}
            üzerinden kullanılmalıdır.
          </p>
        </div>
      </div>
    </CommercialShell>
  );
}

function Stage7AdminState({ state }: { state: string }) {
  if (state === "admin-dense") {
    const rows = Array.from({ length: 8 }, (_, index) => ({
      id: `stage7-row-${index + 1}`,
      lead: `Klinik ${index + 1}`,
      status: index % 2 === 0 ? "active" : "pending",
      owner: `stage7-${index + 1}@example.com`,
    }));
    return (
      <CommercialShell>
        <div className="flex flex-1 justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-5xl">
            <div className="mb-6">
              <p className="mb-2 text-xs font-semibold uppercase text-primary">Yönetim</p>
              <h1 className="font-display text-2xl font-bold text-off-black">Ticari yönetim</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Sentetik Stage 7 operasyon listesi; canlı billing veya production işlemi içermez.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Sahip</th>
                    <th className="px-4 py-3">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{row.lead}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.status}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.owner}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold"
                        >
                          İncele
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CommercialShell>
    );
  }

  if (state === "admin-empty") {
    return (
      <CommercialShell>
        <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center">
            <h1 className="font-display text-2xl font-bold text-off-black">Ticari yönetim</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Henüz lead, davet veya abonelik kaydı yok. Yeni kayıt oluştuğunda burada listelenecek.
            </p>
          </div>
        </div>
      </CommercialShell>
    );
  }

  return (
    <CommercialShell>
      <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
            <div>
              <h1 className="font-display text-2xl font-bold text-off-black">Yönetim erişimi reddedildi</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Bu işlem başarısız oldu veya admin yetkisi doğrulanamadı. Erişim denied; lütfen yetkiyi kontrol edin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </CommercialShell>
  );
}

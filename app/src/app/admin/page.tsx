import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AdminLoginForm } from "@/components/admin-login-form";
import { CommercialAdminConsole } from "@/components/commercial-admin-console";
import { CommercialShell } from "@/components/public/CommercialShell";
import { resolveAdminSessionEmail } from "@/lib/commercial-admin-access";
import { PUBLIC_MARKETING_COPY } from "@/lib/phase-84b-public-website";
import { isSupabaseConfigured } from "@/lib/supabase";

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
            <h1 className="mb-2 font-display text-2xl font-bold text-off-black">SiriusAI yönetim girişi</h1>
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
            <Link href="/commercial-admin/emergency" className="text-primary underline-offset-2 hover:underline">
              /commercial-admin/emergency
            </Link>{" "}
            üzerinden kullanılmalıdır.
          </p>
        </div>
      </div>
    </CommercialShell>
  );
}

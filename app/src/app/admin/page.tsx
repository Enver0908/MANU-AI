import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminLoginForm } from "@/components/admin-login-form";
import { CommercialAdminConsole } from "@/components/commercial-admin-console";
import { buttonClasses, Card, CardBody, CardHeader } from "@/components/ui";
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
      <main className="min-h-screen bg-stone-50 px-4 py-8 sm:px-6 lg:px-8">
        <CommercialAdminConsole
          variant="session"
          sessionEmail={sessionEmail}
          initiallyConfigured
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-muted px-safe py-10 text-ink">
      <div className="mx-auto max-w-lg">
        <Link href="/" className={`${buttonClasses("ghost", "sm")} mb-6 inline-flex`}>
          <ArrowLeft size={16} />
          Ana sayfa
        </Link>
        <Card>
          <CardHeader title="Yönetim paneli girişi" />
          <CardBody>
            <AdminLoginForm initialError={initialError} />
          </CardBody>
        </Card>
        <p className="mt-4 text-center text-xs text-ink-subtle">
          Acil durum token girişi yalnızca{" "}
          <Link href="/commercial-admin/emergency" className="underline-offset-2 hover:underline">
            /commercial-admin/emergency
          </Link>{" "}
          üzerinden kullanılmalıdır.
        </p>
      </div>
    </main>
  );
}

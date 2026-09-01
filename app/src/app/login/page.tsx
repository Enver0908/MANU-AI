import type { Metadata } from "next";
import { CommercialShell } from "@/components/public/CommercialShell";
import { CustomerLoginForm } from "@/components/customer-login-form";
import { AIYA_BRAND_NAME } from "@/lib/brand";
import { PUBLIC_MARKETING_COPY } from "@/lib/phase-84b-public-website";

export const metadata: Metadata = {
  title: `Giriş | ${PUBLIC_MARKETING_COPY.brand}`,
  description: PUBLIC_MARKETING_COPY.loginBody,
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

function describeLoginError(error?: string) {
  switch (error) {
    case "auth_not_configured":
      return "Kimlik doğrulama şu an yapılandırılmamış. Lütfen e-posta ile iletişime geçin.";
    case "auth_callback_failed":
      return "Giriş bağlantısı doğrulanamadı. Yeni bir bağlantı isteyin.";
    default:
      return null;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const initialError = describeLoginError(params.error);
  const nextPath = params.next?.trim() || null;

  return (
    <CommercialShell>
      <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-semibold uppercase text-primary">Müşteri girişi</p>
            <h1 className="mb-2 font-display text-2xl font-bold text-off-black">{AIYA_BRAND_NAME} müşteri girişi</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Varsayılan giriş e-posta bağlantısıdır; parola ile giriş ikincil seçenektir.
            </p>
          </div>

          <CustomerLoginForm initialError={initialError} nextPath={nextPath} />

          <div className="mt-6 rounded-md border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Bu giriş yalnızca kayıtlı ve onaylı {AIYA_BRAND_NAME} müşterilerine yöneliktir. Erişiminiz yoksa iletişim formu
              ile talep bırakın.
            </p>
          </div>
        </div>
      </div>
    </CommercialShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonClasses, Card, CardBody, CardHeader } from "@/components/ui";
import { CustomerLoginForm } from "@/components/customer-login-form";
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
    <main className="min-h-screen bg-surface-muted px-safe py-10 text-ink">
      <div className="mx-auto max-w-lg">
        <Link href="/" className={`${buttonClasses("ghost", "sm")} mb-6 inline-flex`}>
          <ArrowLeft size={16} />
          Ana sayfa
        </Link>
        <Card>
          <CardHeader title={PUBLIC_MARKETING_COPY.loginTitle} />
          <CardBody className="space-y-4">
            <p className="text-sm leading-6 text-ink-muted">{PUBLIC_MARKETING_COPY.loginBody}</p>
            <CustomerLoginForm initialError={initialError} nextPath={nextPath} />
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

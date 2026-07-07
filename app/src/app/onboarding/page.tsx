import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AlertCircle, Mail } from "lucide-react";
import { CommercialShell } from "@/components/public/CommercialShell";
import { OnboardingClaimPanel } from "@/components/onboarding-claim-panel";
import { resolveCustomerSessionFacts } from "@/lib/customer-auth-session";
import {
  PUBLIC_MARKETING_COPY,
  SIRIUSAI_PUBLIC_CONTACT_EMAIL,
  buildContactMailtoUrl,
} from "@/lib/phase-84b-public-website";
import { deriveCustomerAuthRedirect } from "@/lib/phase-84d-customer-auth";
import { loadClaimableCheckoutSessionForEmail } from "@/lib/commercial-onboarding-store";
import { createSupabaseServerClient, getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";

export const metadata: Metadata = {
  title: `Onboarding | ${PUBLIC_MARKETING_COPY.brand}`,
  description: PUBLIC_MARKETING_COPY.onboardingBody,
};

type OnboardingPageProps = {
  searchParams: Promise<{ state?: string; session_id?: string }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;

  if (!isSupabaseConfigured()) {
    redirect("/login?error=auth_not_configured");
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  });

  if (!supabase) {
    redirect("/login?error=auth_not_configured");
  }

  const facts = await resolveCustomerSessionFacts(supabase);
  if (!facts.isAuthenticated) {
    const loginUrl = params.session_id
      ? `/login?next=${encodeURIComponent(`/onboarding?session_id=${params.session_id}`)}`
      : "/login";
    redirect(loginUrl);
  }

  const redirectTarget = deriveCustomerAuthRedirect(facts);
  if (redirectTarget === "/dashboard") {
    redirect("/dashboard");
  }

  const supportView = params.state === "support" || redirectTarget.endsWith("state=support");
  let sessionId = params.session_id ?? null;
  if (!sessionId && facts.normalizedEmail) {
    const admin = getSupabaseAdminClient();
    if (admin) {
      sessionId = (await loadClaimableCheckoutSessionForEmail(admin, facts.normalizedEmail)) ?? null;
    }
  }

  return (
    <CommercialShell>
      <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold uppercase text-primary">Onboarding</p>
            <h1 className="mb-2 font-display text-2xl font-bold text-off-black">
              {supportView ? "Erişim desteği gerekli" : "Çalışma alanını bağlayın"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {supportView
                ? "Oturumunuz açık ancak bağlanacak aktif bir çalışma alanı bulunamadı."
                : "Ödemeniz doğrulandıysa çalışma alanınızı bu hesaba bağlayabilirsiniz."}
            </p>
          </div>

          <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-6">
            {!supportView ? (
              <OnboardingClaimPanel sessionId={sessionId} />
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Hesabınız oturum açmış durumda ancak bağlanacak aktif bir çalışma alanı bulunamadı.
                </p>
              </div>
            )}

            <a
              href={buildContactMailtoUrl("SiriusAI onboarding desteği")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-muted/40 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Mail size={16} />
              Destek al
            </a>
            <p className="text-xs text-muted-foreground">{SIRIUSAI_PUBLIC_CONTACT_EMAIL}</p>
            <form action="/api/demo-logout" method="post">
              <button
                type="submit"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Oturumu kapat
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Giriş sayfasına dönmek için{" "}
            <Link href="/login" className="text-primary hover:underline">
              müşteri girişi
            </Link>
            .
          </p>
        </div>
      </div>
    </CommercialShell>
  );
}

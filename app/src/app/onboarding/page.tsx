import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowLeft, Mail, ShieldAlert } from "lucide-react";
import { buttonClasses, Card, CardBody, CardHeader } from "@/components/ui";
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
    <main className="min-h-screen bg-surface-muted px-safe py-10 text-ink">
      <div className="mx-auto max-w-lg">
        <Link href="/" className={`${buttonClasses("ghost", "sm")} mb-6 inline-flex`}>
          <ArrowLeft size={16} />
          Ana sayfa
        </Link>
        <Card>
          <CardHeader
            title={supportView ? PUBLIC_MARKETING_COPY.onboardingSupportTitle : PUBLIC_MARKETING_COPY.onboardingTitle}
          />
          <CardBody className="space-y-4">
            <p className="text-sm leading-6 text-ink-muted">
              {supportView ? PUBLIC_MARKETING_COPY.onboardingSupportBody : PUBLIC_MARKETING_COPY.onboardingBody}
            </p>
            {!supportView ? (
              <OnboardingClaimPanel sessionId={sessionId} />
            ) : (
              <div className="flex items-start gap-3 rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
                <p>Hesabınız oturum açmış durumda ancak bağlanacak aktif bir çalışma alanı bulunamadı.</p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <a href={buildContactMailtoUrl("SiriusAI onboarding desteği")} className={buttonClasses("primary", "md")}>
                <Mail size={16} />
                {PUBLIC_MARKETING_COPY.contactCta}
              </a>
              <p className="text-xs text-ink-subtle">{SIRIUSAI_PUBLIC_CONTACT_EMAIL}</p>
              <form action="/api/demo-logout" method="post">
                <button type="submit" className={`${buttonClasses("secondary", "md")} w-full`}>
                  Oturumu kapat
                </button>
              </form>
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

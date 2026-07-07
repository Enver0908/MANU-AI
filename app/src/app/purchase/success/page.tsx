import Link from "next/link";
import { ArrowRight, CheckCircle, MailCheck } from "lucide-react";
import { CommercialShell } from "@/components/public/CommercialShell";
import { PurchaseSuccessOnboarding } from "@/components/purchase-success-onboarding";

export const metadata = {
  title: "Ödeme doğrulandı · SiriusAI",
};

type PurchaseSuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

const STEPS = [
  {
    icon: MailCheck,
    title: "Magic-link e-postanızı açın",
    desc: "Kayıtlı e-posta adresinize hesap bağlama bağlantısı gönderilecek.",
  },
  {
    icon: CheckCircle,
    title: "Çalışma alanını claim edin",
    desc: "Bağlantıya tıklayarak onboarding adımını tamamlayın.",
  },
  {
    icon: ArrowRight,
    title: "Dashboard erişimi açılır",
    desc: "Claim tamamlandıktan sonra klinik çalışma alanınız hazır olacak.",
  },
] as const;

export default async function PurchaseSuccessPage({ searchParams }: PurchaseSuccessPageProps) {
  const params = await searchParams;
  const sessionId = params.session_id ?? null;

  return (
    <CommercialShell>
      <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sage/15">
                <CheckCircle size={32} className="text-sage" />
              </div>
            </div>
            <p className="mb-2 text-xs font-semibold uppercase text-primary">Ödeme tamamlandı</p>
            <h1 className="mb-2 font-display text-2xl font-bold text-off-black">Ödeme doğrulandı</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ödemeniz başarıyla işlendi. Şimdi hesabınızı bağlamanız gerekiyor.
            </p>
          </div>

          <div className="mb-6 flex flex-col gap-5 rounded-lg border border-border bg-surface p-6">
            <p className="text-sm font-semibold text-foreground">Sonraki adımlar</p>
            <ol className="flex flex-col gap-4">
              {STEPS.map(({ icon: Icon, title, desc }) => (
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
            </ol>
          </div>

          <PurchaseSuccessOnboarding sessionId={sessionId} />

          <div className="mt-6 rounded-md border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Zaten giriş yaptıysanız{" "}
              <Link
                href={sessionId ? `/onboarding?session_id=${encodeURIComponent(sessionId)}` : "/onboarding"}
                className="text-primary hover:underline"
              >
                onboarding ekranına geçin
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </CommercialShell>
  );
}

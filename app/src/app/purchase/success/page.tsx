import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { PurchaseSuccessOnboarding } from "@/components/purchase-success-onboarding";
import { PURCHASE_COPY } from "@/lib/phase-83e2-purchase-ux";

export const metadata = {
  title: "Ödeme alındı · SiriusAI",
};

type PurchaseSuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function PurchaseSuccessPage({ searchParams }: PurchaseSuccessPageProps) {
  const params = await searchParams;
  const sessionId = params.session_id ?? null;

  return (
    <main className="min-h-screen bg-surface-muted px-safe py-8 text-ink">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
            {PURCHASE_COPY.eyebrow}
          </span>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-ink">
            <CheckCircle2 size={22} className="text-emerald-700" />
            {PURCHASE_COPY.successTitle}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{PURCHASE_COPY.successBody}</p>
        </div>

        <Card>
          <CardHeader title={PURCHASE_COPY.successAccountTitle} />
          <CardBody className="space-y-4">
            <PurchaseSuccessOnboarding sessionId={sessionId} />
            <p className="text-xs text-ink-subtle">
              Zaten giriş yaptıysanız{" "}
              <Link
                href={sessionId ? `/onboarding?session_id=${encodeURIComponent(sessionId)}` : "/onboarding"}
                className="font-medium text-emerald-900 underline-offset-2 hover:underline"
              >
                onboarding ekranına geçin
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

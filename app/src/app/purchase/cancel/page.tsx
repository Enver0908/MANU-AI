import Link from "next/link";
import { RotateCcw, XCircle } from "lucide-react";
import { buttonClasses, Card, CardBody, CardHeader } from "@/components/ui";
import { PURCHASE_COPY, PURCHASE_CONTACT_EMAIL } from "@/lib/phase-83e2-purchase-ux";

export const metadata = {
  title: "Ödeme tamamlanmadı · MANU-AI",
};

export default function PurchaseCancelPage() {
  return (
    <main className="min-h-screen bg-surface-muted px-safe py-8 text-ink">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
            {PURCHASE_COPY.eyebrow}
          </span>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-ink">
            <XCircle size={22} className="text-ink-muted" />
            {PURCHASE_COPY.cancelTitle}
          </h1>
        </div>

        <Card>
          <CardHeader title="Ödeme iptal edildi" />
          <CardBody className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              Ödeme tamamlanmadı ve hesabınızdan tahsilat yapılmadı. Dilediğinizde tekrar
              deneyebilirsiniz.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/purchase" className={buttonClasses("primary", "lg")}>
                <RotateCcw size={17} />
                Tekrar dene
              </Link>
              <a href={`mailto:${PURCHASE_CONTACT_EMAIL}`} className={buttonClasses("secondary", "lg")}>
                Yardım al
              </a>
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

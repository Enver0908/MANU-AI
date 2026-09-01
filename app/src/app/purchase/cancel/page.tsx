import Link from "next/link";
import { XCircle } from "lucide-react";
import { CommercialShell } from "@/components/public/CommercialShell";
import { AIYA_BRAND_NAME } from "@/lib/brand";

export const metadata = {
  title: `Ödeme tamamlanmadı · ${AIYA_BRAND_NAME}`,
};

export default function PurchaseCancelPage() {
  return (
    <CommercialShell>
      <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <XCircle size={32} className="text-muted-foreground" />
              </div>
            </div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">İşlem tamamlanmadı</p>
            <h1 className="mb-2 font-display text-2xl font-bold text-off-black">Ödeme tamamlanmadı</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ödeme işlemi iptal edildi veya tamamlanamadı. Davet kodunuz hâlâ geçerliyse istediğiniz zaman tekrar
              deneyebilirsiniz.
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
            <p className="text-sm font-semibold text-foreground">Ne yapmak istersiniz?</p>
            <Link
              href="/purchase"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Tekrar dene
            </Link>
            <Link
              href="/#iletisim"
              className="inline-flex items-center justify-center rounded-md border border-border bg-muted/40 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Destek al
            </Link>
          </div>

          <div className="mt-6 rounded-md border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Ödemenizden ücret alındığını düşünüyorsanız hemen{" "}
              <Link href="/#iletisim" className="text-primary underline underline-offset-2">
                iletişime geçin
              </Link>
              . Sandbox modunda gerçek bir işlem gerçekleşmemiştir.
            </p>
          </div>
        </div>
      </div>
    </CommercialShell>
  );
}

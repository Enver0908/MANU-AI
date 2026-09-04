import type { Metadata } from "next";
import { CommercialShell } from "@/components/public/CommercialShell";
import { PurchaseFlow } from "@/components/purchase-flow";
import { AIYA_BRAND_NAME, buildCustomerSurfaceMetadata } from "@/lib/brand";

export const metadata: Metadata = buildCustomerSurfaceMetadata({
  path: "/purchase",
  title: `Davetli erişim | ${AIYA_BRAND_NAME}`,
  description:
    "Bu sayfa yalnızca ekibin ilettiği davet bilgileriyle erişimi doğrulamak içindir. Self-serve satın alma değildir.",
});

export default function PurchasePage() {
  return (
    <CommercialShell>
      <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-semibold uppercase text-primary">Davetli erişim</p>
            <h1 className="mb-2 font-display text-2xl font-bold text-off-black">Davetli erişimi doğrulayın</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ekibimizin size ilettiği davet kodu ve onaylı e-posta adresinizle erişiminizi doğrulayın.
            </p>
          </div>

          <PurchaseFlow />

          <div className="mt-6 rounded-md border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Bu sayfa self-serve satın alma değildir. Erişim yalnızca ekip değerlendirmesi ve iletilen davet bilgileri
              ile açılır.
            </p>
          </div>
        </div>
      </div>
    </CommercialShell>
  );
}

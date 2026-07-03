import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PurchaseFlow } from "@/components/purchase-flow";
import { PURCHASE_COPY } from "@/lib/phase-83e2-purchase-ux";

export const metadata = {
  title: "Satın al · MANU-AI",
};

export default function PurchasePage() {
  return (
    <main className="min-h-screen bg-surface-muted px-safe py-8 text-ink">
      <div className="mx-auto w-full max-w-xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={16} />
          Ana sayfa
        </Link>
        <div className="mt-4 mb-6">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
            {PURCHASE_COPY.eyebrow}
          </span>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{PURCHASE_COPY.purchaseTitle}</h1>
        </div>
        <PurchaseFlow />
      </div>
    </main>
  );
}

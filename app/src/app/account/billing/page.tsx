import type { Metadata } from "next";
import { SettingsBillingPortalButton } from "@/components/settings/settings-billing-portal-button";
import { CommercialShell } from "@/components/public/CommercialShell";
import { PUBLIC_MARKETING_COPY } from "@/lib/phase-84b-public-website";

export const metadata: Metadata = {
  title: `Faturalandirma | ${PUBLIC_MARKETING_COPY.brand}`,
  description: "Abonelik ve odeme portalina erisim.",
};

export default function AccountBillingPage() {
  return (
    <CommercialShell>
      <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-border bg-surface p-6">
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase text-primary">Hesap</p>
              <h1 className="mb-2 font-display text-2xl font-bold text-off-black">Faturalandirma</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Odeme yonteminizi, faturalarinizi ve abonelik durumunuzu Stripe sandbox portalinda yonetin.
              </p>
            </div>
            <SettingsBillingPortalButton uiLanguage="tr" />
          </div>
        </div>
      </div>
    </CommercialShell>
  );
}

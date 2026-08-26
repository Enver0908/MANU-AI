import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountRecoveryForm } from "@/components/account-recovery-form";
import { CommercialShell } from "@/components/public/CommercialShell";
import { PUBLIC_MARKETING_COPY } from "@/lib/phase-84b-public-website";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerReadOnlyClient } from "@/lib/supabase-server-readonly";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: `Parola kurtarma | ${PUBLIC_MARKETING_COPY.brand}`,
  description: "Yeni parolanızı belirleyin.",
};

export default async function AccountRecoveryPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=auth_not_configured");
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerReadOnlyClient({
    getAll: () => cookieStore.getAll(),
  });

  const {
    data: { user },
  } = await supabase?.auth.getUser() ?? { data: { user: null } };

  if (!user) {
    redirect("/login?error=auth_callback_failed");
  }

  return (
    <CommercialShell>
      <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-semibold uppercase text-primary">Hesap güvenliği</p>
            <h1 className="mb-2 font-display text-2xl font-bold text-off-black">Yeni parola belirle</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Kurtarma bağlantısı doğrulandı. Yeni parolanızı kaydedin.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-6">
            <AccountRecoveryForm />
          </div>
        </div>
      </div>
    </CommercialShell>
  );
}

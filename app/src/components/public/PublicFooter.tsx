import { SIRIUSAI_PUBLIC_CONTACT_EMAIL } from "@/lib/phase-84b-public-website";

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="mb-1 text-sm font-semibold text-off-black">SiriusAI</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Diyetisyen-danışan iletişimi için davetli klinik çalışma alanı.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p className="mb-1 text-xs font-semibold uppercase text-foreground">Durum</p>
            <p className="max-w-xs leading-relaxed">
              Bu platform production pilot aşamasında değildir. Klinik üretim kullanımı ayrı onaylara bağlıdır.
            </p>
            <a
              href={`mailto:${SIRIUSAI_PUBLIC_CONTACT_EMAIL}`}
              className="mt-1 inline-flex min-h-6 items-center text-primary underline underline-offset-2"
            >
              E-posta ile ulaşın
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SiriusAI. Tüm hakları saklıdır.</p>
          <p>
            Production pilot: <span className="font-medium text-destructive">NO-GO</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-paper py-12 md:py-16" aria-labelledby="hero-heading">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" />
            Davetli klinik erişim
          </div>

          <h1 id="hero-heading" className="font-display text-4xl font-bold leading-tight text-off-black sm:text-5xl">
            SiriusAI
          </h1>

          <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
            Diyetisyen-danışan iletişimi için davetli klinik çalışma alanı.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/#iletisim"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              İletişime geç
            </Link>
            <Link
              href="/purchase"
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Davet koduyla başla
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Davet kodunuz yoksa iletişim formu ile erişim talebinde bulunun.
          </p>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  Mail,
  MessageSquare,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
} from "lucide-react";
import { buttonClasses, Card, CardBody, CardHeader } from "@/components/ui";
import { ContactLeadForm } from "@/components/contact-lead-form";
import {
  PUBLIC_MARKETING_COPY,
  PUBLIC_MARKETING_SECTIONS,
  SIRIUSAI_PUBLIC_CONTACT_EMAIL,
  buildContactMailtoUrl,
  isPublicDemoLoginEnabled,
} from "@/lib/phase-84b-public-website";

export function SiriusaiMarketingPage() {
  const demoEnabled = isPublicDemoLoginEnabled();
  const contactMailto = buildContactMailtoUrl();

  return (
    <div className="min-h-screen bg-surface-muted text-ink">
      <a href="#main" className="skip-link" data-testid="skip-link">
        Ana içeriğe geç
      </a>

      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 px-safe backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 py-3">
          <Link href="/" className="text-sm font-semibold tracking-wide text-emerald-900">
            {PUBLIC_MARKETING_COPY.brand}
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Genel">
            <Link href="/login" className={buttonClasses("ghost", "sm")}>
              {PUBLIC_MARKETING_COPY.loginLabel}
            </Link>
            <Link href="/purchase" className={buttonClasses("secondary", "sm")}>
              <ShoppingCart size={15} />
              {PUBLIC_MARKETING_COPY.purchaseLabel}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="border-b border-line px-safe py-12 sm:py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
                {PUBLIC_MARKETING_COPY.tagline}
              </p>
              <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
                {PUBLIC_MARKETING_COPY.heroTitle}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-ink-muted">
                {PUBLIC_MARKETING_COPY.heroSubtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#contact" className={buttonClasses("primary", "lg")}>
                  <Mail size={18} />
                  {PUBLIC_MARKETING_COPY.contactCta}
                </a>
                <Link href="/purchase" className={buttonClasses("secondary", "lg")}>
                  <ShoppingCart size={18} />
                  {PUBLIC_MARKETING_COPY.purchaseLabel}
                </Link>
              </div>
              {demoEnabled ? (
                <p className="mt-4 text-sm text-ink-subtle">
                  Yerel demo için{" "}
                  <Link href="/demo" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
                    demo giriş sayfası
                  </Link>
                  .
                </p>
              ) : null}
            </div>
            <ProductMockPanel />
          </div>
        </section>

        {PUBLIC_MARKETING_SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="border-b border-line px-safe py-12 even:bg-surface"
          >
            <div className="mx-auto max-w-6xl">
              <h2 className="text-2xl font-semibold text-ink">{section.title}</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-ink-muted">{section.body}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex items-start gap-2 rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-muted"
                  >
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-800" aria-hidden />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}

        <section id="contact" className="px-safe py-12 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div>
                <h2 className="text-2xl font-semibold text-ink">{PUBLIC_MARKETING_COPY.contactSectionTitle}</h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">
                  {PUBLIC_MARKETING_COPY.contactSectionBody}
                </p>
                <a href={contactMailto} className={`${buttonClasses("primary", "lg")} mt-6 inline-flex`}>
                  <Mail size={18} />
                  {PUBLIC_MARKETING_COPY.contactCta}
                </a>
              </div>
              <Card>
                <CardHeader title="İletişim formu" />
                <CardBody className="space-y-4">
                  <p className="text-sm leading-6 text-ink-muted">{PUBLIC_MARKETING_COPY.contactFormNote}</p>
                  <ContactLeadForm />
                  <div className="rounded-control border border-line bg-surface-sunken px-4 py-3 text-sm">
                    <p className="font-medium text-ink">E-posta</p>
                    <a
                      href={contactMailto}
                      className="mt-1 inline-flex items-center gap-2 text-emerald-900 underline-offset-2 hover:underline"
                    >
                      {SIRIUSAI_PUBLIC_CONTACT_EMAIL}
                      <ArrowRight size={14} aria-hidden />
                    </a>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-safe py-6 text-xs leading-6 text-ink-subtle">
        <div className="mx-auto max-w-6xl">
          <p>{PUBLIC_MARKETING_COPY.footerNote}</p>
        </div>
      </footer>
    </div>
  );
}

function ProductMockPanel() {
  return (
    <div
      className="rounded-card border border-line bg-surface p-4 shadow-sm"
      aria-hidden
      data-testid="siriusai-product-mock"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <LayoutDashboard size={16} className="text-emerald-800" />
          Örnek panel
        </span>
        <span className="text-xs text-ink-subtle">Temsili arayüz</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[88px_minmax(0,1fr)]">
        <div className="space-y-2">
          {["Özet", "Danışanlar", "Görüşme"].map((label) => (
            <div
              key={label}
              className="rounded-control border border-line bg-surface-sunken px-2 py-2 text-center text-[11px] font-medium text-ink-muted"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="rounded-control border border-line bg-surface-sunken px-3 py-2">
            <p className="text-[11px] font-medium text-ink-muted">Örnek danışan A.</p>
            <p className="mt-1 text-xs text-ink">Bugün öğle yemeğinde ne tercih edebilirim?</p>
          </div>
          <div className="flex items-center gap-2 rounded-control border border-line bg-surface-sunken px-3 py-2">
            <MessageSquare size={14} className="text-emerald-800" />
            <span className="text-xs text-ink-muted">Taslak onayı bekliyor</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <MockRiskChip tone="green" label="Rutin" />
            <MockRiskChip tone="yellow" label="Onay" />
            <span className="inline-flex items-center gap-1 rounded-control border border-line px-2 py-1 text-[11px] text-ink-subtle">
              <Smartphone size={12} />
              PWA
            </span>
            <span className="inline-flex items-center gap-1 rounded-control border border-line px-2 py-1 text-[11px] text-ink-subtle">
              <ShieldCheck size={12} />
              Denetimli
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockRiskChip({ tone, label }: { tone: "green" | "yellow"; label: string }) {
  const classes =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-amber-200 bg-amber-50 text-amber-950";
  return (
    <span className={`inline-flex rounded-control border px-2 py-1 text-[11px] font-medium ${classes}`}>
      {label}
    </span>
  );
}

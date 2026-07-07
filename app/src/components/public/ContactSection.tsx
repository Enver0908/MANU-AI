"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

type FormState = "idle" | "loading" | "success" | "error" | "unavailable";

export function ContactSection() {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setErrorMsg("");

    const form = event.currentTarget;
    const contactName = (form.elements.namedItem("contactName") as HTMLInputElement).value;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const clinicName = (form.elements.namedItem("clinicName") as HTMLInputElement).value;
    const message = (form.elements.namedItem("message") as HTMLTextAreaElement).value;
    const companyWebsite = (form.elements.namedItem("companyWebsite") as HTMLInputElement).value;

    try {
      const response = await fetch("/api/contact/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName,
          email,
          clinicName,
          message,
          sourcePath: `${window.location.pathname}${window.location.hash}`,
          companyWebsite,
        }),
      });

      if (response.status === 503) {
        setState("unavailable");
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as { accepted?: boolean };
      if (!response.ok || !payload.accepted) {
        setErrorMsg("Talep gönderilemedi. Lütfen tekrar deneyin veya e-posta ile ulaşın.");
        setState("error");
        return;
      }

      setState("success");
      form.reset();
    } catch {
      setErrorMsg("Bir hata oluştu. Lütfen tekrar deneyin veya e-posta ile ulaşın.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <section id="iletisim" className="bg-paper py-20" aria-labelledby="contact-heading">
        <div className="mx-auto max-w-lg px-4 text-center sm:px-6">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sage/15">
              <CheckCircle size={28} className="text-sage" />
            </div>
          </div>
          <h2 id="contact-heading" className="mb-3 font-display text-2xl font-bold text-off-black">
            Talebiniz alındı
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            Ekibimiz talebinizi inceleyecek ve en kısa sürede size ulaşacak. Davet kodu oluşturulduğunda e-posta
            adresinize bildirim gönderilecek.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="iletisim" className="bg-paper py-20" aria-labelledby="contact-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-start">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase text-primary">İletişim</p>
            <h2 id="contact-heading" className="mb-4 font-display text-3xl font-bold text-off-black">
              Erişim talebi bırakın
            </h2>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              Henüz davet kodunuz yoksa formu doldurun. Ekibimiz klinik uygunluğunuzu değerlendirip size özel davet
              kodu oluşturacak.
            </p>
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="mb-1 text-sm font-semibold text-foreground">Süreç nasıl işler?</p>
              <ol className="mt-3 flex list-none flex-col gap-2 text-sm text-muted-foreground">
                {["Formu gönderin", "Ekibimiz 1-3 iş günü içinde ulaşır", "Onay sonrası davet kodu e-posta ile gelir"].map(
                  (step, index) => (
                    <li key={step} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ),
                )}
              </ol>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="contactName" className="text-xs font-semibold text-foreground">
                  Ad Soyad <span className="text-destructive">*</span>
                </label>
                <input
                  id="contactName"
                  name="contactName"
                  type="text"
                  required
                  autoComplete="name"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Dr. Ayşe Kaya"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-foreground">
                  E-posta <span className="text-destructive">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="ayse@klinik.com"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="clinicName" className="text-xs font-semibold text-foreground">
                Klinik adı <span className="text-destructive">*</span>
              </label>
              <input
                id="clinicName"
                name="clinicName"
                type="text"
                required
                className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Sağlık Kliniği"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="message" className="text-xs font-semibold text-foreground">
                Mesaj <span className="text-destructive">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={4}
                className="resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Kliniğiniz ve kullanım amacınız hakkında kısaca bilgi verin..."
              />
            </div>

            <div className="hidden" aria-hidden>
              <label htmlFor="companyWebsite">Website</label>
              <input id="companyWebsite" name="companyWebsite" tabIndex={-1} autoComplete="off" />
            </div>

            {(state === "error" || state === "unavailable") ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
                <p className="text-xs leading-relaxed text-destructive">
                  {state === "unavailable"
                    ? "Çevrimiçi form şu an kullanılamıyor. Lütfen e-posta ile ulaşın."
                    : errorMsg}
                </p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={state === "loading"}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {state === "loading" ? <Loader2 size={15} className="animate-spin" /> : null}
              {state === "loading" ? "Gönderiliyor..." : "Talep gönder"}
            </button>

            <p className="text-xs text-muted-foreground">
              Formu göndererek pilot program koşullarının ekip tarafından değerlendirileceğini kabul etmiş olursunuz.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

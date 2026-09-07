"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Field, TextArea, TextInput } from "@/components/ui";
import { PUBLIC_CONTACT_COPY } from "@/lib/phase-84b-public-website";

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
        setErrorMsg(PUBLIC_CONTACT_COPY.errorRetry);
        setState("error");
        return;
      }

      setState("success");
      form.reset();
    } catch {
      setErrorMsg(PUBLIC_CONTACT_COPY.errorGeneric);
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
            {PUBLIC_CONTACT_COPY.successTitle}
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            {PUBLIC_CONTACT_COPY.successBody}
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
              {PUBLIC_CONTACT_COPY.heading}
            </h2>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              {PUBLIC_CONTACT_COPY.processIntro}
            </p>
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="mb-1 text-sm font-semibold text-foreground">Süreç nasıl işler?</p>
              <ol className="mt-3 flex list-none flex-col gap-2 text-sm text-muted-foreground">
                {PUBLIC_CONTACT_COPY.processSteps.map(
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

          <form
            id="contact"
            onSubmit={handleSubmit}
            className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-6"
            noValidate
            aria-busy={state === "loading"}
          >
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Ad Soyad" htmlFor="contact-lead-name" required>
                <TextInput
                  id="contact-lead-name"
                  name="contactName"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Dr. Ayşe Kaya"
                />
              </Field>
              <Field label="E-posta" htmlFor="contact-lead-email" required>
                <TextInput
                  id="contact-lead-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="ayse@klinik.com"
                />
              </Field>
            </div>

            <Field label="Klinik adı" htmlFor="contact-lead-clinic" required>
              <TextInput id="contact-lead-clinic" name="clinicName" type="text" required placeholder="Sağlık Kliniği" />
            </Field>

            <Field label="Mesaj" htmlFor="contact-lead-message" required>
              <TextArea
                id="contact-lead-message"
                name="message"
                required
                rows={4}
                className="resize-none"
                placeholder="Kliniğiniz ve kullanım amacınız hakkında kısaca bilgi verin..."
              />
            </Field>

            <div className="hidden" aria-hidden>
              <label htmlFor="contact-lead-website">Website</label>
              <input id="contact-lead-website" name="companyWebsite" tabIndex={-1} autoComplete="off" />
            </div>

            {(state === "error" || state === "unavailable") ? (
              <div
                className="flex min-w-0 items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
                <p className="free-text text-xs leading-relaxed text-destructive">
                  {state === "unavailable" ? PUBLIC_CONTACT_COPY.unavailable : `Hata: ${errorMsg}`}
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
              {PUBLIC_CONTACT_COPY.consentNote}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

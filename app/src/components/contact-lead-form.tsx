"use client";

import { useState } from "react";
import { CheckCircle2, Mail, Send } from "lucide-react";
import { Button, Field, TextInput } from "@/components/ui";
import {
  SIRIUSAI_PUBLIC_CONTACT_EMAIL,
  buildContactMailtoUrl,
} from "@/lib/phase-84b-public-website";
import { isLikelyEmail } from "@/lib/phase-83e2-purchase-ux";

type SubmitState = "idle" | "submitting" | "success" | "unavailable" | "error";

export function ContactLeadForm() {
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [message, setMessage] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const contactMailto = buildContactMailtoUrl();
  const busy = submitState === "submitting";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!contactName.trim()) {
      setFormError("Ad soyad gerekli.");
      return;
    }
    if (!isLikelyEmail(email)) {
      setFormError("Geçerli bir e-posta girin.");
      return;
    }
    if (!message.trim()) {
      setFormError("Mesaj gerekli.");
      return;
    }

    setSubmitState("submitting");
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
        setSubmitState("unavailable");
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        accepted?: boolean;
        blockingReasons?: string[];
        error?: string;
      };

      if (!response.ok || !payload.accepted) {
        setSubmitState("error");
        setFormError("Talep gönderilemedi. Lütfen e-posta ile iletişime geçin.");
        return;
      }

      setSubmitState("success");
      setContactName("");
      setEmail("");
      setClinicName("");
      setMessage("");
      setCompanyWebsite("");
    } catch {
      setSubmitState("error");
      setFormError("Bağlantı hatası. Lütfen e-posta ile iletişime geçin.");
    }
  }

  if (submitState === "success") {
    return (
      <div className="space-y-4" role="status">
        <div className="flex items-start gap-3 rounded-control border border-sage/30 bg-sage/10 px-4 py-3 text-sm text-ink">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>Talebiniz alındı. Ekibimiz en kısa sürede dönüş yapacaktır.</p>
        </div>
        <a href={contactMailto} className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-2">
          <Mail size={16} aria-hidden />
          Acil durumda doğrudan e-posta gönderin
        </a>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <Field label="Ad soyad" htmlFor="contact-lead-name" error={formError} required>
        <TextInput
          id="contact-lead-name"
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
          autoComplete="name"
          required
        />
      </Field>
      <Field label="E-posta" htmlFor="contact-lead-email">
        <TextInput
          id="contact-lead-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </Field>
      <Field label="Klinik adı (opsiyonel)" htmlFor="contact-lead-clinic">
        <TextInput
          id="contact-lead-clinic"
          value={clinicName}
          onChange={(event) => setClinicName(event.target.value)}
          autoComplete="organization"
        />
      </Field>
      <Field label="Mesaj" htmlFor="contact-lead-message">
        <textarea
          id="contact-lead-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          required
          className="min-h-[120px] w-full min-w-0 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
        />
      </Field>
      <div className="hidden" aria-hidden>
        <label htmlFor="contact-lead-website">Website</label>
        <input
          id="contact-lead-website"
          tabIndex={-1}
          autoComplete="off"
          value={companyWebsite}
          onChange={(event) => setCompanyWebsite(event.target.value)}
        />
      </div>
      {submitState === "unavailable" ? (
        <p className="text-sm text-amber-950" role="status">
          Çevrimiçi form şu an kullanılamıyor. Lütfen{" "}
          <a href={contactMailto} className="font-medium underline underline-offset-2">
            {SIRIUSAI_PUBLIC_CONTACT_EMAIL}
          </a>{" "}
          adresine yazın.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} icon={Send}>
          {busy ? "Gönderiliyor…" : "Talebi gönder"}
        </Button>
        <a
          href={contactMailto}
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line px-4 text-sm font-medium text-ink hover:bg-surface-sunken"
        >
          <Mail size={16} aria-hidden />
          E-posta ile yaz
        </a>
      </div>
    </form>
  );
}

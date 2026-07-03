"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Mail, Send } from "lucide-react";
import { Button, Field, TextInput } from "@/components/ui";
import {
  PUBLIC_MARKETING_COPY,
  SIRIUSAI_PUBLIC_CONTACT_EMAIL,
  buildContactMailtoUrl,
} from "@/lib/phase-84b-public-website";
import { isLikelyEmail } from "@/lib/phase-83e2-purchase-ux";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function CustomerLoginForm(props: { initialError?: string | null; nextPath?: string | null }) {
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(props.initialError ?? null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const contactMailto = useMemo(() => buildContactMailtoUrl("SiriusAI müşteri girişi"), []);
  const busy = submitState === "submitting";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!isLikelyEmail(email)) {
      setFormError("Geçerli bir e-posta girin.");
      return;
    }

    setSubmitState("submitting");
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          next: props.nextPath ?? undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        sent?: boolean;
        error?: string;
        blockingReasons?: string[];
      };

      if (response.status === 403 && payload.error === "customer_access_not_found") {
        setSubmitState("error");
        setFormError("Bu e-posta için kayıtlı müşteri erişimi bulunamadı. Erişim için ekibimizle iletişime geçin.");
        return;
      }

      if (!response.ok || !payload.sent) {
        setSubmitState("error");
        setFormError("Giriş bağlantısı gönderilemedi. Lütfen tekrar deneyin veya e-posta ile ulaşın.");
        return;
      }

      setSubmitState("success");
      setEmail("");
    } catch {
      setSubmitState("error");
      setFormError("Bağlantı hatası. Lütfen tekrar deneyin.");
    }
  }

  if (submitState === "success") {
    return (
      <div className="space-y-4" role="status">
        <div className="flex items-start gap-3 rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            Giriş bağlantısı gönderildi. E-postanızdaki bağlantıya tıklayarak oturum açabilirsiniz.
          </p>
        </div>
        <p className="text-xs text-ink-subtle">
          Bağlantı gelmediyse spam klasörünü kontrol edin veya{" "}
          <a href={contactMailto} className="font-medium text-emerald-900 underline-offset-2 hover:underline">
            {SIRIUSAI_PUBLIC_CONTACT_EMAIL}
          </a>{" "}
          adresine yazın.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <Field label="Kayıtlı müşteri e-postası" htmlFor="customer-login-email">
        <TextInput
          id="customer-login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </Field>
      {formError ? (
        <p className="text-sm text-rose-800" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} icon={Send}>
          {busy ? "Gönderiliyor…" : "Giriş bağlantısı gönder"}
        </Button>
        <a
          href={contactMailto}
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line px-4 text-sm font-medium text-ink hover:bg-surface-sunken"
        >
          <Mail size={16} aria-hidden />
          {PUBLIC_MARKETING_COPY.contactCta}
        </a>
      </div>
    </form>
  );
}

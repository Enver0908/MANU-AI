"use client";

import { useState } from "react";
import { CheckCircle2, Mail, Send, Shield } from "lucide-react";
import { Button, Field, TextInput } from "@/components/ui";
import {
  PUBLIC_MARKETING_COPY,
  SIRIUSAI_PUBLIC_CONTACT_EMAIL,
  buildContactMailtoUrl,
} from "@/lib/phase-84b-public-website";
import { isLikelyEmail } from "@/lib/phase-83e2-purchase-ux";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function AdminLoginForm(props: { initialError?: string | null }) {
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(props.initialError ?? null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const contactMailto = buildContactMailtoUrl("SiriusAI yönetim girişi");
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
      const response = await fetch("/api/admin/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        sent?: boolean;
        error?: string;
        blockingReasons?: string[];
      };

      if (response.status === 403 && payload.error === "admin_access_denied") {
        setSubmitState("error");
        setFormError("Bu e-posta yönetim allowlist'inde değil. Erişim için operasyon ekibiyle iletişime geçin.");
        return;
      }

      if (!response.ok || !payload.sent) {
        setSubmitState("error");
        setFormError("Giriş bağlantısı gönderilemedi. Lütfen tekrar deneyin.");
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
            Yönetim giriş bağlantısı gönderildi. E-postanızdaki bağlantıya tıklayarak admin paneline
            erişebilirsiniz.
          </p>
        </div>
        <p className="text-xs text-ink-subtle">
          Bağlantı gelmediyse spam klasörünü kontrol edin veya{" "}
          <a href={contactMailto} className="font-medium text-emerald-900 underline-offset-2 hover:underline">
            {SIRIUSAI_PUBLIC_CONTACT_EMAIL}
          </a>{" "}
          ile iletişime geçin.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <p className="text-sm leading-6 text-ink-muted">
        {PUBLIC_MARKETING_COPY.brand} ticari operasyon paneli yalnızca allowlist&apos;teki yönetici
        e-postaları için açılır.
      </p>
      <Field label="Yönetici e-posta" htmlFor="admin-login-email">
        <TextInput
          id="admin-login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </Field>
      {formError ? (
        <p className="text-sm text-red-700" role="alert">
          {formError}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || !email.trim()} fullWidth icon={busy ? Mail : Send}>
        {busy ? "Gönderiliyor…" : "Giriş bağlantısı gönder"}
      </Button>
      <p className="flex items-start gap-2 text-xs text-ink-subtle">
        <Shield size={14} className="mt-0.5 shrink-0" aria-hidden />
        Production pilot hâlâ NO-GO. Bu panel invite, lead ve abonelik operasyonları içindir.
      </p>
    </form>
  );
}

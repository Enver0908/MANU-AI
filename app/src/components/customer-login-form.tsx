"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import {
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
      <div className="rounded-lg border border-border bg-surface p-6 text-center" role="status">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/15">
            <MailCheck size={24} className="text-sage" aria-hidden />
          </div>
        </div>
        <h2 className="mb-2 font-semibold text-foreground">Bağlantı gönderildi</h2>
        <p className="mb-1 text-sm leading-relaxed text-muted-foreground">
          Giriş bağlantısı kayıtlı e-posta adresinize gönderildi.
        </p>
        <p className="text-xs text-muted-foreground">
          E-postayı göremiyorsanız spam klasörünü kontrol edin veya{" "}
          <a href={contactMailto} className="font-medium text-primary underline-offset-2 hover:underline">
            {SIRIUSAI_PUBLIC_CONTACT_EMAIL}
          </a>{" "}
          adresine yazın.
        </p>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6" onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="customer-login-email" className="text-xs font-semibold text-foreground">
          E-posta adresi
        </label>
        <input
          id="customer-login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          className="rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="kayitli@email.com"
          required
        />
      </div>
      {formError ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5" role="alert">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
          <p className="text-xs leading-relaxed text-destructive">{formError}</p>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={busy || !email.trim()}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
        {busy ? "Gönderiliyor..." : "Giriş bağlantısı gönder"}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        Hesabınız yok mu?{" "}
        <Link href="/#iletisim" className="text-primary hover:underline">
          Erişim talep edin
        </Link>
      </p>
    </form>
  );
}

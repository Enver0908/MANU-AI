"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import {
  SIRIUSAI_PUBLIC_CONTACT_EMAIL,
  buildContactMailtoUrl,
} from "@/lib/phase-84b-public-website";
import { isLikelyEmail } from "@/lib/phase-83e2-purchase-ux";

type LoginMode = "magic_link" | "password";
type SubmitState = "idle" | "submitting" | "success" | "error";

export function CustomerLoginForm(props: { initialError?: string | null; nextPath?: string | null }) {
  const [mode, setMode] = useState<LoginMode>("magic_link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(props.initialError ?? null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const contactMailto = useMemo(() => buildContactMailtoUrl("SiriusAI müşteri girişi"), []);
  const busy = submitState === "submitting";

  async function onSubmitMagicLink(event: React.FormEvent) {
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
      };

      if (!response.ok || !payload.sent) {
        if (response.status === 429) {
          setSubmitState("error");
          setFormError("Çok fazla deneme. Lütfen biraz bekleyin.");
          return;
        }
        setSubmitState("error");
        setFormError("İşlem tamamlanamadı. Geçerli bir e-posta kullanın ve tekrar deneyin.");
        return;
      }

      setSubmitState("success");
      setEmail("");
    } catch {
      setSubmitState("error");
      setFormError("Bağlantı hatası. Lütfen tekrar deneyin.");
    }
  }

  async function onSubmitPassword(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!isLikelyEmail(email)) {
      setFormError("Geçerli bir e-posta girin.");
      return;
    }
    if (!password) {
      setFormError("Parola gerekli.");
      return;
    }

    setSubmitState("submitting");
    try {
      const response = await fetch("/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          next: props.nextPath ?? undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        authenticated?: boolean;
        next?: string;
        error?: string;
      };

      if (!response.ok || !payload.authenticated) {
        setSubmitState("error");
        setFormError("E-posta veya parola hatalı.");
        return;
      }

      window.location.assign(payload.next ?? "/dashboard");
    } catch {
      setSubmitState("error");
      setFormError("Bağlantı hatası. Lütfen tekrar deneyin.");
    }
  }

  if (submitState === "success" && mode === "magic_link") {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center" role="status">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/15">
            <MailCheck size={24} className="text-sage" aria-hidden />
          </div>
        </div>
        <h2 className="mb-2 font-semibold text-foreground">Bağlantı gönderildi</h2>
        <p className="mb-1 text-sm leading-relaxed text-muted-foreground">
          Hesap varsa giriş bağlantısı e-posta adresinize gönderildi.
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
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Giriş yöntemi">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "magic_link"}
          className={`min-h-11 flex-1 rounded-md px-3 text-sm font-semibold transition ${
            mode === "magic_link" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
          onClick={() => {
            setMode("magic_link");
            setFormError(null);
            setSubmitState("idle");
          }}
          data-testid="login-mode-magic-link"
        >
          E-posta bağlantısı
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "password"}
          className={`min-h-11 flex-1 rounded-md px-3 text-sm font-semibold transition ${
            mode === "password" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
          onClick={() => {
            setMode("password");
            setFormError(null);
            setSubmitState("idle");
          }}
          data-testid="login-mode-password"
        >
          Parola
        </button>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={mode === "magic_link" ? onSubmitMagicLink : onSubmitPassword}
        noValidate
      >
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
        {mode === "password" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-login-password" className="text-xs font-semibold text-foreground">
              Parola
            </label>
            <input
              id="customer-login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
        ) : null}
        {formError ? (
          <div
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5"
            role="alert"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
            <p className="text-xs leading-relaxed text-destructive">{formError}</p>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={busy || !email.trim() || (mode === "password" && !password)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="customer-login-submit"
        >
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
          {busy
            ? mode === "magic_link"
              ? "Gönderiliyor..."
              : "Giriş yapılıyor..."
            : mode === "magic_link"
              ? "Giriş bağlantısı gönder"
              : "Parola ile giriş"}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Hesabınız yok mu?{" "}
          <Link href="/#iletisim" className="text-primary hover:underline">
            Erişim talep edin
          </Link>
        </p>
      </form>
    </div>
  );
}

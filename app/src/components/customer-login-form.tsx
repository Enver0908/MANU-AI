"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { AIYA_BRAND_NAME } from "@/lib/brand";
import { buildContactMailtoUrl } from "@/lib/phase-84b-public-website";
import { parseRetryAfterSeconds } from "@/lib/phase-84d-customer-auth";
import { isLikelyEmail } from "@/lib/phase-83e2-purchase-ux";

type LoginMode = "password" | "magic_link";
type SubmitState = "idle" | "submitting" | "success" | "error";
type SuccessKind = "magic_link" | "recovery";

export function CustomerLoginForm(props: { initialError?: string | null; nextPath?: string | null }) {
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(props.initialError ?? null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [successKind, setSuccessKind] = useState<SuccessKind>("magic_link");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const contactMailto = useMemo(() => buildContactMailtoUrl(`${AIYA_BRAND_NAME} müşteri girişi`), []);
  const busy = submitState === "submitting" || cooldownSeconds > 0;

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  function beginCooldown(seconds: number) {
    setCooldownSeconds(Math.max(1, Math.ceil(seconds)));
  }

  function switchToMagicLink() {
    setMode("magic_link");
    setFormError(null);
    setSubmitState("idle");
  }

  function switchToPassword() {
    setMode("password");
    setFormError(null);
    setSubmitState("idle");
  }

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
          const retryAfter = parseRetryAfterSeconds(response);
          beginCooldown(retryAfter);
          setSubmitState("error");
          setFormError(`Hata: Çok fazla deneme. ${retryAfter} saniye sonra tekrar deneyin.`);
          return;
        }
        setSubmitState("error");
        setFormError("Hata: İşlem tamamlanamadı. Geçerli bir e-posta kullanın ve tekrar deneyin.");
        return;
      }

      setSuccessKind("magic_link");
      setSubmitState("success");
      setEmail("");
    } catch {
      setSubmitState("error");
      setFormError("Hata: Bağlantı hatası. Lütfen tekrar deneyin.");
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
        if (response.status === 429) {
          const retryAfter = parseRetryAfterSeconds(response);
          beginCooldown(retryAfter);
          setSubmitState("error");
          setFormError(`Hata: Çok fazla deneme. ${retryAfter} saniye sonra tekrar deneyin.`);
          return;
        }
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

  async function onForgotPassword() {
    setFormError(null);
    if (!isLikelyEmail(email)) {
      setFormError("Geçerli bir e-posta girin.");
      return;
    }

    setSubmitState("submitting");
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        accepted?: boolean;
        error?: string;
      };

      if (response.status === 429) {
        const retryAfter = parseRetryAfterSeconds(response);
        beginCooldown(retryAfter);
        setSubmitState("error");
        setFormError(`Hata: Çok fazla deneme. ${retryAfter} saniye sonra tekrar deneyin.`);
        return;
      }

      if (!response.ok || !payload.accepted) {
        setSubmitState("error");
        setFormError("Hata: İşlem tamamlanamadı. Geçerli bir e-posta kullanın ve tekrar deneyin.");
        return;
      }

      setSuccessKind("recovery");
      setSubmitState("success");
    } catch {
      setSubmitState("error");
      setFormError("Hata: Bağlantı hatası. Lütfen tekrar deneyin.");
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
          {successKind === "recovery"
            ? "Hesap varsa parola sıfırlama bağlantısı e-posta adresinize gönderildi."
            : "Hesap varsa giriş bağlantısı e-posta adresinize gönderildi."}
        </p>
        <p className="text-xs text-muted-foreground">
          E-postayı göremiyorsanız spam klasörünü kontrol edin veya{" "}
          <a href={contactMailto} className="inline-flex min-h-6 items-center font-medium text-primary underline underline-offset-2">
            destek ekibine yazın
          </a>{" "}
          .
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
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
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? "customer-login-error" : undefined}
            className="min-w-0 rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="kayitli@email.com"
            required
          />
        </div>
        {mode === "password" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-login-password" className="text-xs font-semibold text-foreground">
              Şifre
            </label>
            <input
              id="customer-login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              aria-invalid={formError ? true : undefined}
              aria-describedby={formError ? "customer-login-error" : undefined}
              className="min-w-0 rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
        ) : null}
        {formError ? (
          <div
            id="customer-login-error"
            className="flex min-w-0 items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5"
            role="alert"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
            <p className="free-text text-xs leading-relaxed text-destructive">{formError}</p>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={busy || !email.trim()}
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
              : "Giriş yap"}
        </button>
        {mode === "password" ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-muted/40 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              onClick={switchToMagicLink}
              data-testid="login-mode-magic-link"
            >
              Giriş bağlantısı gönder
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary underline underline-offset-2"
              onClick={() => void onForgotPassword()}
              disabled={busy}
              data-testid="login-forgot-password"
            >
              Şifremi unuttum
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary underline underline-offset-2"
            onClick={switchToPassword}
            data-testid="login-mode-password"
          >
            E-posta ve şifreyle giriş
          </button>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Hesabınız yok mu?{" "}
          <Link href="/#iletisim" className="inline-flex min-h-6 items-center text-primary underline underline-offset-2">
            Erişim talep edin
          </Link>
        </p>
      </form>
    </div>
  );
}

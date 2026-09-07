"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Mail, Send, Shield } from "lucide-react";
import { Button, Field, TextInput } from "@/components/ui";
import { AIYA_BRAND_NAME } from "@/lib/brand";
import {
  PUBLIC_MARKETING_COPY,
  buildContactMailtoUrl,
} from "@/lib/phase-84b-public-website";
import { parseRetryAfterSeconds } from "@/lib/phase-84d-customer-auth";
import { isLikelyEmail } from "@/lib/phase-83e2-purchase-ux";

type SubmitState = "idle" | "submitting" | "success" | "error";
type LoginMode = "password" | "magic_link";
type SuccessKind = "magic_link" | "recovery";

export function AdminLoginForm(props: { initialError?: string | null }) {
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(props.initialError ?? null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [successKind, setSuccessKind] = useState<SuccessKind>("magic_link");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const contactMailto = buildContactMailtoUrl(`${AIYA_BRAND_NAME} yönetim girişi`);
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

  function applyAdminAccessDeniedError() {
    setSubmitState("error");
    setFormError("Bu e-posta yönetim allowlist'inde değil. Erişim için operasyon ekibiyle iletişime geçin.");
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
        applyAdminAccessDeniedError();
        return;
      }

      if (!response.ok || !payload.sent) {
        if (response.status === 429) {
          const retryAfter = parseRetryAfterSeconds(response);
          beginCooldown(retryAfter);
          setSubmitState("error");
          setFormError(`Çok fazla giriş bağlantısı istendi. ${retryAfter} saniye sonra tekrar deneyin.`);
          return;
        }
        setSubmitState("error");
        setFormError(
          response.status === 503
            ? "Giriş sağlayıcısına geçici olarak ulaşılamıyor. Biraz sonra tekrar deneyin."
            : "Giriş bağlantısı gönderilemedi. Lütfen tekrar deneyin.",
        );
        return;
      }

      setSuccessKind("magic_link");
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
      setFormError("Şifre gerekli.");
      return;
    }

    setSubmitState("submitting");
    try {
      const response = await fetch("/api/admin/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        authenticated?: boolean;
        next?: string;
        error?: string;
        blockingReasons?: string[];
      };

      if (response.status === 403 && payload.error === "admin_access_denied") {
        applyAdminAccessDeniedError();
        return;
      }

      if (!response.ok || !payload.authenticated) {
        if (response.status === 429) {
          const retryAfter = parseRetryAfterSeconds(response);
          beginCooldown(retryAfter);
          setSubmitState("error");
          setFormError(`Çok fazla giriş denemesi. ${retryAfter} saniye sonra tekrar deneyin.`);
          return;
        }
        setSubmitState("error");
        setFormError(
          response.status === 503
            ? "Giriş sağlayıcısına geçici olarak ulaşılamıyor. Biraz sonra tekrar deneyin."
            : "E-posta veya şifre hatalı.",
        );
        return;
      }

      window.location.assign(payload.next ?? "/admin");
    } catch {
      setSubmitState("error");
      setFormError("Bağlantı hatası. Lütfen tekrar deneyin.");
    }
  }

  async function onForgotPassword() {
    setFormError(null);
    if (!isLikelyEmail(email)) {
      setFormError("Şifre sıfırlama için geçerli bir e-posta girin.");
      return;
    }

    setSubmitState("submitting");
    try {
      const response = await fetch("/api/admin/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        accepted?: boolean;
        error?: string;
      };

      if (response.status === 403 && payload.error === "admin_access_denied") {
        applyAdminAccessDeniedError();
        return;
      }

      if (response.status === 429) {
        const retryAfter = parseRetryAfterSeconds(response);
        beginCooldown(retryAfter);
        setSubmitState("error");
        setFormError(`Çok fazla şifre sıfırlama isteği. ${retryAfter} saniye sonra tekrar deneyin.`);
        return;
      }

      if (!response.ok || !payload.accepted) {
        setSubmitState("error");
        setFormError("Şifre sıfırlama bağlantısı gönderilemedi. Lütfen tekrar deneyin.");
        return;
      }

      setSuccessKind("recovery");
      setSubmitState("success");
    } catch {
      setSubmitState("error");
      setFormError("Bağlantı hatası. Lütfen tekrar deneyin.");
    }
  }

  if (submitState === "success") {
    return (
      <div className="space-y-4" role="status">
        <div className="flex items-start gap-3 rounded-control border border-sage/30 bg-sage/10 px-4 py-3 text-sm text-ink">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            {successKind === "recovery"
              ? "Şifre sıfırlama bağlantısı gönderildi. E-postanızdaki bağlantıyla yeni şifre belirleyebilirsiniz."
              : "Yönetim giriş bağlantısı gönderildi. E-postanızdaki bağlantıya tıklayarak admin paneline erişebilirsiniz."}
          </p>
        </div>
        <p className="text-xs text-ink-muted">
          Bağlantı gelmediyse spam klasörünü kontrol edin veya{" "}
          <a href={contactMailto} className="inline-flex min-h-6 items-center font-medium text-primary underline underline-offset-2">
            destek ekibine yazın
          </a>{" "}
          .
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={mode === "magic_link" ? onSubmitMagicLink : onSubmitPassword}>
      <p className="text-sm leading-6 text-ink-muted">
        {PUBLIC_MARKETING_COPY.brand} ticari operasyon paneli yalnızca allowlist&apos;teki yönetici
        e-postaları için açılır.
      </p>
      <Field label="Yönetici e-posta" htmlFor="admin-login-email" error={formError} required>
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
      {mode === "password" ? (
        <Field label="Şifre" htmlFor="admin-login-password" required>
          <TextInput
            id="admin-login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
      ) : null}
      <Button
        type="submit"
        disabled={busy || !email.trim() || (mode === "password" && !password)}
        fullWidth
        icon={busy ? Loader2 : mode === "password" ? KeyRound : Send}
        className={busy ? "[&_svg]:animate-spin" : undefined}
      >
        {busy
          ? mode === "magic_link"
            ? "Gönderiliyor…"
            : "Giriş yapılıyor…"
          : mode === "magic_link"
            ? "Giriş bağlantısı gönder"
            : "Giriş yap"}
      </Button>
      {mode === "password" ? (
        <div className="flex flex-col gap-2">
          <Button type="button" variant="secondary" fullWidth icon={Mail} onClick={switchToMagicLink} disabled={busy}>
            Giriş bağlantısı gönder
          </Button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void onForgotPassword()}
            disabled={busy}
          >
            Şifremi unuttum
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary underline underline-offset-2"
          onClick={switchToPassword}
          disabled={busy}
        >
          E-posta ve şifreyle giriş
        </button>
      )}
      <p className="flex items-start gap-2 text-xs text-ink-muted">
        <Shield size={14} className="mt-0.5 shrink-0" aria-hidden />
        Bu panel invite, lead ve abonelik operasyonları içindir.
      </p>
    </form>
  );
}

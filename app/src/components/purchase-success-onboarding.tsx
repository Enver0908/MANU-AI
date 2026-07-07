"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, Mail, Send } from "lucide-react";
import { isLikelyEmail } from "@/lib/phase-83e2-purchase-ux";
import { SIRIUSAI_PUBLIC_CONTACT_EMAIL, buildContactMailtoUrl } from "@/lib/phase-84b-public-website";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function PurchaseSuccessOnboarding(props: { sessionId?: string | null }) {
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [sessionRecognized, setSessionRecognized] = useState<boolean | null>(null);
  const [pollAttempt, setPollAttempt] = useState(0);

  const sessionId = props.sessionId?.trim() || null;
  const nextPath = sessionId ? `/onboarding?session_id=${encodeURIComponent(sessionId)}` : "/onboarding";
  const contactMailto = useMemo(() => buildContactMailtoUrl("SiriusAI ödeme sonrası onboarding"), []);
  const busy = submitState === "submitting";

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetch(`/api/commercial/onboarding/status?session_id=${encodeURIComponent(sessionId)}`)
        .then(async (response) => {
          const payload = (await response.json().catch(() => ({}))) as {
            checkoutSessionRecognized?: boolean;
            entitlementStatus?: string;
          };
          if (!cancelled) {
            setSessionRecognized(Boolean(payload.checkoutSessionRecognized));
            if (!payload.checkoutSessionRecognized && pollAttempt < 4) {
              setPollAttempt((attempt) => attempt + 1);
            }
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSessionRecognized(false);
          }
        });
    }, pollAttempt === 0 ? 0 : 3000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionId, pollAttempt]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!isLikelyEmail(email)) {
      setFormError("Ödeme sırasında kullandığınız e-postayı girin.");
      return;
    }

    setSubmitState("submitting");
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          next: nextPath,
          checkoutSessionId: sessionId,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        sent?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.sent) {
        setSubmitState("error");
        setFormError(
          response.status === 403
            ? "Bu e-posta için kayıtlı müşteri erişimi bulunamadı. Ödeme e-postanızı kontrol edin."
            : "Giriş bağlantısı gönderilemedi. Lütfen tekrar deneyin.",
        );
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
            <CheckCircle size={24} className="text-sage" aria-hidden />
          </div>
        </div>
        <h2 className="mb-2 font-semibold text-foreground">Giriş bağlantısı gönderildi</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          E-postanızdaki bağlantıyla oturum açın; ardından çalışma alanınızı bağlayabileceksiniz.
        </p>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6" onSubmit={onSubmit} noValidate>
      {sessionId ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {sessionRecognized === true
            ? "Ödeme kaydınız doğrulandı. Satın alma sırasında kullandığınız e-posta ile giriş bağlantısı isteyin."
            : sessionRecognized === false
              ? pollAttempt < 4
                ? "Ödeme kaydı henüz doğrulanmadı. Birkaç saniye içinde tekrar kontrol ediliyor..."
                : "Ödeme kaydı henüz doğrulanmadı. Birkaç dakika bekleyin veya destek ile iletişime geçin."
              : "Ödeme kaydı kontrol ediliyor..."}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Hesabınızı bağlamak için kayıtlı müşteri e-postanıza giriş bağlantısı gönderin.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="purchase-success-email" className="text-xs font-semibold text-foreground">
          Ödeme e-postası
        </label>
        <input
          id="purchase-success-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          className="rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          required
        />
      </div>

      {formError ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5" role="alert">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
          <p className="text-xs leading-relaxed text-destructive">{formError}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {busy ? "Gönderiliyor..." : "Hesabını oluştur / giriş linki gönder"}
        </button>
        <a
          href={contactMailto}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-muted/40 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Mail size={16} aria-hidden />
          Destek
        </a>
      </div>
      <p className="text-xs text-muted-foreground">{SIRIUSAI_PUBLIC_CONTACT_EMAIL}</p>
    </form>
  );
}

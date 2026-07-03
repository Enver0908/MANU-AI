"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Mail, Send } from "lucide-react";
import { Button, Field, TextInput } from "@/components/ui";
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
      <div className="space-y-4" role="status">
        <div className="flex items-start gap-3 rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            Giriş bağlantısı gönderildi. E-postanızdaki bağlantıyla oturum açın; ardından çalışma
            alanınızı bağlayabileceksiniz.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {sessionId ? (
        <p className="text-sm text-ink-muted">
          {sessionRecognized === true
            ? "Ödeme kaydınız doğrulandı. Satın alma sırasında kullandığınız e-posta ile giriş bağlantısı isteyin."
            : sessionRecognized === false
              ? pollAttempt < 4
                ? "Ödeme kaydı henüz doğrulanmadı. Birkaç saniye içinde tekrar kontrol ediliyor…"
                : "Ödeme kaydı henüz doğrulanmadı. Birkaç dakika bekleyin veya destek ile iletişime geçin."
              : "Ödeme kaydı kontrol ediliyor…"}
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          Hesabınızı bağlamak için kayıtlı müşteri e-postanıza giriş bağlantısı gönderin.
        </p>
      )}
      <Field label="Ödeme e-postası" htmlFor="purchase-success-email">
        <TextInput
          id="purchase-success-email"
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
          {busy ? "Gönderiliyor…" : "Hesabını oluştur / giriş linki gönder"}
        </Button>
        <a
          href={contactMailto}
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line px-4 text-sm font-medium text-ink hover:bg-surface-sunken"
        >
          <Mail size={16} aria-hidden />
          Destek
        </a>
      </div>
      <p className="text-xs text-ink-subtle">{SIRIUSAI_PUBLIC_CONTACT_EMAIL}</p>
    </form>
  );
}

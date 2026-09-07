"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import {
  deriveCheckoutOutcome,
  derivePurchaseGateView,
  describePurchaseBlockingReason,
  isLikelyEmail,
  type PurchaseGateView,
} from "@/lib/phase-83e2-purchase-ux";
import { describeCommercialBlockingReason } from "@/lib/phase-84g-subscription-operations";

function mapPurchaseBlockingReason(reason: string) {
  if (reason.toLowerCase().includes("pending")) {
    return "İnceleniyor; lütfen bekleyin veya destek ile iletişime geçin.";
  }
  const purchaseCopy = describePurchaseBlockingReason(reason);
  if (purchaseCopy !== "Erişim için uygunluk doğrulanamadı.") {
    return purchaseCopy;
  }
  return describeCommercialBlockingReason(reason);
}

type Phase = "idle" | "checking" | "starting_checkout";

export function PurchaseFlow() {
  const checkoutButtonRef = useRef<HTMLButtonElement | null>(null);
  const [email, setEmail] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [gate, setGate] = useState<PurchaseGateView | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const busy = phase !== "idle";

  useEffect(() => {
    if (gate?.kind === "eligible") {
      checkoutButtonRef.current?.focus();
    }
  }, [gate]);

  async function onCheckEligibility(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setCheckoutError(null);
    setGate(null);

    if (!isLikelyEmail(email)) {
      setFormError("Geçerli bir e-posta girin.");
      return;
    }
    if (!inviteToken.trim()) {
      setFormError("Davet kodunu girin.");
      return;
    }

    setPhase("checking");
    try {
      const response = await fetch("/api/commercial/invite-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), inviteToken: inviteToken.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      setGate(derivePurchaseGateView(response.status, payload));
    } catch {
      setGate({
        kind: "error",
        message: "Uygunluk kontrol edilemedi. Bağlantınızı kontrol edip tekrar deneyin.",
      });
    } finally {
      setPhase("idle");
    }
  }

  async function onStartCheckout() {
    setCheckoutError(null);
    setPhase("starting_checkout");
    try {
      const response = await fetch("/api/commercial/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), inviteToken: inviteToken.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      const outcome = deriveCheckoutOutcome(response.status, payload);
      if ("redirectUrl" in outcome) {
        window.location.assign(outcome.redirectUrl);
        return;
      }
      setCheckoutError(outcome.errorMessage);
    } catch {
      setCheckoutError("Ödeme başlatılamadı. Lütfen tekrar deneyin.");
    } finally {
      setPhase("idle");
    }
  }

  if (gate?.kind === "eligible") {
    return (
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage/15">
              <CheckCircle size={18} className="text-sage" />
            </div>
            <div>
              <p className="mb-0.5 text-sm font-semibold text-foreground">Erişim doğrulandı</p>
              <p className="text-sm text-muted-foreground">
                <strong>{gate.normalizedEmail || email}</strong> adresi için davet kodu geçerli.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Ödeme tamamlandıktan sonra magic-link ile hesabınızı bağlayacak ve çalışma alanınızı claim edeceksiniz.
          </div>

          {checkoutError ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5" role="alert">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
              <p className="text-xs leading-relaxed text-destructive">{checkoutError}</p>
            </div>
          ) : null}

          <button
            ref={checkoutButtonRef}
            type="button"
            onClick={onStartCheckout}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {phase === "starting_checkout" ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
            {phase === "starting_checkout" ? "Ödemeye yönlendiriliyor..." : "Ödemeye geç"}
          </button>

          <button
            type="button"
            onClick={() => setGate(null)}
            className="text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Farklı davet kodu kullan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6" onSubmit={onCheckEligibility} noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="purchase-email" className="text-xs font-semibold text-foreground">
            Onaylı e-posta adresiniz <span className="text-destructive">*</span>
          </label>
          <input
            id="purchase-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="min-w-0 rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="kayitli@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? "purchase-form-error" : undefined}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="purchase-token" className="text-xs font-semibold text-foreground">
            Davet kodu <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="purchase-token"
              autoComplete="one-time-code"
              className="w-full min-w-0 rounded-md border border-input bg-background py-2.5 pl-9 pr-3 font-mono text-sm placeholder:font-sans placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="XXXX-XXXX"
              value={inviteToken}
              onChange={(event) => setInviteToken(event.target.value)}
              aria-invalid={formError ? true : undefined}
              aria-describedby={formError ? "purchase-form-error" : undefined}
              required
            />
          </div>
        </div>

        {formError ? (
          <div
            id="purchase-form-error"
            className="flex min-w-0 items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5"
            role="alert"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
            <p className="free-text text-xs leading-relaxed text-destructive">{formError}</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy || !email || !inviteToken}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {phase === "checking" ? <Loader2 size={15} className="animate-spin" /> : null}
          {phase === "checking" ? "Doğrulanıyor..." : "Erişimi doğrula"}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Davet kodunuz yok mu?{" "}
          <Link href="/#iletisim" className="text-primary underline underline-offset-2">
            Erişim talep edin
          </Link>
        </p>
      </form>

      {gate ? <GateResult gate={gate} /> : null}
    </div>
  );
}

function GateResult({ gate }: { gate: Exclude<PurchaseGateView, { kind: "eligible"; normalizedEmail: string }> }) {
  if (gate.kind === "waitlist") {
    const reasons = [...new Set(gate.reasons.map(mapPurchaseBlockingReason))];
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-destructive" />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-destructive">Hata: Erişim doğrulanamadı</p>
            {reasons.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {reasons.map((reason) => (
                  <li key={reason} className="text-xs leading-relaxed text-muted-foreground">
                    {reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Kaydınız satın almaya uygun değil.</p>
            )}
            <Link href="/#iletisim" className="text-xs text-primary underline underline-offset-2">
              Erişim talep et
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-2">
        <AlertCircle size={15} className="mt-0.5 shrink-0 text-destructive" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {gate.kind === "not_configured"
            ? "Hata: Ticari erişim bu kurulumda yapılandırılmamış. Erişim talebi için ekiple iletişime geçin."
            : `Hata: ${gate.message}`}
        </p>
      </div>
    </div>
  );
}

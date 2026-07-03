"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Info, Mail, ShieldAlert } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Field, TextInput } from "@/components/ui";
import {
  PURCHASE_CONTACT_EMAIL,
  PURCHASE_COPY,
  derivePurchaseGateView,
  deriveCheckoutOutcome,
  describePurchaseBlockingReason,
  isLikelyEmail,
  type PurchaseGateView,
} from "@/lib/phase-83e2-purchase-ux";
import { describeCommercialBlockingReason } from "@/lib/phase-84g-subscription-operations";

function mapPurchaseBlockingReason(reason: string) {
  const purchaseCopy = describePurchaseBlockingReason(reason);
  if (purchaseCopy !== "Erişim için uygunluk doğrulanamadı.") {
    return purchaseCopy;
  }
  return describeCommercialBlockingReason(reason);
}

type Phase = "idle" | "checking" | "starting_checkout";

export function PurchaseFlow() {
  const [email, setEmail] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [gate, setGate] = useState<PurchaseGateView | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const busy = phase !== "idle";

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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title={PURCHASE_COPY.purchaseFormTitle}
          description={PURCHASE_COPY.purchaseSubtitle}
          icon={CreditCard}
        />
        <CardBody>
          <form className="flex flex-col gap-4" onSubmit={onCheckEligibility} noValidate>
            <Field label="Onaylı e-posta" htmlFor="purchase-email" required>
              <TextInput
                id="purchase-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="diyetisyen@ornek.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field label="Davet kodu" htmlFor="purchase-token" required>
              <TextInput
                id="purchase-token"
                autoComplete="one-time-code"
                placeholder="Davet e-postanızdaki kod"
                value={inviteToken}
                onChange={(event) => setInviteToken(event.target.value)}
                required
              />
            </Field>

            {formError ? (
              <p className="text-xs font-medium text-red-700" role="alert">
                {formError}
              </p>
            ) : null}

            <Button type="submit" size="lg" disabled={busy}>
              {phase === "checking" ? "Kontrol ediliyor…" : "Uygunluğu doğrula"}
            </Button>
          </form>
        </CardBody>
      </Card>

      {gate ? <GateResult gate={gate} onStartCheckout={onStartCheckout} busy={busy} checkoutError={checkoutError} /> : null}
    </div>
  );
}

function GateResult({
  gate,
  onStartCheckout,
  busy,
  checkoutError,
}: {
  gate: PurchaseGateView;
  onStartCheckout: () => void;
  busy: boolean;
  checkoutError: string | null;
}) {
  if (gate.kind === "eligible") {
    return (
      <Card>
        <CardHeader title="Uygunluk doğrulandı" icon={CheckCircle2} />
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            {gate.normalizedEmail ? (
              <>
                <span className="font-medium text-ink">{gate.normalizedEmail}</span> için erişim onaylı.
              </>
            ) : (
              "Erişim onaylı."
            )}{" "}
            Güvenli ödemeye geçebilirsiniz.
          </p>
          <Button size="lg" icon={CreditCard} onClick={onStartCheckout} disabled={busy}>
            {busy ? "Ödemeye yönlendiriliyor…" : "Güvenli ödemeye geç"}
          </Button>
          {checkoutError ? (
            <p className="text-xs font-medium text-red-700" role="alert">
              {checkoutError}
            </p>
          ) : null}
          <p className="text-xs text-ink-subtle">
            Ödeme Stripe üzerinde güvenli olarak alınır. Bu ortam sandbox modundadır.
          </p>
        </CardBody>
      </Card>
    );
  }

  if (gate.kind === "waitlist") {
    return (
      <Card>
        <CardHeader title={PURCHASE_COPY.waitlistTitle} icon={ShieldAlert} />
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">{PURCHASE_COPY.waitlistBody}</p>
          {gate.reasons.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {[...new Set(gate.reasons.map(mapPurchaseBlockingReason))].map((reason) => (
                <li key={reason} className="text-sm text-ink">
                  • {reason}
                </li>
              ))}
            </ul>
          ) : null}
          <a
            href={`mailto:${PURCHASE_CONTACT_EMAIL}`}
            className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-emerald-800 underline"
          >
            <Mail size={15} />
            {PURCHASE_CONTACT_EMAIL}
          </a>
        </CardBody>
      </Card>
    );
  }

  if (gate.kind === "not_configured") {
    return (
      <Card>
        <CardHeader title="Ödeme ortamı hazır değil" icon={Info} />
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Ticari erişim bu kurulumda yapılandırılmamış. Erişim talebi için ekiple iletişime geçin.
          </p>
          <a
            href={`mailto:${PURCHASE_CONTACT_EMAIL}`}
            className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-emerald-800 underline"
          >
            <Mail size={15} />
            {PURCHASE_CONTACT_EMAIL}
          </a>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Bir sorun oluştu" icon={ShieldAlert} />
      <CardBody>
        <p className="text-sm text-ink-muted">{gate.message}</p>
      </CardBody>
    </Card>
  );
}

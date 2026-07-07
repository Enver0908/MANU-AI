"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, LayoutDashboard, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { describeOnboardingBlockingReason } from "@/lib/phase-84g-subscription-operations";

type OnboardingStatus = {
  authenticated?: boolean;
  claimable?: boolean;
  alreadyClaimed?: boolean;
  blockingReasons?: string[];
};

export function OnboardingClaimPanel(props: { sessionId?: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionId = props.sessionId?.trim() || null;

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;
    void fetch(`/api/commercial/onboarding/status?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as OnboardingStatus & {
          error?: string;
        };
        if (!cancelled) {
          if (!response.ok) {
            setError(payload.error ?? "onboarding_status_failed");
            return;
          }
          setStatus(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("onboarding_status_failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function onClaim() {
    if (!sessionId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/commercial/onboarding/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        claimed?: boolean;
        redirectUrl?: string;
        blockingReasons?: string[];
        error?: string;
      };

      if (!response.ok || !payload.claimed) {
        setError(describeOnboardingBlockingReason(payload.blockingReasons?.[0] ?? payload.error ?? "claim_failed"));
        return;
      }

      router.push(payload.redirectUrl ?? "/dashboard");
      router.refresh();
    } catch {
      setError("claim_failed");
    } finally {
      setBusy(false);
    }
  }

  if (!sessionId) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
        <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Bağlanacak ödeme oturumu bulunamadı. Destek için iletişime geçin.
        </p>
      </div>
    );
  }

  if (!status && !error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <LoaderCircle size={16} className="animate-spin" aria-hidden />
        Onboarding durumu kontrol ediliyor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
        <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
        <p className="text-xs leading-relaxed text-destructive">{describeOnboardingBlockingReason(error)}</p>
      </div>
    );
  }

  if (status?.alreadyClaimed) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <div className="flex items-start gap-3 rounded-md border border-border bg-sage/10 px-4 py-3 text-sm text-foreground">
          <CheckCircle size={18} className="mt-0.5 shrink-0 text-sage" aria-hidden />
          <p>Çalışma alanınız zaten bu hesaba bağlı.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LayoutDashboard size={16} />
          Panele git
        </button>
      </div>
    );
  }

  if (status?.claimable) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ödemeniz doğrulandı. Çalışma alanınızı bu hesaba bağlamak için aşağıdaki adımı tamamlayın.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onClaim()}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <LayoutDashboard size={16} />}
          {busy ? "Bağlanıyor..." : "Çalışma alanını bağla"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
      <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
      <p className="text-xs leading-relaxed text-destructive">
        {describeOnboardingBlockingReason(status?.blockingReasons?.[0] ?? "onboarding_claim_blocked")}
      </p>
    </div>
  );
}

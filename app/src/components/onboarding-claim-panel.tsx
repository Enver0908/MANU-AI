"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LayoutDashboard, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
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
        setError(
          describeOnboardingBlockingReason(
            payload.blockingReasons?.[0] ?? payload.error ?? "claim_failed",
          ),
        );
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
    return null;
  }

  if (!status && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <LoaderCircle size={16} className="animate-spin" aria-hidden />
        Onboarding durumu kontrol ediliyor…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-rose-800">{describeOnboardingBlockingReason(error)}</p>;
  }

  if (status?.alreadyClaimed) {
    return (
      <div className="space-y-3" role="status">
        <div className="flex items-start gap-3 rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>Çalışma alanınız zaten bu hesaba bağlı.</p>
        </div>
        <Button icon={LayoutDashboard} onClick={() => router.push("/dashboard")}>
          Panele git
        </Button>
      </div>
    );
  }

  if (status?.claimable) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">
          Ödemeniz doğrulandı. Çalışma alanınızı bu hesaba bağlamak için aşağıdaki adımı tamamlayın.
        </p>
        <Button disabled={busy} icon={LayoutDashboard} onClick={() => void onClaim()}>
          {busy ? "Bağlanıyor…" : "Çalışma alanını bağla"}
        </Button>
      </div>
    );
  }

  return (
    <p className="text-sm text-rose-800">
      {describeOnboardingBlockingReason(status?.blockingReasons?.[0] ?? "onboarding_claim_blocked")}
    </p>
  );
}

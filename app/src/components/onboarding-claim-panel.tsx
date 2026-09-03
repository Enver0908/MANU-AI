"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, LayoutDashboard, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { describeOnboardingBlockingReason } from "@/lib/phase-84g-subscription-operations";
import {
  AccountSecurityValidationError,
  describePasswordPolicyError,
  validatePasswordPair,
} from "@/lib/phase-85-stage-4d-password-policy";

type OnboardingStatus = {
  authenticated?: boolean;
  invitedEmail?: string | null;
  claimable?: boolean;
  alreadyClaimed?: boolean;
  blockingReasons?: string[];
};

export function OnboardingClaimPanel(props: { sessionId?: string | null; inviteId?: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordReady, setPasswordReady] = useState(false);
  const sessionId = props.sessionId?.trim() || null;
  const inviteId = props.inviteId?.trim() || null;
  const ambiguousReference = Boolean(sessionId && inviteId);
  const claimReference = !ambiguousReference && (sessionId || inviteId);

  useEffect(() => {
    if (ambiguousReference || !claimReference) {
      return;
    }

    const query = sessionId
      ? `session_id=${encodeURIComponent(sessionId)}`
      : `invite_id=${encodeURIComponent(inviteId!)}`;

    let cancelled = false;
    void fetch(`/api/commercial/onboarding/status?${query}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as OnboardingStatus & {
          error?: string;
          blockingReasons?: string[];
        };
        if (!cancelled) {
          if (!response.ok) {
            setError(payload.blockingReasons?.[0] ?? payload.error ?? "onboarding_status_failed");
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
  }, [ambiguousReference, claimReference, inviteId, sessionId]);

  async function claimWorkspace() {
    const response = await fetch("/api/commercial/onboarding/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionId ? { sessionId } : { inviteId }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      claimed?: boolean;
      redirectUrl?: string;
      blockingReasons?: string[];
      error?: string;
    };

    if (!response.ok || !payload.claimed) {
      setError(describeOnboardingBlockingReason(payload.blockingReasons?.[0] ?? payload.error ?? "claim_failed"));
      return false;
    }

    router.push(payload.redirectUrl ?? "/dashboard");
    router.refresh();
    return true;
  }

  async function onCreateAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!claimReference) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!passwordReady) {
        try {
          validatePasswordPair(password, passwordConfirmation);
        } catch (validationError) {
          const code = validationError instanceof AccountSecurityValidationError ? validationError.code : "invalid_password";
          setError(describePasswordPolicyError(code) ?? describeOnboardingBlockingReason(code));
          return;
        }

        const passwordResponse = await fetch("/api/auth/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password,
            passwordConfirmation,
            sessionId: sessionId ?? undefined,
            inviteId: inviteId ?? undefined,
          }),
        });
        const passwordPayload = (await passwordResponse.json().catch(() => ({}))) as {
          updated?: boolean;
          error?: string;
          blockingReasons?: string[];
        };
        if (!passwordResponse.ok || !passwordPayload.updated) {
          setError(
            describePasswordPolicyError(passwordPayload.error) ??
              describeOnboardingBlockingReason(
                passwordPayload.blockingReasons?.[0] ?? passwordPayload.error ?? "claim_failed",
              ),
          );
          return;
        }
        setPasswordReady(true);
      }

      await claimWorkspace();
    } catch {
      setError("claim_failed");
    } finally {
      setBusy(false);
    }
  }

  if (ambiguousReference) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
        <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Davet ve ödeme oturumu birlikte kullanılamaz. Destek için iletişime geçin.
        </p>
      </div>
    );
  }

  if (!claimReference) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
        <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Bağlanacak davet veya ödeme oturumu bulunamadı. Destek için iletişime geçin.
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

  if (error && !status) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
        <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
        <p className="text-xs leading-relaxed text-destructive">Hata: {describeOnboardingBlockingReason(error)}</p>
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

  if (status?.claimable && status.invitedEmail) {
    return (
      <form className="flex flex-col gap-4" onSubmit={(event) => void onCreateAccount(event)} noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="onboarding-invited-email" className="text-xs font-semibold text-foreground">
            Davet e-postası
          </label>
          <input
            id="onboarding-invited-email"
            type="email"
            value={status.invitedEmail}
            readOnly
            aria-readonly="true"
            data-testid="onboarding-invited-email"
            className="min-w-0 rounded-md border border-input bg-muted/50 px-3 py-2.5 text-sm text-foreground"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="onboarding-password" className="text-xs font-semibold text-foreground">
            Şifre
          </label>
          <input
            id="onboarding-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            disabled={busy || passwordReady}
            data-testid="onboarding-password"
            className="min-w-0 rounded-md border border-input bg-background px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="onboarding-password-confirm" className="text-xs font-semibold text-foreground">
            Şifre tekrar
          </label>
          <input
            id="onboarding-password-confirm"
            type="password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            autoComplete="new-password"
            disabled={busy || passwordReady}
            data-testid="onboarding-password-confirm"
            className="min-w-0 rounded-md border border-input bg-background px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
        </div>
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5" role="alert">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
            <p className="text-xs leading-relaxed text-destructive">{error}</p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Şifrenizi belirleyin. Başarılı kurulumdan sonra AIya çalışma alanınız bu hesaba bağlanır.
          </p>
        )}
        <button
          type="submit"
          disabled={busy || (!passwordReady && (!password || !passwordConfirmation))}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="onboarding-create-account"
        >
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <LayoutDashboard size={16} />}
          {busy ? "Hesap oluşturuluyor..." : "Hesabımı oluştur"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
      <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
      <p className="text-xs leading-relaxed text-destructive">
        Hata veya bekleyen durum: {describeOnboardingBlockingReason(error ?? status?.blockingReasons?.[0] ?? "onboarding_claim_blocked")}
      </p>
    </div>
  );
}

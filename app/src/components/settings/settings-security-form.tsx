"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, TextInput } from "@/components/ui";
import type { DashboardMessageKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import type { SettingsAccountReadModel } from "@/lib/phase-85-stage-4d-settings-contracts";
import { useShellDirtyRegistration } from "@/lib/use-shell-dirty-registration";
import type { ShellDirtyEntryState } from "@/lib/phase-85-stage-5-shell-dirty-registry";

type Step = "idle" | "reauth_sent" | "saving";

export function SettingsSecurityForm({
  model,
  uiLanguage,
}: {
  model: SettingsAccountReadModel;
  uiLanguage: SupportedLanguageCode;
}) {
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [nonce, setNonce] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isDirty = Boolean(
    newEmail.trim() || password.trim() || passwordConfirmation.trim() || nonce.trim(),
  );
  const dirtyState: ShellDirtyEntryState = busy
    ? "saving"
    : error
      ? "error"
      : isDirty
        ? "dirty"
        : "clean";

  useShellDirtyRegistration({
    id: "settings-security",
    label: "Güvenlik",
    state: dirtyState,
    canSave: false,
    onDiscard: () => {
      setNewEmail("");
      setPassword("");
      setPasswordConfirmation("");
      setNonce("");
      setStep("idle");
      setError(null);
      setSuccess(null);
    },
    onFocusField: () => {
      document.getElementById("settings-security-new-email")?.focus();
    },
  });

  const mapError = useCallback(
    (code?: string, fallbackKey: DashboardMessageKey = "settingsSecurityActionFailed") => {
      if (!code) return t(uiLanguage, fallbackKey);
      const key = `settingsSecurityError_${code}` as DashboardMessageKey;
      return t(uiLanguage, key) || t(uiLanguage, fallbackKey);
    },
    [uiLanguage],
  );

  const onRequestReauth = useCallback(async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/auth/reauthenticate", { method: "POST" });
      const data = (await response.json()) as { error?: string; sent?: boolean };
      if (!response.ok) {
        setError(mapError(data.error, "settingsSecurityReauthFailed"));
        return;
      }
      setStep("reauth_sent");
      setSuccess(t(uiLanguage, "settingsSecurityReauthSent"));
    } catch {
      setError(t(uiLanguage, "settingsSecurityReauthFailed"));
    } finally {
      setBusy(false);
    }
  }, [mapError, uiLanguage]);

  const onSavePassword = useCallback(async () => {
    if (!password.trim()) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, string> = {
        password,
        passwordConfirmation,
      };
      if (nonce.trim()) {
        payload.nonce = nonce.trim();
      }
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; auditWarning?: string };
      if (!response.ok) {
        setError(mapError(data.error, "settingsSecurityPasswordFailed"));
        return;
      }
      setPassword("");
      setPasswordConfirmation("");
      setNonce("");
      setStep("idle");
      setSuccess(
        data.auditWarning
          ? t(uiLanguage, "settingsSecurityPasswordSavedAuditWarning")
          : t(uiLanguage, "settingsSecurityPasswordSaved"),
      );
      router.refresh();
    } catch {
      setError(t(uiLanguage, "settingsSecurityPasswordFailed"));
    } finally {
      setBusy(false);
    }
  }, [mapError, nonce, password, passwordConfirmation, router, uiLanguage]);

  const onRequestEmailChange = useCallback(async () => {
    if (!newEmail.trim()) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/auth/email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });
      const data = (await response.json()) as { error?: string; auditWarning?: string };
      if (!response.ok) {
        setError(mapError(data.error, "settingsSecurityEmailFailed"));
        return;
      }
      setNewEmail("");
      setSuccess(
        data.auditWarning
          ? t(uiLanguage, "settingsSecurityEmailPendingAuditWarning")
          : t(uiLanguage, "settingsSecurityEmailPending"),
      );
    } catch {
      setError(t(uiLanguage, "settingsSecurityEmailFailed"));
    } finally {
      setBusy(false);
    }
  }, [mapError, newEmail, uiLanguage]);

  const onRequestPasswordReset = useCallback(async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (response.status === 202) {
        setSuccess(t(uiLanguage, "settingsSecurityResetAccepted"));
        return;
      }
      const data = (await response.json()) as { error?: string };
      setError(mapError(data.error, "settingsSecurityResetFailed"));
    } catch {
      setError(t(uiLanguage, "settingsSecurityResetFailed"));
    } finally {
      setBusy(false);
    }
  }, [mapError, uiLanguage]);

  if (model.runtime.mode === "fallback" || !model.runtime.identityActionsAvailable) {
    return null;
  }

  return (
    <div data-testid="settings-security-form" data-dirty={isDirty ? "true" : "false"} className="space-y-6">
      <dl>
        <div className="flex min-w-0 flex-col gap-1 border-b border-line py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <dt className="shrink-0 text-sm font-medium text-ink-muted">{t(uiLanguage, "settingsSecurityEmail")}</dt>
          <dd className="min-w-0 break-words text-sm font-semibold text-ink sm:text-right">
            {model.security.emailMasked || "—"}
          </dd>
        </div>
      </dl>

      <section className="space-y-3" aria-labelledby="settings-security-email-heading">
        <h3 id="settings-security-email-heading" className="text-sm font-semibold text-ink">
          {t(uiLanguage, "settingsSecurityEmailChangeHeading")}
        </h3>
        <p className="text-xs leading-5 text-ink-muted">{t(uiLanguage, "settingsSecurityEmailChangeHint")}</p>
        <Field label={t(uiLanguage, "settingsSecurityNewEmail")} htmlFor="settings-security-new-email">
          <TextInput
            id="settings-security-new-email"
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            disabled={busy}
            autoComplete="email"
          />
        </Field>
        <Button type="button" onClick={onRequestEmailChange} disabled={busy || !newEmail.trim()} data-testid="settings-security-email-save">
          {t(uiLanguage, "settingsSecurityEmailChangeSubmit")}
        </Button>
      </section>

      <section className="space-y-3" aria-labelledby="settings-security-password-heading">
        <h3 id="settings-security-password-heading" className="text-sm font-semibold text-ink">
          {t(uiLanguage, "settingsSecurityPasswordHeading")}
        </h3>
        <p className="text-xs leading-5 text-ink-muted">{t(uiLanguage, "settingsSecurityPasswordHint")}</p>
        <Button type="button" variant="secondary" onClick={onRequestReauth} disabled={busy} data-testid="settings-security-reauth">
          {t(uiLanguage, "settingsSecurityReauthRequest")}
        </Button>
        {step === "reauth_sent" ? (
          <Field label={t(uiLanguage, "settingsSecurityNonce")} htmlFor="settings-security-nonce">
            <TextInput
              id="settings-security-nonce"
              value={nonce}
              onChange={(event) => setNonce(event.target.value)}
              disabled={busy}
              autoComplete="one-time-code"
            />
          </Field>
        ) : null}
        <Field label={t(uiLanguage, "settingsSecurityNewPassword")} htmlFor="settings-security-password">
          <TextInput
            id="settings-security-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            autoComplete="new-password"
          />
        </Field>
        <Field label={t(uiLanguage, "settingsSecurityConfirmPassword")} htmlFor="settings-security-password-confirm">
          <TextInput
            id="settings-security-password-confirm"
            type="password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            disabled={busy}
            autoComplete="new-password"
          />
        </Field>
        <Button
          type="button"
          onClick={onSavePassword}
          disabled={busy || !password || password !== passwordConfirmation}
          data-testid="settings-security-password-save"
        >
          {t(uiLanguage, "settingsSecurityPasswordSubmit")}
        </Button>
      </section>

      <section className="space-y-3" aria-labelledby="settings-security-reset-heading">
        <h3 id="settings-security-reset-heading" className="text-sm font-semibold text-ink">
          {t(uiLanguage, "settingsSecurityResetHeading")}
        </h3>
        <p className="text-xs leading-5 text-ink-muted">{t(uiLanguage, "settingsSecurityResetHint")}</p>
        <Button type="button" variant="secondary" onClick={onRequestPasswordReset} disabled={busy} data-testid="settings-security-reset">
          {t(uiLanguage, "settingsSecurityResetSubmit")}
        </Button>
      </section>

      {error ? (
        <p className="text-sm font-medium text-red-700" role="alert" data-testid="settings-security-error">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm font-medium text-emerald-800" role="status" data-testid="settings-security-success">
          {success}
        </p>
      ) : null}
    </div>
  );
}

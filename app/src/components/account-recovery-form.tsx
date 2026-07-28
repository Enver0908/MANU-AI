"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, TextInput } from "@/components/ui";

export function AccountRecoveryForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!password || password !== passwordConfirmation) {
        setError("Parolalar eşleşmiyor.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/auth/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, passwordConfirmation }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(mapRecoveryError(data.error));
          return;
        }
        setSuccess(true);
        router.replace("/dashboard");
      } catch {
        setError("Parola kaydedilemedi. Bağlantı süresi dolmuş olabilir; yeni sıfırlama isteyin.");
      } finally {
        setBusy(false);
      }
    },
    [password, passwordConfirmation, router],
  );

  if (success) {
    return (
      <p className="text-sm text-ink-muted" role="status">
        Parola güncellendi. Yönlendiriliyorsunuz...
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="account-recovery-form" noValidate>
      <Field label="Yeni parola" htmlFor="account-recovery-password" required>
        <TextInput
          id="account-recovery-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Parolayı onayla" htmlFor="account-recovery-password-confirm" required>
        <TextInput
          id="account-recovery-password-confirm"
          type="password"
          value={passwordConfirmation}
          onChange={(event) => setPasswordConfirmation(event.target.value)}
          disabled={busy}
          autoComplete="new-password"
        />
      </Field>
      {error ? (
        <p className="text-sm font-medium text-red-700" role="alert" data-testid="account-recovery-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || !password} data-testid="account-recovery-submit">
        {busy ? "Kaydediliyor..." : "Yeni parolayı kaydet"}
      </Button>
    </form>
  );
}

function mapRecoveryError(code?: string) {
  switch (code) {
    case "weak_password":
    case "invalid_password":
      return "Parola en az 12 karakter olmalı; büyük harf, küçük harf, rakam ve sembol içermelidir.";
    case "password_mismatch":
      return "Parolalar eşleşmiyor.";
    case "recovery_expired":
    case "invalid_or_expired_nonce":
      return "Kurtarma bağlantısı süresi doldu. Yeni sıfırlama bağlantısı isteyin.";
    case "unauthenticated":
      return "Oturum bulunamadı. E-postadaki kurtarma bağlantısını tekrar açın.";
    default:
      return "Parola kaydedilemedi. Tekrar deneyin veya yeni sıfırlama isteyin.";
  }
}

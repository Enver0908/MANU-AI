"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, SelectInput, TextInput } from "@/components/ui";
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from "@/lib/languages";
import type { DashboardMessageKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { COMMON_PROFILE_TIMEZONES } from "@/lib/phase-85-stage-4d-own-profile";
import type { SettingsAccountReadModel } from "@/lib/phase-85-stage-4d-settings-contracts";
import { authenticatedMutationFetch } from "@/lib/phase-85-stage-5-shell-authenticated-mutation";
import { useShellDirtyRegistration } from "@/lib/use-shell-dirty-registration";
import type { ShellDirtyEntryState } from "@/lib/phase-85-stage-5-shell-dirty-registry";

type ProfileFormState = {
  displayName: string;
  uiLanguage: SupportedLanguageCode;
  timezone: string;
};

export function SettingsProfileForm({
  model,
  uiLanguage,
}: {
  model: SettingsAccountReadModel;
  uiLanguage: SupportedLanguageCode;
}) {
  const router = useRouter();
  const displayNameRef = useRef<HTMLInputElement>(null);
  const initial = useMemo<ProfileFormState>(
    () => ({
      displayName: model.profile.displayName,
      uiLanguage: model.profile.uiLanguage,
      timezone: model.profile.timezone,
    }),
    [model.profile.displayName, model.profile.timezone, model.profile.uiLanguage],
  );
  const [form, setForm] = useState<ProfileFormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty =
    form.displayName.trim() !== initial.displayName.trim() ||
    form.uiLanguage !== initial.uiLanguage ||
    form.timezone !== initial.timezone;

  const dirtyState: ShellDirtyEntryState = saving
    ? "saving"
    : error
      ? "error"
      : isDirty
        ? "dirty"
        : "clean";

  const onSave = useCallback(async () => {
    if (!isDirty || saving) return false;
    setSaving(true);
    setError(null);
    setSuccess(false);

    const payload: { displayName?: string; uiLanguage?: SupportedLanguageCode; timezone?: string } = {};
    if (form.displayName.trim() !== initial.displayName.trim()) {
      payload.displayName = form.displayName.trim();
    }
    if (form.uiLanguage !== initial.uiLanguage) {
      payload.uiLanguage = form.uiLanguage;
    }
    if (form.timezone !== initial.timezone) {
      payload.timezone = form.timezone;
    }

    try {
      const response = await authenticatedMutationFetch("/api/account/profile", {
        method: "PATCH",
        mutationKind: "save",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; profile?: ProfileFormState };
      if (!response.ok) {
        const key = `settingsProfileError_${data.error}` as DashboardMessageKey;
        setError(t(uiLanguage, key) || t(uiLanguage, "settingsProfileSaveFailed"));
        return false;
      }
      if (data.profile) {
        setForm({
          displayName: data.profile.displayName,
          uiLanguage: data.profile.uiLanguage,
          timezone: data.profile.timezone,
        });
      }
      setSuccess(true);
      router.refresh();
      return true;
    } catch {
      setError(t(uiLanguage, "settingsProfileSaveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [form, initial, isDirty, router, saving, uiLanguage]);

  useShellDirtyRegistration({
    id: "settings-profile",
    label: "Profil",
    state: dirtyState,
    canSave: isDirty,
    onSave,
    onDiscard: () => {
      setForm(initial);
      setError(null);
      setSuccess(false);
    },
    onFocusField: () => displayNameRef.current?.focus(),
  });

  if (model.runtime.mode === "fallback" || !model.runtime.identityActionsAvailable) {
    return null;
  }

  return (
    <div data-testid="settings-profile-form" data-dirty={isDirty ? "true" : "false"} className="space-y-4">
      <Field label={t(uiLanguage, "settingsProfileDisplayName")} htmlFor="settings-profile-display-name" required>
        <TextInput
          id="settings-profile-display-name"
          ref={displayNameRef}
          value={form.displayName}
          onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
          maxLength={80}
          disabled={saving}
        />
      </Field>

      <Field label={t(uiLanguage, "settingsProfileTimezone")} htmlFor="settings-profile-timezone" required>
        <SelectInput
          id="settings-profile-timezone"
          value={form.timezone}
          onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
          disabled={saving}
        >
          {COMMON_PROFILE_TIMEZONES.map((timezone) => (
            <option key={timezone} value={timezone}>
              {timezone}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label={t(uiLanguage, "settingsProfileLanguage")} htmlFor="settings-profile-language" required>
        <SelectInput
          id="settings-profile-language"
          value={form.uiLanguage}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              uiLanguage: event.target.value as SupportedLanguageCode,
            }))
          }
          disabled={saving}
        >
          {SUPPORTED_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.nativeLabel}
            </option>
          ))}
        </SelectInput>
      </Field>

      {error ? (
        <p className="text-sm font-medium text-red-700" role="alert" data-testid="settings-profile-error">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm font-medium text-emerald-800" role="status" data-testid="settings-profile-success">
          {t(uiLanguage, "settingsProfileSaveSuccess")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={!isDirty || saving}
          data-testid="settings-profile-save"
        >
          {saving ? t(uiLanguage, "settingsProfileSaving") : t(uiLanguage, "settingsProfileSave")}
        </Button>
        {isDirty ? (
          <p className="text-xs text-ink-muted" role="status">
            {t(uiLanguage, "settingsProfileUnsaved")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

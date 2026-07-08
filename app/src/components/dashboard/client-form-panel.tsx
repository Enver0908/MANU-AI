"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Check, Save } from "lucide-react";
import { getActiveFormSchema } from "@/lib/client-forms";
import {
  buildClientFormAnswersPayload,
  buildInitialClientFormAnswers,
  formatSectionLabel,
  getPromptAccessLabel,
  getPromptAccessTone,
  groupFormFieldsBySection,
  hasFormFieldValue,
  isAutopilotRequiredField,
  serializeFieldValueForInput,
  summarizeAutopilotFieldStatus,
} from "@/lib/client-form-panel-helpers";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import type { ClientFormFieldDefinition, ClientFormResponseRecord, ClientRecord, ManuAppState } from "@/lib/types";
import { MOBILE_FIELD_CLASS } from "@/lib/phase-83e5-mobile-ergonomics";
import { Badge, EmptyState, SelectInput } from "./shared";

export function ClientFormPanel({
  client,
  state,
  uiLanguage,
  onSave,
}: {
  client: ClientRecord;
  state: ManuAppState;
  uiLanguage: SupportedLanguageCode;
  onSave: (input: {
    clientId: string;
    schemaId: string;
    answers: Record<string, unknown>;
    submittedPhoneE164?: string;
  }) => Promise<void>;
}) {
  const activeSchema = getActiveFormSchema(state);
  const existingResponse = useMemo(() => {
    if (!activeSchema) return null;
    return (
      state.clientFormResponses.find(
        (item) => item.clientId === client.id && item.schemaId === activeSchema.id,
      ) || null
    );
  }, [activeSchema, client.id, state.clientFormResponses]);

  const draftKey = `${client.id}:${existingResponse?.updatedAt || "new"}`;
  const initialAnswers = useMemo(
    () => buildInitialClientFormAnswers(client, existingResponse),
    [client, existingResponse],
  );

  if (!activeSchema) {
    return <EmptyState message="Yanıt kaydetmeden önce yayınlanmış bir danışan form şeması gerekir." />;
  }

  return (
    <ClientFormPanelEditor
      key={draftKey}
      client={client}
      uiLanguage={uiLanguage}
      activeSchema={activeSchema}
      existingResponse={existingResponse}
      initialAnswers={initialAnswers}
      onSave={onSave}
    />
  );
}

function ClientFormPanelEditor({
  client,
  uiLanguage,
  activeSchema,
  existingResponse,
  initialAnswers,
  onSave,
}: {
  client: ClientRecord;
  uiLanguage: SupportedLanguageCode;
  activeSchema: NonNullable<ReturnType<typeof getActiveFormSchema>>;
  existingResponse: ClientFormResponseRecord | null;
  initialAnswers: Record<string, unknown>;
  onSave: (input: {
    clientId: string;
    schemaId: string;
    answers: Record<string, unknown>;
    submittedPhoneE164?: string;
  }) => Promise<void>;
}) {
  const [draftAnswers, setDraftAnswers] = useState(initialAnswers);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sections = groupFormFieldsBySection(activeSchema.fields);
  const autopilotStatus = summarizeAutopilotFieldStatus(activeSchema.fields, draftAnswers);
  const disabled = client.lifecycleStatus === "removed_anonymized";

  const updateField = (fieldId: string, value: unknown) => {
    setDraftAnswers((current) => ({ ...current, [fieldId]: value }));
    setSaveError(null);
  };

  const handleSave = async () => {
    if (disabled || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        clientId: client.id,
        schemaId: activeSchema.id,
        answers: buildClientFormAnswersPayload(activeSchema.fields, draftAnswers),
        submittedPhoneE164: client.primaryPhoneE164 || undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "form_save_failed";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="client-form-panel">
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-stone-900">{activeSchema.title}</h4>
            <p className="mt-1 text-sm text-stone-600">
              v{activeSchema.version} · {activeSchema.languageCode.toUpperCase()}
              {existingResponse ? ` · Son güncelleme ${new Date(existingResponse.updatedAt).toLocaleString("tr-TR")}` : " · Henüz kayıtlı yanıt yok"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              label={`Autopilot ${autopilotStatus.complete}/${autopilotStatus.total}`}
              tone={autopilotStatus.missing.length === 0 ? "emerald" : "amber"}
            />
            {autopilotStatus.missing.length > 0 && (
              <Badge label={`${autopilotStatus.missing.length} eksik`} tone="amber" />
            )}
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Aktif Phase 77C şeması bölüm bölüm düzenlenir. AI prompt alanları, diyetisyen-only alanlar ve autopilot zorunlu alanlar ayrı etiketlenir.
        </p>
      </div>

      {sections.map(([sectionKey, fields]) => (
        <fieldset key={sectionKey} className="rounded-lg border border-stone-200 p-4">
          <legend className="px-1 text-sm font-semibold text-stone-900">{formatSectionLabel(sectionKey)}</legend>
          <div className="mt-3 grid gap-4 xl:grid-cols-2">
            {fields.map((field) => (
              <ClientFormFieldEditor
                key={field.id}
                field={field}
                value={draftAnswers[field.id]}
                disabled={disabled}
                onChange={(value) => updateField(field.id, value)}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {saveError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>Kayıt başarısız: {saveError}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || isSaving}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="client-form-save"
        >
          {isSaving ? <Save size={16} className="animate-pulse" /> : <Check size={16} />}
          {t(uiLanguage, "saveResponse")}
        </button>
        {disabled && <p className="text-sm text-stone-500">Anonimleştirilmiş danışan kayıtları düzenlenemez.</p>}
      </div>
    </div>
  );
}

function ClientFormFieldEditor({
  field,
  value,
  disabled,
  onChange,
}: {
  field: ClientFormFieldDefinition;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const promptAccess = field.promptAccess || (field.llmVisibility === "prompt_allowed" ? "prompt_allowed" : "dietitian_only");
  const missing = (field.required || isAutopilotRequiredField(field.id)) && !hasFormFieldValue(value);
  const inputValue = serializeFieldValueForInput(field, value);

  return (
    <div className="space-y-2" data-testid={`client-form-field-${field.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-stone-800">
          {field.label}
          {field.required ? " *" : ""}
        </p>
        <Badge label={getPromptAccessLabel(promptAccess)} tone={getPromptAccessTone(promptAccess)} />
        {isAutopilotRequiredField(field.id) && <Badge label="Autopilot" tone="amber" />}
        {missing && <Badge label="Eksik" tone="red" />}
      </div>

      {field.type === "textarea" ? (
        <textarea
          value={String(inputValue)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className={`${MOBILE_FIELD_CLASS} resize-y leading-6`}
        />
      ) : field.type === "select" && field.options?.length ? (
        <SelectInput
          label=""
          value={String(inputValue)}
          onChange={onChange}
          options={[["", "Seçin"], ...field.options.map((option) => [option, option] as [string, string])]}
        />
      ) : field.type === "multiselect" && field.options?.length ? (
        <div className="grid gap-2 rounded-lg border border-stone-200 bg-white p-3">
          {field.options.map((option) => {
            const selected = Array.isArray(inputValue) ? inputValue.includes(option) : false;
            return (
              <label key={option} className="flex min-h-11 items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={disabled}
                  onChange={(event) => {
                    const current = Array.isArray(inputValue) ? inputValue : [];
                    onChange(
                      event.target.checked
                        ? [...current, option]
                        : current.filter((item) => item !== option),
                    );
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      ) : field.type === "date" ? (
        <label className="block text-sm font-medium text-stone-700">
          <input
            type="date"
            value={String(inputValue)}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-base outline-none transition focus:border-emerald-700 sm:text-sm"
          />
        </label>
      ) : field.type === "number" ? (
        <input
          type="number"
          value={String(inputValue)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={MOBILE_FIELD_CLASS}
        />
      ) : (
        <input
          type="text"
          value={String(inputValue)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={MOBILE_FIELD_CLASS}
        />
      )}
    </div>
  );
}

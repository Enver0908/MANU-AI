"use client";

import { useId, useMemo, useRef, useState } from "react";
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
import type { ClientFormFieldDefinition, ClientRecord, ManuAppState } from "@/lib/types";
import type { Stage6FormRead, Stage6FormSchemaDto } from "@/lib/phase-85-stage-6-dashboard-contracts";
import { MOBILE_FIELD_CLASS } from "@/lib/phase-83e5-mobile-ergonomics";
import { Badge, EmptyState, SelectInput } from "./shared";
import { useShellDirtyRegistration } from "@/lib/use-shell-dirty-registration";
import type { ShellDirtyEntryState } from "@/lib/phase-85-stage-5-shell-dirty-registry";
import {
  classifyStage6EditorFailure,
  stage6EditorFailureMessage,
  type Stage6EditorFailure,
} from "@/lib/phase-85-stage-6-workspace-state";

export function ClientFormPanel({
  client,
  state,
  formRead,
  uiLanguage,
  onSave,
}: {
  client: ClientRecord;
  state: ManuAppState;
  formRead?: Stage6FormRead | null;
  uiLanguage: SupportedLanguageCode;
  onSave: (input: {
    clientId: string;
    schemaId: string;
    answers: Record<string, unknown>;
    submittedPhoneE164?: string;
  }) => Promise<void>;
}) {
  const activeSchema = formRead === undefined ? getActiveFormSchema(state) : formRead?.schema ?? null;
  const existingResponse = useMemo(() => {
    if (!activeSchema) return null;
    if (formRead !== undefined) return formRead?.response ?? null;
    return (
      state.clientFormResponses.find(
        (item) => item.clientId === client.id && item.schemaId === activeSchema.id,
      ) || null
    );
  }, [activeSchema, client.id, formRead, state.clientFormResponses]);

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
  activeSchema: Stage6FormSchemaDto;
  existingResponse: Stage6FormRead["response"];
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
  const [saveFailure, setSaveFailure] = useState<Stage6EditorFailure | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  const sections = groupFormFieldsBySection(activeSchema.fields);
  const autopilotStatus = summarizeAutopilotFieldStatus(activeSchema.fields, draftAnswers);
  const disabled = client.lifecycleStatus === "removed_anonymized";
  const isDirty = JSON.stringify(draftAnswers) !== JSON.stringify(initialAnswers);
  const dirtyState: ShellDirtyEntryState = isSaving
    ? "saving"
    : saveFailure
      ? "error"
      : isDirty
        ? "dirty"
        : "clean";

  useShellDirtyRegistration({
    id: `client-form:${client.id}:${activeSchema.id}`,
    label: "Danışan formu",
    state: dirtyState,
    canSave: isDirty && !disabled,
    onSave: async () => {
      if (disabled || isSaving) return false;
      setIsSaving(true);
      setSaveFailure(null);
      try {
        await onSave({
          clientId: client.id,
          schemaId: activeSchema.id,
          answers: buildClientFormAnswersPayload(activeSchema.fields, draftAnswers),
          submittedPhoneE164: client.primaryPhoneE164 || undefined,
        });
        return true;
      } catch (error) {
        setSaveFailure(classifyStage6EditorFailure(error, "form_save_failed"));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    onDiscard: () => {
      setDraftAnswers(initialAnswers);
      setSaveFailure(null);
    },
    onFocusField: () => saveButtonRef.current?.focus(),
  });

  const updateField = (fieldId: string, value: unknown) => {
    setDraftAnswers((current) => ({ ...current, [fieldId]: value }));
    setSaveFailure(null);
  };

  const handleSave = async () => {
    if (disabled || isSaving) return;
    setIsSaving(true);
    setSaveFailure(null);
    try {
      await onSave({
        clientId: client.id,
        schemaId: activeSchema.id,
        answers: buildClientFormAnswersPayload(activeSchema.fields, draftAnswers),
        submittedPhoneE164: client.primaryPhoneE164 || undefined,
      });
    } catch (error) {
      setSaveFailure(classifyStage6EditorFailure(error, "form_save_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 min-[768px]:pb-8" data-testid="client-form-panel">
      <div className="rounded-card border border-line bg-surface-muted p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-ink">{activeSchema.title}</h4>
            <p className="mt-1 text-sm text-ink-muted">
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
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Aktif Phase 77C şeması bölüm bölüm düzenlenir. AI prompt alanları, diyetisyen-only alanlar ve autopilot zorunlu alanlar ayrı etiketlenir.
        </p>
      </div>

      {sections.map(([sectionKey, fields]) => (
        <fieldset key={sectionKey} className="rounded-card border border-line p-4">
          <legend className="px-1 text-sm font-semibold text-ink">{formatSectionLabel(sectionKey)}</legend>
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

      {saveFailure && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 rounded-card border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{stage6EditorFailureMessage(saveFailure)}</p>
        </div>
      )}

      <div className="sticky z-20 mt-2 flex flex-wrap items-center gap-3 border-t border-line bg-surface py-3 max-[767px]:bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] min-[768px]:bottom-0">
        <button
          ref={saveButtonRef}
          type="button"
          onClick={handleSave}
          disabled={disabled || isSaving}
          className="inline-flex min-h-11 items-center gap-2 rounded-control bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-alt disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="client-form-save"
        >
          {isSaving ? <Save size={16} className="animate-pulse" /> : <Check size={16} />}
          {t(uiLanguage, "saveResponse")}
        </button>
        {disabled && <p className="text-sm text-ink-subtle">Anonimleştirilmiş danışan kayıtları düzenlenemez.</p>}
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
  const labelId = useId();

  return (
    <div className="space-y-2" data-testid={`client-form-field-${field.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p id={labelId} className="text-sm font-medium text-ink">
          {field.label}
          {field.required ? " *" : ""}
        </p>
        <Badge label={getPromptAccessLabel(promptAccess)} tone={getPromptAccessTone(promptAccess)} />
        {isAutopilotRequiredField(field.id) && <Badge label="Autopilot" tone="amber" />}
        {missing && <Badge label="Eksik" tone="red" />}
      </div>

      {field.type === "textarea" ? (
        <textarea
          aria-labelledby={labelId}
          value={String(inputValue)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className={`${MOBILE_FIELD_CLASS} resize-y leading-6`}
        />
      ) : field.type === "select" && field.options?.length ? (
        <SelectInput
          label=""
          ariaLabelledBy={labelId}
          value={String(inputValue)}
          onChange={onChange}
          options={[["", "Seçin"], ...field.options.map((option) => [option, option] as [string, string])]}
        />
      ) : field.type === "multiselect" && field.options?.length ? (
        <div
          role="group"
          aria-labelledby={labelId}
          className="grid gap-2 rounded-card border border-line bg-surface p-3"
        >
          {field.options.map((option) => {
            const selected = Array.isArray(inputValue) ? inputValue.includes(option) : false;
            return (
              <label key={option} className="flex min-h-11 items-center gap-2 text-sm text-ink">
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
        <label className="block text-sm font-medium text-ink">
          <input
            aria-labelledby={labelId}
            type="date"
            value={String(inputValue)}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-card border border-line bg-surface px-3 py-2 text-base outline-none transition focus:border-primary sm:text-sm"
          />
        </label>
      ) : field.type === "number" ? (
        <input
          aria-labelledby={labelId}
          type="number"
          value={String(inputValue)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={MOBILE_FIELD_CLASS}
        />
      ) : (
        <input
          aria-labelledby={labelId}
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

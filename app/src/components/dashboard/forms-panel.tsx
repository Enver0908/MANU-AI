"use client";

import { Check, Plus } from "lucide-react";
import type { ClientRecord, ManuAppState } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import { Badge, SelectInput, TextInput, TextareaInput, languageOptions } from "./shared";

export function FormsPanel({
  state,
  selectedClient,
  schemaTitle,
  schemaLanguage,
  schemaFieldsRaw,
  formAnswersRaw,
  uiLanguage,
  onSchemaTitle,
  onSchemaLanguage,
  onSchemaFieldsRaw,
  onFormAnswersRaw,
  onCreateSchema,
  onPublishSchema,
  onSaveResponse,
}: {
  state: ManuAppState;
  selectedClient: ClientRecord;
  schemaTitle: string;
  schemaLanguage: SupportedLanguageCode;
  schemaFieldsRaw: string;
  formAnswersRaw: string;
  uiLanguage: SupportedLanguageCode;
  onSchemaTitle: (value: string) => void;
  onSchemaLanguage: (value: SupportedLanguageCode) => void;
  onSchemaFieldsRaw: (value: string) => void;
  onFormAnswersRaw: (value: string) => void;
  onCreateSchema: () => void;
  onPublishSchema: (schemaId: string) => Promise<ManuAppState>;
  onSaveResponse: () => void;
}) {
  const activeSchema = [...state.clientFormSchemas]
    .filter((schema) => schema.status === "published")
    .sort((a, b) => b.version - a.version)[0];
  const response = activeSchema
    ? state.clientFormResponses.find((item) => item.clientId === selectedClient.id && item.schemaId === activeSchema.id)
    : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-xl font-semibold">Dinamik form şemaları</h3>
        <div className="mt-3 space-y-3">
          <TextInput label="Şema başlığı" value={schemaTitle} onChange={onSchemaTitle} />
          <SelectInput
            label={t(uiLanguage, "formLanguage")}
            value={schemaLanguage}
            onChange={(value) => onSchemaLanguage(value as SupportedLanguageCode)}
            options={languageOptions}
          />
          <TextareaInput label="Alanlar" value={schemaFieldsRaw} onChange={onSchemaFieldsRaw} rows={6} />
          <button
            onClick={onCreateSchema}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white"
            type="button"
          >
            <Plus size={16} />
            {t(uiLanguage, "createSchema")}
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {state.clientFormSchemas.map((schema) => (
            <div key={schema.id} className="rounded-lg border border-stone-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{schema.title}</p>
                  <p className="text-xs text-stone-500">
                    v{schema.version} · {schema.fields.length} alan · {schema.languageCode}
                  </p>
                </div>
                <Badge label={schema.status} tone={schema.status === "published" ? "emerald" : "stone"} />
              </div>
              {schema.status === "draft" && (
                <button
                  onClick={() => onPublishSchema(schema.id)}
                  className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700"
                  type="button"
                >
                  Yayınla
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-xl font-semibold">{selectedClient.fullName} form yanıtı</h3>
        {activeSchema ? (
          <>
            <p className="mt-1 text-sm text-stone-600">
              {activeSchema.title} v{activeSchema.version} · {activeSchema.languageCode}
            </p>
            <p className="text-sm text-stone-500">
              Besin kuralları ve menü planı artık danışan detay sekmelerinden yönetilir.
            </p>
            <TextareaInput
              label="Diğer form yanıtları (anahtar: değer)"
              value={formAnswersRaw}
              onChange={onFormAnswersRaw}
              rows={6}
            />
            <button
              onClick={onSaveResponse}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white"
              type="button"
            >
              <Check size={16} />
              {t(uiLanguage, "saveResponse")}
            </button>
            {response && (
              <pre className="mt-4 overflow-auto rounded-lg bg-stone-100 p-3 text-xs text-stone-700">
                {JSON.stringify(response.answers, null, 2)}
              </pre>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-stone-500">Yanıt kaydetmeden önce bir form şeması yayınlayın.</p>
        )}
      </section>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import type { ManuAppState, ClientRecord } from "@/lib/types";
import type { SupportedLanguageCode } from "@/lib/languages";
import { getActiveFormSchema } from "@/lib/client-forms";
import { parseAnswerLines, parseSchemaFields } from "@/components/dashboard/shared";
import { FormsPanel } from "@/components/dashboard/forms-panel";

export function FormsRoute({
  state,
  selectedClient,
  uiLanguage,
  onCreateFormSchema,
  onPublishFormSchema,
  onSaveFormResponse,
}: {
  state: ManuAppState;
  selectedClient: ClientRecord;
  uiLanguage: SupportedLanguageCode;
  onCreateFormSchema: (input: {
    title: string;
    fields: ReturnType<typeof parseSchemaFields>;
    languageCode: SupportedLanguageCode;
  }) => Promise<ManuAppState>;
  onPublishFormSchema: (schemaId: string) => Promise<ManuAppState>;
  onSaveFormResponse: (input: {
    clientId: string;
    schemaId: string;
    answers: Record<string, unknown>;
    submittedPhoneE164?: string;
  }) => Promise<ManuAppState>;
}) {
  const [schemaTitle, setSchemaTitle] = useState("Client intake");
  const [schemaLanguage, setSchemaLanguage] = useState<SupportedLanguageCode>("tr");
  const [schemaFieldsRaw, setSchemaFieldsRaw] = useState("daily_routine | Daily routine | textarea | prompt_allowed");
  const [formAnswersRaw, setFormAnswersRaw] = useState("");

  const createSchema = useCallback(async () => {
    const fields = parseSchemaFields(schemaFieldsRaw);
    if (!schemaTitle.trim() || fields.length === 0) return;
    await onCreateFormSchema({ title: schemaTitle, fields, languageCode: schemaLanguage });
  }, [onCreateFormSchema, schemaFieldsRaw, schemaLanguage, schemaTitle]);

  const saveResponse = useCallback(async () => {
    const activeSchema = getActiveFormSchema(state);
    if (!activeSchema) return;
    await onSaveFormResponse({
      clientId: selectedClient.id,
      schemaId: activeSchema.id,
      answers: parseAnswerLines(formAnswersRaw),
      submittedPhoneE164: selectedClient.primaryPhoneE164 || undefined,
    });
    setFormAnswersRaw("");
  }, [formAnswersRaw, onSaveFormResponse, selectedClient, state]);

  return (
    <FormsPanel
      state={state}
      selectedClient={selectedClient}
      schemaTitle={schemaTitle}
      schemaLanguage={schemaLanguage}
      schemaFieldsRaw={schemaFieldsRaw}
      formAnswersRaw={formAnswersRaw}
      uiLanguage={uiLanguage}
      onSchemaTitle={setSchemaTitle}
      onSchemaLanguage={setSchemaLanguage}
      onSchemaFieldsRaw={setSchemaFieldsRaw}
      onFormAnswersRaw={setFormAnswersRaw}
      onCreateSchema={createSchema}
      onPublishSchema={onPublishFormSchema}
      onSaveResponse={saveResponse}
    />
  );
}

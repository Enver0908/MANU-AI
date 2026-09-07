"use client";

import { useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { Channel, ClientRecord } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import { useShellDirtyRegistration } from "@/lib/use-shell-dirty-registration";
import {
  classifyStage6EditorFailure,
  stage6EditorFailureMessage,
  type Stage6EditorFailure,
} from "@/lib/phase-85-stage-6-workspace-state";
import { shellDirtyRegistry } from "@/lib/phase-85-stage-5-shell-dirty-registry";
import { ClientSummary, EmptyState, SelectInput, TextInput, languageOptions } from "./shared";

export function ClientsPanel({
  clients,
  selectedClientId,
  search,
  newClientName,
  newClientChannel,
  newClientHandle,
  newClientPhone,
  newClientLanguage,
  uiLanguage,
  onSearch,
  onSelect,
  onAddClient,
  onNewClientName,
  onNewClientChannel,
  onNewClientHandle,
  onNewClientPhone,
  onNewClientLanguage,
}: {
  clients: ClientRecord[];
  selectedClientId: string | null;
  search: string;
  newClientName: string;
  newClientChannel: Channel;
  newClientHandle: string;
  newClientPhone: string;
  newClientLanguage: SupportedLanguageCode;
  uiLanguage: SupportedLanguageCode;
  onSearch: (value: string) => void;
  onSelect: (clientId: string) => void;
  onAddClient: () => Promise<string | null>;
  onNewClientName: (value: string) => void;
  onNewClientChannel: (value: Channel) => void;
  onNewClientHandle: (value: string) => void;
  onNewClientPhone: (value: string) => void;
  onNewClientLanguage: (value: SupportedLanguageCode) => void;
}) {
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState<Stage6EditorFailure | null>(null);
  const isDirty = Boolean(
    newClientName.trim() ||
      newClientHandle.trim() ||
      newClientPhone.trim() ||
      newClientChannel !== "whatsapp" ||
      newClientLanguage !== "tr",
  );

  useShellDirtyRegistration({
    id: "client-roster-create",
    label: "Yeni danışan",
    state: isSaving ? "saving" : saveFailure ? "error" : isDirty ? "dirty" : "clean",
    canSave: Boolean(newClientName.trim()) && !isSaving,
    onSave: async () => {
      if (!newClientName.trim() || isSaving) return false;
      setIsSaving(true);
      setSaveFailure(null);
      try {
        return Boolean(await onAddClient());
      } catch (error) {
        setSaveFailure(classifyStage6EditorFailure(error, "client_create_failed"));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    onDiscard: () => {
      onNewClientName("");
      onNewClientHandle("");
      onNewClientPhone("");
      onNewClientChannel("whatsapp");
      onNewClientLanguage("tr");
      setSaveFailure(null);
    },
    onFocusField: () => addButtonRef.current?.focus(),
  });

  const handleAddClient = async () => {
    if (!newClientName.trim() || isSaving) return;
    setIsSaving(true);
    setSaveFailure(null);
    try {
      const clientId = await onAddClient();
      if (!clientId) return;
      shellDirtyRegistry.update("client-roster-create", { state: "clean", canSave: false });
      onSelect(clientId);
    } catch (error) {
      setSaveFailure(classifyStage6EditorFailure(error, "client_create_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-3" data-testid="client-roster">
      <div className="rounded-card border border-line bg-surface p-3">
        <label className="flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface-muted px-3 py-2 text-base text-ink-muted sm:text-sm">
          <Search size={16} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-subtle"
            placeholder={t(uiLanguage, "searchClients")}
          />
        </label>
      </div>

      <div className="space-y-2">
        {clients.length === 0 ? (
          <EmptyState
            title="Sonuç yok"
            message={search.trim() ? "Aramanızla eşleşen danışan bulunamadı." : "Henüz danışan yok. Aşağıdan yeni kayıt ekleyin."}
          />
        ) : (
          clients.map((client) => (
            <button
              key={client.id}
              onClick={() => onSelect(client.id)}
              className={`w-full rounded-card border p-3 text-left transition ${
                selectedClientId === client.id
                  ? "border-primary bg-primary/5"
                  : "border-line bg-surface hover:border-line-strong"
              }`}
              type="button"
              data-testid="client-roster-item"
              data-client-id={client.id}
              aria-current={selectedClientId === client.id ? "true" : undefined}
            >
              <ClientSummary client={client} />
            </button>
          ))
        )}
      </div>

      <div className="rounded-card border border-line bg-surface p-3">
        <h3 className="text-sm font-semibold text-ink">Create client</h3>
        <div className="mt-3 space-y-2">
          <TextInput label={t(uiLanguage, "fullName")} value={newClientName} onChange={onNewClientName} />
          <TextInput label={t(uiLanguage, "primaryPhone")} value={newClientPhone} onChange={onNewClientPhone} keyboard="tel" />
          <SelectInput
            label={t(uiLanguage, "clientLanguage")}
            value={newClientLanguage}
            onChange={(value) => onNewClientLanguage(value as SupportedLanguageCode)}
            options={languageOptions}
          />
          <SelectInput
            label={t(uiLanguage, "channel")}
            value={newClientChannel}
            onChange={(value) => onNewClientChannel(value as Channel)}
            options={[
              ["whatsapp", "WhatsApp"],
              ["telegram", "Telegram"],
            ]}
          />
          <TextInput label={t(uiLanguage, "channelId")} value={newClientHandle} onChange={onNewClientHandle} />
          <button
            ref={addButtonRef}
            onClick={() => void handleAddClient()}
            disabled={!newClientName.trim() || isSaving}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:bg-ink-alt"
            type="button"
          >
            <Plus size={16} />
            {isSaving ? "Kaydediliyor..." : t(uiLanguage, "addClient")}
          </button>
          {saveFailure ? (
            <p role="alert" aria-live="assertive" className="rounded-control border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {stage6EditorFailureMessage(saveFailure)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

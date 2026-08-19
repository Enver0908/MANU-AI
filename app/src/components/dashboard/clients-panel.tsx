"use client";

import { useRef } from "react";
import { Plus, Search } from "lucide-react";
import type { Channel, ClientRecord } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import { useShellDirtyRegistration } from "@/lib/use-shell-dirty-registration";
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
  onAddClient: () => void;
  onNewClientName: (value: string) => void;
  onNewClientChannel: (value: Channel) => void;
  onNewClientHandle: (value: string) => void;
  onNewClientPhone: (value: string) => void;
  onNewClientLanguage: (value: SupportedLanguageCode) => void;
}) {
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const isDirty = Boolean(
    newClientName.trim() || newClientHandle.trim() || newClientPhone.trim() || newClientChannel !== "whatsapp",
  );

  useShellDirtyRegistration({
    id: "client-roster-create",
    label: "Yeni danışan",
    state: isDirty ? "dirty" : "clean",
    canSave: Boolean(newClientName.trim()),
    onSave: async () => {
      if (!newClientName.trim()) return false;
      onAddClient();
      return true;
    },
    onDiscard: () => {
      onNewClientName("");
      onNewClientHandle("");
      onNewClientPhone("");
      onNewClientChannel("whatsapp");
      onNewClientLanguage("tr");
    },
    onFocusField: () => addButtonRef.current?.focus(),
  });

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
            onClick={onAddClient}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:bg-ink-alt"
            type="button"
          >
            <Plus size={16} />
            {t(uiLanguage, "addClient")}
          </button>
        </div>
      </div>
    </section>
  );
}

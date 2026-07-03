"use client";

import { Activity, Bot, MessageSquareText } from "lucide-react";
import type { ClientRecord, ManuAppState } from "@/lib/types";
import { Badge, EmptyState, InfoLine, SelectInput, TextInput, TextareaInput, scenarioMessages } from "./shared";
import { MobileStickyActionBar } from "./mobile-ergonomics";
import { MOBILE_CHROME_CLASS } from "@/lib/phase-83e5-mobile-ergonomics";

export function SimulatorPanel({
  state,
  selectedClient,
  clients,
  simBody,
  simKey,
  isSimulating,
  onSelectClient,
  onSimBody,
  onSimKey,
  onRun,
  onOpenConversation,
}: {
  state: ManuAppState;
  selectedClient: ClientRecord;
  clients: ClientRecord[];
  simBody: string;
  simKey: string;
  isSimulating: boolean;
  onSelectClient: (clientId: string) => void;
  onSimBody: (value: string) => void;
  onSimKey: (value: string) => void;
  onRun: () => void;
  onOpenConversation: () => void;
}) {
  const last = state.lastSimulation;

  return (
    <>
    <div className={`grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] ${MOBILE_CHROME_CLASS.bottomNavWithStickyActions}`}>
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 text-emerald-900">
            <Bot size={22} />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Gelen mesaj simülatörü</h3>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              Mevcut çekirdek orkestratörü yerel demo verisiyle çalıştırır. Gerçek kanallar bağlı kalmaz.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <SelectInput
            label="Danışan"
            value={selectedClient.id}
            onChange={onSelectClient}
            options={clients.map((client) => [client.id, client.fullName])}
          />
          <TextInput label="İstek anahtarı" value={simKey} onChange={onSimKey} />
          <TextareaInput label="Gelen mesaj" value={simBody} onChange={onSimBody} rows={6} />
          <div className="flex flex-wrap gap-2">
            {scenarioMessages.map((scenario) => (
              <button
                key={scenario.label}
                onClick={() => onSimBody(scenario.body)}
                className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                type="button"
              >
                {scenario.label}
              </button>
            ))}
          </div>
          <button
            onClick={onRun}
            disabled={isSimulating}
            className="hidden min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-stone-400 sm:w-auto lg:inline-flex"
            type="button"
          >
            <Activity size={17} />
            {isSimulating ? "Çalışıyor..." : "Gelen akışı çalıştır"}
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Son sonuç</h3>
          {last ? (
            <div className="mt-3 space-y-3">
              <Badge label={last.action} tone={last.action === "handoff" ? "red" : last.action === "sent" ? "emerald" : "amber"} />
              <div className="space-y-2 text-sm">
                <InfoLine label="Risk" value={last.risk || "-"} />
                <InfoLine label="Model" value={last.model || "no LLM call"} />
                <InfoLine label="Engel" value={last.blockedReason || "-"} />
              </div>
              {last.reasons.length > 0 && (
                <div className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700">{last.reasons.join(", ")}</div>
              )}
              {last.draft && <div className="rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">{last.draft}</div>}
              <button
                onClick={onOpenConversation}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                type="button"
              >
                <MessageSquareText size={16} />
                Zaman çizelgesini aç
              </button>
            </div>
          ) : (
            <EmptyState
              title="Simülasyon yok"
              message="Bu tarayıcı oturumunda henüz yerel simülasyon çalıştırılmadı."
            />
          )}
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Seçili danışan kapıları</h3>
          <div className="mt-3 space-y-2 text-sm">
            <InfoLine label="AI" value={`${selectedClient.aiStatus} / ${selectedClient.aiMode}`} />
            <InfoLine label="Güvenlik" value={selectedClient.mandatorySafetyComplete ? "tamamlandı" : "eksik"} />
            <InfoLine label="Pencere" value={selectedClient.aiActiveFrom || selectedClient.aiActiveUntil ? "zamanlı" : "her zaman"} />
            <InfoLine label="Devralma" value={selectedClient.humanTakeoverLocked ? "kilitli" : "açık"} />
          </div>
        </section>
      </aside>
    </div>

    <MobileStickyActionBar>
      <button
        onClick={onRun}
        disabled={isSimulating}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-stone-400"
        type="button"
      >
        <Activity size={17} />
        {isSimulating ? "Çalışıyor..." : "Gelen akışı çalıştır"}
      </button>
    </MobileStickyActionBar>
    </>
  );
}

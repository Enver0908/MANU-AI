"use client";

import type { ReactNode } from "react";
import {
  ClipboardList,
  FileText,
  MessageSquareText,
  UserRound,
  Utensils,
} from "lucide-react";
import type { ClientRecord } from "@/lib/types";
import { ClientSummary, EmptyState } from "./shared";

export type OverviewClientWorkAreaAvailability =
  | { state: "enabled"; clientName: string }
  | { state: "disabled"; reason: "client_required" };

export type OverviewAiChatAvailability =
  | { state: "enabled" }
  | { state: "disabled"; reason: "feature_disabled" | "role_forbidden" | "access_unverified" };

type ClientTaskShortcut = "forms" | "nutrition" | "menu";

function getShortcutStatus(
  availability: OverviewClientWorkAreaAvailability | OverviewAiChatAvailability,
) {
  if (availability.state === "enabled") {
    return "clientName" in availability ? `${availability.clientName} için aç` : "Kullanıma hazır";
  }

  switch (availability.reason) {
    case "client_required":
      return "Aktif danışan gerekli";
    case "feature_disabled":
      return "GO doğrulamasına kadar kapalı";
    case "role_forbidden":
      return "Bu rol için erişim yok";
    case "access_unverified":
      return "Erişim doğrulanamadı";
  }
}

function WorkAreaShortcut({
  testId,
  label,
  icon,
  availability,
  onOpen,
}: {
  testId: string;
  label: string;
  icon: ReactNode;
  availability: OverviewClientWorkAreaAvailability | OverviewAiChatAvailability;
  onOpen: () => void;
}) {
  const disabled = availability.state === "disabled";
  const statusId = `${testId}-status`;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-describedby={statusId}
      data-testid={testId}
      className={`flex min-h-16 min-w-0 items-center gap-3 rounded-control border px-3 py-2 text-left transition ${
        disabled
          ? "cursor-not-allowed border-line bg-surface-muted text-ink-muted"
          : "border-line bg-surface text-ink hover:bg-surface-muted"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-control ${
          disabled ? "bg-surface text-ink-muted" : "bg-primary/10 text-primary"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block break-words text-sm font-semibold">{label}</span>
        <span id={statusId} className="mt-0.5 block break-words text-xs text-ink-muted">
          {getShortcutStatus(availability)}
        </span>
      </span>
    </button>
  );
}

export function OverviewPanel({
  selectedClient,
  pendingMessageCount,
  pendingAlertCount,
  pendingNotificationCount,
  clientWorkAreaAvailability,
  aiChatAvailability,
  onOpenClients,
  onOpenMessages,
  onOpenAlerts,
  onOpenNotifications,
  onOpenClientTask,
  onOpenAiChat,
}: {
  selectedClient?: ClientRecord;
  pendingMessageCount: number;
  pendingAlertCount: number;
  pendingNotificationCount: number;
  clientWorkAreaAvailability: OverviewClientWorkAreaAvailability;
  aiChatAvailability: OverviewAiChatAvailability;
  onOpenClients: () => void;
  onOpenMessages: () => void;
  onOpenAlerts: () => void;
  onOpenNotifications: () => void;
  onOpenClientTask: (task: ClientTaskShortcut) => void;
  onOpenAiChat: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <section className="min-w-0 rounded-card border border-line bg-surface p-4" data-testid="overview-daily-work">
          <h3 className="text-lg font-semibold text-ink break-words">Günlük iş girişi</h3>
          <p className="mt-1 min-w-0 break-words text-sm text-ink-muted">
            Aktif danışan, bekleyen kuyruklar ve doğrudan görevler. Raporlama vitrini yoktur.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={onOpenMessages}
              className="inline-flex min-h-11 items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-ink transition hover:bg-surface-muted"
            >
              <span className="inline-flex items-center gap-2">
                <MessageSquareText size={16} className="text-primary" />
                Mesajlar
              </span>
              <span className="font-semibold">{pendingMessageCount}</span>
            </button>
            <button
              type="button"
              onClick={onOpenAlerts}
              className="inline-flex min-h-11 items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-ink transition hover:bg-surface-muted"
            >
              Uyarılar
              <span className="font-semibold">{pendingAlertCount}</span>
            </button>
            <button
              type="button"
              onClick={onOpenNotifications}
              className="inline-flex min-h-11 items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-ink transition hover:bg-surface-muted"
            >
              Bildirimler
              <span className="font-semibold">{pendingNotificationCount}</span>
            </button>
          </div>
        </section>

        <section className="min-w-0 rounded-card border border-line bg-surface p-4" data-testid="overview-active-client">
          <h3 className="text-lg font-semibold text-ink break-words">Aktif danışan</h3>
          {selectedClient ? (
            <div className="mt-4 space-y-3">
              <ClientSummary client={selectedClient} compact />
              <button
                onClick={onOpenClients}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted"
                type="button"
              >
                <UserRound size={16} />
                Çalışma alanını aç
              </button>
            </div>
          ) : (
            <EmptyState title="Danışan seçilmedi" message="Danışan listesinden bir kayıt seçin." />
          )}
        </section>
      </div>

      <section className="min-w-0 rounded-card border border-line bg-surface p-4" data-testid="overview-work-areas">
        <h3 className="text-lg font-semibold text-ink break-words">Çalışma alanları</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <WorkAreaShortcut
            testId="overview-work-area-forms"
            label="Danışan formu"
            icon={<FileText size={18} />}
            availability={clientWorkAreaAvailability}
            onOpen={() => onOpenClientTask("forms")}
          />
          <WorkAreaShortcut
            testId="overview-work-area-nutrition"
            label="Beslenme planı"
            icon={<ClipboardList size={18} />}
            availability={clientWorkAreaAvailability}
            onOpen={() => onOpenClientTask("nutrition")}
          />
          <WorkAreaShortcut
            testId="overview-work-area-menu"
            label="Menü planı"
            icon={<Utensils size={18} />}
            availability={clientWorkAreaAvailability}
            onOpen={() => onOpenClientTask("menu")}
          />
          <WorkAreaShortcut
            testId="overview-work-area-ai-chat"
            label="AI Chat"
            icon={<MessageSquareText size={18} />}
            availability={aiChatAvailability}
            onOpen={onOpenAiChat}
          />
        </div>
      </section>
    </div>
  );
}

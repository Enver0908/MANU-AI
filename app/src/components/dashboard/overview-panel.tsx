"use client";

import {
  MessageSquareText,
  UserRound,
} from "lucide-react";
import type { ClientRecord, ManuAppState, SupportedLanguageCode } from "@/lib/types";
import type { OperationalFoundationInspectionDto } from "@/lib/phase-85-if-h-operational-visibility";
import { ClientSummary, EmptyState } from "./shared";
import { OperationalFoundationPanel } from "./operational-foundation-panel";

export function OverviewPanel({
  selectedClient,
  state,
  uiLanguage,
  showInspectionDetails,
  operationalFoundation,
  pendingMessageCount,
  pendingAlertCount,
  pendingNotificationCount,
  onOpenClients,
  onOpenMessages,
  onOpenAlerts,
  onOpenNotifications,
}: {
  selectedClient?: ClientRecord;
  state: ManuAppState;
  uiLanguage: SupportedLanguageCode;
  showInspectionDetails: boolean;
  operationalFoundation?: OperationalFoundationInspectionDto | null;
  pendingMessageCount: number;
  pendingAlertCount: number;
  pendingNotificationCount: number;
  onOpenClients: () => void;
  onOpenMessages: () => void;
  onOpenAlerts: () => void;
  onOpenNotifications: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <section className="rounded-card border border-line bg-surface p-4">
          <h3 className="text-lg font-semibold text-ink">Günlük iş girişi</h3>
          <p className="mt-1 text-sm text-ink-muted">
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

        <section className="rounded-card border border-line bg-surface p-4">
          <h3 className="text-lg font-semibold text-ink">Aktif danışan</h3>
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

      <section className="rounded-card border border-line bg-surface p-4">
        <OperationalFoundationPanel
          state={state}
          uiLanguage={uiLanguage}
          showInspectionDetails={showInspectionDetails}
          inspection={operationalFoundation}
        />
      </section>
    </div>
  );
}

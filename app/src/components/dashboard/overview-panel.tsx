"use client";

import {
  AlertTriangle,
  Bot,
  CirclePause,
  ClipboardList,
  MessageSquareText,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import type { ClientRecord } from "@/lib/types";
import { ClientSummary, EmptyState, MetricCard, WorkflowItem } from "./shared";

export function OverviewPanel({
  metrics,
  selectedClient,
  onOpenSimulator,
  onOpenClients,
}: {
  metrics: { pendingDrafts: number; urgentHandoffs: number; aiSent: number; passive: number };
  selectedClient?: ClientRecord;
  onOpenSimulator: () => void;
  onOpenClients: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Bot} label="AI gönderimleri" value={String(metrics.aiSent)} tone="emerald" />
        <MetricCard icon={ClipboardList} label="Bekleyen taslaklar" value={String(metrics.pendingDrafts)} tone="amber" />
        <MetricCard icon={AlertTriangle} label="Açık devirler" value={String(metrics.urgentHandoffs)} tone="red" />
        <MetricCard icon={CirclePause} label="Pasif danışanlar" value={String(metrics.passive)} tone="stone" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Çalışma yüzeyi</h3>
              <p className="mt-1 text-sm text-stone-600">Panel kabuğu, danışan kontrolleri, simülatör ve kaynak etiketleri.</p>
            </div>
            <button
              onClick={onOpenSimulator}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              type="button"
            >
              <Bot size={17} />
              Simülatörü çalıştır
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <WorkflowItem icon={ShieldCheck} title="Aktivasyon kapısı" body="Aktif, pasif, zamanlama, devralma ve güvenlik profili engelleri." />
            <WorkflowItem icon={SlidersHorizontal} title="Mod kontrolleri" body="Autopilot, copilot, manuel, duraklatılmış, persona ve zaman penceresi." />
            <WorkflowItem icon={MessageSquareText} title="Zaman çizelgesi etiketleri" body="Danışan, AI, diyetisyen ve sistem kaynakları görünür kalır." />
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Seçili danışan</h3>
          {selectedClient ? (
            <div className="mt-4 space-y-3">
              <ClientSummary client={selectedClient} compact />
              <button
                onClick={onOpenClients}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                type="button"
              >
                <UserRound size={16} />
                Danışanı yönet
              </button>
            </div>
          ) : (
            <EmptyState title="Danışan seçilmedi" message="Danışan listesinden bir kayıt seçin." />
          )}
        </section>
      </div>
    </div>
  );
}

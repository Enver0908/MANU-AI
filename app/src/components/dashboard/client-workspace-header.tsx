"use client";

import { ArrowLeft } from "lucide-react";
import type { ClientRecord } from "@/lib/types";
import { Badge } from "./shared";

export function ClientWorkspaceHeader({
  client,
  title,
  showBack,
  backLabel,
  onBack,
}: {
  client: ClientRecord;
  title?: string;
  showBack: boolean;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <header
      className="flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-start sm:justify-between"
      data-testid="client-workspace-header"
    >
      <div className="flex min-w-0 items-start gap-2">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control border border-line bg-surface text-ink transition hover:bg-surface-muted lg:hidden"
            data-testid="client-workspace-back"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="sr-only">{backLabel}</span>
          </button>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Aktif danışan</p>
          <h3 className="truncate text-xl font-semibold text-ink">{client.fullName}</h3>
          <p className="mt-1 break-words text-sm text-ink-muted">
            {title ? `${title} · ` : ""}
            {client.channel} · {client.channelUserId || "Kanal kimliği yok"} · {client.communicationLanguage}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" aria-live="polite">
        <Badge label={client.aiStatus} tone={client.aiStatus === "active" ? "emerald" : "stone"} />
        <Badge label={client.aiMode} tone={client.aiMode === "autopilot" ? "emerald" : "amber"} />
        <Badge label={client.channelPermission} tone={client.channelPermission === "ready" ? "emerald" : "amber"} />
      </div>
    </header>
  );
}

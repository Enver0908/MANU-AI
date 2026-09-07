"use client";

import {
  Activity,
  Bot,
  ClipboardList,
  Download,
  FileText,
  PhoneCall,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { t, type DashboardMessageKey } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import type { ClientWorkspaceTask } from "@/lib/phase-85-stage-4b-dashboard-routing";
import { CLIENT_WORKSPACE_TASK_TO_LEGACY_TAB } from "@/lib/phase-85-stage-4b-dashboard-routing";
import type { ClientDetailTab } from "./shared";

const PRIMARY_TASKS: Array<{
  task: ClientWorkspaceTask;
  labelKey: DashboardMessageKey;
  icon: LucideIcon;
}> = [
  { task: "summary", labelKey: "tabOverview", icon: Activity },
  { task: "forms", labelKey: "tabPersonalForm", icon: FileText },
  { task: "nutrition", labelKey: "tabFoodRules", icon: UtensilsCrossed },
  { task: "menu", labelKey: "tabMenu", icon: ClipboardList },
  { task: "ai", labelKey: "tabAiAssistant", icon: Bot },
];

const SECONDARY_TASKS: Array<{
  task: ClientWorkspaceTask;
  labelKey: DashboardMessageKey;
  icon: LucideIcon;
}> = [
  { task: "context", labelKey: "tabCriticalContext", icon: PhoneCall },
  { task: "export", labelKey: "tabExport", icon: Download },
];

export function ClientTaskHub({
  uiLanguage,
  activeTask,
  badges,
  onOpenTask,
  variant,
}: {
  uiLanguage: SupportedLanguageCode;
  activeTask: ClientWorkspaceTask;
  badges: Partial<Record<ClientWorkspaceTask, string>>;
  onOpenTask: (task: ClientWorkspaceTask) => void;
  variant: "hub" | "tabs";
}) {
  const items = [...PRIMARY_TASKS, ...SECONDARY_TASKS];

  if (variant === "tabs") {
    return (
      <nav className="flex gap-1 overflow-x-auto border-b border-line px-1 pt-1" data-testid="client-detail-tabs">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.task === activeTask;
          const tabKey = CLIENT_WORKSPACE_TASK_TO_LEGACY_TAB[item.task] as ClientDetailTab;
          return (
            <button
              key={item.task}
              type="button"
              onClick={() => onOpenTask(item.task)}
              className={`relative inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-ink-muted hover:border-line hover:text-ink"
              }`}
              data-testid={`tab-${tabKey}`}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="hidden sm:inline">{t(uiLanguage, item.labelKey)}</span>
              {badges[item.task] ? (
                <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface-muted px-1.5 text-[10px] font-bold text-ink">
                  {badges[item.task]}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="grid gap-2" aria-label="Danışan görevleri" data-testid="client-task-hub">
      {items.map((item) => {
        const Icon = item.icon;
        const tabKey = CLIENT_WORKSPACE_TASK_TO_LEGACY_TAB[item.task] as ClientDetailTab;
        return (
          <button
            key={item.task}
            type="button"
            onClick={() => onOpenTask(item.task)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-card border border-line bg-surface px-3 py-3 text-left text-sm font-medium text-ink transition hover:bg-surface-muted"
            data-testid={`tab-${tabKey}`}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <Icon size={16} className="shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">{t(uiLanguage, item.labelKey)}</span>
            </span>
            {badges[item.task] ? (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold text-ink">
                {badges[item.task]}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

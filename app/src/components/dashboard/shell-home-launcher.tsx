"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Handshake,
  MessageSquare,
} from "lucide-react";
import { buildShellHomeActionHref } from "@/lib/phase-85-stage-5-shell-home-actions";
import {
  formatShellBadgeDisplayCount,
  type ShellHomeActionDto,
  type ShellHomeActionId,
} from "@/lib/phase-85-stage-5-shell-contracts";
import { parseDashboardSearchParams } from "@/lib/phase-85-stage-4b-dashboard-routing";
import { useSearchParams } from "next/navigation";

const HOME_ACTION_LABEL: Record<ShellHomeActionId, string> = {
  alerts: "Uyarılar",
  handoffs: "Devirler",
  messages: "Okunmamış mesajlar",
  notifications: "Bildirimler",
  resume_last_work: "Son çalışmana dön",
};

const HOME_ACTION_ICON: Record<ShellHomeActionId, typeof AlertTriangle> = {
  alerts: AlertTriangle,
  handoffs: Handshake,
  messages: MessageSquare,
  notifications: Bell,
  resume_last_work: ArrowRight,
};

/**
 * Fixed-order home action launcher for overview.
 * Mobile: first content block. Wide: compact task strip above overview body.
 */
export function ShellHomeLauncher({
  actions,
  clientId,
  layout = "stack",
}: {
  actions: ShellHomeActionDto[];
  clientId?: string | null;
  layout?: "stack" | "strip";
}) {
  const searchParams = useSearchParams();
  const current = parseDashboardSearchParams(searchParams);

  return (
    <section
      className={
        layout === "strip"
          ? "flex flex-wrap gap-2"
          : "grid gap-2 sm:grid-cols-2 xl:grid-cols-5"
      }
      aria-label="Ana sayfa eylemleri"
      data-testid="shell-home-launcher"
    >
      {actions.map((action) => {
        const href = buildShellHomeActionHref(action, { clientId, current });
        const Icon = HOME_ACTION_ICON[action.id];
        const label = HOME_ACTION_LABEL[action.id];
        const count =
          action.id === "resume_last_work" || action.count <= 0
            ? null
            : formatShellBadgeDisplayCount(action.count);

        if (!action.enabled) {
          return (
            <span
              key={action.id}
              className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface-muted px-3 text-sm text-ink-muted opacity-60"
              title={action.disabledReason}
              data-testid={`shell-home-action-${action.id}`}
              data-enabled="false"
            >
              <Icon size={16} />
              <span>{label}</span>
              {count ? <span className="font-semibold">{count}</span> : null}
            </span>
          );
        }

        return (
          <Link
            key={action.id}
            href={href}
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-ink transition hover:bg-surface-muted"
            data-testid={`shell-home-action-${action.id}`}
            data-enabled="true"
          >
            <Icon size={16} className="text-primary" />
            <span>{label}</span>
            {count ? <span className="font-semibold text-primary">{count}</span> : null}
          </Link>
        );
      })}
    </section>
  );
}

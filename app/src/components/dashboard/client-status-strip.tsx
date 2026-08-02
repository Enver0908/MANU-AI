"use client";

import type { ShellActiveClientDto, ShellStatusChip } from "@/lib/phase-85-stage-5-shell-contracts";
import { resolveShellClientStatusStrip } from "@/lib/phase-85-stage-5-shell-contracts";

export function ClientStatusStrip({
  client,
  stale = false,
}: {
  client: ShellActiveClientDto | null;
  stale?: boolean;
}) {
  const chips = resolveShellClientStatusStrip(client, { stale });
  return (
    <ul
      className="flex flex-wrap gap-1.5"
      data-testid="client-status-strip"
      aria-label="Danışan durum özeti"
    >
      {chips.map((chip) => (
        <li key={`${chip.key}-${chip.label}`}>
          <StatusChip chip={chip} />
        </li>
      ))}
    </ul>
  );
}

function StatusChip({ chip }: { chip: ShellStatusChip }) {
  const tone =
    chip.key === "unknown"
      ? "border-line bg-surface-muted text-ink-muted"
      : chip.key === "risk" && chip.label.includes("kırmızı")
        ? "border-red-200 bg-red-50 text-red-800"
        : chip.key === "risk" && chip.label.includes("sarı")
          ? "border-warm/30 bg-warm/10 text-warm"
          : "border-line bg-surface text-ink-muted";

  return (
    <span className={`inline-flex min-h-8 items-center rounded-control border px-2 text-xs font-medium ${tone}`}>
      {chip.label}
    </span>
  );
}

import type { ReactNode } from "react";
import { cn } from "./cn";
import { OriginBadge, RiskBadge } from "./badge";
import type { MessageOrigin, MessageRisk } from "./tokens";

export type TimelineEntry = {
  id: string;
  origin: MessageOrigin;
  risk?: MessageRisk;
  timestamp: ReactNode;
  body: ReactNode;
  meta?: ReactNode;
};

/**
 * Conversation timeline primitive. Every row surfaces message provenance
 * (origin) and, when present, clinical risk. Long tokens wrap so the timeline
 * never causes horizontal page overflow.
 */
export function Timeline({ entries, className }: { entries: TimelineEntry[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col gap-2", className)}>
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-card border border-line bg-surface px-3 py-2 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <OriginBadge origin={entry.origin} />
              {entry.risk ? <RiskBadge risk={entry.risk} /> : null}
            </div>
            <span className="text-xs text-ink-subtle">{entry.timestamp}</span>
          </div>
          <div className="mt-1.5 whitespace-pre-wrap break-words text-sm text-ink">{entry.body}</div>
          {entry.meta ? <div className="mt-1 text-xs text-ink-muted">{entry.meta}</div> : null}
        </li>
      ))}
    </ol>
  );
}

"use client";

import { cn } from "./cn";
import type { IconType } from "./tokens";

export type TabItem = {
  id: string;
  label: string;
  icon?: IconType;
  badge?: string;
};

export function Tabs({
  items,
  value,
  onValueChange,
  className,
  ariaLabel,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}
    >
      {items.map((item) => {
        const active = item.id === value;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onValueChange(item.id)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition",
              active
                ? "border-primary text-primary"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {Icon ? <Icon size={16} className="shrink-0" /> : null}
            <span className="command-label">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full border border-line bg-surface-muted px-1.5 text-xs font-medium text-ink-muted">
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

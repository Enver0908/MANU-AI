"use client";

import { cn } from "./cn";

export type SegmentedOption = {
  value: string;
  label: string;
};

export function SegmentedControl({
  options,
  value,
  onValueChange,
  className,
  ariaLabel,
}: {
  options: SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex rounded-control border border-line bg-surface-muted p-0.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "min-h-9 min-w-0 rounded-control px-3 text-sm font-medium transition",
              active ? "bg-surface text-primary shadow-[0_1px_2px_rgba(23,20,18,0.08)]" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            <span className="command-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

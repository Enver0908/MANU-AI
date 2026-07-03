"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";

export type SheetSide = "bottom" | "right";

/**
 * Bottom sheet (mobile) / side sheet (desktop) primitive. Behavior only; the
 * consumer owns open state. Includes safe-area padding for installed PWA.
 */
export function Sheet({
  open,
  onClose,
  side = "bottom",
  title,
  footer,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  side?: SheetSide;
  title: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const panelPosition =
    side === "bottom"
      ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-card pb-safe"
      : "inset-y-0 right-0 h-full w-full max-w-md";

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/40" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute flex flex-col border border-line bg-surface shadow-lg",
          panelPosition,
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <Button variant="ghost" size="sm" icon={X} aria-label="Kapat" onClick={onClose} className="px-2" />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

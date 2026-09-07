"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";
import { useModalFocus } from "./use-modal-focus";

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
  const panelRef = useRef<HTMLDivElement>(null);
  useModalFocus(open, panelRef, onClose);

  if (!open) return null;

  const panelPosition =
    side === "bottom"
      ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-card pb-safe"
      : "inset-y-0 right-0 h-full w-full max-w-md";

  return (
    <div className="fixed inset-0 z-50 bg-ink/45" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-sheet-title"
        tabIndex={-1}
        className={cn(
          "absolute flex min-w-0 flex-col border border-line bg-surface shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-focus",
          panelPosition,
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id="ui-sheet-title" className="min-w-0 text-sm font-semibold text-ink">
            {title}
          </h2>
          <Button variant="ghost" size="sm" icon={X} aria-label="Kapat" onClick={onClose} className="px-2" />
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

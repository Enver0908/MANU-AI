"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";

export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-4 py-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full max-w-lg rounded-card border border-line bg-surface shadow-lg",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
          </div>
          <Button variant="ghost" size="sm" icon={X} aria-label="Kapat" onClick={onClose} className="px-2" />
        </div>
        {children ? <div className="px-4 py-4">{children}</div> : null}
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

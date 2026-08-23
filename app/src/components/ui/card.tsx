import type { ReactNode } from "react";
import { cn } from "./cn";
import type { IconType } from "./tokens";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-card border border-line bg-surface shadow-[0_1px_2px_rgba(23,20,18,0.05)]", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: IconType;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-line px-4 py-3", className)}>
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="rounded-control bg-surface-muted p-2 text-primary">
            <Icon size={18} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description ? <p className="free-text mt-0.5 text-xs text-ink-muted">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-4 py-4", className)}>{children}</div>;
}

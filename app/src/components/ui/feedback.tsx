import type { ReactNode } from "react";
import { cn } from "./cn";
import { badgeToneClasses, iconToneClass, type IconType, type Tone } from "./tokens";

export function Alert({
  tone = "plum",
  title,
  children,
  icon: Icon,
  className,
}: {
  tone?: Tone;
  title: ReactNode;
  children?: ReactNode;
  icon?: IconType;
  className?: string;
}) {
  return (
    <div className={cn("rounded-card border px-4 py-3", badgeToneClasses(tone), className)} role="status">
      <div className="flex gap-3">
        {Icon ? <Icon size={18} className={cn("mt-0.5 shrink-0", iconToneClass(tone))} /> : null}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          {children ? <div className="mt-1 text-sm leading-6 opacity-90">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  icon: Icon,
  action,
  className,
}: {
  title: ReactNode;
  message?: ReactNode;
  icon?: IconType;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-48 flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface px-6 py-8 text-center", className)}>
      {Icon ? (
        <span className="mb-3 rounded-control bg-surface-muted p-2 text-primary">
          <Icon size={20} />
        </span>
      ) : null}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {message ? <p className="free-text mt-1 max-w-sm text-sm leading-6 text-ink-muted">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingBlock({ label = "Yukleniyor", className }: { label?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-32 items-center justify-center gap-3 rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted", className)} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

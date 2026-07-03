import { cn } from "./cn";
import {
  badgeToneClasses,
  MESSAGE_ORIGIN,
  MESSAGE_RISK,
  type IconType,
  type MessageOrigin,
  type MessageRisk,
  type Tone,
} from "./tokens";

export type BadgeProps = {
  label: string;
  tone?: Tone;
  icon?: IconType;
  className?: string;
};

export function Badge({ label, tone = "stone", icon: Icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-semibold",
        badgeToneClasses(tone),
        className,
      )}
    >
      {Icon ? <Icon size={12} /> : null}
      {label}
    </span>
  );
}

/** Provenance chip. Keeps message origin distinguishable in every timeline row. */
export function OriginBadge({ origin, className }: { origin: MessageOrigin; className?: string }) {
  const meta = MESSAGE_ORIGIN[origin];
  return <Badge label={meta.label} tone={meta.tone} className={className} />;
}

/** Clinical message-risk chip. Uses reserved green/yellow/red risk colors only. */
export function RiskBadge({ risk, className }: { risk: MessageRisk; className?: string }) {
  const meta = MESSAGE_RISK[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-semibold",
        meta.classes,
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

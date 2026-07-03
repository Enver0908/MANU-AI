import type { ComponentType } from "react";

/**
 * Phase 83E-1 design system: pure, testable style logic.
 *
 * Components in `components/ui/*` stay thin and delegate class resolution here
 * so the palette, variants, and clinical/UI color separation can be unit tested
 * without rendering. This file must not import client-only APIs.
 */

export type IconType = ComponentType<{ size?: number; className?: string }>;

/**
 * Design constraint: no surface radius may exceed 8px. Values are asserted in
 * the design-system unit test.
 */
export const RADIUS_PX = {
  control: 6,
  card: 8,
} as const;

// --- Buttons (command buttons) -------------------------------------------------

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-card font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-emerald-950 text-white hover:bg-emerald-900",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-muted",
  ghost: "text-ink-muted hover:bg-surface-muted",
  // Destructive affordance for operational actions (delete/remove). This is not
  // a clinical message-risk color; message risk uses MESSAGE_RISK below.
  danger: "border border-red-200 bg-surface text-red-700 hover:bg-red-50",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-11 px-4 py-2 text-sm", // 44px min touch target
  lg: "min-h-12 px-5 py-3 text-sm",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]}`;
}

// --- Badges / status tones -----------------------------------------------------

/**
 * Generic UI tones. `emerald | amber | red | stone` matches the tones already
 * used across the existing dashboard so primitives are a coherent superset.
 */
export type Tone = "emerald" | "amber" | "red" | "stone";

const BADGE_TONE: Record<Tone, string> = {
  emerald: "bg-emerald-100 text-emerald-950 border-emerald-200",
  amber: "bg-amber-100 text-amber-950 border-amber-200",
  red: "bg-red-100 text-red-950 border-red-200",
  stone: "bg-stone-100 text-stone-700 border-stone-200",
};

export function badgeToneClasses(tone: Tone = "stone"): string {
  return BADGE_TONE[tone];
}

export function iconToneClass(tone: Tone = "stone"): string {
  const map: Record<Tone, string> = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
    stone: "text-stone-500",
  };
  return map[tone];
}

// --- Clinical message provenance (origin) -------------------------------------

/**
 * Message origin must stay visually distinguishable in the UI. These are
 * provenance labels, not risk states, so they use neutral/brand tones.
 */
export type MessageOrigin =
  | "client_inbound"
  | "ai_generated"
  | "dietitian_manual"
  | "system_event"
  | "imported_unknown";

export const MESSAGE_ORIGIN: Record<MessageOrigin, { label: string; tone: Tone }> = {
  client_inbound: { label: "Client", tone: "stone" },
  ai_generated: { label: "AI", tone: "emerald" },
  dietitian_manual: { label: "Dietitian", tone: "amber" },
  system_event: { label: "System", tone: "stone" },
  imported_unknown: { label: "Imported", tone: "stone" },
};

// --- Clinical message risk (green/yellow/red ONLY) ----------------------------

/**
 * Clinical message-risk classification. These colors are reserved for message
 * risk state and must never be reused to express generic success/warning/error.
 */
export type MessageRisk = "green" | "yellow" | "red";

export const MESSAGE_RISK: Record<MessageRisk, { label: string; classes: string; dot: string }> = {
  green: { label: "Green", classes: "bg-green-50 text-green-800 border-green-200", dot: "bg-green-600" },
  yellow: { label: "Yellow", classes: "bg-yellow-50 text-yellow-900 border-yellow-300", dot: "bg-yellow-500" },
  red: { label: "Red", classes: "bg-red-50 text-red-800 border-red-300", dot: "bg-red-600" },
};

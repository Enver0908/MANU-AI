/**
 * Phase 83E-5 mobile ergonomics: pure, testable helpers shared by the dashboard
 * control primitives. This module contains no IO and no clinical behavior; it
 * only centralizes touch-target sizing, keyboard-aware input attributes, and the
 * mobile-first field class so panels stay consistent across web and installed PWA.
 */

/** WCAG / plan minimum interactive touch target in CSS pixels. */
export const TOUCH_TARGET_MIN_PX = 44;

/** Tailwind height utility that guarantees the 44px minimum (2.75rem = 44px). */
export const TOUCH_TARGET_CLASS = "min-h-11";

/**
 * Mobile-first field class. Uses 16px (`text-base`) on phones to prevent the iOS
 * focus zoom, drops to 14px (`sm:text-sm`) on larger screens, and enforces the
 * 44px minimum height for comfortable one-handed tapping.
 */
export const MOBILE_FIELD_CLASS =
  "mt-1 w-full min-h-11 rounded-lg border border-stone-200 bg-white px-3 py-2 text-base text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-100 sm:text-sm";

export type InputKeyboardKind = "text" | "email" | "tel" | "numeric" | "url" | "search";

export type InputKeyboardAttrs = {
  type: string;
  inputMode: "text" | "email" | "tel" | "numeric" | "url" | "search" | "none" | "decimal";
  autoComplete: string;
  enterKeyHint: "enter" | "done" | "go" | "next" | "search" | "send";
};

/**
 * Map a semantic field kind to keyboard-aware input attributes so mobile users
 * get the right on-screen keyboard, autofill hint, and Enter-key affordance.
 */
export function resolveInputKeyboard(kind: InputKeyboardKind = "text"): InputKeyboardAttrs {
  switch (kind) {
    case "email":
      return { type: "email", inputMode: "email", autoComplete: "email", enterKeyHint: "next" };
    case "tel":
      return { type: "tel", inputMode: "tel", autoComplete: "tel", enterKeyHint: "next" };
    case "numeric":
      return { type: "text", inputMode: "numeric", autoComplete: "off", enterKeyHint: "done" };
    case "url":
      return { type: "url", inputMode: "url", autoComplete: "url", enterKeyHint: "go" };
    case "search":
      return { type: "search", inputMode: "search", autoComplete: "off", enterKeyHint: "search" };
    case "text":
    default:
      return { type: "text", inputMode: "text", autoComplete: "off", enterKeyHint: "done" };
  }
}

/** Append the touch-target minimum to an existing class string. */
export function withTouchTarget(base = ""): string {
  return `${base} ${TOUCH_TARGET_CLASS}`.trim();
}

/** Mobile bottom nav height in rem (min-h-14 = 3.5rem). Used by sticky action bar positioning. */
export const MOBILE_BOTTOM_NAV_HEIGHT_REM = 3.5;

/** Approximate sticky action bar height in rem for content padding calculations. */
export const MOBILE_STICKY_ACTION_BAR_HEIGHT_REM = 3.5;

/**
 * Tailwind utility class names (defined in globals.css) for mobile chrome spacing.
 * Panels with a sticky action bar should use `bottomNavWithStickyActions` on their
 * root wrapper; panels without sticky actions rely on the shell's bottom-nav padding.
 */
export const MOBILE_CHROME_CLASS = {
  /** Fixed position for a sticky action bar sitting above the bottom nav. */
  stickyBarPosition: "bottom-above-nav",
  /** Extra bottom padding when a sticky action bar is present (mobile only). */
  bottomNavWithStickyActions: "pb-mobile-nav-actions lg:pb-0",
} as const;

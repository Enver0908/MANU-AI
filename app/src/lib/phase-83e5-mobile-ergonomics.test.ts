import { describe, expect, it } from "vitest";
import {
  MOBILE_CHROME_CLASS,
  MOBILE_FIELD_CLASS,
  MOBILE_BOTTOM_NAV_HEIGHT_REM,
  MOBILE_STICKY_ACTION_BAR_HEIGHT_REM,
  TOUCH_TARGET_CLASS,
  TOUCH_TARGET_MIN_PX,
  resolveInputKeyboard,
  withTouchTarget,
} from "./phase-83e5-mobile-ergonomics";

describe("phase 83e-5 mobile ergonomics helpers", () => {
  it("enforces a 44px minimum touch target", () => {
    expect(TOUCH_TARGET_MIN_PX).toBe(44);
    expect(TOUCH_TARGET_CLASS).toBe("min-h-11");
    expect(withTouchTarget("px-3 py-2")).toContain("min-h-11");
  });

  it("uses 16px on mobile and 14px on larger screens to prevent iOS zoom", () => {
    expect(MOBILE_FIELD_CLASS).toContain("text-base");
    expect(MOBILE_FIELD_CLASS).toContain("sm:text-sm");
    expect(MOBILE_FIELD_CLASS).toContain("min-h-11");
    expect(MOBILE_FIELD_CLASS).toContain("w-full");
  });

  it("maps semantic field kinds to keyboard-aware attributes", () => {
    expect(resolveInputKeyboard("email")).toMatchObject({
      type: "email",
      inputMode: "email",
      autoComplete: "email",
    });
    expect(resolveInputKeyboard("tel")).toMatchObject({ type: "tel", inputMode: "tel", autoComplete: "tel" });
    expect(resolveInputKeyboard("numeric").inputMode).toBe("numeric");
    expect(resolveInputKeyboard("search")).toMatchObject({ type: "search", enterKeyHint: "search" });
  });

  it("defaults to a safe text keyboard", () => {
    expect(resolveInputKeyboard()).toEqual({
      type: "text",
      inputMode: "text",
      autoComplete: "off",
      enterKeyHint: "done",
    });
  });

  it("exposes mobile chrome spacing constants for sticky bars and content padding", () => {
    expect(MOBILE_BOTTOM_NAV_HEIGHT_REM).toBe(3.5);
    expect(MOBILE_STICKY_ACTION_BAR_HEIGHT_REM).toBe(3.5);
    expect(MOBILE_CHROME_CLASS.stickyBarPosition).toBe("bottom-above-nav");
    expect(MOBILE_CHROME_CLASS.bottomNavWithStickyActions).toContain("pb-mobile-nav-actions");
  });
});

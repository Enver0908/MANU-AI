import { describe, expect, it } from "vitest";
import { cn } from "./cn";
import {
  PHASE_85_COLORS,
  RADIUS_PX,
  badgeToneClasses,
  buttonClasses,
  iconToneClass,
  MESSAGE_ORIGIN,
  MESSAGE_RISK,
  type MessageOrigin,
  type Tone,
} from "./tokens";

describe("phase 85 design system foundation tokens", () => {
  it("joins truthy class values and drops falsy ones", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
    expect(cn()).toBe("");
  });

  it("keeps every surface radius within the 8px design constraint", () => {
    for (const value of Object.values(RADIUS_PX)) {
      expect(value).toBeLessThanOrEqual(8);
    }
    expect(RADIUS_PX.card).toBe(8);
  });

  it("records the user-provided redesign palette", () => {
    expect(PHASE_85_COLORS.paper).toBe("#FBFAF8");
    expect(PHASE_85_COLORS.ink).toBe("#111116");
    expect(PHASE_85_COLORS.primaryPlum).toBe("#612E82");
    expect(PHASE_85_COLORS.sage).toBe("#578F6B");
    expect(PHASE_85_COLORS.warm).toBe("#D79800");
  });

  it("builds command button classes with an accessible touch target for md", () => {
    const primaryMd = buttonClasses("primary", "md");
    expect(primaryMd).toContain("bg-primary");
    expect(primaryMd).toContain("hover:bg-primary-hover");
    expect(primaryMd).toContain("rounded-control");
    expect(primaryMd).toContain("min-h-11");
    expect(buttonClasses("secondary")).toContain("border-line");
    expect(buttonClasses("danger")).toContain("text-red-700");
  });

  it("maps generic UI tones to the approved editorial palette", () => {
    const tones: Tone[] = ["plum", "sage", "warm", "red", "stone"];
    const classes = tones.map((tone) => badgeToneClasses(tone));
    expect(new Set(classes).size).toBe(tones.length);
    expect(badgeToneClasses("plum")).toContain("text-primary");
    expect(badgeToneClasses("sage")).toContain("text-sage");
    expect(badgeToneClasses("warm")).toContain("text-warm");
    expect(iconToneClass("plum")).toBe("text-primary");
    expect(iconToneClass("sage")).toBe("text-sage");
    expect(iconToneClass("warm")).toBe("text-warm");
  });

  it("keeps emerald as a backwards-compatible alias for sage", () => {
    expect(badgeToneClasses("emerald")).toBe(badgeToneClasses("sage"));
    expect(iconToneClass("emerald")).toBe(iconToneClass("sage"));
    expect(badgeToneClasses("amber")).toBe(badgeToneClasses("warm"));
    expect(iconToneClass("amber")).toBe(iconToneClass("warm"));
  });

  it("maps all five message origins with distinguishable labels", () => {
    const origins: MessageOrigin[] = [
      "client_inbound",
      "ai_generated",
      "dietitian_manual",
      "system_event",
      "imported_unknown",
    ];
    for (const origin of origins) {
      expect(MESSAGE_ORIGIN[origin].label.length).toBeGreaterThan(0);
    }
    expect(MESSAGE_ORIGIN.ai_generated.label).toBe("AI");
    expect(MESSAGE_ORIGIN.ai_generated.tone).toBe("sage");
    expect(MESSAGE_ORIGIN.dietitian_manual.label).toBe("Dietitian");
    expect(MESSAGE_ORIGIN.dietitian_manual.tone).toBe("warm");
  });

  it("reserves green/yellow/red exclusively for clinical message risk", () => {
    expect(Object.keys(MESSAGE_RISK).sort()).toEqual(["green", "red", "yellow"]);
    expect(MESSAGE_RISK.green.classes).toContain("green");
    expect(MESSAGE_RISK.yellow.classes).toContain("yellow");
    expect(MESSAGE_RISK.red.classes).toContain("red");
    // Generic tones must not expose a green risk color as a normal UI tone.
    const genericTones: Tone[] = ["plum", "sage", "warm", "emerald", "amber", "red", "stone"];
    expect(genericTones).not.toContain("green" as Tone);
    expect(genericTones).not.toContain("yellow" as Tone);
  });
});

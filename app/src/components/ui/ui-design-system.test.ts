import { describe, expect, it } from "vitest";
import { cn } from "./cn";
import {
  RADIUS_PX,
  badgeToneClasses,
  buttonClasses,
  iconToneClass,
  MESSAGE_ORIGIN,
  MESSAGE_RISK,
  type MessageOrigin,
  type Tone,
} from "./tokens";

describe("phase 83e-1 design system tokens", () => {
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

  it("builds command button classes with an accessible touch target for md", () => {
    const primaryMd = buttonClasses("primary", "md");
    expect(primaryMd).toContain("bg-emerald-950");
    expect(primaryMd).toContain("rounded-card");
    expect(primaryMd).toContain("min-h-11");
    expect(buttonClasses("secondary")).toContain("border-line");
    expect(buttonClasses("danger")).toContain("text-red-700");
  });

  it("gives each generic tone a distinct badge style", () => {
    const tones: Tone[] = ["emerald", "amber", "red", "stone"];
    const classes = tones.map((tone) => badgeToneClasses(tone));
    expect(new Set(classes).size).toBe(tones.length);
    expect(iconToneClass("emerald")).not.toBe(iconToneClass("stone"));
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
    expect(MESSAGE_ORIGIN.dietitian_manual.label).toBe("Dietitian");
  });

  it("reserves green/yellow/red exclusively for clinical message risk", () => {
    expect(Object.keys(MESSAGE_RISK).sort()).toEqual(["green", "red", "yellow"]);
    expect(MESSAGE_RISK.green.classes).toContain("green");
    expect(MESSAGE_RISK.yellow.classes).toContain("yellow");
    expect(MESSAGE_RISK.red.classes).toContain("red");
    // Generic tones must not expose a green risk color as a normal UI tone.
    const genericTones: Tone[] = ["emerald", "amber", "red", "stone"];
    expect(genericTones).not.toContain("green" as Tone);
    expect(genericTones).not.toContain("yellow" as Tone);
  });
});

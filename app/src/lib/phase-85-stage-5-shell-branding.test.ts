import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("siriusai branding assets", () => {
  const publicDir = join(process.cwd(), "public");

  it("uses SiriusAI manifest branding with unlocked orientation and raster icons", () => {
    const manifest = JSON.parse(readFileSync(join(publicDir, "manifest.webmanifest"), "utf8")) as {
      name: string;
      short_name: string;
      orientation: string;
      theme_color: string;
      icons: Array<{ src: string; purpose?: string }>;
    };
    expect(manifest.name).toBe("SiriusAI");
    expect(manifest.short_name).toBe("SiriusAI");
    expect(manifest.orientation).toBe("any");
    expect(manifest.theme_color.toLowerCase()).toBe("#612e82");
    expect(manifest.name.toLowerCase()).not.toContain("manu");
    expect(manifest.icons.some((icon) => icon.src.includes("siriusai-180.png"))).toBe(true);
    expect(manifest.icons.some((icon) => icon.src.includes("siriusai-192.png"))).toBe(true);
    expect(manifest.icons.some((icon) => icon.src.includes("siriusai-512.png"))).toBe(true);
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("ships required icon raster files", () => {
    for (const file of [
      "icons/siriusai-180.png",
      "icons/siriusai-192.png",
      "icons/siriusai-512.png",
      "icons/siriusai-192-maskable.png",
      "icons/siriusai-512-maskable.png",
      "icon.svg",
    ]) {
      expect(existsSync(join(publicDir, file))).toBe(true);
    }
  });
});

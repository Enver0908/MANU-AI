import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AIya branding assets", () => {
  const publicDir = join(process.cwd(), "public");

  it("uses AIya manifest branding without orientation lock and with raster icons", () => {
    const manifest = JSON.parse(readFileSync(join(publicDir, "manifest.webmanifest"), "utf8")) as {
      name: string;
      short_name: string;
      orientation?: string;
      theme_color: string;
      start_url: string;
      icons: Array<{ src: string; purpose?: string }>;
    };
    expect(manifest.name).toBe("AIya");
    expect(manifest.short_name).toBe("AIya");
    expect(manifest.orientation).toBeUndefined();
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.theme_color.toLowerCase()).toBe("#612e82");
    expect(manifest.name.toLowerCase()).not.toContain("manu");
    expect(manifest.icons.some((icon) => icon.src.includes("aiya-180.png"))).toBe(true);
    expect(manifest.icons.some((icon) => icon.src.includes("aiya-192.png"))).toBe(true);
    expect(manifest.icons.some((icon) => icon.src.includes("aiya-512.png"))).toBe(true);
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("ships required icon raster files plus one-release legacy aliases", () => {
    for (const file of [
      "icons/aiya-180.png",
      "icons/aiya-192.png",
      "icons/aiya-512.png",
      "icons/aiya-192-maskable.png",
      "icons/aiya-512-maskable.png",
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

import type { Page } from "@playwright/test";

export type Stage7GeometryFailure = {
  code: string;
  detail: string;
};

export async function collectStage7GeometryFailures(page: Page): Promise<Stage7GeometryFailure[]> {
  return page.evaluate(() => {
    const failures: { code: string; detail: string }[] = [];
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    if (overflow > 1) {
      failures.push({ code: "horizontal-overflow", detail: `page overflow ${overflow}px` });
    }

    const candidates = Array.from(
      document.querySelectorAll("button, a, [role='button'], input, select, textarea"),
    ) as HTMLElement[];
    for (const node of candidates) {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.width === 0 || rect.height === 0) {
        failures.push({ code: "zero-box", detail: `${node.tagName.toLowerCase()} has a zero bounding box` });
        continue;
      }
      const isPrimary =
        node.tagName === "BUTTON" ||
        node.getAttribute("role") === "button" ||
        node.getAttribute("type") === "submit";
      if (isPrimary && (rect.width < 44 || rect.height < 44) && getComputedStyle(node).display !== "none") {
        failures.push({
          code: "touch-target",
          detail: `${node.tagName.toLowerCase()} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        });
      }
    }

    const sticky = Array.from(
      document.querySelectorAll("header, footer, nav, aside, dialog, [role='dialog'], [class*='sticky'], [class*='fixed']"),
    ).filter((node) => {
      const style = getComputedStyle(node);
      return style.position === "sticky" || style.position === "fixed";
    }) as HTMLElement[];
    const focus = document.activeElement as HTMLElement | null;
    if (focus) {
      const focusRect = focus.getBoundingClientRect();
      for (const layer of sticky) {
        const layerRect = layer.getBoundingClientRect();
        const covers =
          focusRect.width > 0 &&
          focusRect.top >= layerRect.top &&
          focusRect.bottom <= layerRect.bottom &&
          focusRect.left >= layerRect.left &&
          focusRect.right <= layerRect.right &&
          layer.contains(focus) === false;
        if (covers) {
          failures.push({ code: "focus-obscured", detail: "focused control is fully covered by a sticky/fixed layer" });
        }
      }
    }

    const textNodes = Array.from(document.querySelectorAll("p, h1, h2, h3, button, a, label, td, li"));
    for (const node of textNodes) {
      const el = node as HTMLElement;
      if (el.scrollWidth - el.clientWidth > 8 && getComputedStyle(el).whiteSpace === "nowrap") {
        failures.push({ code: "clipped-text", detail: (el.textContent ?? "").trim().slice(0, 80) });
      }
    }
    return failures.slice(0, 20);
  });
}

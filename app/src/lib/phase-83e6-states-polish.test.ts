import { describe, expect, it } from "vitest";
import {
  ALERT_BANNER_LIVE,
  DASHBOARD_MAIN_ID,
  FOCUS_RING_CLASS,
  SKELETON_BLOCK_CLASS,
  STATUS_BANNER_LIVE,
} from "./phase-83e6-states-polish";

describe("phase 83e-6 states polish constants", () => {
  it("exposes accessible focus and skeleton utility classes", () => {
    expect(FOCUS_RING_CLASS).toContain("focus-visible:outline-emerald-800");
    expect(SKELETON_BLOCK_CLASS).toContain("animate-pulse");
  });

  it("defines dashboard main landmark id and banner live regions", () => {
    expect(DASHBOARD_MAIN_ID).toBe("dashboard-main");
    expect(STATUS_BANNER_LIVE).toBe("polite");
    expect(ALERT_BANNER_LIVE).toBe("assertive");
  });
});

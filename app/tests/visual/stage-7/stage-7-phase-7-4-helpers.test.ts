import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STAGE7_WCAG_TAGS } from "./stage-7-axe";
import { scanArtifactPrivacy } from "./stage-7-redaction";

const STAGE5_TARGETS = {
  lcpMs: 2500,
  cls: 0.1,
  tbtMs: 200,
  interactionProxyMs: 200,
  gzipMultiplier: 1.1,
};

const STAGE7_PERF_ROUTES = [
  "/",
  "/login",
  "/purchase",
  "/app-install",
  "/admin",
  "/dashboard",
  "/dashboard?section=clients",
  "/dashboard?section=messages",
  "/dashboard?section=alerts",
  "/dashboard?section=notifications",
  "/dashboard/ai-chat",
  "/dashboard/settings",
];

describe("stage 7.4 accessibility, browser, and performance helpers", () => {
  it("centralizes the WCAG 2.0/2.1/2.2 A and AA axe tag set", () => {
    expect(STAGE7_WCAG_TAGS).toEqual([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22a",
      "wcag22aa",
    ]);
    const axe = readFileSync(join(__dirname, "stage-7-axe.ts"), "utf8");
    expect(axe).toContain("incompletes");
    expect(axe).toContain("STAGE7_WCAG_TAGS");
    expect(axe).not.toContain("best-practice");
  });

  it("keeps Stage 5 lab budgets and Stage 7.4 route scope", () => {
    const measure = readFileSync(
      join(process.cwd(), "scripts", "measure-stage-7-lab-perf.mjs"),
      "utf8",
    );
    const stage5 = readFileSync(
      join(process.cwd(), "scripts", "measure-stage-5-lab-perf.mjs"),
      "utf8",
    );
    expect(measure).toContain(`lcpMs: ${STAGE5_TARGETS.lcpMs}`);
    expect(measure).toContain(`cls: ${STAGE5_TARGETS.cls}`);
    expect(measure).toContain(`tbtMs: ${STAGE5_TARGETS.tbtMs}`);
    expect(measure).toContain(`interactionProxyMs: ${STAGE5_TARGETS.interactionProxyMs}`);
    expect(measure).toContain("shellGzipMaxMultiplierAgainstStage5Baseline: 1.1");
    expect(measure).toContain("local_lab_only");
    expect(measure).toContain("NO-GO");
    expect(measure).not.toContain("field Core Web Vitals");
    for (const route of STAGE7_PERF_ROUTES) {
      expect(measure).toContain(route);
    }
    expect(stage5).toContain("lcpMs: 2500");
    expect(stage5).toContain("cls: 0.1");
  });

  it("moves offline-lock keyboard focus onto the retry control and traps dirty dialog focus", () => {
    const shell = readFileSync(
      join(process.cwd(), "src", "components", "dashboard", "dashboard-shell.tsx"),
      "utf8",
    );
    const dirty = readFileSync(
      join(process.cwd(), "src", "components", "dashboard", "shell-dirty-navigation-dialog.tsx"),
      "utf8",
    );
    const runner = readFileSync(join(__dirname, "stage-7-runner.ts"), "utf8");
    expect(shell).toContain("focusable?.focus()");
    expect(shell).toContain("data-testid=\"shell-retry\"");
    expect(shell).toContain("data-testid=\"skip-link\"");
    expect(dirty).toContain("useModalFocus(true, panelRef, request.onStay)");
    expect(dirty).toContain("role=\"alertdialog\"");
    expect(runner).not.toContain("reload(");
  });

  it("requires NVDA evidence to PASS and never treats absence as PASS", () => {
    const verify = readFileSync(join(process.cwd(), "scripts", "verify-stage-7.mjs"), "utf8");
    const nvda = readFileSync(join(process.cwd(), "scripts", "run-stage-7-nvda-smoke.mjs"), "utf8");
    expect(verify).toContain("stage_7_4_nvda_not_pass");
    expect(verify).toContain("nvda.status === \"BLOCKED\"");
    expect(nvda).toContain("nvda.exe");
    expect(nvda).toContain("BLOCKED");
    expect(nvda).toContain("form-dialog");
    expect(nvda).toContain("login");
    expect(nvda).toContain("dashboard-navigation");
    expect(nvda).toContain("client-selection");
    expect(nvda).toContain("messaging");
    expect(nvda).not.toContain("skip NVDA");
  });

  it("keeps stage 7.4 sources free of forbidden artifacts", () => {
    const helperSource = readFileSync(join(__dirname, "stage-7-phase-7-4-helpers.test.ts"), "utf8");
    expect(scanArtifactPrivacy("dietitian@example.com +15555550100")).toEqual([]);
    expect(scanArtifactPrivacy(helperSource)).toEqual([]);
  });
});

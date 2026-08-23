import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CORE_SEEDS, buildStage7Scenarios } from "./stage-7-catalog";
import { scanArtifactPrivacy } from "./stage-7-redaction";
import { hasCapability } from "../../../src/lib/app-capability-contracts";
import { buildWorkspaceCapabilities } from "../../../src/lib/phase-85-stage-6-dashboard-contracts";
import type { TenantRole } from "../../../src/lib/types";

const STAGE_7_3_SURFACES = [
  "dashboard-shell",
  "dashboard-overview",
  "dashboard-clients",
  "dashboard-forms",
  "dashboard-nutrition",
  "dashboard-menu",
  "dashboard-ai",
  "dashboard-messaging",
  "dashboard-alerts",
  "dashboard-simulator",
  "dashboard-ai-chat",
  "dashboard-voice",
  "dashboard-forms-library",
  "dashboard-settings",
  "pwa",
] as const;

const MUTATING_ROLES: TenantRole[] = ["owner", "admin", "dietitian"];
const READ_ONLY_ROLES: TenantRole[] = ["assistant", "auditor"];

describe("stage 7.3 dashboard and PWA helpers", () => {
  it("keeps every dashboard and PWA surface in the executable catalog", () => {
    const scenarios = buildStage7Scenarios();
    for (const surface of STAGE_7_3_SURFACES) {
      expect(CORE_SEEDS.some((seed) => seed.surface === surface)).toBe(true);
      expect(scenarios.some((scenario) => scenario.surface === surface)).toBe(true);
    }
  });

  it("locks existing role capabilities without inventing new permissions", () => {
    for (const role of MUTATING_ROLES) {
      expect(hasCapability(role, "update_client")).toBe(true);
      expect(buildWorkspaceCapabilities(role).canUpdateClient).toBe(true);
      expect(buildWorkspaceCapabilities(role).canReleaseTakeover).toBe(true);
    }
    for (const role of READ_ONLY_ROLES) {
      expect(hasCapability(role, "update_client")).toBe(false);
      expect(hasCapability(role, "dietitian_ai_chat")).toBe(false);
      expect(buildWorkspaceCapabilities(role).canUpdateClient).toBe(false);
      expect(buildWorkspaceCapabilities(role).canReleaseTakeover).toBe(false);
      expect(buildWorkspaceCapabilities(role).canExportClient).toBe(false);
    }
    expect(hasCapability("dietitian", "dietitian_ai_chat")).toBe(true);
    expect(hasCapability("owner", "read_operational_foundation")).toBe(true);
    expect(hasCapability("auditor", "read_operational_foundation")).toBe(false);
  });

  it("drives PWA offline lock on the product document instead of a Chromium reload", () => {
    const runner = readFileSync(join(__dirname, "stage-7-runner.ts"), "utf8");
    const start = runner.indexOf("pwa-offline-lock");
    expect(start).toBeGreaterThan(-1);
    const slice = runner.slice(start, start + 900);
    expect(slice).toContain("dispatchEvent(new Event(\"offline\"))");
    expect(slice).not.toContain("reload(");
  });

  it("keeps shell offline, update, and dirty contracts in the product chrome", () => {
    const shell = readFileSync(
      join(process.cwd(), "src", "components", "dashboard", "dashboard-shell.tsx"),
      "utf8",
    );
    const dirtyDialog = readFileSync(
      join(process.cwd(), "src", "components", "dashboard", "shell-dirty-navigation-dialog.tsx"),
      "utf8",
    );
    expect(shell).toContain("data-testid=\"shell-blocker\"");
    expect(shell).toContain("data-testid=\"shell-retry\"");
    expect(shell).toContain("data-testid=\"authenticated-shell\"");
    expect(shell).toContain("shell-update-waiting-banner");
    expect(dirtyDialog).toContain("shell-dirty-navigation-dialog");
  });

  it("keeps stage 7.3 evidence and helper sources free of forbidden artifacts", () => {
    const evidence = readFileSync(
      join(process.cwd(), "..", "docs", "PHASE_85_STAGE_7_PHASE_3_DASHBOARD_PWA_REMEDIATION_EVIDENCE.md"),
      "utf8",
    );
    const helperSource = readFileSync(join(__dirname, "stage-7-phase-7-3-helpers.test.ts"), "utf8");
    expect(scanArtifactPrivacy(evidence)).toEqual([]);
    expect(scanArtifactPrivacy(helperSource)).toEqual([]);
  });
});

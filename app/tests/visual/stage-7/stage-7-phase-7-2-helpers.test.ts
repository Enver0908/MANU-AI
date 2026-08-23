import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CORE_SEEDS, buildStage7Scenarios } from "./stage-7-catalog";
import { scanArtifactPrivacy } from "./stage-7-redaction";
import { buildFieldDescribedBy } from "../../../src/components/ui/field";
import { MESSAGE_RISK, buttonClasses } from "../../../src/components/ui/tokens";

const STAGE_7_2_SURFACES = new Set([
  "public",
  "auth",
  "purchase",
  "onboarding",
  "install",
  "admin",
  "emergency-admin",
]);

describe("stage 7.2 public and shared helpers", () => {
  it("keeps every public and commercial surface in the executable catalog", () => {
    const scenarios = buildStage7Scenarios();
    for (const surface of STAGE_7_2_SURFACES) {
      expect(CORE_SEEDS.some((seed) => seed.surface === surface)).toBe(true);
      expect(scenarios.some((scenario) => scenario.surface === surface)).toBe(true);
    }
  });

  it("associates field errors before hints and keeps danger off clinical risk red", () => {
    expect(
      buildFieldDescribedBy({ error: true, hint: true, errorId: "e", hintId: "h" }),
    ).toBe("e");
    expect(buttonClasses("danger")).toContain("text-destructive");
    expect(buttonClasses("danger")).not.toContain("text-red-700");
    expect(MESSAGE_RISK.red.classes).toContain("red");
  });

  it("keeps stage 7.2 evidence and helper sources free of forbidden artifacts", () => {
    const evidence = readFileSync(
      join(process.cwd(), "..", "docs", "PHASE_85_STAGE_7_PHASE_2_PUBLIC_SHARED_REMEDIATION_EVIDENCE.md"),
      "utf8",
    );
    const helperSource = readFileSync(join(__dirname, "stage-7-phase-7-2-helpers.test.ts"), "utf8");
    expect(scanArtifactPrivacy(evidence)).toEqual([]);
    expect(scanArtifactPrivacy(helperSource)).toEqual([]);
  });
});

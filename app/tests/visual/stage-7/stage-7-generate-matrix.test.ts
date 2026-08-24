import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildStage7Scenarios } from "./stage-7-catalog";

describe("stage-7 matrix generator", () => {
  it("writes the executable scenario matrix only when explicitly invoked", () => {
    const matrixPath = join(process.cwd(), "..", "docs", "PHASE_85_STAGE_7_SCENARIO_MATRIX.json");
    const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
    const scenarios = buildStage7Scenarios();
    matrix.status = "STAGE_7_1_EXECUTABLE_CATALOG";
    matrix.executableScenarios = scenarios;
    writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`);
    expect(scenarios.length).toBeGreaterThan(80);
  });
});

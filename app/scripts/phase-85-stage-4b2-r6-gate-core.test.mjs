import { describe, expect, it } from "vitest";
import {
  buildR6GateReport,
  classifyRlsGateResult,
  collectAddedDiffViolations,
} from "./phase-85-stage-4b2-r6-gate-core.mjs";

describe("phase 85 stage 4b-2 R6 gate core", () => {
  it("blocks skipped RLS instead of treating it as pass", () => {
    expect(classifyRlsGateResult({ exitCode: 0, output: "Test Files 1 skipped\nTests 35 skipped" })).toEqual({
      status: "blocked",
      reason: "rls_suite_skipped",
    });
    expect(classifyRlsGateResult({ exitCode: 0, output: "Tests 35 passed" }).status).toBe("pass");
  });

  it("detects secrets and forbidden names only in newly added diff lines", () => {
    const forbiddenPhaseName = ["Phase", "86"].join(" ");
    const oldLiveKey = ["sk", "live", "old"].join("_");
    const newLiveKey = ["sk", "live", "new"].join("_");
    expect(collectAddedDiffViolations(`- ${oldLiveKey}\n+ normal text\n`)).toEqual([]);
    expect(collectAddedDiffViolations(`+ ${newLiveKey}\n+ Next is ${forbiddenPhaseName}\n`)).toEqual([
      "live_stripe_key",
      "forbidden_phase_name",
    ]);
  });

  it("fails closed when any independent check is blocked or failed", () => {
    expect(
      buildR6GateReport([
        { name: "core", status: "pass", reason: "completed", exitCode: 0, durationMs: 1 },
        { name: "rls", status: "blocked", reason: "rls_suite_skipped", exitCode: 0, durationMs: 1 },
      ]),
    ).toMatchObject({ status: "blocked", productionPilotGo: false });
    expect(
      buildR6GateReport([
        { name: "core", status: "fail", reason: "exit_1", exitCode: 1, durationMs: 1 },
      ]).status,
    ).toBe("fail");
  });
});

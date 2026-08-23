import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildStage7Scenarios, listMandatoryStates } from "./stage-7-catalog";
import { computeFindingFingerprint, mergeFindingsByFingerprint, stripVolatileFields } from "./stage-7-fingerprint";
import { pairwiseCombinations } from "./stage-7-pairwise";
import { assertArtifactPrivacy, scanArtifactPrivacy } from "./stage-7-redaction";
import {
  parseStage7Finding,
  parseStage7Scenario,
  transitionFindingStatus,
} from "./stage-7-schema";

describe("stage-7 contracts", () => {
  it("parses a valid scenario and rejects duplicates", () => {
    const scenarios = buildStage7Scenarios();
    expect(scenarios.length).toBeGreaterThan(80);
    const ids = new Set(scenarios.map((scenario) => scenario.id));
    expect(ids.size).toBe(scenarios.length);
    expect(listMandatoryStates().length).toBeGreaterThan(40);
    expect(() => parseStage7Scenario(scenarios[0])).not.toThrow();
    const surfaces = new Set(scenarios.map((scenario) => scenario.surface));
    for (const surface of surfaces) {
      const states = scenarios.filter((scenario) => scenario.surface === surface).map((scenario) => scenario.state);
      const hasErrorOrEmpty = states.some((state) =>
        /empty|error|invalid|offline|forbidden|restricted|unauth|ineligible|revoked|lock|failure|conflict|stale|duplicate/.test(
          state,
        ),
      );
      const hasBaseline = states.some(
        (state) =>
          !/error|invalid|offline|forbidden|restricted|unauth|ineligible|revoked|failure/.test(state),
      );
      expect(hasErrorOrEmpty && hasBaseline).toBe(true);
    }
    const matrixPath = join(process.cwd(), "..", "docs", "PHASE_85_STAGE_7_SCENARIO_MATRIX.json");
    const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
    matrix.status = "STAGE_7_1_EXECUTABLE_CATALOG";
    matrix.executableScenarios = scenarios;
    writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`);
  });

  it("keeps finding fingerprints stable after volatile field stripping", () => {
    const finding = parseStage7Finding({
      id: "S7-F-demo-01",
      fingerprint: "pending",
      category: "geometry",
      severity: "P2",
      status: "open",
      surface: "public",
      scenarioId: "public.contact-empty.dietitian.tr.chromium-desktop",
      role: "dietitian",
      locale: "tr",
      browser: "chromium-desktop",
      viewport: "desktop-1440",
      wcagCriteria: ["1.4.10"],
      expected: "No horizontal overflow",
      actual: "page overflow 12px at http://127.0.0.1:3100/ 2026-08-22T09:00:00+03:00",
      reproductionSteps: ["open /"],
      evidenceRefs: ["shot"],
      rootCause: "layout",
      remediationPhase: "7.2",
      resolutionEvidence: [],
    });
    const first = computeFindingFingerprint(finding);
    const second = computeFindingFingerprint({
      ...finding,
      actual: "page overflow 12px at http://127.0.0.1:9999/ 2026-08-23T11:11:11+03:00",
    });
    expect(first).toBe(second);
    expect(stripVolatileFields({ timestamp: "x", keep: 1 })).toEqual({ keep: 1 });
    expect(mergeFindingsByFingerprint([finding, { ...finding }])).toHaveLength(1);
  });

  it("redacts non-synthetic secrets and allows example.com fixtures", () => {
    expect(scanArtifactPrivacy("dietitian.stage7@example.com +15555550100")).toEqual([]);
    expect(scanArtifactPrivacy("Authorization: Bearer abc.def.ghi")).not.toHaveLength(0);
    expect(() => assertArtifactPrivacy("user@gmail.com", "fixture")).toThrow();
  });

  it("covers pairwise combinations without cartesian explosion", () => {
    const rows = pairwiseCombinations({
      role: ["owner", "admin", "dietitian"],
      locale: ["tr", "en", "de"],
      browser: ["chromium-desktop", "webkit-iphone"],
    });
    expect(rows.length).toBeLessThan(3 * 3 * 2);
    expect(rows.length).toBeGreaterThan(3);
  });

  it("enforces finding status transitions and accepted_p3 metadata", () => {
    expect(transitionFindingStatus("open", "in_remediation")).toBe("in_remediation");
    expect(() => transitionFindingStatus("resolved", "accepted_p3")).toThrow();
    expect(() =>
      parseStage7Finding({
        id: "S7-F-p3",
        fingerprint: "x",
        category: "visual",
        severity: "P2",
        status: "accepted_p3",
        surface: "public",
        scenarioId: "s",
        role: "dietitian",
        locale: "tr",
        browser: "chromium-desktop",
        viewport: "desktop-1440",
        wcagCriteria: [],
        expected: "a",
        actual: "b",
        reproductionSteps: [],
        evidenceRefs: [],
        rootCause: "n/a",
        remediationPhase: "7.2",
        resolutionEvidence: [],
        acceptedBy: "user",
        acceptedAt: "2026-08-22T09:00:00+03:00",
        acceptanceReason: "cosmetic",
      }),
    ).toThrow(/P3/);
  });
});

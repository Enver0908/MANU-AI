import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  STAGE_4C_LOCAL_CLOSURE_END,
  STAGE_4C_LOCAL_CLOSURE_START,
  buildStage4CLocalClosureEvidenceBody,
  buildStage4CLocalClosureReport,
  parseVitestRunSummary,
  upsertStage4CLocalClosureEvidence,
  writeStage4CLocalClosureEvidence,
} from "../../scripts/lib/stage-4c-rehearsal-evidence.mjs";

const tempDirs = [];

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "stage-4c-evidence-"));
  tempDirs.push(dir);
  return dir;
}

function passReport(overrides = {}) {
  return {
    ...buildStage4CLocalClosureReport({
      checks: [
        {
          name: "rls_integration_suite",
          status: "pass",
          reason: "completed",
          exitCode: 0,
          durationMs: 1234,
          summary: parseVitestRunSummary("Test Files  1 passed (1)\nTests  12 passed (12)"),
        },
      ],
      rlsSummary: parseVitestRunSummary("Test Files  1 passed (1)\nTests  12 passed (12)"),
      recordedAt: "2026-07-27T00:00:00.000Z",
    }),
    ...overrides,
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Stage 4C rehearsal evidence writer", () => {
  it("parses exact vitest test and test-file counts", () => {
    const summary = parseVitestRunSummary("Test Files  2 passed | 1 skipped (3)\nTests  42 passed | 3 skipped (45)");
    expect(summary).toMatchObject({
      parseable: true,
      passed: 42,
      failed: 0,
      skipped: 3,
      timedOut: 0,
      total: 45,
      testFiles: {
        passed: 2,
        failed: 0,
        skipped: 1,
      },
    });
  });

  it("preserves historical remediation content outside bounded markers", () => {
    const existing = [
      "# Evidence",
      "",
      "Historical Faz 8 text must stay.",
      "",
      STAGE_4C_LOCAL_CLOSURE_START,
      "old generated body",
      STAGE_4C_LOCAL_CLOSURE_END,
      "",
      "Historical Faz 7 text must stay.",
      "",
    ].join("\n");
    const updated = upsertStage4CLocalClosureEvidence(existing, buildStage4CLocalClosureEvidenceBody(passReport()));

    expect(updated).toContain("Historical Faz 8 text must stay.");
    expect(updated).toContain("Historical Faz 7 text must stay.");
    expect(updated).not.toContain("old generated body");
    expect(updated).toContain("PASS_LOCAL_STAGE_4C_REMEDIATED");
  });

  it("updates the bounded generated section idempotently", () => {
    const first = upsertStage4CLocalClosureEvidence("# Evidence\n", buildStage4CLocalClosureEvidenceBody(passReport()));
    const second = upsertStage4CLocalClosureEvidence(first, buildStage4CLocalClosureEvidenceBody(passReport()));

    expect(second).toBe(first);
    expect(second.match(new RegExp(STAGE_4C_LOCAL_CLOSURE_START, "g"))).toHaveLength(1);
    expect(second.match(new RegExp(STAGE_4C_LOCAL_CLOSURE_END, "g"))).toHaveLength(1);
  });

  it("does not write evidence for failed or skipped closure reports", () => {
    const dir = makeTempDir();
    const evidencePath = join(dir, "evidence.md");
    writeFileSync(evidencePath, "unchanged", "utf8");

    expect(() => writeStage4CLocalClosureEvidence(evidencePath, passReport({ status: "fail" }))).toThrow(
      "stage_4c_local_closure_evidence_requires_pass_report",
    );
    expect(readFileSync(evidencePath, "utf8")).toBe("unchanged");

    expect(() => writeStage4CLocalClosureEvidence(evidencePath, passReport({ rlsSkippedCount: 1 }))).toThrow(
      "stage_4c_local_closure_evidence_requires_zero_skipped_rls",
    );
    expect(readFileSync(evidencePath, "utf8")).toBe("unchanged");
  });

  it("fails closed when generated evidence markers are broken", () => {
    expect(() =>
      upsertStage4CLocalClosureEvidence(
        `# Evidence\n\n${STAGE_4C_LOCAL_CLOSURE_START}\nmissing end marker`,
        buildStage4CLocalClosureEvidenceBody(passReport()),
      ),
    ).toThrow("stage_4c_local_closure_evidence_marker_mismatch");
  });
});

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { PHASE_3_STAGES } from "./phase-3-plan.mjs";
import {
  assertCanBeginStage,
  buildApiContractMatrix,
  buildEvidence,
  createInitialState,
  stableDigest,
} from "./phase-3-contract.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

test("phase 3 manifest has four ordered stages with explicit contracts", () => {
  assert.deepEqual(PHASE_3_STAGES.map((stage) => stage.id), ["3.1", "3.2", "3.3", "3.4"]);
  for (const stage of PHASE_3_STAGES) {
    assert.ok(stage.title);
    assert.ok(stage.operations.length >= 4);
    assert.ok(stage.verificationRules.length >= 4);
    assert.ok(stage.requiredOutputFiles.length >= 1);
  }
});

test("phase 3 stage ordering rejects skipped stages", () => {
  const state = createInitialState({ repoRoot: ".", sourceCommit: "a".repeat(40), openedAt: "2026-09-08T00:00:00.000Z" });
  assert.throws(() => assertCanBeginStage(state, "3.2"), /prerequisite_not_verified/);
  assert.doesNotThrow(() => assertCanBeginStage(state, "3.1"));
});

test("phase 3 API matrix covers the current route tree and does not emit secrets", () => {
  const matrix = buildApiContractMatrix(repoRoot);
  assert.ok(matrix.counts.routeCount >= 100);
  assert.equal(matrix.routes.length, matrix.counts.routeCount);
  assert.equal(matrix.routes.filter((route) => route.methods.length === 0).length, 0);
  assert.doesNotMatch(JSON.stringify(matrix), /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|password\s*[:=]/i);
});

test("phase 3 evidence digest is deterministic and output writer remains secret-free", () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), "aiya-phase3-"));
  try {
    const evidence = buildEvidence({
      stage: PHASE_3_STAGES[0],
      sourceCommit: "b".repeat(40),
      status: "VERIFIED",
      outputFiles: [{ path: "docs/system-audit/phase-3/api-contract-matrix.json", sha256: "c".repeat(64) }],
      operations: PHASE_3_STAGES[0].operations.map((description, index) => ({ order: index + 1, description, status: "PASS", outputReferences: [] })),
      verification: { rules: PHASE_3_STAGES[0].verificationRules, result: "PASS" },
    });
    assert.equal(evidence.evidenceDigest, stableDigest({ ...evidence, evidenceDigest: null }));
    assert.equal(existsSync(temp), true);
    assert.equal(readFileSync(path.join(repoRoot, "tools/system-audit/phase-3/phase-3-plan.mjs"), "utf8").includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

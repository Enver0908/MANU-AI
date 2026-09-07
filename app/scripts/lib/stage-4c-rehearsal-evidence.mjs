import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const STAGE_4C_LOCAL_CLOSURE_EVIDENCE_VERSION =
  "p85-stage-4c-local-closure-rehearsal-evidence-v1";

export const STAGE_4C_LOCAL_CLOSURE_START =
  "<!-- STAGE_4C_LOCAL_CLOSURE_REHEARSAL:START -->";
export const STAGE_4C_LOCAL_CLOSURE_END =
  "<!-- STAGE_4C_LOCAL_CLOSURE_REHEARSAL:END -->";

export function parseVitestRunSummary(output) {
  const lines = output.split(/\r?\n/);
  const testsLine = lines.find((line) => /^\s*Tests\s+/i.test(line));
  const testFilesLine = lines.find((line) => /^\s*Test Files\s+/i.test(line));
  if (!testsLine && !testFilesLine) {
    return { parseable: false, passed: 0, failed: 0, skipped: 0, timedOut: 0, total: 0 };
  }

  const summaryLine = testsLine ?? testFilesLine ?? "";
  const passed = Number(summaryLine.match(/(\d+)\s+passed/i)?.[1] ?? 0);
  const failed = Number(summaryLine.match(/(\d+)\s+failed/i)?.[1] ?? 0);
  const skipped = Number(summaryLine.match(/(\d+)\s+skipped/i)?.[1] ?? 0);
  const timedOut = Number(summaryLine.match(/(\d+)\s+timed out/i)?.[1] ?? 0);
  const total = passed + failed + skipped + timedOut;
  const testFiles = testFilesLine
    ? {
        passed: Number(testFilesLine.match(/(\d+)\s+passed/i)?.[1] ?? 0),
        failed: Number(testFilesLine.match(/(\d+)\s+failed/i)?.[1] ?? 0),
        skipped: Number(testFilesLine.match(/(\d+)\s+skipped/i)?.[1] ?? 0),
      }
    : null;

  return {
    parseable: total > 0 || Boolean(testFilesLine),
    passed,
    failed,
    skipped,
    timedOut,
    total,
    testFiles,
  };
}

export function parsePlaywrightRunSummary(output) {
  const passed = Number(output.match(/(\d+)\s+passed/i)?.[1] ?? 0);
  const failed = Number(output.match(/(\d+)\s+failed/i)?.[1] ?? 0);
  const skipped = Number(output.match(/(\d+)\s+skipped/i)?.[1] ?? 0);
  const timedOut = Number(output.match(/(\d+)\s+timed out/i)?.[1] ?? 0);
  const total = passed + failed + skipped + timedOut;
  return {
    parseable: total > 0,
    passed,
    failed,
    skipped,
    timedOut,
    total,
  };
}

export function buildCommandSummary(name, output) {
  if (name === "visual_acceptance") {
    return parsePlaywrightRunSummary(output);
  }
  if (
    name.includes("tests") ||
    name === "app_unit_tests" ||
    name === "rls_integration_suite" ||
    name === "stage_4c_full_rehearsal"
  ) {
    return parseVitestRunSummary(output);
  }
  return null;
}

export function buildStage4CLocalClosureReport({
  checks,
  rlsSummary,
  recordedAt = new Date().toISOString(),
}) {
  return {
    version: STAGE_4C_LOCAL_CLOSURE_EVIDENCE_VERSION,
    status: "pass",
    verdict: "PASS_LOCAL_STAGE_4C_REMEDIATED",
    productionPilotGo: false,
    r405Open: true,
    rlsSkippedCount: rlsSummary.skipped,
    checks,
    measurementExpectations: {
      p95: {
        historyListP95Ms: 300,
        conversationLoadP95Ms: 300,
        runEventCatchUpP95Ms: 300,
        sendTransactionP95Ms: 500,
        contextToolP95Ms: 500,
        boundedRetrievalP95Ms: 2_000,
      },
      fixture: {
        dietitians: 100,
        clients: 5_000,
        chats: 10_000,
        messageVersions: 200_000,
      },
      explainProfiles: [
        "history_list",
        "conversation_load",
        "branch_chain",
        "run_event_catch_up",
        "context_gateway_access",
        "source_search",
        "job_claim",
        "deletion_claim",
      ],
      auditPolicy:
        "Only documented R-405 nested Next.js/PostCSS/Sharp findings may remain accepted; unknown production findings fail closure.",
    },
    recordedAt,
  };
}

function assertClosureReportIsWritable(report) {
  if (report.status !== "pass") {
    throw new Error("stage_4c_local_closure_evidence_requires_pass_report");
  }
  if (report.verdict !== "PASS_LOCAL_STAGE_4C_REMEDIATED") {
    throw new Error("stage_4c_local_closure_evidence_requires_remediated_verdict");
  }
  if (report.rlsSkippedCount !== 0) {
    throw new Error("stage_4c_local_closure_evidence_requires_zero_skipped_rls");
  }
  if (report.productionPilotGo !== false || report.r405Open !== true) {
    throw new Error("stage_4c_local_closure_evidence_requires_no_go_and_r405_open");
  }
}

function formatSummary(summary) {
  if (!summary?.parseable) return "summary_unparseable";
  const filePart = summary.testFiles
    ? `; files ${summary.testFiles.passed} passed, ${summary.testFiles.failed} failed, ${summary.testFiles.skipped} skipped`
    : "";
  return `${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.timedOut} timed out${filePart}`;
}

export function buildStage4CLocalClosureEvidenceBody(report) {
  assertClosureReportIsWritable(report);
  return `${STAGE_4C_LOCAL_CLOSURE_START}

## Latest Measured Local Closure

Status: **complete locally with measured zero-skip rehearsal evidence**

- Recorded at: ${report.recordedAt}
- Verdict: \`${report.verdict}\` (repo-local only; not production GO)
- RLS skipped count: ${report.rlsSkippedCount}
- Production pilot remains \`NO-GO\`
- R-405 remains open
- Real provider, channel, billing, monitoring, backup, secret-manager, and health-data egress gates remain closed

### Verification Chain

${report.checks
  .map(
    (check) =>
      `- ${check.name}: ${check.status} (${check.reason}, ${check.durationMs}ms)` +
      (check.summary ? `; ${formatSummary(check.summary)}` : ""),
  )
  .join("\n")}

### Measurement Expectations Captured By The Full Rehearsal

- Fixture: ${report.measurementExpectations.fixture.dietitians} dietitians, ${report.measurementExpectations.fixture.clients} clients, ${report.measurementExpectations.fixture.chats} chats, ${report.measurementExpectations.fixture.messageVersions} message versions
- P95 thresholds: history list ${report.measurementExpectations.p95.historyListP95Ms}ms; conversation load ${report.measurementExpectations.p95.conversationLoadP95Ms}ms; run event catch-up ${report.measurementExpectations.p95.runEventCatchUpP95Ms}ms; send transaction ${report.measurementExpectations.p95.sendTransactionP95Ms}ms; context tool ${report.measurementExpectations.p95.contextToolP95Ms}ms; bounded retrieval ${report.measurementExpectations.p95.boundedRetrievalP95Ms}ms
- EXPLAIN profiles requiring tenant-leading indexed plans: ${report.measurementExpectations.explainProfiles.join(", ")}
- Dependency audit policy: ${report.measurementExpectations.auditPolicy}

### Machine Report

\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`

${STAGE_4C_LOCAL_CLOSURE_END}
`;
}

export function upsertStage4CLocalClosureEvidence(existing, evidenceBody) {
  const startIndex = existing.indexOf(STAGE_4C_LOCAL_CLOSURE_START);
  const endIndex = existing.indexOf(STAGE_4C_LOCAL_CLOSURE_END);
  const hasStart = startIndex >= 0;
  const hasEnd = endIndex >= 0;
  if (hasStart !== hasEnd || (hasStart && endIndex < startIndex)) {
    throw new Error("stage_4c_local_closure_evidence_marker_mismatch");
  }
  if (!hasStart) {
    return `${existing.trimEnd()}\n\n${evidenceBody}`;
  }
  const suffix = existing
    .slice(endIndex + STAGE_4C_LOCAL_CLOSURE_END.length)
    .replace(/^\r?\n/u, "");
  return `${existing.slice(0, startIndex)}${evidenceBody}${suffix}`;
}

export function writeStage4CLocalClosureEvidence(evidencePath, report) {
  const evidenceBody = buildStage4CLocalClosureEvidenceBody(report);
  const existing = existsSync(evidencePath)
    ? readFileSync(evidencePath, "utf8")
    : `# Phase 85 Stage 4C Local Closure Rehearsal Evidence

Status: **pending measured local Supabase/Postgres closure**

This file is the dedicated target for the fail-fast \`npm run rehearse:stage-4c\` writer. Historical remediation evidence remains in \`docs/PHASE_85_STAGE_4C_REMEDIATION_EVIDENCE.md\` and must not be truncated by automated rehearsal updates.
`;
  const updated = upsertStage4CLocalClosureEvidence(existing, evidenceBody);
  writeFileSync(evidencePath, updated, "utf8");
  return updated;
}

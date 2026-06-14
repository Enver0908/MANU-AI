import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FULL_REHEARSAL_TARGET_COUNT,
  expandHarnessCasesDeterministically,
  loadHarnessCasesFromJsonl,
  runHarnessBatch,
} from "../src/ai-quality-evaluation-harness-v1.js";
import { handleInboundMessage } from "../src/orchestrator.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const seedCases = loadHarnessCasesFromJsonl(
  readFileSync(join(moduleDir, "../tests/ai-quality-harness-seed-cases.jsonl"), "utf8"),
);
const rehearsalCases = expandHarnessCasesDeterministically(seedCases, FULL_REHEARSAL_TARGET_COUNT);

const { metrics } = await runHarnessBatch(rehearsalCases, { handleInboundMessage });

console.log(
  JSON.stringify(
    {
      harnessVersion: metrics.harnessVersion,
      status: metrics.status,
      caseCount: metrics.caseCount,
      passCount: metrics.passCount,
      failureCount: metrics.failureCount,
      elapsedMs: metrics.elapsedMs,
      categoryCounts: metrics.categoryCounts,
    },
    null,
    2,
  ),
);

if (metrics.failureCount > 0) {
  console.error(metrics.failures.slice(0, 20).join("\n"));
  process.exit(1);
}

console.log("AI quality full rehearsal passed with mock provider only.");

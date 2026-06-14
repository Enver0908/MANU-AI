import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPANDED_REHEARSAL_CLIENT_COUNT,
  EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT,
  EXPANDED_REHEARSAL_TARGET_COUNT,
  expandHarnessCasesForClientScale,
  loadHarnessCasesFromJsonl,
  runExpandedRehearsalBatch,
} from "../src/index.js";
import { handleInboundMessage } from "../src/orchestrator.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const seedCases = loadHarnessCasesFromJsonl(
  readFileSync(join(moduleDir, "../tests/ai-quality-harness-seed-cases.jsonl"), "utf8"),
);
const rehearsalCases = expandHarnessCasesForClientScale(
  seedCases,
  EXPANDED_REHEARSAL_CLIENT_COUNT,
  EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT,
);

const { metrics } = await runExpandedRehearsalBatch(rehearsalCases, {
  handleInboundMessage,
  clientCount: EXPANDED_REHEARSAL_CLIENT_COUNT,
  messagesPerClient: EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT,
});

console.log(
  JSON.stringify(
    {
      rehearsalVersion: metrics.rehearsalVersion,
      status: metrics.status,
      clientCount: metrics.clientCount,
      messagesPerClient: metrics.messagesPerClient,
      caseCount: metrics.caseCount,
      turnCount: metrics.turnCount,
      unsafeClientSendCount: metrics.unsafeClientSendCount,
      sourceUnsupportedGreenCount: metrics.sourceUnsupportedGreenCount,
      forbiddenFoodApprovalCount: metrics.forbiddenFoodApprovalCount,
      yellowRedClientSendCount: metrics.yellowRedClientSendCount,
      claimOutsideManifestCount: metrics.claimOutsideManifestCount,
      narrowAutopilotEligibleCount: metrics.narrowAutopilotEligibleCount,
      responsePlanPassRate: metrics.responsePlanPassRate,
      claimGroundingPassRate: metrics.claimGroundingPassRate,
      styleSoftMismatchRate: metrics.styleSoftMismatchRate,
      elapsedMs: metrics.elapsedMs,
    },
    null,
    2,
  ),
);

if (metrics.status !== "pass") {
  console.error(metrics.failures.slice(0, 20).join("\n"));
  process.exit(1);
}

console.log(
  `Expanded AI quality rehearsal passed for ${EXPANDED_REHEARSAL_TARGET_COUNT} client-message cases with mock provider only.`,
);

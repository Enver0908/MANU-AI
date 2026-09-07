import type { Stage4CGoldenCorpusCase } from "./phase-85-stage-4c-golden-corpus-catalog";
import type { Stage4CHardZeroMetrics } from "./phase-85-stage-4c-closure";
import { evaluateStage4CGoldenCorpusCase } from "./phase-85-stage-4c-closure";
import type { AppTenantContext } from "./auth-context";
import { inMemoryAiChatStore, seedInMemoryClientGatewayFixture } from "./phase-85-stage-4c-in-memory-store";
import { maybeProcessDeterministicAiChatJobs } from "./phase-85-stage-4c-run-service";
import { resetInMemoryAiChatStoreForTests } from "./phase-85-stage-4c-store";

const CHAIN_TENANT: AppTenantContext = {
  tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  dietitianId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  role: "dietitian",
};
const CHAIN_CLIENT_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function shouldExerciseStoreChain(testCase: Stage4CGoldenCorpusCase) {
  if (testCase.expect.blocked) return false;
  if (testCase.runStatus) return true;
  if (testCase.category === "risk" || testCase.category === "client_retrieval") return true;
  if (testCase.redTeamCategory === "edit_stop_reconnect_race") return true;
  return testCase.scopeType === "general" && !testCase.expect.forbiddenTools?.length;
}

async function evaluateCorpusChainCase(testCase: Stage4CGoldenCorpusCase) {
  if (!shouldExerciseStoreChain(testCase)) {
    return [] as string[];
  }

  resetInMemoryAiChatStoreForTests();
  if (testCase.scopeType === "client") {
    seedInMemoryClientGatewayFixture({
      id: CHAIN_CLIENT_ID,
      tenantId: CHAIN_TENANT.tenantId,
      fullName: "Ayse Yilmaz",
      accessible: testCase.expect.blockReason !== "not_authorized",
    });
  }
  const conversation = await inMemoryAiChatStore.createConversation(CHAIN_TENANT, {
    requestId: `chain-create-${testCase.id}`,
    scopeType: testCase.scopeType,
    clientId: testCase.scopeType === "client" ? CHAIN_CLIENT_ID : null,
    title: `Corpus ${testCase.id}`,
  });

  const send = await inMemoryAiChatStore.sendMessage(CHAIN_TENANT, conversation.id, {
    requestId: `chain-send-${testCase.id}`,
    expectedRevision: conversation.revision,
    body: testCase.triggerBody,
  });

  await maybeProcessDeterministicAiChatJobs(inMemoryAiChatStore, `corpus-chain-${testCase.id}`);

  const failures: string[] = [];
  const run = await inMemoryAiChatStore.getRunById(CHAIN_TENANT.tenantId, send.runId);
  if (!run) {
    failures.push(`chain_run_missing:${testCase.id}`);
    return failures;
  }

  if (testCase.runStatus === "cancel_requested") {
    await inMemoryAiChatStore.stopRun(CHAIN_TENANT, send.runId, {
      requestId: `chain-stop-${testCase.id}`,
    });
    await maybeProcessDeterministicAiChatJobs(inMemoryAiChatStore, `corpus-chain-stop-${testCase.id}`);
    const stopped = await inMemoryAiChatStore.getRunById(CHAIN_TENANT.tenantId, send.runId);
    if (stopped?.status === "completed") {
      failures.push(`chain_stopped_marked_complete:${testCase.id}`);
    }
  } else if (run.status !== "completed" && run.status !== "stopped" && run.status !== "failed") {
    failures.push(`chain_run_not_terminal:${testCase.id}:${run.status}`);
  }

  const detail = await inMemoryAiChatStore.loadConversation(CHAIN_TENANT, conversation.id, {
    messageLimit: 20,
  });
  if (detail.messages.length === 0) {
    failures.push(`chain_conversation_empty:${testCase.id}`);
  }

  return failures;
}

export async function runStage4CCorpusChainBatch(
  cases: Stage4CGoldenCorpusCase[],
  metrics: Stage4CHardZeroMetrics,
) {
  const failures: string[] = [];
  for (const testCase of cases) {
    failures.push(...(await evaluateStage4CGoldenCorpusCase(testCase, metrics)));
    failures.push(...(await evaluateCorpusChainCase(testCase)));
  }
  return failures;
}

export function validateStage4CCorpusCaseSchema(testCase: Stage4CGoldenCorpusCase) {
  const failures: string[] = [];
  if (!testCase.scopeType) failures.push(`missing_scope:${testCase.id}`);
  if (!testCase.expect) failures.push(`missing_expect:${testCase.id}`);
  const hasToolExpectation =
    testCase.expect.allowedTools !== undefined ||
    testCase.expect.forbiddenTools !== undefined ||
    testCase.expect.intent !== undefined;
  if (!hasToolExpectation) {
    failures.push(`missing_tool_expectation:${testCase.id}`);
  }
  const hasRiskOrAnswerability =
    testCase.expect.riskLevel !== undefined ||
    testCase.expect.answerability !== undefined ||
    testCase.expect.blocked !== undefined ||
    testCase.expect.generalPhiEgress !== undefined ||
    testCase.expect.forbiddenTools !== undefined;
  if (!hasRiskOrAnswerability && testCase.corpusKind === "golden") {
    failures.push(`missing_risk_or_answerability:${testCase.id}`);
  }
  const hasSourceExpectation =
    testCase.allowedSourceIds !== undefined ||
    testCase.sourceExcerptTexts !== undefined ||
    testCase.category !== "source_conflict";
  if (!hasSourceExpectation && testCase.category === "source_conflict") {
    failures.push(`missing_source_expectation:${testCase.id}`);
  }
  const hasForbiddenActions =
    testCase.expect.clientSendEligible !== undefined ||
    testCase.expect.autoClinicalWrite !== undefined ||
    testCase.expect.providerEgress !== undefined ||
    testCase.expect.crossTenantLeak !== undefined ||
    testCase.expect.secondClientRetrieval !== undefined ||
    testCase.expect.deletedDataRetrieval !== undefined ||
    testCase.expect.productionProviderFlag !== undefined ||
    testCase.expect.stoppedRunComplete !== undefined ||
    testCase.expect.blocked !== undefined ||
    testCase.expect.riskLevel !== undefined;
  if (!hasForbiddenActions) {
    failures.push(`missing_forbidden_actions:${testCase.id}`);
  }
  return failures;
}

export function validateStage4CCorpusCatalog(cases: Stage4CGoldenCorpusCase[]) {
  return cases.flatMap((testCase) => validateStage4CCorpusCaseSchema(testCase));
}

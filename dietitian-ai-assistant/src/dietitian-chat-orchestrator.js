import { buildProviderContext } from "./dietitian-chat-context-policy.js";
import { shouldAbortRun, validateAssistantOutput } from "./dietitian-chat-output-guard.js";

export const DIETITIAN_CHAT_ORCHESTRATOR_VERSION = "dietitian-chat-orchestrator-v1";

export const RUN_PHASES = ["retrieving", "generating", "validating"];

/**
 * @param {{ messages: readonly { role: "user" | "assistant"; body: string }[]; triggerBody: string }} input
 */
export function createDietitianChatRunPlan(input) {
  const context = buildProviderContext({ messages: input.messages });
  return {
    version: DIETITIAN_CHAT_ORCHESTRATOR_VERSION,
    phases: [...RUN_PHASES],
    context,
    triggerBody: input.triggerBody,
  };
}

/**
 * @param {{
 *   runStatus: string;
 *   providerResult: {
 *     directAnswer: string | null;
 *     answerability?: string | null;
 *     riskLevel?: string | null;
 *     completionState?: string | null;
 *   };
 * }} input
 */
export function finalizeDietitianChatRun(input) {
  if (shouldAbortRun(input.runStatus)) {
    const partial = typeof input.providerResult.directAnswer === "string" ? input.providerResult.directAnswer : "";
    return {
      terminalStatus: input.runStatus === "cancel_requested" ? "stopped" : input.runStatus,
      validation: validateAssistantOutput({
        directAnswer: partial || null,
        answerability: input.providerResult.answerability ?? "insufficient",
        riskLevel: input.providerResult.riskLevel ?? "green",
        completionState: "incomplete",
      }),
    };
  }

  const validation = validateAssistantOutput(input.providerResult);
  return {
    terminalStatus: validation.ok ? "completed" : "failed",
    validation,
  };
}

export { buildProviderContext, shouldAbortRun, validateAssistantOutput };

export const DIETITIAN_CHAT_OUTPUT_GUARD_VERSION = "dietitian-chat-output-guard-v1";

const TERMINAL_RUN_STATUSES = new Set([
  "completed",
  "stopped",
  "failed",
  "superseded",
]);

/**
 * @param {string | null | undefined} status
 */
export function isTerminalRunStatus(status) {
  return TERMINAL_RUN_STATUSES.has(String(status ?? ""));
}

/**
 * @param {string | null | undefined} status
 */
export function shouldAbortRun(status) {
  return status === "cancel_requested" || status === "superseded" || isTerminalRunStatus(status);
}

/**
 * @param {{
 *   directAnswer: string | null;
 *   answerability?: string | null;
 *   riskLevel?: string | null;
 *   completionState?: string | null;
 * }} input
 */
export function validateAssistantOutput(input) {
  const directAnswer = typeof input.directAnswer === "string" ? input.directAnswer.trim() : "";
  const answerability = input.answerability ?? (directAnswer ? "answerable" : "insufficient");
  const riskLevel = input.riskLevel ?? "green";

  if (!directAnswer && answerability === "answerable") {
    return {
      ok: false,
      code: "empty_answer_for_answerable",
      answerability: "insufficient",
      riskLevel,
      completionState: "incomplete",
      directAnswer: null,
    };
  }

  const completionState = input.completionState ?? (directAnswer ? "complete" : "incomplete");

  if (completionState === "incomplete") {
    return {
      ok: true,
      answerability,
      riskLevel,
      completionState: "incomplete",
      directAnswer: directAnswer || null,
    };
  }

  return {
    ok: true,
    answerability,
    riskLevel,
    completionState: directAnswer ? "complete" : "incomplete",
    directAnswer: directAnswer || null,
  };
}

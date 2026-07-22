import { validateDietitianChatStructuredAnswerSchema } from "./dietitian-chat-answerability.js";

export const DIETITIAN_CHAT_OUTPUT_GUARD_VERSION = "dietitian-chat-output-guard-v2";

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
 *   structuredAnswer?: Record<string, unknown> | null;
 *   sourcedValidation?: { ok: boolean; answerability?: string | null; code?: string | null } | null;
 * }} input
 */
export function validateAssistantOutput(input) {
  const directAnswer = typeof input.directAnswer === "string" ? input.directAnswer.trim() : "";
  let answerability = input.answerability ?? (directAnswer ? "answerable" : "insufficient");
  const riskLevel = input.riskLevel ?? "green";

  if (input.structuredAnswer) {
    const schema = validateDietitianChatStructuredAnswerSchema(input.structuredAnswer);
    if (!schema.ok) {
      return {
        ok: false,
        code: schema.code ?? "structured_answer_invalid",
        answerability: "insufficient",
        riskLevel,
        completionState: "incomplete",
        directAnswer: directAnswer || null,
      };
    }
  }

  if (input.sourcedValidation && !input.sourcedValidation.ok) {
    return {
      ok: false,
      code: input.sourcedValidation.code ?? "sourced_validation_failed",
      answerability: input.sourcedValidation.answerability ?? "insufficient",
      riskLevel,
      completionState: "incomplete",
      directAnswer: directAnswer || null,
    };
  }

  if (input.sourcedValidation?.answerability === "partial") {
    answerability = "partial";
  }

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

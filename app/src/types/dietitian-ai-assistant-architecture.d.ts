declare module "dietitian-ai-assistant-architecture" {
  export type CorePersona = {
    id: string;
    label: string;
    behavior: Record<string, string>;
  };

  export const personas: CorePersona[];
  export const SAFETY_CLASSIFIER_VERSION: string;
  export const MISSING_HISTORICAL_CONTEXT_TOKEN: string;
  export const MISSING_HISTORICAL_CONTEXT_INSTRUCTION: string;
  export function buildDietitianVoiceProfile(samples: string[]): {
    averageMessageChars: number;
    formality: string;
    emojiPolicy: string;
    commonGreetings: string[];
    commonClosings: string[];
    styleNotes: string;
  };

  export function classifyDieteticRisk(
    message: string,
    clientProfile?: Record<string, unknown>,
  ): {
    level: "green" | "yellow" | "red";
    reasons: string[];
    classifierVersion: string;
    shouldHandoff: boolean;
    pauseAutopilot: boolean;
  };

  export function handleInboundMessage(
    input: Record<string, unknown>,
    adapters: {
      generateReply?: (payload: Record<string, unknown>) => Promise<string>;
      sendMessage?: (payload: Record<string, unknown>) => Promise<void>;
      onDraftForApproval?: (payload: Record<string, unknown>) => Promise<void>;
      onHandoff?: (payload: Record<string, unknown>) => Promise<void>;
    },
  ): Promise<Record<string, unknown>>;
}

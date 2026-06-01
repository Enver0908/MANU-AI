import {
  SAFETY_CLASSIFIER_VERSION,
  classifyConversationRisk,
} from "dietitian-ai-assistant-architecture";
import type { AiDecisionRecord, ClientRecord, MessageRecord } from "./types";

export { SAFETY_CLASSIFIER_VERSION };

export function classifySimulationRisk(client: ClientRecord, body: string, recentMessages: MessageRecord[] = []) {
  return classifyConversationRisk({
    message: body,
    recentMessages,
    clientProfile: {
      highRisk: client.clinicalRiskNotes.length > 0,
      healthProfile: client.healthProfile,
    },
  });
}

export function modelForRisk(risk: AiDecisionRecord["risk"]) {
  if (risk === "green") return "gemini-1.5-flash";
  if (risk === "yellow") return "gemini-3";
  return null;
}

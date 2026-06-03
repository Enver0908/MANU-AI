import {
  CLINICAL_SAFETY_CLASSIFIER_VERSION,
  classifyClinicalSafetyRisk,
} from "dietitian-ai-assistant-architecture";
import type { AiDecisionRecord, ClientRecord, MessageRecord } from "./types";

export { CLINICAL_SAFETY_CLASSIFIER_VERSION as SAFETY_CLASSIFIER_VERSION };

export function classifySimulationRisk(client: ClientRecord, body: string, recentMessages: MessageRecord[] = []) {
  return classifyClinicalSafetyRisk({
    message: body,
    recentMessages,
    clientProfile: {
      highRisk: client.clinicalRiskNotes.length > 0,
      healthProfile: client.healthProfile,
      allergies: client.allergies,
      restrictedFoods: client.restrictedFoods,
    },
  });
}

export function modelForRisk(risk: AiDecisionRecord["risk"]) {
  if (risk === "green") return "gemini-1.5-flash";
  if (risk === "yellow") return "gemini-3";
  return null;
}

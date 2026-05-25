export const MODEL_ROUTING = {
  green: "gemini-1.5-flash",
  yellow: "gemini-3",
  red: null,
};

export function selectModelForRisk(riskLevel) {
  if (!(riskLevel in MODEL_ROUTING)) {
    throw new Error(`Unknown risk level for model routing: ${riskLevel}`);
  }

  return MODEL_ROUTING[riskLevel];
}


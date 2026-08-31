export const MODEL_ROUTING = {
  green: "glm-5.3-flash",
  yellow: "glm-5.3-flash",
  red: null,
};

export function selectModelForRisk(riskLevel) {
  if (!(riskLevel in MODEL_ROUTING)) {
    throw new Error(`Unknown risk level for model routing: ${riskLevel}`);
  }

  return MODEL_ROUTING[riskLevel];
}

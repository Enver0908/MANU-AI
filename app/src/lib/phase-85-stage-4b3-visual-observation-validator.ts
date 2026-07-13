import { parseVisualObservationV1, type VisualObservationV1 } from "./phase-85-stage-4b3-media-contracts";

export const STAGE_4B3_VISUAL_OBSERVATION_VALIDATOR_VERSION = "p85-stage-4b3-visual-observation-validator-v1";

const FORBIDDEN_PROVIDER_CLINICAL_KEYS = [
  "clinicalAdvice",
  "clinical_advice",
  "diagnosis",
  "treatmentPlan",
  "treatment_plan",
  "dosage",
  "medicalRecommendation",
  "medical_recommendation",
  "freeTextAdvice",
  "free_text_advice",
  "clientProfile",
  "client_profile",
  "menuPlan",
  "menu_plan",
  "foodRules",
  "food_rules",
] as const;

export class Stage4B3VisualObservationValidationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "Stage4B3VisualObservationValidationError";
    this.code = code;
  }
}

export function assertProviderObservationHasNoForbiddenClinicalKeys(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return;
  }

  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if ((FORBIDDEN_PROVIDER_CLINICAL_KEYS as readonly string[]).includes(key)) {
      throw new Stage4B3VisualObservationValidationError(`provider_observation_forbidden_key:${key}`);
    }
    assertProviderObservationHasNoForbiddenClinicalKeys(record[key]);
  }
}

export function validateProviderVisualObservation(input: unknown): VisualObservationV1 {
  assertProviderObservationHasNoForbiddenClinicalKeys(input);
  try {
    return parseVisualObservationV1(input);
  } catch (error) {
    const code = error instanceof Error ? error.message : "observation_validation_failed";
    throw new Stage4B3VisualObservationValidationError(code);
  }
}

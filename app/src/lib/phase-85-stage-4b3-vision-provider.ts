export const STAGE_4B3_VISION_PROVIDER_CONTRACT_VERSION = "p85-stage-4b3-vision-provider-v1";

export const STAGE_4B3_VISION_PROVIDER_FAILURE_CODES = [
  "provider_gate_disabled",
  "missing_content_sha256",
  "provider_timeout",
  "provider_invalid_output",
  "observation_validation_failed",
  "retry_limit_exceeded",
] as const;

export type Stage4B3VisionProviderFailureCode = (typeof STAGE_4B3_VISION_PROVIDER_FAILURE_CODES)[number];

export type Stage4B3VisionProviderInput = {
  contentSha256: string;
  detectedMimeType: "image/jpeg";
};

export type Stage4B3VisionProviderSuccess = {
  ok: true;
  observation: unknown;
};

export type Stage4B3VisionProviderFailure = {
  ok: false;
  failureCode: Stage4B3VisionProviderFailureCode | string;
  retryable: boolean;
};

export type Stage4B3VisionProviderResult = Stage4B3VisionProviderSuccess | Stage4B3VisionProviderFailure;

export interface Stage4B3VisionProviderPort {
  analyze(input: Stage4B3VisionProviderInput): Promise<Stage4B3VisionProviderResult>;
}

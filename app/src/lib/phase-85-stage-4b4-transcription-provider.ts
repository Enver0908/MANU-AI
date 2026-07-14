import type { Stage4B4SupportedLocale } from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_TRANSCRIPTION_PROVIDER_CONTRACT_VERSION = "p85-stage-4b4-transcription-provider-v1";
export const STAGE_4B4_TRANSCRIPTION_PROVIDER_TIMEOUT_MS = 30_000;

export const STAGE_4B4_TRANSCRIPTION_PROVIDER_FAILURE_CODES = [
  "provider_gate_disabled",
  "missing_content_sha256",
  "missing_wav_bytes",
  "provider_timeout",
  "provider_invalid_output",
  "observation_validation_failed",
  "unknown_fixture",
  "retry_limit_exceeded",
] as const;

export type Stage4B4TranscriptionProviderFailureCode =
  (typeof STAGE_4B4_TRANSCRIPTION_PROVIDER_FAILURE_CODES)[number];

export type Stage4B4TranscriptionProviderInput = {
  requestId: string;
  contentSha256: string;
  locale: Stage4B4SupportedLocale;
  wavBytes: Buffer;
};

export type Stage4B4TranscriptionProviderSuccess = {
  ok: true;
  observation: unknown;
};

export type Stage4B4TranscriptionProviderFailure = {
  ok: false;
  failureCode: Stage4B4TranscriptionProviderFailureCode | string;
  retryable: boolean;
};

export type Stage4B4TranscriptionProviderResult =
  | Stage4B4TranscriptionProviderSuccess
  | Stage4B4TranscriptionProviderFailure;

export interface Stage4B4TranscriptionProviderPort {
  transcribe(input: Stage4B4TranscriptionProviderInput): Promise<Stage4B4TranscriptionProviderResult>;
}

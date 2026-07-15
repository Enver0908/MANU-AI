import type { Stage4B4SupportedLocale } from "./phase-85-stage-4b4-voice-contracts";
import type { AudioQualityCode } from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_TRANSCRIPTION_PROVIDER_CONTRACT_VERSION = "p85-stage-4b4-transcription-provider-v2";
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

export function mapTranscriptionProviderFailureToQualityCode(
  failureCode: string | null | undefined,
): AudioQualityCode {
  switch (failureCode) {
    case "provider_gate_disabled":
      return "provider_disabled";
    case "provider_timeout":
      return "provider_timeout";
    case "retry_limit_exceeded":
      return "retry_limit_exceeded";
    case "unknown_fixture":
      return "unknown_fixture";
    case "observation_validation_failed":
    case "provider_invalid_output":
    case "missing_content_sha256":
    case "missing_wav_bytes":
    case "missing_asset":
      return "malformed_observation";
    default:
      return "malformed_observation";
  }
}

export function isRetryableTranscriptionProviderFailure(failureCode: string | null | undefined): boolean {
  return failureCode === "provider_timeout" || failureCode === "storage_upload_failed";
}

export async function invokeStage4B4TranscriptionProviderWithDeadline(
  provider: Stage4B4TranscriptionProviderPort,
  input: Stage4B4TranscriptionProviderInput,
  deadlineMs: number = STAGE_4B4_TRANSCRIPTION_PROVIDER_TIMEOUT_MS,
): Promise<Stage4B4TranscriptionProviderResult> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<Stage4B4TranscriptionProviderFailure>((resolve) => {
    timeoutHandle = setTimeout(
      () => resolve({ ok: false, failureCode: "provider_timeout", retryable: true }),
      deadlineMs,
    );
  });

  try {
    return await Promise.race([provider.transcribe(input), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

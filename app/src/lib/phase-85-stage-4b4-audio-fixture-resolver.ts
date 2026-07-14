import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashMediaBytes } from "./phase-85-stage-4b3-image-admission";
import { STAGE_4B4_SUPPORTED_VOICE_MIME_TYPES } from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_FIXTURE_RESOLVER_VERSION = "p85-stage-4b4-audio-fixture-resolver-v1";
export const STAGE_4B4_FIXTURE_MEDIA_ID_PREFIX = "MOCK_AUDIO_";

const FIXTURE_MEDIA_ID_PATTERN = /^MOCK_AUDIO_([A-Z0-9_]+)$/i;

export type Stage4B4VoiceFixtureId = "golden_voice_note" | "stereo_voice_note";

const FIXTURE_FILES: Record<Stage4B4VoiceFixtureId, string> = {
  golden_voice_note: "stage-4b4-golden-voice-note.ogg",
  stereo_voice_note: "stage-4b4-stereo-voice-note.ogg",
};

export function isAllowlistedStage4B4AudioFixtureMediaId(providerMediaId: string): boolean {
  const compact = providerMediaId.trim();
  if (!compact.startsWith(STAGE_4B4_FIXTURE_MEDIA_ID_PREFIX)) {
    return false;
  }
  return FIXTURE_MEDIA_ID_PATTERN.test(compact);
}

export function resolveStage4B4VoiceFixtureId(providerMediaId: string): Stage4B4VoiceFixtureId | null {
  const match = providerMediaId.trim().match(FIXTURE_MEDIA_ID_PATTERN);
  if (!match) {
    return null;
  }
  const raw = match[1].toLowerCase();
  if (raw === "golden_voice_note" || raw === "stereo_voice_note") {
    return raw;
  }
  return null;
}

export function resolveAllowlistedStage4B4AudioFixtureBytes(providerMediaId: string): {
  bytes: Buffer;
  mimeType: (typeof STAGE_4B4_SUPPORTED_VOICE_MIME_TYPES)[number];
  sha256: string;
  fixtureId: Stage4B4VoiceFixtureId;
} | null {
  const fixtureId = resolveStage4B4VoiceFixtureId(providerMediaId);
  if (!fixtureId) {
    return null;
  }
  const fileName = FIXTURE_FILES[fixtureId];
  const bytes = readFileSync(resolve(__dirname, "fixtures", fileName));
  return {
    bytes,
    mimeType: "audio/ogg; codecs=opus",
    sha256: hashMediaBytes(bytes),
    fixtureId,
  };
}

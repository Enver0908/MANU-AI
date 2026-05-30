import { buildDietitianVoiceProfile } from "dietitian-ai-assistant-architecture";
import { AppDomainError } from "./app-errors";
import type {
  DietitianVoiceProfileRecord,
  DietitianVoiceSampleRecord,
  ManuAppState,
  VoiceSampleStatus,
} from "./types";

export const MIN_APPROVED_VOICE_SAMPLES = 10;
export const MAX_VOICE_SAMPLES_FOR_PROFILE = 100;
export const MAX_VOICE_SAMPLE_CHARS = 1000;

export function parseVoiceSamples(input: string) {
  return input
    .split(/\n\s*\n/)
    .map((sample) => sample.trim())
    .filter(Boolean);
}

export function addVoiceSamplesToState(state: ManuAppState, rawInput: string, createdAt = new Date().toISOString()) {
  const existingHashes = new Set(state.voiceSamples.map((sample) => sample.bodyHash));
  const nextSamples: DietitianVoiceSampleRecord[] = [];

  for (const body of parseVoiceSamples(rawInput)) {
    if (body.length > MAX_VOICE_SAMPLE_CHARS) continue;
    const bodyHash = hashVoiceSample(body);
    if (existingHashes.has(bodyHash)) continue;
    existingHashes.add(bodyHash);
    nextSamples.push({
      id: crypto.randomUUID(),
      tenantId: state.tenant.id,
      dietitianId: state.dietitian.id,
      body,
      bodyHash,
      status: "draft",
      createdAt,
    });
  }

  if (nextSamples.length === 0) return state;

  return {
    ...state,
    voiceSamples: [...state.voiceSamples, ...nextSamples],
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "voice_sample_added",
        entityType: "dietitian_voice_sample",
        entityId: nextSamples.map((sample) => sample.id).join(","),
        metadata: { count: nextSamples.length },
        createdAt,
      },
    ],
  };
}

export function updateVoiceSampleStatusInState(
  state: ManuAppState,
  sampleId: string,
  status: VoiceSampleStatus,
  createdAt = new Date().toISOString(),
) {
  if (!state.voiceSamples.some((sample) => sample.id === sampleId)) {
    throw new AppDomainError(404, "voice_sample_not_found");
  }

  return {
    ...state,
    voiceSamples: state.voiceSamples.map((sample) => (sample.id === sampleId ? { ...sample, status } : sample)),
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: status === "approved" ? "voice_sample_approved" : "voice_sample_status_changed",
        entityType: "dietitian_voice_sample",
        entityId: sampleId,
        metadata: { status },
        createdAt,
      },
    ],
  };
}

export function generateVoiceProfileInState(state: ManuAppState, createdAt = new Date().toISOString()) {
  const approvedSamples = state.voiceSamples
    .filter((sample) => sample.status === "approved")
    .slice(-MAX_VOICE_SAMPLES_FOR_PROFILE);

  if (approvedSamples.length < MIN_APPROVED_VOICE_SAMPLES) {
    throw new AppDomainError(400, "voice_profile_requires_approved_samples");
  }

  const profile = buildDietitianVoiceProfile(approvedSamples.map((sample) => sample.body));
  const previousVersion = state.voiceProfiles.find((item) => item.dietitianId === state.dietitian.id)?.profileVersion || 0;
  const nextProfile: DietitianVoiceProfileRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    status: "generated",
    profileVersion: previousVersion + 1,
    averageMessageChars: profile.averageMessageChars,
    formality: profile.formality,
    emojiPolicy: profile.emojiPolicy,
    commonGreetings: profile.commonGreetings,
    commonClosings: profile.commonClosings,
    styleNotes: profile.styleNotes,
    sampleCount: approvedSamples.length,
    sourceSampleIds: approvedSamples.map((sample) => sample.id),
    generatedAt: createdAt,
    updatedAt: createdAt,
  };

  return {
    ...state,
    voiceProfiles: [
      ...state.voiceProfiles.filter((item) => item.dietitianId !== state.dietitian.id),
      nextProfile,
    ],
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "voice_profile_generated",
        entityType: "dietitian_voice_profile",
        entityId: nextProfile.id,
        metadata: { profileVersion: nextProfile.profileVersion, sampleCount: nextProfile.sampleCount },
        createdAt,
      },
    ],
  };
}

export function getActiveVoiceProfile(state: ManuAppState) {
  const profile = state.voiceProfiles.find((item) => item.dietitianId === state.dietitian.id && item.status === "generated");
  if (!profile) return null;

  return {
    averageMessageChars: profile.averageMessageChars,
    formality: profile.formality,
    emojiPolicy: profile.emojiPolicy,
    commonGreetings: profile.commonGreetings,
    commonClosings: profile.commonClosings,
    styleNotes: profile.styleNotes,
  };
}

function hashVoiceSample(body: string) {
  const normalized = body.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

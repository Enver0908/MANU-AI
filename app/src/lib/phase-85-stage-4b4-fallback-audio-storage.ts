import { createInMemoryStage4B4AudioStorage } from "./phase-85-stage-4b4-audio-storage";

const fallbackAudioStorage = createInMemoryStage4B4AudioStorage();

export function getFallbackStage4B4AudioStorage() {
  return fallbackAudioStorage;
}

export function resetFallbackStage4B4AudioStorage() {
  fallbackAudioStorage.objects.clear();
}

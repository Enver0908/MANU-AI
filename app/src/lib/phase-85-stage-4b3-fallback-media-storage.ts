import { createInMemoryStage4B3MediaStorage } from "./phase-85-stage-4b3-media-storage";

const fallbackMediaStorage = createInMemoryStage4B3MediaStorage();

export function getFallbackStage4B3MediaStorage() {
  return fallbackMediaStorage;
}

export function resetFallbackStage4B3MediaStorage() {
  fallbackMediaStorage.objects.clear();
}

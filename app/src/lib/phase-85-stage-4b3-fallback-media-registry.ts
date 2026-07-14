import type { Stage4B3MockMediaRegistry } from "./phase-85-stage-4b3-media-transport";
import { createEmptyStage4B3MockMediaRegistry } from "./phase-85-stage-4b3-media-transport";

const fallbackMockMediaRegistry = createEmptyStage4B3MockMediaRegistry();

export function getFallbackStage4B3MockMediaRegistry(): Stage4B3MockMediaRegistry {
  return fallbackMockMediaRegistry;
}

export function resetFallbackStage4B3MockMediaRegistry() {
  fallbackMockMediaRegistry.clear();
}

import { buildStyleDnaV2 } from "dietitian-ai-assistant-architecture";
import { getActiveVoiceProfile } from "./voice-profile-workflow";
import { getStyleEditHistorySignals } from "./phase-77s-style-edit-history";
import type { ManuAppState } from "./types";

export const PHASE_77S_DIETITIAN_VOICE_ENGINE_V2_VERSION = "phase-77s-dietitian-voice-engine-v2-v0.1.0";

export function buildStyleDnaV2ContextFromState(state: ManuAppState, clientId?: string | null) {
  const client = clientId ? state.clients.find((entry) => entry.id === clientId) : null;
  const knownClientNames = [
    ...(client?.fullName ? [client.fullName] : []),
    ...state.clients
      .filter((entry) => entry.id !== clientId && entry.lifecycleStatus !== "removed_anonymized")
      .map((entry) => entry.fullName)
      .filter(Boolean),
  ];

  return buildStyleDnaV2({
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    voiceProfile: getActiveVoiceProfile(state),
    editHistorySignals: getStyleEditHistorySignals(state),
    knownClientNames: [...new Set(knownClientNames)],
  });
}

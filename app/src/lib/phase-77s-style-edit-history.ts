import {
  buildStyleEditHistoryRecord,
  extractStyleSignalsFromEditHistory,
} from "dietitian-ai-assistant-architecture";
import type { DietitianStyleEditHistoryRecord, ManuAppState } from "./types";

export const PHASE_77S_STYLE_EDIT_HISTORY_VERSION = "phase-77s-style-edit-history-v0.1.0";
export const MAX_STYLE_EDIT_HISTORY_RECORDS = 100;

export function getKnownClientNamesForStyleLearning(state: ManuAppState, clientId?: string | null) {
  const activeClient = clientId ? state.clients.find((client) => client.id === clientId) : null;
  const otherNames = state.clients
    .filter((client) => client.id !== clientId && client.lifecycleStatus !== "removed_anonymized")
    .map((client) => client.fullName)
    .filter(Boolean);
  return [...new Set([activeClient?.fullName, ...otherNames].filter(Boolean))] as string[];
}

export function recordStyleEditHistoryInState(
  state: ManuAppState,
  input: {
    aiDraft: string;
    dietitianFinal: string;
    clientId?: string | null;
    createdAt?: string;
  },
): ManuAppState {
  const createdAt = input.createdAt || new Date().toISOString();
  const knownClientNames = getKnownClientNamesForStyleLearning(state, input.clientId);
  const recordBody = buildStyleEditHistoryRecord({
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    aiDraft: input.aiDraft,
    dietitianFinal: input.dietitianFinal,
    knownClientNames,
  });

  const record: DietitianStyleEditHistoryRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    clientId: input.clientId || null,
    aiDraftHash: recordBody.aiDraftHash,
    dietitianFinalHash: recordBody.dietitianFinalHash,
    diffMetadata: recordBody.diffMetadata,
    createdAt,
  };

  const nextRecords = [...state.styleEditHistory, record].slice(-MAX_STYLE_EDIT_HISTORY_RECORDS);
  return {
    ...state,
    styleEditHistory: nextRecords,
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "style_edit_history_recorded",
        entityType: "dietitian_style_edit_history",
        entityId: record.id,
        metadata: {
          lengthDelta: record.diffMetadata.lengthDelta,
          greetingChanged: record.diffMetadata.greetingChanged,
        },
        createdAt,
      },
    ],
  };
}

export function getStyleEditHistorySignals(state: ManuAppState) {
  const records = state.styleEditHistory.filter((record) => record.dietitianId === state.dietitian.id);
  return extractStyleSignalsFromEditHistory(records);
}

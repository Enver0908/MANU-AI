"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createInitialState } from "./seed-data";
import type { Channel, ClientRecord, ManuAppState, SimulationRequest, SupportedLanguageCode } from "./types";
import type {
  ClientContextUpdateImportance,
  ClientContextUpdateSource,
  ClientFormFieldDefinition,
  VoiceSampleStatus,
} from "./types";

export function useManuState() {
  const [state, setState] = useState<ManuAppState>(() => createInitialState());
  const [hydrated, setHydrated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const replaceFromApi = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init?.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        try {
          const body = await response.json();
          setAuthError(body.error || `auth_error_${response.status}`);
        } catch {
          setAuthError(`auth_error_${response.status}`);
        }
      }
      throw new Error(`Request failed: ${response.status}`);
    }

    setAuthError(null);
    const nextState = (await response.json()) as ManuAppState;
    setState(nextState);
    return nextState;
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      replaceFromApi("/api/app-state")
        .catch(() => setState(createInitialState()))
        .finally(() => {
          setHydrated(true);
        });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [replaceFromApi]);

  return useMemo(
    () => ({
      state,
      hydrated,
      authError,
      createClient: (input: {
        fullName: string;
        channel: Channel;
        channelUserId: string;
        primaryPhoneE164: string;
        communicationLanguage: SupportedLanguageCode;
      }) =>
        replaceFromApi("/api/clients", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      updateDietitianPreferences: (input: { uiLanguage: SupportedLanguageCode }) =>
        replaceFromApi("/api/dietitian/preferences", {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
      updateClient: (clientId: string, patch: Partial<ClientRecord>) =>
        replaceFromApi(`/api/clients/${clientId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      releaseHumanTakeover: (clientId: string) =>
        replaceFromApi(`/api/clients/${clientId}/release-takeover`, {
          method: "POST",
        }),
      runSimulation: (input: SimulationRequest) =>
        replaceFromApi("/api/simulator", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      sendManualReply: (input: { clientId: string; body: string }) =>
        replaceFromApi("/api/messages/manual", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      approveDraft: (messageId: string) =>
        replaceFromApi(`/api/messages/drafts/${messageId}`, {
          method: "POST",
          body: JSON.stringify({ action: "approve" }),
        }),
      editAndSendDraft: (messageId: string, body: string) =>
        replaceFromApi(`/api/messages/drafts/${messageId}`, {
          method: "POST",
          body: JSON.stringify({ action: "edit_send", body }),
        }),
      dismissDraft: (messageId: string) =>
        replaceFromApi(`/api/messages/drafts/${messageId}`, {
          method: "POST",
          body: JSON.stringify({ action: "dismiss" }),
        }),
      resolveHandoff: (handoffId: string) =>
        replaceFromApi(`/api/handoffs/${handoffId}/resolve`, {
          method: "POST",
        }),
      resolveAndReactivateHandoff: (
        handoffId: string,
        input: { reactivationReason: string; aiMode: "copilot" | "autopilot" },
      ) =>
        replaceFromApi(`/api/handoffs/${handoffId}/resolve-and-reactivate`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      dismissHandoff: (handoffId: string) =>
        replaceFromApi(`/api/handoffs/${handoffId}/dismiss`, {
          method: "POST",
        }),
      markNotificationRead: (notificationId: string) =>
        replaceFromApi(`/api/notifications/${notificationId}/read`, {
          method: "POST",
        }),
      acknowledgeNotification: (notificationId: string) =>
        replaceFromApi(`/api/notifications/${notificationId}/acknowledge`, {
          method: "POST",
        }),
      resetState: () =>
        replaceFromApi("/api/app-state", {
          method: "POST",
        }),
      addVoiceSamples: (rawInput: string) =>
        replaceFromApi("/api/dietitian/voice/samples", {
          method: "POST",
          body: JSON.stringify({ rawInput }),
        }),
      updateVoiceSampleStatus: (sampleId: string, status: VoiceSampleStatus) =>
        replaceFromApi("/api/dietitian/voice/samples", {
          method: "PATCH",
          body: JSON.stringify({ sampleId, status }),
        }),
      generateVoiceProfile: () =>
        replaceFromApi("/api/dietitian/voice/generate", {
          method: "POST",
        }),
      createFormSchema: (input: { title: string; fields: ClientFormFieldDefinition[]; languageCode: SupportedLanguageCode }) =>
        replaceFromApi("/api/client-form-schemas", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      publishFormSchema: (schemaId: string) =>
        replaceFromApi("/api/client-form-schemas/publish", {
          method: "POST",
          body: JSON.stringify({ schemaId }),
        }),
      saveFormResponse: (input: {
        clientId: string;
        schemaId: string;
        answers: Record<string, unknown>;
        submittedPhoneE164?: string;
      }) =>
        replaceFromApi("/api/clients/forms", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      addClientContextUpdate: (
        clientId: string,
        input: {
          source: ClientContextUpdateSource;
          occurredAt?: string | null;
          title: string;
          summary: string;
          details?: string;
          importance: ClientContextUpdateImportance;
        },
      ) =>
        replaceFromApi(`/api/clients/${clientId}/context-updates`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      sendInternalCopilotMessage: (body: string) =>
        replaceFromApi("/api/internal-copilot/messages", {
          method: "POST",
          body: JSON.stringify({ body }),
        }),
    }),
    [authError, hydrated, replaceFromApi, state],
  );
}

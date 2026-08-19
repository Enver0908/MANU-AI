"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppRequestError } from "./app-errors";
import { authenticatedMutationFetch } from "./phase-85-stage-5-shell-authenticated-mutation";
import { getActiveFormSchema } from "./client-forms";
import {
  mergeStage6MutationIntoAppState,
  shouldApplyStage6Response,
} from "./phase-85-stage-6-client-workspace";
import type { ClientScopedMutationResponse } from "./phase-85-stage-6-dashboard-contracts";
import type { ConversationDetailResponse, ConversationMutationResponse } from "./phase-85-stage-4b2-contracts";
import {
  mergeConversationDetailResponseIntoAppState,
  mergeConversationMutationResponseIntoAppState,
  shouldRefreshAppStateAfterConversationMutation,
} from "./phase-85-stage-4b2-state-merge";
import { createInitialState } from "./seed-data";
import type {
  Channel,
  ClientRecord,
  ClientUpdateProposalPatch,
  ManuAppState,
  SimulationRequest,
  SupportedLanguageCode,
} from "./types";
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

  const requestJson = useCallback(async (url: string, init?: RequestInit & { mutationKind?: "save" | "other" }) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const isMutation = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
    const response = isMutation
      ? await authenticatedMutationFetch(url, {
          ...init,
          mutationKind: init?.mutationKind ?? "other",
        })
      : await fetch(url, {
          ...init,
          headers: {
            "content-type": "application/json",
            ...init?.headers,
          },
          cache: "no-store",
        });

    if (!response.ok) {
      let code = `request_failed_${response.status}`;
      if (response.status === 401 || response.status === 403) {
        try {
          const body = await response.json();
          setAuthError(body.error || `auth_error_${response.status}`);
          code = body.error || code;
        } catch {
          setAuthError(`auth_error_${response.status}`);
        }
      } else {
        try {
          const body = await response.json();
          if (body.error) code = body.error;
        } catch {
          // ignore parse errors
        }
      }
      throw new AppRequestError(response.status, code);
    }

    setAuthError(null);
    return response.json();
  }, []);

  const mergeOwnProfileFromApi = useCallback(
    async (url: string, init?: RequestInit) => {
      const data = (await requestJson(url, init)) as {
        profile?: { displayName?: string; uiLanguage?: SupportedLanguageCode };
      };
      let mergedState = createInitialState();
      setState((current) => {
        mergedState = {
          ...current,
          dietitian: {
            ...current.dietitian,
            ...(data.profile?.displayName !== undefined ? { displayName: data.profile.displayName } : {}),
            ...(data.profile?.uiLanguage !== undefined ? { uiLanguage: data.profile.uiLanguage } : {}),
          },
        };
        return mergedState;
      });
      return mergedState;
    },
    [requestJson],
  );

  const replaceFromApi = useCallback(async (url: string, init?: RequestInit) => {
    const nextState = (await requestJson(url, init)) as ManuAppState;
    setState(nextState);
    return nextState;
  }, [requestJson]);

  const mergeStage6MutationFromApi = useCallback(
    async (url: string, expectedClientId: string, init?: RequestInit) => {
      const payload = (await requestJson(url, init)) as ClientScopedMutationResponse<unknown>;
      let mergedState = createInitialState();
      setState((current) => {
        if (expectedClientId !== "*" && !shouldApplyStage6Response(payload, expectedClientId)) {
          mergedState = current;
          return current;
        }
        mergedState = mergeStage6MutationIntoAppState(current, payload);
        return mergedState;
      });
      return mergedState;
    },
    [requestJson],
  );

  const mergeConversationDetailIntoState = useCallback((detail: ConversationDetailResponse) => {
    let mergedState = createInitialState();
    setState((current) => {
      mergedState = mergeConversationDetailResponseIntoAppState(current, detail);
      return mergedState;
    });
    return mergedState;
  }, []);

  const mergeConversationMutationIntoState = useCallback((mutation: ConversationMutationResponse) => {
    let mergedState = createInitialState();
    setState((current) => {
      mergedState = mergeConversationMutationResponseIntoAppState(current, mutation);
      return mergedState;
    });
    return mergedState;
  }, []);

  const conversationMutationFromApi = useCallback(
    async (url: string, init?: RequestInit) => {
      const payload = (await requestJson(url, init)) as ConversationMutationResponse;
      let mergedState = mergeConversationMutationIntoState(payload);
      if (shouldRefreshAppStateAfterConversationMutation(payload.operation)) {
        mergedState = await replaceFromApi("/api/app-state");
      }
      return mergedState;
    },
    [mergeConversationMutationIntoState, replaceFromApi, requestJson],
  );

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
      mergeConversationDetailIntoState,
      mergeConversationMutationIntoState,
      createClient: (input: {
        fullName: string;
        channel: Channel;
        channelUserId: string;
        primaryPhoneE164: string;
        communicationLanguage: SupportedLanguageCode;
      }) =>
        mergeStage6MutationFromApi("/api/clients", "*", {
          method: "POST",
          body: JSON.stringify({ ...input, requestId: crypto.randomUUID() }),
        }),
      updateDietitianPreferences: (input: { uiLanguage: SupportedLanguageCode }) =>
        mergeOwnProfileFromApi("/api/dietitian/preferences", {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
      updateClient: (clientId: string, patch: Partial<ClientRecord>) =>
        mergeStage6MutationFromApi(`/api/clients/${clientId}`, clientId, {
          method: "PATCH",
          body: JSON.stringify({
            ...patch,
            requestId: crypto.randomUUID(),
            expectedRevision: state.clients.find((item) => item.id === clientId)?.contextRevision ?? 0,
          }),
        }),
      removeClient: (clientId: string) =>
        replaceFromApi(`/api/clients/${clientId}/remove`, {
          method: "POST",
        }),
      releaseHumanTakeover: (clientId: string) =>
        mergeStage6MutationFromApi(`/api/clients/${clientId}/release-takeover`, clientId, {
          method: "POST",
          body: JSON.stringify({ requestId: crypto.randomUUID() }),
        }),
      activateClientAi: (
        clientId: string,
        input: {
          requestedAiMode?: "copilot" | "autopilot";
          expectedConversationRevision: number;
          expectedClientContextRevision: number;
        },
      ) =>
        mergeStage6MutationFromApi(`/api/clients/${clientId}/activate-ai`, clientId, {
          method: "POST",
          body: JSON.stringify({ ...input, requestId: crypto.randomUUID() }),
        }),
      runSimulation: (input: SimulationRequest) =>
        replaceFromApi("/api/simulator", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      runVisualSimulation: async (input: {
        clientId: string;
        idempotencyKey: string;
        fixtureSceneId?: string;
        caption?: string;
        burstMessages?: string[];
        flushSilence?: boolean;
        imageFile?: File | null;
      }) => {
        const form = new FormData();
        form.set("clientId", input.clientId);
        form.set("idempotencyKey", input.idempotencyKey);
        if (input.fixtureSceneId) {
          form.set("fixtureSceneId", input.fixtureSceneId);
        }
        if (input.caption) {
          form.set("caption", input.caption);
        }
        if (input.burstMessages?.length) {
          form.set("burstMessages", input.burstMessages.join("\n"));
        }
        if (input.flushSilence === false) {
          form.set("flushSilence", "false");
        }
        if (input.imageFile) {
          form.set("image", input.imageFile);
        }

        const response = await authenticatedMutationFetch("/api/simulator/visual", {
          method: "POST",
          mutationKind: "other",
          body: form,
        });

        if (!response.ok) {
          let code = `request_failed_${response.status}`;
          try {
            const body = await response.json();
            if (body.error) code = body.error;
          } catch {
            // ignore parse errors
          }
          throw new AppRequestError(response.status, code);
        }

        const nextState = (await response.json()) as ManuAppState;
        setState(nextState);
        return nextState;
      },
      runVoiceSimulation: async (input: {
        clientId: string;
        idempotencyKey: string;
        fixtureId?: "golden_voice_note" | "stereo_voice_note";
        transcriptionSceneId?: string;
        burstMessages?: string[];
        flushSilence?: boolean;
      }) => {
        const form = new FormData();
        form.set("clientId", input.clientId);
        form.set("idempotencyKey", input.idempotencyKey);
        if (input.fixtureId) {
          form.set("fixtureId", input.fixtureId);
        }
        if (input.transcriptionSceneId) {
          form.set("transcriptionSceneId", input.transcriptionSceneId);
        }
        if (input.burstMessages?.length) {
          form.set("burstMessages", input.burstMessages.join("\n"));
        }
        if (input.flushSilence === false) {
          form.set("flushSilence", "false");
        }

        const response = await authenticatedMutationFetch("/api/simulator/voice", {
          method: "POST",
          mutationKind: "other",
          body: form,
        });

        if (!response.ok) {
          let code = `request_failed_${response.status}`;
          try {
            const body = await response.json();
            if (body.error) code = body.error;
          } catch {
            // ignore parse errors
          }
          throw new AppRequestError(response.status, code);
        }

        const nextState = (await response.json()) as ManuAppState;
        setState(nextState);
        return nextState;
      },
      sendManualReply: (input: { clientId: string; body: string; aiChatDraftTransferId?: string }) => {
        const conversation = state.conversations.find((item) => item.clientId === input.clientId);
        if (!conversation) {
          throw new Error("conversation_not_found");
        }
        return conversationMutationFromApi("/api/messages/manual", {
          method: "POST",
          body: JSON.stringify({
            conversationId: conversation.id,
            body: input.body,
            requestId: crypto.randomUUID(),
            expectedConversationRevision: conversation.revision ?? 1,
            aiChatDraftTransferId: input.aiChatDraftTransferId,
          }),
        });
      },
      approveDraft: (messageId: string) => {
        const message = state.messages.find((item) => item.id === messageId);
        const conversation = message
          ? state.conversations.find((item) => item.id === message.conversationId)
          : undefined;
        if (!conversation) {
          throw new Error("conversation_not_found");
        }
        return conversationMutationFromApi(`/api/messages/drafts/${messageId}`, {
          method: "POST",
          body: JSON.stringify({
            action: "approve",
            requestId: crypto.randomUUID(),
            expectedConversationRevision: conversation.revision ?? 1,
          }),
        });
      },
      editAndSendDraft: (messageId: string, body: string) => {
        const message = state.messages.find((item) => item.id === messageId);
        const conversation = message
          ? state.conversations.find((item) => item.id === message.conversationId)
          : undefined;
        if (!conversation) {
          throw new Error("conversation_not_found");
        }
        return conversationMutationFromApi(`/api/messages/drafts/${messageId}`, {
          method: "POST",
          body: JSON.stringify({
            action: "edit_send",
            body,
            requestId: crypto.randomUUID(),
            expectedConversationRevision: conversation.revision ?? 1,
          }),
        });
      },
      dismissDraft: (messageId: string) => {
        const message = state.messages.find((item) => item.id === messageId);
        const conversation = message
          ? state.conversations.find((item) => item.id === message.conversationId)
          : undefined;
        if (!conversation) {
          throw new AppRequestError(404, "conversation_not_found");
        }
        return conversationMutationFromApi(`/api/messages/drafts/${messageId}`, {
          method: "POST",
          body: JSON.stringify({
            action: "dismiss",
            requestId: crypto.randomUUID(),
            expectedConversationRevision: conversation.revision ?? 1,
          }),
        });
      },
      reviewSendManualFromDraft: (messageId: string, body?: string) => {
        const message = state.messages.find((item) => item.id === messageId);
        const conversation = message
          ? state.conversations.find((item) => item.id === message.conversationId)
          : undefined;
        const client = conversation
          ? state.clients.find((item) => item.id === conversation.clientId)
          : undefined;
        if (!conversation) {
          throw new AppRequestError(404, "conversation_not_found");
        }
        return conversationMutationFromApi(`/api/messages/drafts/${messageId}`, {
          method: "POST",
          body: JSON.stringify({
            action: "review_send_manual",
            body,
            requestId: crypto.randomUUID(),
            expectedConversationRevision: conversation.revision ?? 1,
            expectedClientContextRevision: client?.contextRevision,
          }),
        });
      },
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
      resolveStructuredUpdateNotification: (notificationId: string) =>
        replaceFromApi(`/api/notifications/${notificationId}/resolve-structured-update`, {
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
        mergeStage6MutationFromApi("/api/clients/forms", input.clientId, {
          method: "POST",
          body: JSON.stringify({
            ...input,
            requestId: crypto.randomUUID(),
            expectedClientContextRevision:
              state.clients.find((item) => item.id === input.clientId)?.contextRevision ?? 0,
            expectedSchemaRevision: getActiveFormSchema(state)?.version ?? 0,
          }),
        }),
      saveClientFoodRuleProfile: (
        clientId: string,
        input: {
          revision: number;
          profile: Record<string, unknown>;
        },
      ) =>
        mergeStage6MutationFromApi(`/api/clients/${clientId}/food-rule-profile`, clientId, {
          method: "PUT",
          body: JSON.stringify({ ...input, requestId: crypto.randomUUID() }),
        }),
      createMenuPlan: (clientId: string, input: { templateType: string; title?: string }) =>
        mergeStage6MutationFromApi(`/api/clients/${clientId}/menu-plans`, clientId, {
          method: "POST",
          body: JSON.stringify({ ...input, requestId: crypto.randomUUID() }),
        }),
      saveMenuPlan: (
        clientId: string,
        planId: string,
        input: {
          revision: number;
          plan: Record<string, unknown>;
        },
      ) =>
        mergeStage6MutationFromApi(`/api/clients/${clientId}/menu-plans/${planId}`, clientId, {
          method: "PUT",
          body: JSON.stringify({ ...input, requestId: crypto.randomUUID() }),
        }),
      activateMenuPlan: (clientId: string, planId: string) =>
        mergeStage6MutationFromApi(`/api/clients/${clientId}/menu-plans/${planId}/activate`, clientId, {
          method: "POST",
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            expectedPlanRevision: state.clientMenuPlans.find((plan) => plan.id === planId)?.revision ?? 0,
          }),
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
        mergeStage6MutationFromApi(`/api/clients/${clientId}/context-updates`, clientId, {
          method: "POST",
          body: JSON.stringify({ ...input, requestId: crypto.randomUUID() }),
        }),
      sendInternalCopilotMessage: (body: string) =>
        replaceFromApi("/api/internal-copilot/messages", {
          method: "POST",
          body: JSON.stringify({ body }),
        }),
      createClientUpdateProposal: (clientId: string, sourceText: string) =>
        replaceFromApi(`/api/clients/${clientId}/update-proposals`, {
          method: "POST",
          body: JSON.stringify({ sourceText }),
        }),
      applyClientUpdateProposal: (clientId: string, proposalId: string, proposedPatches?: ClientUpdateProposalPatch[]) =>
        replaceFromApi(`/api/clients/${clientId}/update-proposals/${proposalId}/apply`, {
          method: "POST",
          body: JSON.stringify(proposedPatches ? { proposedPatches } : {}),
        }),
      rejectClientUpdateProposal: (clientId: string, proposalId: string) =>
        replaceFromApi(`/api/clients/${clientId}/update-proposals/${proposalId}/reject`, {
          method: "POST",
        }),
      createContextIntakeProposal: (
        clientId: string,
        input: {
          sourceText: string;
          intakeSource: ClientContextUpdateSource;
          occurredAt?: string | null;
          title?: string;
          summary?: string;
          details?: string;
          importance?: ClientContextUpdateImportance;
          rawSourceReference?: string | null;
          confirmFullName?: string;
          confirmPhoneE164?: string;
        },
      ) =>
        replaceFromApi(`/api/clients/${clientId}/context-intake/proposals`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      confirmContextIntakeProposal: (clientId: string, proposalId: string) =>
        replaceFromApi(`/api/clients/${clientId}/context-intake/proposals/${proposalId}/confirm`, {
          method: "POST",
        }),
      recheckContextIntakeProposal: (clientId: string, proposalId: string) =>
        replaceFromApi(`/api/clients/${clientId}/context-intake/proposals/${proposalId}/recheck`, {
          method: "POST",
        }),
      applyContextIntakeProposal: (clientId: string, proposalId: string) =>
        replaceFromApi(`/api/clients/${clientId}/context-intake/proposals/${proposalId}/apply`, {
          method: "POST",
        }),
      rejectContextIntakeProposal: (clientId: string, proposalId: string) =>
        replaceFromApi(`/api/clients/${clientId}/context-intake/proposals/${proposalId}/reject`, {
          method: "POST",
        }),
    }),
    [
      authError,
      conversationMutationFromApi,
      hydrated,
      mergeConversationDetailIntoState,
      mergeConversationMutationIntoState,
      mergeOwnProfileFromApi,
      mergeStage6MutationFromApi,
      replaceFromApi,
      state,
    ],
  );
}

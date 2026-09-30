"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Channel,
  ClientContextUpdateImportance,
  ClientContextUpdateRecord,
  ClientContextUpdateSource,
  ClientRecord,
  ManuAppState,
  Phase77FMenuPlanTemplateType,
} from "@/lib/types";
import type { SupportedLanguageCode } from "@/lib/languages";
import type { DashboardUrlState, ClientWorkspaceTask } from "@/lib/phase-85-stage-4b-dashboard-routing";
import type {
  ShellDestinationId,
  ShellDestinationViewSnapshot,
} from "@/lib/phase-85-stage-5-shell-contracts";
import {
  getClientFoodRuleProfileV2Record,
  getClientFoodRuleProfileV2State,
  type ClientFoodRuleProfileV2State,
} from "@/lib/phase-77e-client-food-rule-profile";
import {
  getActiveClientMenuPlanV1Record,
  listClientMenuPlanV1Records,
  menuPlanV1RecordToState,
  type ClientMenuPlanV1State,
} from "@/lib/phase-77f-client-menu-plan";
import { fromDateTimeLocal } from "@/components/dashboard/shared";
import { ClientWorkspace } from "@/components/dashboard/client-workspace";

type ClientCreateInput = {
  fullName: string;
  channel: Channel;
  channelUserId: string;
  primaryPhoneE164: string;
  communicationLanguage: SupportedLanguageCode;
};

type ClientWorkspaceRouteProps = {
  urlState: DashboardUrlState;
  clients: ClientRecord[];
  selectedClient: ClientRecord | null;
  state: ManuAppState;
  uiLanguage: SupportedLanguageCode;
  canManageAiControls: boolean;
  aiChatEnabled: boolean;
  onSelect: (clientId: string) => void;
  onCloseWorkspace: () => void;
  onClientTask: (task: ClientWorkspaceTask) => void;
  onCreateClient: (input: ClientCreateInput) => Promise<ManuAppState>;
  onUpdateClient: (clientId: string, patch: Partial<ClientRecord>) => Promise<ManuAppState>;
  onActivateAi: (clientId: string, requestedAiMode?: "copilot" | "autopilot") => Promise<unknown>;
  onReleaseHumanTakeover: (clientId: string) => Promise<unknown>;
  isActivatingAi: boolean;
  isReleasingHumanTakeover: boolean;
  onRemoveClient: () => void;
  onSaveClientFoodRuleProfile: (
    clientId: string,
    input: { revision: number; profile: Omit<ClientFoodRuleProfileV2State, "conflicts" | "revision"> },
  ) => Promise<ManuAppState>;
  onCreateMenuPlan: (clientId: string, input: { templateType: Phase77FMenuPlanTemplateType }) => Promise<ManuAppState>;
  onSaveMenuPlan: (
    clientId: string,
    planId: string,
    input: {
      revision: number;
      plan: Omit<ClientMenuPlanV1State, "conflicts" | "revision" | "id">;
    },
  ) => Promise<ManuAppState>;
  onActivateMenuPlan: (clientId: string, planId: string) => Promise<ManuAppState>;
  onSaveFormResponse: (input: {
    clientId: string;
    schemaId: string;
    answers: Record<string, unknown>;
    submittedPhoneE164?: string;
  }) => Promise<ManuAppState>;
  onAddClientContextUpdate: (
    clientId: string,
    input: {
      source: ClientContextUpdateSource;
      occurredAt?: string | null;
      title: string;
      summary: string;
      details?: string;
      importance: ClientContextUpdateImportance;
    },
  ) => Promise<ManuAppState>;
  onEvaluateWithAi?: (client: ClientRecord) => void;
  isEvaluatingWithAi: boolean;
  evaluateWithAiError: string | null;
  onOpenMessages?: (clientId: string) => void;
  saveDestinationViewState: (destinationId: ShellDestinationId, snapshot: ShellDestinationViewSnapshot) => void;
  restoreDestinationViewState: (destinationId: ShellDestinationId) => ShellDestinationViewSnapshot | null;
};

export function ClientWorkspaceRoute({
  urlState,
  clients,
  selectedClient,
  state,
  uiLanguage,
  canManageAiControls,
  aiChatEnabled,
  onSelect,
  onCloseWorkspace,
  onClientTask,
  onCreateClient,
  onUpdateClient,
  onActivateAi,
  onReleaseHumanTakeover,
  isActivatingAi,
  isReleasingHumanTakeover,
  onRemoveClient,
  onSaveClientFoodRuleProfile,
  onCreateMenuPlan,
  onSaveMenuPlan,
  onActivateMenuPlan,
  onSaveFormResponse,
  onAddClientContextUpdate,
  onEvaluateWithAi,
  isEvaluatingWithAi,
  evaluateWithAiError,
  onOpenMessages,
  saveDestinationViewState,
  restoreDestinationViewState,
}: ClientWorkspaceRouteProps) {
  const [search, setSearch] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientChannel, setNewClientChannel] = useState<Channel>("whatsapp");
  const [newClientHandle, setNewClientHandle] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientLanguage, setNewClientLanguage] = useState<SupportedLanguageCode>("tr");
  const [contextUpdateSource, setContextUpdateSource] = useState<ClientContextUpdateSource>("phone");
  const [contextUpdateImportance, setContextUpdateImportance] = useState<ClientContextUpdateImportance>("important");
  const [contextUpdateOccurredAt, setContextUpdateOccurredAt] = useState("");
  const [contextUpdateTitle, setContextUpdateTitle] = useState("");
  const [contextUpdateSummary, setContextUpdateSummary] = useState("");
  const [contextUpdateDetails, setContextUpdateDetails] = useState("");
  const searchRef = useRef(search);
  const clientTaskRef = useRef(urlState.clientTask ?? "summary");
  searchRef.current = search;
  clientTaskRef.current = urlState.clientTask ?? "summary";

  useEffect(() => {
    const snapshot = restoreDestinationViewState("clients");
    if (typeof snapshot?.search === "string") setSearch(snapshot.search);
    return () => {
      saveDestinationViewState("clients", {
        search: searchRef.current,
        tab: clientTaskRef.current,
        windowScrollY: window.scrollY,
      });
    };
  }, [restoreDestinationViewState, saveDestinationViewState]);

  const filteredClients = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return clients;
    return clients.filter((client) =>
      [client.fullName, client.channelUserId, client.aiMode, client.aiStatus]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(needle),
    );
  }, [clients, search]);

  const contextUpdates = useMemo<ClientContextUpdateRecord[]>(() => {
    if (!selectedClient) return [];
    return state.clientContextUpdates
      .filter((update) => update.clientId === selectedClient.id)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [selectedClient, state.clientContextUpdates]);

  const foodRuleProfile = useMemo(
    () => (selectedClient ? getClientFoodRuleProfileV2State(state, selectedClient.id) : null),
    [selectedClient, state],
  );
  const foodRuleRecord = useMemo(
    () => (selectedClient ? getClientFoodRuleProfileV2Record(state, selectedClient.id) : null),
    [selectedClient, state],
  );
  const menuPlans = useMemo(
    () =>
      selectedClient
        ? listClientMenuPlanV1Records(state, selectedClient.id).map((plan) =>
            menuPlanV1RecordToState(plan, foodRuleRecord),
          )
        : [],
    [foodRuleRecord, selectedClient, state],
  );
  const activeMenuPlanId = selectedClient
    ? getActiveClientMenuPlanV1Record(state, selectedClient.id)?.id ?? null
    : null;

  const addClient = useCallback(async () => {
    const fullName = newClientName.trim();
    if (!fullName) return null;
    const nextState = await onCreateClient({
      fullName,
      channel: newClientChannel,
      channelUserId: newClientHandle.trim(),
      primaryPhoneE164: newClientPhone.trim(),
      communicationLanguage: newClientLanguage,
    });
    setNewClientName("");
    setNewClientHandle("");
    setNewClientPhone("");
    setNewClientChannel("whatsapp");
    setNewClientLanguage("tr");
    return nextState.clients.at(-1)?.id ?? null;
  }, [newClientChannel, newClientHandle, newClientLanguage, newClientName, newClientPhone, onCreateClient]);

  const updateSelectedClient = useCallback(
    async (patch: Partial<ClientRecord>) => {
      if (!selectedClient) return;
      await onUpdateClient(selectedClient.id, patch);
    },
    [onUpdateClient, selectedClient],
  );

  const saveFormResponse = useCallback(
    async (input: {
      clientId: string;
      schemaId: string;
      answers: Record<string, unknown>;
      submittedPhoneE164?: string;
    }) => {
      await onSaveFormResponse(input);
    },
    [onSaveFormResponse],
  );

  const saveFoodRules = useCallback(
    async (profile: Omit<ClientFoodRuleProfileV2State, "conflicts">) => {
      if (!selectedClient) return;
      const { revision, ...profileBody } = profile;
      await onSaveClientFoodRuleProfile(selectedClient.id, { revision, profile: profileBody });
    },
    [onSaveClientFoodRuleProfile, selectedClient],
  );

  const createMenuPlan = useCallback(
    async (templateType: Phase77FMenuPlanTemplateType) => {
      if (selectedClient) await onCreateMenuPlan(selectedClient.id, { templateType });
    },
    [onCreateMenuPlan, selectedClient],
  );

  const saveMenuPlan = useCallback(
    async (plan: Omit<ClientMenuPlanV1State, "conflicts">) => {
      if (!selectedClient) return;
      const { revision, id, ...planBody } = plan;
      await onSaveMenuPlan(selectedClient.id, id, { revision, plan: planBody });
    },
    [onSaveMenuPlan, selectedClient],
  );

  const activateMenuPlan = useCallback(
    async (planId: string) => {
      if (selectedClient) await onActivateMenuPlan(selectedClient.id, planId);
    },
    [onActivateMenuPlan, selectedClient],
  );

  const addContextUpdate = useCallback(async () => {
    if (!selectedClient) return;
    await onAddClientContextUpdate(selectedClient.id, {
      source: contextUpdateSource,
      occurredAt: contextUpdateOccurredAt ? fromDateTimeLocal(contextUpdateOccurredAt) : null,
      title: contextUpdateTitle,
      summary: contextUpdateSummary,
      details: contextUpdateDetails,
      importance: contextUpdateImportance,
    });
    setContextUpdateTitle("");
    setContextUpdateSummary("");
    setContextUpdateDetails("");
  }, [
    contextUpdateDetails,
    contextUpdateImportance,
    contextUpdateOccurredAt,
    contextUpdateSource,
    contextUpdateSummary,
    contextUpdateTitle,
    onAddClientContextUpdate,
    selectedClient,
  ]);

  return (
    <ClientWorkspace
      urlState={urlState}
      clients={filteredClients}
      selectedClient={selectedClient}
      search={search}
      newClientName={newClientName}
      newClientChannel={newClientChannel}
      newClientHandle={newClientHandle}
      newClientPhone={newClientPhone}
      newClientLanguage={newClientLanguage}
      uiLanguage={uiLanguage}
      canManageAiControls={canManageAiControls}
      onSearch={setSearch}
      onSelect={onSelect}
      onCloseWorkspace={onCloseWorkspace}
      onClientTask={onClientTask}
      onAddClient={addClient}
      onNewClientName={setNewClientName}
      onNewClientChannel={setNewClientChannel}
      onNewClientHandle={setNewClientHandle}
      onNewClientPhone={setNewClientPhone}
      onNewClientLanguage={setNewClientLanguage}
      onUpdateClient={updateSelectedClient}
      onActivateAi={onActivateAi}
      onReleaseHumanTakeover={onReleaseHumanTakeover}
      isActivatingAi={isActivatingAi}
      isReleasingHumanTakeover={isReleasingHumanTakeover}
      onRemoveClient={onRemoveClient}
      contextUpdates={contextUpdates}
      contextUpdateSource={contextUpdateSource}
      contextUpdateImportance={contextUpdateImportance}
      contextUpdateOccurredAt={contextUpdateOccurredAt}
      contextUpdateTitle={contextUpdateTitle}
      contextUpdateSummary={contextUpdateSummary}
      contextUpdateDetails={contextUpdateDetails}
      onContextUpdateSource={setContextUpdateSource}
      onContextUpdateImportance={setContextUpdateImportance}
      onContextUpdateOccurredAt={setContextUpdateOccurredAt}
      onContextUpdateTitle={setContextUpdateTitle}
      onContextUpdateSummary={setContextUpdateSummary}
      onContextUpdateDetails={setContextUpdateDetails}
      onAddContextUpdate={addContextUpdate}
      state={state}
      foodRuleProfile={foodRuleProfile}
      menuPlans={menuPlans}
      activeMenuPlanId={activeMenuPlanId}
      onSaveFoodRules={saveFoodRules}
      onCreateMenuPlan={createMenuPlan}
      onSaveMenuPlan={saveMenuPlan}
      onActivateMenuPlan={activateMenuPlan}
      onSaveFormResponse={saveFormResponse}
      aiChatEnabled={aiChatEnabled}
      onEvaluateWithAi={onEvaluateWithAi}
      isEvaluatingWithAi={isEvaluatingWithAi}
      evaluateWithAiError={evaluateWithAiError}
      onOpenMessages={onOpenMessages}
    />
  );
}

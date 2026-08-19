"use client";

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Download, FileText, PhoneCall, Plus, Sparkles, UserX } from "lucide-react";
import { personas } from "dietitian-ai-assistant-architecture";
import {
  countAiControlBlockers,
  summarizeAiAssistantControl,
} from "@/lib/ai-assistant-control-panel-helpers";
import { getActiveFormSchema } from "@/lib/client-forms";
import type {
  Channel,
  ClientContextUpdateImportance,
  ClientContextUpdateRecord,
  ClientContextUpdateSource,
  ClientRecord,
  ManuAppState,
  Phase77FMenuPlanTemplateType,
} from "@/lib/types";
import {
  getClientFoodRuleProfileV2Record,
  type ClientFoodRuleProfileV2State,
} from "@/lib/phase-77e-client-food-rule-profile";
import { menuPlanV1RecordToState, type ClientMenuPlanV1State } from "@/lib/phase-77f-client-menu-plan";
import {
  buildMenuPlanExportPreviewText,
  deriveMenuPlanExportFromSummarySource,
} from "@/lib/phase-77j-menu-plan-export";
import {
  buildInitialClientFormAnswers,
  summarizeAutopilotFieldStatus,
} from "@/lib/client-form-panel-helpers";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import {
  resolveClientWorkspaceStage,
  resolveClientWorkspaceTask,
  type ClientWorkspaceTask,
  type DashboardUrlState,
} from "@/lib/phase-85-stage-4b-dashboard-routing";
import { shouldRestoreClientRosterFocus } from "@/lib/phase-85-stage-6-client-selection";
import { useStage6ClientWorkspace, type Stage6WorkspaceDomain } from "@/lib/use-stage-6-client-workspace";
import { formatStage6ClientReferenceShort } from "@/lib/phase-85-stage-6-client-selection";
import { buildShellHighImpactConfirmMessage } from "@/lib/phase-85-stage-5-shell-contracts";
import { useShellDirtyRegistration } from "@/lib/use-shell-dirty-registration";
import type { ShellDirtyEntryState } from "@/lib/phase-85-stage-5-shell-dirty-registry";
import {
  Badge,
  ConfirmButton,
  ConflictSummaryBox,
  DateTimeInput,
  EmptyState,
  SelectInput,
  TextInput,
  TextareaInput,
  formatTime,
  sourceLabel,
} from "./shared";
import { ClientsPanel } from "./clients-panel";
import { ClientTaskHub } from "./client-task-hub";
import { ClientWorkspaceHeader } from "./client-workspace-header";
import { SkeletonBlock } from "./state-primitives";

const ClientFormPanel = lazy(() =>
  import("./client-form-panel").then((module) => ({ default: module.ClientFormPanel })),
);
const ActiveNutritionPlanPanel = lazy(() =>
  import("./active-nutrition-plan-panel").then((module) => ({ default: module.ActiveNutritionPlanPanel })),
);
const MenuWorkflowPanel = lazy(() =>
  import("./menu-workflow-panel").then((module) => ({ default: module.MenuWorkflowPanel })),
);
const AiAssistantControlPanel = lazy(() =>
  import("./ai-assistant-control-panel").then((module) => ({ default: module.AiAssistantControlPanel })),
);

function taskDomain(task: ClientWorkspaceTask): Stage6WorkspaceDomain | null {
  if (task === "export") return null;
  if (task === "summary") return "summary";
  return task;
}

function WorkspaceNotice({
  title,
  message,
  tone = "error",
}: {
  title: string;
  message: string;
  tone?: "error" | "conflict";
}) {
  return (
    <div
      role="alert"
      data-testid={tone === "conflict" ? "client-workspace-conflict" : "client-workspace-error"}
      className={`rounded-card border p-4 text-sm ${
        tone === "conflict"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-6">{message}</p>
    </div>
  );
}

export function ClientWorkspace({
  urlState,
  clients,
  selectedClient,
  search,
  newClientName,
  newClientChannel,
  newClientHandle,
  newClientPhone,
  newClientLanguage,
  uiLanguage,
  canManageAiControls = true,
  onSearch,
  onSelect,
  onCloseWorkspace,
  onClientTask,
  onAddClient,
  onNewClientName,
  onNewClientChannel,
  onNewClientHandle,
  onNewClientPhone,
  onNewClientLanguage,
  onUpdateClient,
  onActivateAi,
  onReleaseHumanTakeover,
  isActivatingAi,
  isReleasingHumanTakeover,
  onRemoveClient,
  contextUpdates,
  contextUpdateSource,
  contextUpdateImportance,
  contextUpdateOccurredAt,
  contextUpdateTitle,
  contextUpdateSummary,
  contextUpdateDetails,
  onContextUpdateSource,
  onContextUpdateImportance,
  onContextUpdateOccurredAt,
  onContextUpdateTitle,
  onContextUpdateSummary,
  onContextUpdateDetails,
  onAddContextUpdate,
  state,
  foodRuleProfile,
  menuPlans,
  activeMenuPlanId,
  onSaveFoodRules,
  onCreateMenuPlan,
  onSaveMenuPlan,
  onActivateMenuPlan,
  onSaveFormResponse,
  aiChatEnabled = false,
  onEvaluateWithAi,
  isEvaluatingWithAi = false,
  evaluateWithAiError = null,
}: {
  urlState: DashboardUrlState;
  clients: ClientRecord[];
  selectedClient: ClientRecord | null;
  search: string;
  newClientName: string;
  newClientChannel: Channel;
  newClientHandle: string;
  newClientPhone: string;
  newClientLanguage: SupportedLanguageCode;
  uiLanguage: SupportedLanguageCode;
  canManageAiControls?: boolean;
  onSearch: (value: string) => void;
  onSelect: (clientId: string) => void;
  onCloseWorkspace: () => void;
  onClientTask: (task: ClientWorkspaceTask) => void;
  onAddClient: () => void;
  onNewClientName: (value: string) => void;
  onNewClientChannel: (value: Channel) => void;
  onNewClientHandle: (value: string) => void;
  onNewClientPhone: (value: string) => void;
  onNewClientLanguage: (value: SupportedLanguageCode) => void;
  onUpdateClient: (patch: Partial<ClientRecord>) => Promise<void> | void;
  onActivateAi: (clientId: string, requestedAiMode?: "copilot" | "autopilot") => Promise<unknown> | unknown;
  onReleaseHumanTakeover: (clientId: string) => Promise<unknown> | unknown;
  isActivatingAi?: boolean;
  isReleasingHumanTakeover?: boolean;
  onRemoveClient: () => void;
  contextUpdates: ClientContextUpdateRecord[];
  contextUpdateSource: ClientContextUpdateSource;
  contextUpdateImportance: ClientContextUpdateImportance;
  contextUpdateOccurredAt: string;
  contextUpdateTitle: string;
  contextUpdateSummary: string;
  contextUpdateDetails: string;
  onContextUpdateSource: (value: ClientContextUpdateSource) => void;
  onContextUpdateImportance: (value: ClientContextUpdateImportance) => void;
  onContextUpdateOccurredAt: (value: string) => void;
  onContextUpdateTitle: (value: string) => void;
  onContextUpdateSummary: (value: string) => void;
  onContextUpdateDetails: (value: string) => void;
  onAddContextUpdate: () => void;
  state: ManuAppState;
  foodRuleProfile: ClientFoodRuleProfileV2State | null;
  menuPlans: ClientMenuPlanV1State[];
  activeMenuPlanId: string | null;
  onSaveFoodRules: (profile: Omit<ClientFoodRuleProfileV2State, "conflicts">) => Promise<void>;
  onCreateMenuPlan: (templateType: Phase77FMenuPlanTemplateType) => Promise<void>;
  onSaveMenuPlan: (plan: Omit<ClientMenuPlanV1State, "conflicts">) => Promise<void>;
  onActivateMenuPlan: (planId: string) => Promise<void>;
  onSaveFormResponse: (input: {
    clientId: string;
    schemaId: string;
    answers: Record<string, unknown>;
    submittedPhoneE164?: string;
  }) => Promise<void>;
  aiChatEnabled?: boolean;
  onEvaluateWithAi?: (client: ClientRecord) => void;
  isEvaluatingWithAi?: boolean;
  evaluateWithAiError?: string | null;
}) {
  const stage = resolveClientWorkspaceStage(urlState);
  const clientTask = resolveClientWorkspaceTask(urlState);
  const domain = selectedClient ? taskDomain(clientTask) : null;
  const workspace = useStage6ClientWorkspace({
    clientId: selectedClient?.id ?? null,
    domain: domain ?? "summary",
    enabled: Boolean(selectedClient && domain),
  });
  const previousStageRef = useRef(stage);
  const lastClientIdRef = useRef<string | null>(selectedClient?.id ?? null);

  useEffect(() => {
    const previous = previousStageRef.current;
    if (shouldRestoreClientRosterFocus(stage, previous) && lastClientIdRef.current) {
      const button = document.querySelector<HTMLButtonElement>(
        `[data-testid="client-roster-item"][data-client-id="${lastClientIdRef.current}"]`,
      );
      button?.focus();
    }
    previousStageRef.current = stage;
    if (selectedClient?.id) lastClientIdRef.current = selectedClient.id;
  }, [selectedClient?.id, stage]);

  const handleBack = () => {
    if (stage === "task") {
      onClientTask("summary");
      return;
    }
    onCloseWorkspace();
  };

  return (
    <div
      className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]"
      data-testid="client-workspace"
      data-workspace-stage={stage}
    >
      <div className={stage !== "list" ? "max-lg:hidden" : undefined}>
        <ClientsPanel
          clients={clients}
          selectedClientId={selectedClient?.id ?? null}
          search={search}
          newClientName={newClientName}
          newClientChannel={newClientChannel}
          newClientHandle={newClientHandle}
          newClientPhone={newClientPhone}
          newClientLanguage={newClientLanguage}
          uiLanguage={uiLanguage}
          onSearch={onSearch}
          onSelect={onSelect}
          onAddClient={onAddClient}
          onNewClientName={onNewClientName}
          onNewClientChannel={onNewClientChannel}
          onNewClientHandle={onNewClientHandle}
          onNewClientPhone={onNewClientPhone}
          onNewClientLanguage={onNewClientLanguage}
        />
      </div>

      <div className={stage === "list" ? "max-lg:hidden" : undefined}>
        {urlState.clientId && !selectedClient ? (
          <div className="space-y-4" data-testid="client-workspace-inaccessible">
            <button
              type="button"
              onClick={onCloseWorkspace}
              className="inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted lg:hidden"
              data-testid="client-workspace-back"
            >
              Danışan listesine dön
            </button>
            <WorkspaceNotice
              title="Danışan artık erişilemiyor"
              message="Bu kayıt pasif, silinmiş veya bu oturumda açılamıyor. Başka bir danışana yönlendirilmedi."
            />
          </div>
        ) : selectedClient ? (
          <ClientWorkspaceDetail
            client={selectedClient}
            clientTask={clientTask}
            stage={stage}
            uiLanguage={uiLanguage}
            canManageAiControls={canManageAiControls}
            loadStatus={workspace.status}
            loadError={workspace.error}
            onBack={handleBack}
            onClientTask={onClientTask}
            onUpdateClient={onUpdateClient}
            onActivateAi={onActivateAi}
            onReleaseHumanTakeover={onReleaseHumanTakeover}
            isActivatingAi={isActivatingAi}
            isReleasingHumanTakeover={isReleasingHumanTakeover}
            onRemoveClient={onRemoveClient}
            contextUpdates={workspace.context?.items ?? contextUpdates}
            contextUpdateSource={contextUpdateSource}
            contextUpdateImportance={contextUpdateImportance}
            contextUpdateOccurredAt={contextUpdateOccurredAt}
            contextUpdateTitle={contextUpdateTitle}
            contextUpdateSummary={contextUpdateSummary}
            contextUpdateDetails={contextUpdateDetails}
            onContextUpdateSource={onContextUpdateSource}
            onContextUpdateImportance={onContextUpdateImportance}
            onContextUpdateOccurredAt={onContextUpdateOccurredAt}
            onContextUpdateTitle={onContextUpdateTitle}
            onContextUpdateSummary={onContextUpdateSummary}
            onContextUpdateDetails={onContextUpdateDetails}
            onAddContextUpdate={onAddContextUpdate}
            state={state}
            foodRuleProfile={workspace.nutrition?.profile ?? foodRuleProfile}
            menuPlans={
              workspace.menu
                ? workspace.menu.plans.map((plan) =>
                    menuPlanV1RecordToState(plan, getClientFoodRuleProfileV2Record(state, selectedClient.id)),
                  )
                : menuPlans
            }
            activeMenuPlanId={workspace.menu?.activePlanId ?? activeMenuPlanId}
            onSaveFoodRules={onSaveFoodRules}
            onCreateMenuPlan={onCreateMenuPlan}
            onSaveMenuPlan={onSaveMenuPlan}
            onActivateMenuPlan={onActivateMenuPlan}
            onSaveFormResponse={onSaveFormResponse}
            aiChatEnabled={aiChatEnabled}
            onEvaluateWithAi={onEvaluateWithAi}
            isEvaluatingWithAi={isEvaluatingWithAi}
            evaluateWithAiError={evaluateWithAiError}
          />
        ) : (
          <EmptyState title="Danışan seçilmedi" message="Listeden bir danışan seçin. Otomatik seçim yapılmaz." />
        )}
      </div>
    </div>
  );
}

function ClientWorkspaceDetail({
  client,
  clientTask,
  stage,
  uiLanguage,
  canManageAiControls = true,
  loadStatus,
  loadError,
  onBack,
  onClientTask,
  onUpdateClient,
  onActivateAi,
  onReleaseHumanTakeover,
  isActivatingAi,
  isReleasingHumanTakeover,
  onRemoveClient,
  aiChatEnabled = false,
  onEvaluateWithAi,
  isEvaluatingWithAi = false,
  evaluateWithAiError = null,
  contextUpdates,
  contextUpdateSource,
  contextUpdateImportance,
  contextUpdateOccurredAt,
  contextUpdateTitle,
  contextUpdateSummary,
  contextUpdateDetails,
  onContextUpdateSource,
  onContextUpdateImportance,
  onContextUpdateOccurredAt,
  onContextUpdateTitle,
  onContextUpdateSummary,
  onContextUpdateDetails,
  onAddContextUpdate,
  state,
  foodRuleProfile,
  menuPlans,
  activeMenuPlanId,
  onSaveFoodRules,
  onCreateMenuPlan,
  onSaveMenuPlan,
  onActivateMenuPlan,
  onSaveFormResponse,
}: {
  client: ClientRecord;
  clientTask: ClientWorkspaceTask;
  stage: "list" | "hub" | "task";
  uiLanguage: SupportedLanguageCode;
  canManageAiControls?: boolean;
  loadStatus: string;
  loadError: string | null;
  onBack: () => void;
  onClientTask: (task: ClientWorkspaceTask) => void;
  onUpdateClient: (patch: Partial<ClientRecord>) => Promise<void> | void;
  onActivateAi: (clientId: string, requestedAiMode?: "copilot" | "autopilot") => Promise<unknown> | unknown;
  onReleaseHumanTakeover: (clientId: string) => Promise<unknown> | unknown;
  isActivatingAi?: boolean;
  isReleasingHumanTakeover?: boolean;
  onRemoveClient: () => void;
  aiChatEnabled?: boolean;
  onEvaluateWithAi?: (client: ClientRecord) => void;
  isEvaluatingWithAi?: boolean;
  evaluateWithAiError?: string | null;
  contextUpdates: ClientContextUpdateRecord[];
  contextUpdateSource: ClientContextUpdateSource;
  contextUpdateImportance: ClientContextUpdateImportance;
  contextUpdateOccurredAt: string;
  contextUpdateTitle: string;
  contextUpdateSummary: string;
  contextUpdateDetails: string;
  onContextUpdateSource: (value: ClientContextUpdateSource) => void;
  onContextUpdateImportance: (value: ClientContextUpdateImportance) => void;
  onContextUpdateOccurredAt: (value: string) => void;
  onContextUpdateTitle: (value: string) => void;
  onContextUpdateSummary: (value: string) => void;
  onContextUpdateDetails: (value: string) => void;
  onAddContextUpdate: () => void;
  state: ManuAppState;
  foodRuleProfile: ClientFoodRuleProfileV2State | null;
  menuPlans: ClientMenuPlanV1State[];
  activeMenuPlanId: string | null;
  onSaveFoodRules: (profile: Omit<ClientFoodRuleProfileV2State, "conflicts">) => Promise<void>;
  onCreateMenuPlan: (templateType: Phase77FMenuPlanTemplateType) => Promise<void>;
  onSaveMenuPlan: (plan: Omit<ClientMenuPlanV1State, "conflicts">) => Promise<void>;
  onActivateMenuPlan: (planId: string) => Promise<void>;
  onSaveFormResponse: (input: {
    clientId: string;
    schemaId: string;
    answers: Record<string, unknown>;
    submittedPhoneE164?: string;
  }) => Promise<void>;
}) {
  const foodRuleConflictCount = foodRuleProfile?.conflicts?.length || 0;
  const menuConflictCount = menuPlans.reduce((sum, plan) => sum + (plan.conflicts?.length || 0), 0);
  const activeContextCount = contextUpdates.filter((update) => update.status === "active").length;
  const aiControlSummary = summarizeAiAssistantControl(state, client);
  const aiBlockerCount = countAiControlBlockers(state, client);
  const activeFormSchema = getActiveFormSchema(state);
  const activeFormResponse = activeFormSchema
    ? state.clientFormResponses.find(
        (item) => item.clientId === client.id && item.schemaId === activeFormSchema.id,
      ) || null
    : null;
  const formAutopilotMissingCount = activeFormSchema
    ? summarizeAutopilotFieldStatus(
        activeFormSchema.fields,
        buildInitialClientFormAnswers(client, activeFormResponse),
      ).missing.length
    : 0;
  const badges: Partial<Record<ClientWorkspaceTask, string>> = {
    forms: formAutopilotMissingCount > 0 ? String(formAutopilotMissingCount) : undefined,
    nutrition: foodRuleConflictCount > 0 ? String(foodRuleConflictCount) : undefined,
    menu: activeMenuPlanId ? undefined : "!",
    ai: aiBlockerCount > 0 ? String(aiBlockerCount) : undefined,
    context: activeContextCount > 0 ? String(activeContextCount) : undefined,
  };
  const taskTitle =
    clientTask === "summary"
      ? t(uiLanguage, "tabOverview")
      : clientTask === "forms"
        ? t(uiLanguage, "tabPersonalForm")
        : clientTask === "nutrition"
          ? t(uiLanguage, "tabFoodRules")
          : clientTask === "menu"
            ? t(uiLanguage, "tabMenu")
            : clientTask === "ai"
              ? t(uiLanguage, "tabAiAssistant")
              : clientTask === "context"
                ? t(uiLanguage, "tabCriticalContext")
                : t(uiLanguage, "tabExport");

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-sm" data-testid="client-detail">
      <ClientWorkspaceHeader
        client={client}
        title={taskTitle}
        showBack
        backLabel={stage === "task" ? "Danışan özetine dön" : "Danışan listesine dön"}
        onBack={onBack}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {aiChatEnabled && onEvaluateWithAi ? (
          <button
            type="button"
            onClick={() => onEvaluateWithAi(client)}
            disabled={isEvaluatingWithAi}
            data-testid="client-evaluate-with-ai"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles size={16} />
            {t(uiLanguage, "clientDetailAiEvaluate")}
          </button>
        ) : null}
        <ConfirmButton
          label="Remove client"
          confirmLabel={buildShellHighImpactConfirmMessage("Kaldırmayı onayla", {
            fullName: client.fullName,
            referenceShort: formatStage6ClientReferenceShort(client.id),
          })}
          onConfirm={onRemoveClient}
          icon={UserX}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-red-200 bg-surface px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          confirmClassName="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-red-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
        />
      </div>

      {aiChatEnabled && evaluateWithAiError ? (
        <p role="alert" data-testid="client-evaluate-with-ai-error" className="mt-3 rounded-control border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {evaluateWithAiError}
        </p>
      ) : null}

      <div className="mt-3 hidden lg:block">
        <ClientTaskHub
          uiLanguage={uiLanguage}
          activeTask={clientTask}
          badges={badges}
          onOpenTask={onClientTask}
          variant="tabs"
        />
      </div>

      {loadStatus === "loading" ? (
        <div className="mt-4 space-y-3" aria-busy="true" data-testid="client-workspace-loading">
          <SkeletonBlock className="h-11 w-full" />
          <SkeletonBlock className="h-40 w-full rounded-card" />
        </div>
      ) : null}
      {loadStatus === "error" ? (
        <div className="mt-4">
          <WorkspaceNotice
            title="Çalışma alanı yüklenemedi"
            message={
              loadError === "capability_denied" || loadError?.includes("403")
                ? "Bu danışan görevine yetkiniz yok."
                : "Kayıt şu anda açılamıyor. Sessiz başarı gösterilmedi."
            }
          />
        </div>
      ) : null}
      {loadStatus === "conflict" ? (
        <div className="mt-4">
          <WorkspaceNotice
            title="Kayıt çakışması"
            message="Sunucudaki revizyon değişti. Taslak korundu; yeniden yükleyip uygulamadan önce karar verin."
            tone="conflict"
          />
        </div>
      ) : null}

      {loadStatus !== "loading" && loadStatus !== "error" ? (
        <div className="mt-4">
          {clientTask === "summary" ? (
            <div className="space-y-4">
              <div className="lg:hidden">
                <ClientTaskHub
                  uiLanguage={uiLanguage}
                  activeTask={clientTask}
                  badges={badges}
                  onOpenTask={onClientTask}
                  variant="hub"
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <AiAssistantOverviewCard
                  client={client}
                  summary={aiControlSummary}
                  onOpen={() => onClientTask("ai")}
                />
                <ClientDetailStatusSummary
                  uiLanguage={uiLanguage}
                  foodRuleConflicts={foodRuleConflictCount}
                  menuConflicts={menuConflictCount}
                  hasActiveMenu={!!activeMenuPlanId}
                  activeContextCount={activeContextCount}
                  aiBlockerCount={aiBlockerCount}
                  onNavigate={onClientTask}
                />
              </div>
            </div>
          ) : (
            <Suspense fallback={<SkeletonBlock className="h-48 w-full rounded-card" />}>
              {clientTask === "forms" ? (
                <ClientFormPanel client={client} state={state} uiLanguage={uiLanguage} onSave={onSaveFormResponse} />
              ) : null}
              {clientTask === "nutrition" ? (
                <div className="space-y-4">
                  {foodRuleProfile ? (
                    <>
                      {foodRuleProfile.conflicts.length > 0 ? (
                        <ConflictSummaryBox conflicts={foodRuleProfile.conflicts.map((conflict) => conflict.message)} />
                      ) : null}
                      <ActiveNutritionPlanPanel
                        key={`${client.id}-${foodRuleProfile.revision}`}
                        clientId={client.id}
                        clientName={client.fullName}
                        contextRevision={client.contextRevision}
                        initialProfile={foodRuleProfile}
                        disabled={client.lifecycleStatus === "removed_anonymized"}
                        onSave={onSaveFoodRules}
                      />
                    </>
                  ) : (
                    <EmptyState message={t(uiLanguage, "noFoodRulesYet")} />
                  )}
                </div>
              ) : null}
              {clientTask === "menu" ? (
                <div className="space-y-4">
                  {menuPlans.length > 0 && menuConflictCount > 0 ? (
                    <ConflictSummaryBox
                      conflicts={menuPlans.flatMap((plan) => (plan.conflicts || []).map((conflict) => conflict.message))}
                    />
                  ) : null}
                  <MenuWorkflowPanel
                    key={`${client.id}-menu-${activeMenuPlanId || "none"}-${menuPlans[0]?.revision || 0}`}
                    clientId={client.id}
                    clientName={client.fullName}
                    uiLanguage={uiLanguage}
                    plans={menuPlans}
                    activePlanId={activeMenuPlanId}
                    disabled={client.lifecycleStatus === "removed_anonymized"}
                    onCreate={onCreateMenuPlan}
                    onSave={onSaveMenuPlan}
                    onActivate={onActivateMenuPlan}
                  />
                </div>
              ) : null}
              {clientTask === "ai" ? (
                <AiAssistantControlPanel
                  client={client}
                  state={state}
                  uiLanguage={uiLanguage}
                  disabled={client.lifecycleStatus === "removed_anonymized"}
                  canManageAiControls={canManageAiControls}
                  onUpdateClient={onUpdateClient}
                  onActivateAi={onActivateAi}
                  onReleaseHumanTakeover={onReleaseHumanTakeover}
                  isActivatingAi={isActivatingAi}
                  isReleasingHumanTakeover={isReleasingHumanTakeover}
                />
              ) : null}
              {clientTask === "context" ? (
                <ClientContextUpdatePanel
                  clientId={client.id}
                  updates={contextUpdates}
                  source={contextUpdateSource}
                  importance={contextUpdateImportance}
                  occurredAt={contextUpdateOccurredAt}
                  title={contextUpdateTitle}
                  summary={contextUpdateSummary}
                  details={contextUpdateDetails}
                  onSource={onContextUpdateSource}
                  onImportance={onContextUpdateImportance}
                  onOccurredAt={onContextUpdateOccurredAt}
                  onTitle={onContextUpdateTitle}
                  onSummary={onContextUpdateSummary}
                  onDetails={onContextUpdateDetails}
                  onAdd={onAddContextUpdate}
                />
              ) : null}
              {clientTask === "export" ? (
                <ClientExportTab
                  client={client}
                  uiLanguage={uiLanguage}
                  foodRuleProfile={foodRuleProfile}
                  menuPlans={menuPlans}
                  activeMenuPlanId={activeMenuPlanId}
                  contextUpdates={contextUpdates}
                />
              ) : null}
            </Suspense>
          )}
        </div>
      ) : null}
    </section>
  );
}

function AiAssistantOverviewCard({
  client,
  summary,
  onOpen,
}: {
  client: ClientRecord;
  summary: ReturnType<typeof summarizeAiAssistantControl>;
  onOpen: () => void;
}) {
  const personaLabel = personas.find((persona) => persona.id === client.selectedPersonaId)?.label || client.selectedPersonaId;

  return (
    <div className="rounded-card border border-line p-4" data-testid="ai-assistant-overview-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-ink" />
            <p className="text-sm font-semibold text-ink">AI Asistan ozeti</p>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            {personaLabel} · {client.aiStatus} · {client.aiMode}
          </p>
        </div>
        <Badge label={summary.activationLabel} tone={summary.activationTone} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge
          label={summary.safetyComplete ? "Guvenlik tamam" : "Guvenlik eksik"}
          tone={summary.safetyComplete ? "emerald" : "amber"}
        />
        <Badge
          label={summary.readiness.ready ? "Autopilot hazir" : "Autopilot eksik"}
          tone={summary.readiness.ready ? "emerald" : summary.readiness.blocked ? "red" : "amber"}
        />
        {summary.blockerCount > 0 ? <Badge label={`${summary.blockerCount} engel`} tone="red" /> : null}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted"
        data-testid="open-ai-assistant-control"
      >
        AI Asistan Kontrolu ac
      </button>
    </div>
  );
}

function ClientDetailStatusSummary({
  uiLanguage,
  foodRuleConflicts,
  menuConflicts,
  hasActiveMenu,
  activeContextCount,
  aiBlockerCount,
  onNavigate,
}: {
  uiLanguage: SupportedLanguageCode;
  foodRuleConflicts: number;
  menuConflicts: number;
  hasActiveMenu: boolean;
  activeContextCount: number;
  aiBlockerCount: number;
  onNavigate: (task: ClientWorkspaceTask) => void;
}) {
  return (
    <div className="rounded-card border border-line p-4" data-testid="status-summary">
      <p className="text-sm font-semibold text-ink">Status</p>
      <div className="mt-3 space-y-2">
        <button type="button" onClick={() => onNavigate("ai")} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control bg-surface-muted px-3 py-2 text-left text-sm transition hover:bg-surface-sunken">
          <span className="text-ink-muted">{t(uiLanguage, "tabAiAssistant")}</span>
          {aiBlockerCount > 0 ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">{aiBlockerCount} engel</span>
          ) : (
            <span className="text-xs font-medium text-ink">OK</span>
          )}
        </button>
        <button type="button" onClick={() => onNavigate("nutrition")} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control bg-surface-muted px-3 py-2 text-left text-sm transition hover:bg-surface-sunken">
          <span className="text-ink-muted">{t(uiLanguage, "tabFoodRules")}</span>
          {foodRuleConflicts > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{foodRuleConflicts} {t(uiLanguage, "conflictsFound").toLowerCase()}</span>
          ) : (
            <span className="text-xs font-medium text-ink">OK</span>
          )}
        </button>
        <button type="button" onClick={() => onNavigate("menu")} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control bg-surface-muted px-3 py-2 text-left text-sm transition hover:bg-surface-sunken">
          <span className="text-ink-muted">{t(uiLanguage, "tabMenu")}</span>
          <span className="flex items-center gap-2">
            {menuConflicts > 0 ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{menuConflicts}</span> : null}
            <Badge label={hasActiveMenu ? t(uiLanguage, "activeMenu") : t(uiLanguage, "noActiveMenu")} tone={hasActiveMenu ? "emerald" : "amber"} />
          </span>
        </button>
        <button type="button" onClick={() => onNavigate("context")} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control bg-surface-muted px-3 py-2 text-left text-sm transition hover:bg-surface-sunken">
          <span className="text-ink-muted">{t(uiLanguage, "tabCriticalContext")}</span>
          <span className="text-xs font-medium text-ink">{activeContextCount} active</span>
        </button>
      </div>
    </div>
  );
}

function ClientExportTab({
  client,
  uiLanguage,
  foodRuleProfile,
  menuPlans,
  activeMenuPlanId,
  contextUpdates,
}: {
  client: ClientRecord;
  uiLanguage: SupportedLanguageCode;
  foodRuleProfile: ClientFoodRuleProfileV2State | null;
  menuPlans: ClientMenuPlanV1State[];
  activeMenuPlanId: string | null;
  contextUpdates: ClientContextUpdateRecord[];
}) {
  const [includeRecipes, setIncludeRecipes] = useState(true);
  const [isDownloading, setIsDownloading] = useState<"docx" | "pdf" | null>(null);
  const activeMenu = menuPlans.find((plan) => plan.id === activeMenuPlanId);
  const hasData = !!foodRuleProfile || menuPlans.length > 0 || contextUpdates.length > 0;

  const exportPreview = useMemo(() => {
    if (!activeMenu || !activeMenu.exportVisible) return "";
    return buildMenuPlanExportPreviewText(
      deriveMenuPlanExportFromSummarySource(client, activeMenu, { includeRecipes }),
    );
  }, [activeMenu, client, includeRecipes]);

  const downloadMenuExport = async (format: "docx" | "pdf") => {
    if (!activeMenu || isDownloading) return;
    setIsDownloading(format);
    try {
      const params = new URLSearchParams({
        format,
        includeRecipes: includeRecipes ? "true" : "false",
        planId: activeMenu.id,
      });
      const response = await fetch(`/api/clients/${client.id}/menu-plans/export?${params.toString()}`);
      if (!response.ok) throw new Error(`export_failed_${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        `menu-plan.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(null);
    }
  };

  if (!hasData) {
    return <EmptyState message={t(uiLanguage, "exportNotReady")} />;
  }

  return (
    <div className="space-y-4" data-testid="export-tab">
      <h4 className="text-sm font-semibold text-ink">{t(uiLanguage, "exportSummaryTitle")}</h4>
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-card border border-line p-3">
          <p className="text-xs font-semibold uppercase text-ink-muted">Profile</p>
          <div className="mt-2 space-y-1 text-sm text-ink">
            <p>{client.fullName} · {client.communicationLanguage}</p>
            <p>Goal: {client.healthProfile.goal || "-"}</p>
            <p>Allergies: {client.allergies.length > 0 ? client.allergies.join(", ") : "-"}</p>
          </div>
        </div>
        <div className="rounded-card border border-line p-3">
          <p className="text-xs font-semibold uppercase text-ink-muted">Food rules</p>
          <div className="mt-2 space-y-1 text-sm text-ink">
            {foodRuleProfile ? (
              <>
                <p>Forbidden foods: {foodRuleProfile.forbiddenCatalogFoodIds.length}</p>
                <p>Allowed foods: {foodRuleProfile.allowedCatalogFoodIds.length}</p>
                <p>Flexibility: {foodRuleProfile.flexibilityGlobal}</p>
              </>
            ) : (
              <p className="text-ink-muted">Not configured</p>
            )}
          </div>
        </div>
        <div className="rounded-card border border-line p-3">
          <p className="text-xs font-semibold uppercase text-ink-muted">Menu plan</p>
          <div className="mt-2 space-y-1 text-sm text-ink">
            {activeMenu ? (
              <>
                <p>Template: {activeMenu.templateType}</p>
                <p>Meals: {activeMenu.mealSlots.length}</p>
                <p>Status: Active</p>
              </>
            ) : (
              <p className="text-ink-muted">{t(uiLanguage, "noActiveMenu")}</p>
            )}
          </div>
        </div>
        <div className="rounded-card border border-line p-3">
          <p className="text-xs font-semibold uppercase text-ink-muted">Critical context</p>
          <div className="mt-2 text-sm text-ink">
            <p>{contextUpdates.filter((update) => update.status === "active").length} active entries</p>
          </div>
        </div>
      </div>
      <div className="rounded-card border border-line p-4" data-testid="menu-export-panel">
        <h5 className="text-sm font-semibold text-ink">{t(uiLanguage, "exportMenuTitle")}</h5>
        {!activeMenu ? (
          <p className="mt-2 text-sm text-ink-muted">{t(uiLanguage, "noActiveMenu")}</p>
        ) : !activeMenu.exportVisible ? (
          <p className="mt-2 text-sm text-amber-700">{t(uiLanguage, "exportMenuNotVisible")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={includeRecipes}
                onChange={(event) => setIncludeRecipes(event.target.checked)}
                data-testid="export-include-recipes"
              />
              {t(uiLanguage, "exportIncludeRecipes")}
            </label>
            <div>
              <p className="text-xs font-semibold uppercase text-ink-muted">{t(uiLanguage, "exportPreviewTitle")}</p>
              <pre
                className="mt-2 max-h-48 overflow-auto rounded-control border border-line bg-surface-muted p-3 text-xs text-ink whitespace-pre-wrap"
                data-testid="export-preview"
              >
                {exportPreview}
              </pre>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadMenuExport("docx")}
                disabled={isDownloading !== null}
                className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="export-download-docx"
              >
                <Download size={16} />
                {t(uiLanguage, "exportDownloadDocx")}
              </button>
              <button
                type="button"
                onClick={() => downloadMenuExport("pdf")}
                disabled={isDownloading !== null}
                className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="export-download-pdf"
              >
                <FileText size={16} />
                {t(uiLanguage, "exportDownloadPdf")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientContextUpdatePanel({
  clientId,
  updates,
  source,
  importance,
  occurredAt,
  title,
  summary,
  details,
  onSource,
  onImportance,
  onOccurredAt,
  onTitle,
  onSummary,
  onDetails,
  onAdd,
}: {
  clientId: string;
  updates: ClientContextUpdateRecord[];
  source: ClientContextUpdateSource;
  importance: ClientContextUpdateImportance;
  occurredAt: string;
  title: string;
  summary: string;
  details: string;
  onSource: (value: ClientContextUpdateSource) => void;
  onImportance: (value: ClientContextUpdateImportance) => void;
  onOccurredAt: (value: string) => void;
  onTitle: (value: string) => void;
  onSummary: (value: string) => void;
  onDetails: (value: string) => void;
  onAdd: () => void;
}) {
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const isDirty = Boolean(title.trim() || summary.trim() || details.trim());
  const dirtyState: ShellDirtyEntryState = isDirty ? "dirty" : "clean";

  useShellDirtyRegistration({
    id: `client-context:${clientId}`,
    label: "Kritik bilgi",
    state: dirtyState,
    canSave: Boolean(title.trim() && summary.trim()),
    onSave: async () => {
      if (!title.trim() || !summary.trim()) return false;
      onAdd();
      return true;
    },
    onDiscard: () => {
      onTitle("");
      onSummary("");
      onDetails("");
    },
    onFocusField: () => addButtonRef.current?.focus(),
  });

  return (
    <section className="rounded-card border border-line bg-surface-muted p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PhoneCall size={18} className="text-primary" />
            <h4 className="text-sm font-semibold text-ink">Critical context</h4>
          </div>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Add dietitian-confirmed information from phone, Zoom, or face-to-face conversations.
          </p>
        </div>
        <Badge label={`${updates.filter((update) => update.status === "active").length} active`} tone="emerald" />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <SelectInput
          label="Source"
          value={source}
          onChange={(value) => onSource(value as ClientContextUpdateSource)}
          options={[
            ["phone", "Phone"],
            ["zoom", "Zoom"],
            ["in_person", "In person"],
            ["other", "Other"],
          ]}
        />
        <SelectInput
          label="Importance"
          value={importance}
          onChange={(value) => onImportance(value as ClientContextUpdateImportance)}
          options={[
            ["routine", "Routine"],
            ["important", "Important"],
            ["critical", "Critical"],
          ]}
        />
        <DateTimeInput label="Occurred at" value={occurredAt} onChange={onOccurredAt} />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <TextInput label="Title" value={title} onChange={onTitle} />
        <TextareaInput label="Summary" value={summary} onChange={onSummary} rows={3} />
      </div>
      <div className="mt-3">
        <TextareaInput label="Details" value={details} onChange={onDetails} rows={4} />
      </div>
      <button
        ref={addButtonRef}
        onClick={onAdd}
        disabled={!title.trim() || !summary.trim()}
        className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-alt disabled:cursor-not-allowed disabled:bg-ink-subtle"
        type="button"
      >
        <Plus size={16} />
        Add context
      </button>

      <div className="mt-4 grid gap-3">
        {updates.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-surface p-4 text-sm text-ink-muted">
            No dietitian context updates yet.
          </p>
        ) : (
          updates.slice(0, 5).map((update) => (
            <article key={update.id} className="rounded-card border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge label={sourceLabel(update.source)} tone="stone" />
                <Badge label={update.importance} tone={update.importance === "critical" ? "red" : "amber"} />
                <span className="text-xs font-medium text-ink-muted">{formatTime(update.occurredAt)}</span>
              </div>
              <h5 className="mt-2 text-sm font-semibold text-ink">{update.title}</h5>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{update.summary}</p>
              {update.details ? (
                <p className="mt-2 whitespace-pre-wrap break-words border-t border-line pt-2 text-sm leading-6 text-ink-muted">
                  {update.details}
                </p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

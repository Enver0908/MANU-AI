"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Bot, ShieldCheck } from "lucide-react";
import { personas } from "dietitian-ai-assistant-architecture";
import {
  AI_MODE_LABELS_TR,
  AI_STATUS_LABELS_TR,
  collectAiPreflightBlockers,
  isAiConfigurationLockedByRedRisk,
  RED_LOCK_ATOMIC_ACTIVATION_CTA_TR,
  resolveAiControlDisabledState,
  summarizeAiAssistantControl,
  summarizeAutopilotReadinessGate,
} from "@/lib/ai-assistant-control-panel-helpers";
import {
  isSafetyChecklistComplete,
  normalizeSafetyChecklist,
  safetyChecklistLabels,
} from "@/lib/safety-checklist";
import type { AiMode, AiStatus, ClientRecord, ManuAppState, SafetyChecklist } from "@/lib/types";
import type { SupportedLanguageCode } from "@/lib/languages";
import { Badge, ConfirmButton, DateTimeInput, SegmentedControl, SelectInput, ToggleRow, fromDateTimeLocal, toDateTimeLocal } from "./shared";
import { useShellDirtyRegistration } from "@/lib/use-shell-dirty-registration";
import type { ShellDirtyEntryState } from "@/lib/phase-85-stage-5-shell-dirty-registry";
import {
  classifyStage6EditorFailure,
  stage6EditorFailureMessage,
  type Stage6EditorFailure,
} from "@/lib/phase-85-stage-6-workspace-state";

export function AiAssistantControlPanel({
  client,
  state,
  uiLanguage,
  disabled,
  canManageAiControls = true,
  onUpdateClient,
  onActivateAi,
  onReleaseHumanTakeover,
  isActivatingAi = false,
  isReleasingHumanTakeover = false,
}: {
  client: ClientRecord;
  state: ManuAppState;
  uiLanguage: SupportedLanguageCode;
  disabled?: boolean;
  canManageAiControls?: boolean;
  onUpdateClient: (patch: Partial<ClientRecord>) => Promise<void> | void;
  onActivateAi: (clientId: string, requestedAiMode?: "copilot" | "autopilot") => Promise<unknown> | unknown;
  onReleaseHumanTakeover: (clientId: string) => Promise<unknown> | unknown;
  isActivatingAi?: boolean;
  isReleasingHumanTakeover?: boolean;
}) {
  const summary = summarizeAiAssistantControl(state, client);
  const readiness = summarizeAutopilotReadinessGate(state, client);
  const blockers = collectAiPreflightBlockers(state, client);
  const safetyChecklist = normalizeSafetyChecklist(client.safetyChecklist);
  const redLocked = isAiConfigurationLockedByRedRisk(client);
  const { activationDisabled, configurationDisabled } = resolveAiControlDisabledState(client, {
    disabled: disabled || !canManageAiControls,
    isActivatingAi,
  });
  const selectedPersona = personas.find((persona) => persona.id === client.selectedPersonaId);
  const activeHumanControlSession = state.humanControlSessions
    .filter((session) => session.clientId === client.id && session.status === "active")
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())[0];
  const takeoverMismatch = client.humanTakeoverLocked !== Boolean(activeHumanControlSession);
  const panelRef = useRef<HTMLElement>(null);
  const [isControlMutationPending, setIsControlMutationPending] = useState(false);
  const [controlFailure, setControlFailure] = useState<Stage6EditorFailure | null>(null);
  const dirtyState: ShellDirtyEntryState =
    isActivatingAi || isReleasingHumanTakeover || isControlMutationPending
      ? "saving"
      : controlFailure
        ? "error"
        : "clean";

  useShellDirtyRegistration({
    id: `client-ai:${client.id}`,
    label: "AI asistan kontrolü",
    state: dirtyState,
    canSave: false,
    onSave: async () => false,
    onDiscard: () => setControlFailure(null),
    onFocusField: () => panelRef.current?.querySelector<HTMLElement>("button, [href], input, select, textarea")?.focus(),
  });

  const runControlMutation = async (operation: () => Promise<unknown> | unknown) => {
    if (isControlMutationPending || isActivatingAi || isReleasingHumanTakeover) return;
    setIsControlMutationPending(true);
    setControlFailure(null);
    try {
      await operation();
    } catch (error) {
      setControlFailure(classifyStage6EditorFailure(error, "ai_control_update_failed"));
    } finally {
      setIsControlMutationPending(false);
    }
  };

  const updateAiStatus = (value: AiStatus) => {
    if (value === "active") {
      void runControlMutation(() => onActivateAi(client.id, client.aiMode === "autopilot" ? "autopilot" : "copilot"));
      return;
    }
    void runControlMutation(() => onUpdateClient({ aiStatus: "passive" }));
  };

  const updateHumanTakeover = (checked: boolean) => {
    if (checked) {
      void runControlMutation(() => onUpdateClient({ humanTakeoverLocked: true }));
      return;
    }
    void runControlMutation(() => onReleaseHumanTakeover(client.id));
  };

  const updateSafetyChecklist = (key: keyof SafetyChecklist, checked: boolean) => {
    const nextChecklist = {
      ...normalizeSafetyChecklist(client.safetyChecklist),
      [key]: checked,
    };
    void runControlMutation(() =>
      onUpdateClient({
        safetyChecklist: nextChecklist,
        mandatorySafetyComplete: isSafetyChecklistComplete({ ...client, safetyChecklist: nextChecklist }),
      }),
    );
  };

  const activateAiFromRedLock = () => {
    void runControlMutation(() => onActivateAi(client.id, client.aiMode === "autopilot" ? "autopilot" : "copilot"));
  };

  return (
    <section ref={panelRef} className="space-y-4" data-testid="ai-assistant-control-panel">
      {controlFailure ? (
        <p role="alert" aria-live="assertive" className="rounded-control border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {stage6EditorFailureMessage(controlFailure)}
        </p>
      ) : null}
      <div className="rounded-card border border-line bg-surface-muted p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-ink" />
              <h4 className="text-sm font-semibold text-ink">AI Asistan Kontrolu</h4>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {selectedPersona?.label || client.selectedPersonaId} · {AI_STATUS_LABELS_TR[client.aiStatus]} ·{" "}
              {AI_MODE_LABELS_TR[client.aiMode]}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge label={summary.activationLabel} tone={summary.activationTone} />
            <Badge
              label={summary.safetyComplete ? "Guvenlik tamam" : "Guvenlik eksik"}
              tone={summary.safetyComplete ? "emerald" : "amber"}
            />
            {summary.blockerCount > 0 && (
              <Badge label={`${summary.blockerCount} engel`} tone="red" />
            )}
          </div>
        </div>
        <ul className="mt-3 space-y-1 text-sm text-ink" data-testid="ai-control-state-signals">
          <li>Hazırlık: {summary.safetyComplete && summary.blockerCount === 0 ? "Hazır" : "Hazır değil"}</li>
          <li>Devralma: {client.humanTakeoverLocked ? "İnsan kontrolünde" : "Asistan kontrolünde"}</li>
          <li>Düzenleme: {canManageAiControls && !disabled ? "Düzenlenebilir" : "Salt okunur"}</li>
          <li>Revizyon: {takeoverMismatch || controlFailure ? "Eski veya uyumsuz" : "Güncel"}</li>
        </ul>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="px-1 text-sm font-semibold text-ink">Durum ve mod</p>
          <div className="mt-3 space-y-4" data-testid="ai-activation-controls">
            {redLocked && client.aiStatus !== "active" ? (
              <div className="space-y-3 rounded-card border border-red-200 bg-red-50 p-3">
                <p className="text-sm leading-6 text-red-900">
                  Kirmizi risk kilidi aktif. AI aktivasyonu kirmizi uyaruyi atomik olarak kapatir; mod ve konfigurasyon
                  alanlari kilitli kalir.
                </p>
                <ConfirmButton
                  label={isActivatingAi ? "Aktivasyon dogrulaniyor" : RED_LOCK_ATOMIC_ACTIVATION_CTA_TR}
                  confirmLabel={RED_LOCK_ATOMIC_ACTIVATION_CTA_TR}
                  onConfirm={activateAiFromRedLock}
                  disabled={activationDisabled}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-card bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                  confirmClassName="inline-flex min-h-11 w-full items-center justify-center rounded-card bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
                />
              </div>
            ) : (
              <div className={activationDisabled ? "pointer-events-none opacity-60" : undefined}>
                <SegmentedControl
                  label="AI durumu"
                  value={client.aiStatus}
                  options={[
                    ["active", AI_STATUS_LABELS_TR.active],
                    ["passive", AI_STATUS_LABELS_TR.passive],
                  ]}
                  onChange={(value) => updateAiStatus(value as AiStatus)}
                />
              </div>
            )}
            {isActivatingAi && (
              <p className="text-xs font-medium text-ink-muted">
                Aktivasyon atomik endpoint uzerinden dogrulaniyor.
              </p>
            )}
          </div>

          <fieldset className="mt-4 space-y-4 border-0 p-0" disabled={configurationDisabled || isControlMutationPending}>
            <SegmentedControl
              label="AI modu"
              value={client.aiMode}
              options={[
                ["autopilot", AI_MODE_LABELS_TR.autopilot],
                ["copilot", AI_MODE_LABELS_TR.copilot],
                ["manual", AI_MODE_LABELS_TR.manual],
                ["paused", AI_MODE_LABELS_TR.paused],
              ]}
              onChange={(value) => void runControlMutation(() => onUpdateClient({ aiMode: value as AiMode }))}
            />
            <SelectInput
              label="Persona"
              value={client.selectedPersonaId}
              onChange={(value) => void runControlMutation(() => onUpdateClient({ selectedPersonaId: value }))}
              options={personas.map((persona) => [persona.id, persona.label])}
            />
            <ToggleRow
              label="Diyetisyen devralma kilidi"
              checked={client.humanTakeoverLocked}
              onChange={updateHumanTakeover}
            />
            {client.humanTakeoverLocked && (
              <ConfirmButton
                label={isReleasingHumanTakeover ? "Devralma cozuluyor" : "Devralmayi cozumle"}
                confirmLabel="Devralmayi cozumle"
                onConfirm={() => {
                  void runControlMutation(() => onReleaseHumanTakeover(client.id));
                }}
                disabled={isReleasingHumanTakeover || isControlMutationPending || configurationDisabled}
                className="inline-flex min-h-11 items-center justify-center rounded-card border border-amber-200 bg-surface px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                confirmClassName="inline-flex min-h-11 items-center justify-center rounded-card bg-amber-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
              />
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <DateTimeInput
                label="Aktif baslangic"
                value={toDateTimeLocal(client.aiActiveFrom)}
                onChange={(value) => void runControlMutation(() => onUpdateClient({ aiActiveFrom: fromDateTimeLocal(value) }))}
              />
              <DateTimeInput
                label="Aktif bitis"
                value={toDateTimeLocal(client.aiActiveUntil)}
                onChange={(value) => void runControlMutation(() => onUpdateClient({ aiActiveUntil: fromDateTimeLocal(value) }))}
              />
            </div>
          </fieldset>
        </div>

        <div className="space-y-4">
          <fieldset
            className="rounded-card border border-line bg-surface p-4"
            disabled={configurationDisabled || isControlMutationPending}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-ink" />
                <p className="text-sm font-semibold text-ink">Guvenlik kontrol listesi</p>
              </div>
              <Badge
                label={client.mandatorySafetyComplete ? "Tamam" : "Eksik"}
                tone={client.mandatorySafetyComplete ? "emerald" : "amber"}
              />
            </div>
            <div className="mt-3 grid gap-2">
              {(Object.keys(safetyChecklistLabels) as Array<keyof SafetyChecklist>).map((key) => (
                <ToggleRow
                  key={key}
                  label={safetyChecklistLabels[key]}
                  checked={safetyChecklist[key]}
                  onChange={(checked) => updateSafetyChecklist(key, checked)}
                />
              ))}
            </div>
          </fieldset>

          <div
            className="rounded-card border border-line bg-surface p-4"
            data-testid="ai-autopilot-readiness-gate"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Autopilot hazirlik kapisi</p>
              <Badge
                label={
                  readiness.ready
                    ? "Hazir"
                    : readiness.blocked
                      ? "Engelli"
                      : "Eksik"
                }
                tone={readiness.ready ? "emerald" : readiness.blocked ? "red" : "amber"}
              />
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Autopilot yalnizca guvenlik, form ve kanal kosullari tamamlandiginda acilir.
            </p>
            {readiness.missingLabels.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-ink">
                {readiness.missingLabels.map((label) => (
                  <li key={label} className="rounded-md bg-surface-muted px-2 py-1">
                    {label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-primary">Tum autopilot kosullari saglandi.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-4" data-testid="ai-lock-status">
          <p className="text-sm font-semibold text-ink">Kilit durumu</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-md bg-surface-muted px-3 py-2">
              <span className="text-ink-muted">Kirmizi risk kilidi</span>
              <Badge label={summary.redLockActive ? "Aktif" : "Yok"} tone={summary.redLockActive ? "red" : "emerald"} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md bg-surface-muted px-3 py-2">
              <span className="text-ink-muted">Sari risk bekleme</span>
              <Badge label={summary.yellowHoldActive ? "Aktif" : "Yok"} tone={summary.yellowHoldActive ? "amber" : "emerald"} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md bg-surface-muted px-3 py-2">
              <span className="text-ink-muted">Diyetisyen devralma</span>
              <Badge
                label={takeoverMismatch ? "Kontrol gerekli" : summary.humanTakeoverLocked ? "Kilitli" : "Acik"}
                tone={takeoverMismatch ? "red" : summary.humanTakeoverLocked ? "amber" : "emerald"}
              />
            </div>
          </div>
          {activeHumanControlSession && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p className="font-semibold">Aktif insan kontrol oturumu</p>
              <p className="mt-1">
                {activeHumanControlSession.reason} · {formatSessionTime(activeHumanControlSession.openedAt)}
              </p>
            </div>
          )}
          {takeoverMismatch && (
            <p className="mt-3 text-sm text-red-700">
              Client kilidi ile aktif insan kontrol oturumu uyusmuyor. Cozum endpointi ile kapatilana kadar AI kontrolu fail-closed kalir.
            </p>
          )}
          {redLocked && (
            <p className="mt-3 text-sm text-red-700">
              Kirmizi risk kilidi aktif. Yeniden aktivasyon yalnizca atomik AI aktivasyon CTA uzerinden yapilabilir.
            </p>
          )}
        </div>

        <div className="rounded-card border border-line bg-surface p-4" data-testid="ai-preflight-blockers">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-ink" />
            <p className="text-sm font-semibold text-ink">Preflight engelleri</p>
          </div>
          {blockers.length === 0 ? (
            <p className="mt-3 text-sm text-primary">Simdi acik preflight engeli yok.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {blockers.map((blocker) => (
                <li
                  key={`${blocker.code}-${blocker.id}`}
                  className={`rounded-md px-3 py-2 text-sm ${
                    blocker.severity === "block" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {blocker.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {uiLanguage !== "tr" && (
        <p className="text-xs text-ink-muted">
          Panel dili {uiLanguage}; AI kontrol etiketleri su an Turkce sabit metin kullanir.
        </p>
      )}
    </section>
  );
}

function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

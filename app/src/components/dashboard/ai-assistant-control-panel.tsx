"use client";

import { AlertTriangle, Bot, ShieldCheck } from "lucide-react";
import { personas } from "dietitian-ai-assistant-architecture";
import {
  AI_MODE_LABELS_TR,
  AI_STATUS_LABELS_TR,
  collectAiPreflightBlockers,
  isAiControlLockedByRedRisk,
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
import {
  Badge,
  DateTimeInput,
  SegmentedControl,
  SelectInput,
  ToggleRow,
  fromDateTimeLocal,
  toDateTimeLocal,
} from "./shared";

export function AiAssistantControlPanel({
  client,
  state,
  uiLanguage,
  disabled,
  onUpdateClient,
}: {
  client: ClientRecord;
  state: ManuAppState;
  uiLanguage: SupportedLanguageCode;
  disabled?: boolean;
  onUpdateClient: (patch: Partial<ClientRecord>) => void;
}) {
  const summary = summarizeAiAssistantControl(state, client);
  const readiness = summarizeAutopilotReadinessGate(state, client);
  const blockers = collectAiPreflightBlockers(state, client);
  const safetyChecklist = normalizeSafetyChecklist(client.safetyChecklist);
  const redLocked = isAiControlLockedByRedRisk(client);
  const controlsDisabled = disabled || redLocked || client.lifecycleStatus === "removed_anonymized";
  const selectedPersona = personas.find((persona) => persona.id === client.selectedPersonaId);

  const updateSafetyChecklist = (key: keyof SafetyChecklist, checked: boolean) => {
    const nextChecklist = {
      ...normalizeSafetyChecklist(client.safetyChecklist),
      [key]: checked,
    };
    onUpdateClient({
      safetyChecklist: nextChecklist,
      mandatorySafetyComplete: isSafetyChecklistComplete({ ...client, safetyChecklist: nextChecklist }),
    });
  };

  return (
    <section className="space-y-4" data-testid="ai-assistant-control-panel">
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-stone-700" />
              <h4 className="text-sm font-semibold text-stone-900">AI Asistan Kontrolu</h4>
            </div>
            <p className="mt-1 text-sm text-stone-600">
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
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <fieldset className="rounded-lg border border-stone-200 bg-white p-4" disabled={controlsDisabled}>
          <legend className="px-1 text-sm font-semibold text-stone-800">Durum ve mod</legend>
          <div className="mt-3 space-y-4">
            <SegmentedControl
              label="AI durumu"
              value={client.aiStatus}
              options={[
                ["active", AI_STATUS_LABELS_TR.active],
                ["passive", AI_STATUS_LABELS_TR.passive],
              ]}
              onChange={(value) => onUpdateClient({ aiStatus: value as AiStatus })}
            />
            <SegmentedControl
              label="AI modu"
              value={client.aiMode}
              options={[
                ["autopilot", AI_MODE_LABELS_TR.autopilot],
                ["copilot", AI_MODE_LABELS_TR.copilot],
                ["manual", AI_MODE_LABELS_TR.manual],
                ["paused", AI_MODE_LABELS_TR.paused],
              ]}
              onChange={(value) => onUpdateClient({ aiMode: value as AiMode })}
            />
            <SelectInput
              label="Persona"
              value={client.selectedPersonaId}
              onChange={(value) => onUpdateClient({ selectedPersonaId: value })}
              options={personas.map((persona) => [persona.id, persona.label])}
            />
            <ToggleRow
              label="Diyetisyen devralma kilidi"
              checked={client.humanTakeoverLocked}
              onChange={(checked) => onUpdateClient({ humanTakeoverLocked: checked })}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <DateTimeInput
                label="Aktif baslangic"
                value={toDateTimeLocal(client.aiActiveFrom)}
                onChange={(value) => onUpdateClient({ aiActiveFrom: fromDateTimeLocal(value) })}
              />
              <DateTimeInput
                label="Aktif bitis"
                value={toDateTimeLocal(client.aiActiveUntil)}
                onChange={(value) => onUpdateClient({ aiActiveUntil: fromDateTimeLocal(value) })}
              />
            </div>
          </div>
        </fieldset>

        <div className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-stone-700" />
                <p className="text-sm font-semibold text-stone-800">Guvenlik kontrol listesi</p>
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
          </div>

          <div
            className="rounded-lg border border-stone-200 bg-white p-4"
            data-testid="ai-autopilot-readiness-gate"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-stone-800">Autopilot hazirlik kapisi</p>
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
            <p className="mt-2 text-xs text-stone-500">
              Autopilot yalnizca guvenlik, form ve kanal kosullari tamamlandiginda acilir.
            </p>
            {readiness.missingLabels.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-stone-700">
                {readiness.missingLabels.map((label) => (
                  <li key={label} className="rounded-md bg-stone-50 px-2 py-1">
                    {label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-emerald-700">Tum autopilot kosullari saglandi.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-4" data-testid="ai-lock-status">
          <p className="text-sm font-semibold text-stone-800">Kilit durumu</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-2">
              <span className="text-stone-600">Kirmizi risk kilidi</span>
              <Badge label={summary.redLockActive ? "Aktif" : "Yok"} tone={summary.redLockActive ? "red" : "emerald"} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-2">
              <span className="text-stone-600">Sari risk bekleme</span>
              <Badge label={summary.yellowHoldActive ? "Aktif" : "Yok"} tone={summary.yellowHoldActive ? "amber" : "emerald"} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-2">
              <span className="text-stone-600">Diyetisyen devralma</span>
              <Badge
                label={summary.humanTakeoverLocked ? "Kilitli" : "Acik"}
                tone={summary.humanTakeoverLocked ? "amber" : "emerald"}
              />
            </div>
          </div>
          {redLocked && (
            <p className="mt-3 text-sm text-red-700">
              Kirmizi risk kilidi aktif. Yeniden aktivasyon yalnizca devir cozum akisindan yapilabilir.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-4" data-testid="ai-preflight-blockers">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-stone-700" />
            <p className="text-sm font-semibold text-stone-800">Preflight engelleri</p>
          </div>
          {blockers.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-700">Simdi acik preflight engeli yok.</p>
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
        <p className="text-xs text-stone-500">
          Panel dili {uiLanguage}; AI kontrol etiketleri su an Turkce sabit metin kullanir.
        </p>
      )}
    </section>
  );
}

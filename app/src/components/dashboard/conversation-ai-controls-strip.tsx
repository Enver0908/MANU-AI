"use client";

import {
  AI_STATUS_LABELS_TR,
  isAiConfigurationLockedByRedRisk,
  RED_LOCK_ATOMIC_ACTIVATION_CTA_TR,
  resolveAiControlDisabledState,
} from "@/lib/ai-assistant-control-panel-helpers";
import type { AiStatus, ClientRecord } from "@/lib/types";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { ConfirmButton, SegmentedControl } from "./shared";

export function ConversationAiControlsStrip({
  client,
  uiLanguage,
  canManageAiControls = true,
  isActivatingAi,
  onActivateAi,
  onSetPassive,
}: {
  client: ClientRecord;
  uiLanguage: SupportedLanguageCode;
  canManageAiControls?: boolean;
  isActivatingAi?: boolean;
  onActivateAi: (clientId: string) => Promise<unknown>;
  onSetPassive: (clientId: string) => Promise<unknown>;
}) {
  const redLocked = isAiConfigurationLockedByRedRisk(client);
  const { activationDisabled, configurationDisabled } = resolveAiControlDisabledState(client, {
    disabled: !canManageAiControls,
    isActivatingAi,
  });

  const updateAiStatus = (value: AiStatus) => {
    if (value === "active") {
      void onActivateAi(client.id);
      return;
    }
    void onSetPassive(client.id);
  };

  return (
    <section className="border-t border-stone-200 bg-stone-50 p-3" data-testid="conversation-ai-controls">
      {redLocked && client.aiStatus !== "active" ? (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm leading-6 text-red-900">{t(uiLanguage, "conversationRedBannerBody")}</p>
          <ConfirmButton
            label={isActivatingAi ? t(uiLanguage, "conversationActivatingAi") : RED_LOCK_ATOMIC_ACTIVATION_CTA_TR}
            confirmLabel={RED_LOCK_ATOMIC_ACTIVATION_CTA_TR}
            onConfirm={() => {
              void onActivateAi(client.id);
            }}
            disabled={activationDisabled}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            confirmClassName="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
          />
        </div>
      ) : (
        <fieldset className="border-0 p-0" disabled={configurationDisabled}>
          <SegmentedControl
            label={t(uiLanguage, "conversationAiStatusLabel")}
            value={client.aiStatus}
            options={[
              ["active", AI_STATUS_LABELS_TR.active],
              ["passive", AI_STATUS_LABELS_TR.passive],
            ]}
            onChange={(value) => updateAiStatus(value as AiStatus)}
          />
        </fieldset>
      )}
    </section>
  );
}

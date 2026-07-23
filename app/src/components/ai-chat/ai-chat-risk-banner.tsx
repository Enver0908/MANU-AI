"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRightLeft, ShieldAlert } from "lucide-react";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import {
  createAiChatRunHandoff,
  fetchAiChatRunRisk,
  generateAiChatRequestId,
  transferAiChatRunDraft,
  type AiChatRunRiskView,
} from "@/lib/use-ai-chat";
import type { AiChatScopeType } from "@/lib/phase-85-stage-4c-contracts";
import { AppRequestError } from "@/lib/app-errors";

export function AiChatRiskBanner({
  uiLanguage,
  runId,
  scopeType,
  isStreaming,
  onActionComplete,
}: {
  uiLanguage: SupportedLanguageCode;
  runId: string | null;
  scopeType: AiChatScopeType | null;
  isStreaming: boolean;
  onActionComplete?: () => void;
}) {
  const [risk, setRisk] = useState<AiChatRunRiskView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isHandoffPending, setIsHandoffPending] = useState(false);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const [handoffConfirmOpen, setHandoffConfirmOpen] = useState(false);

  useEffect(() => {
    if (!runId || isStreaming) {
      return;
    }
    let cancelled = false;
    void fetchAiChatRunRisk(runId)
      .then((summary) => {
        if (cancelled) return;
        setRisk(summary);
        setError(null);
        if (summary.destinations.length === 1) {
          setSelectedDestinationId(summary.destinations[0]!.conversationId);
        }
      })
      .catch((loadError) => {
        if (cancelled) return;
        if (loadError instanceof AppRequestError && loadError.code === "ai_chat_risk_assessment_missing") {
          setRisk(null);
          return;
        }
        setError(loadError instanceof AppRequestError ? loadError.code : "ai_chat_risk_load_failed");
      });
    return () => {
      cancelled = true;
    };
  }, [isStreaming, runId]);

  if (!runId || isStreaming || !risk) return null;

  const tone =
    risk.riskLevel === "red"
      ? "border-red-200 bg-red-50 text-red-950"
      : risk.riskLevel === "yellow"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-emerald-200 bg-emerald-50 text-emerald-950";

  const Icon = risk.riskLevel === "red" ? ShieldAlert : AlertTriangle;

  const handleTransfer = async () => {
    if (!selectedDestinationId || risk.clientContextRevision == null) return;
    const destination = risk.destinations.find((item) => item.conversationId === selectedDestinationId);
    if (!destination) return;
    setIsTransferring(true);
    setError(null);
    try {
      await transferAiChatRunDraft({
        runId,
        requestId: generateAiChatRequestId(),
        destinationConversationId: destination.conversationId,
        destinationRevision: destination.revision,
        clientContextRevision: risk.clientContextRevision,
      });
      onActionComplete?.();
    } catch (transferError) {
      setError(transferError instanceof AppRequestError ? transferError.code : "ai_chat_transfer_failed");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleHandoff = async () => {
    if (!risk.handoffConfirmationToken || risk.clientContextRevision == null) return;
    setIsHandoffPending(true);
    setError(null);
    try {
      await createAiChatRunHandoff({
        runId,
        requestId: generateAiChatRequestId(),
        confirmationToken: risk.handoffConfirmationToken,
        expectedClientContextRevision: risk.clientContextRevision,
      });
      setHandoffConfirmOpen(false);
      onActionComplete?.();
    } catch (handoffError) {
      setError(handoffError instanceof AppRequestError ? handoffError.code : "ai_chat_handoff_failed");
    } finally {
      setIsHandoffPending(false);
    }
  };

  return (
    <section
      className={`mx-3 mb-2 rounded-lg border px-3 py-3 text-sm ${tone}`}
      data-testid="ai-chat-risk-banner"
      data-risk-level={risk.riskLevel}
      role="status"
    >
      <div className="flex items-start gap-2">
        <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t(uiLanguage, `aiChatRiskTitle_${risk.riskLevel}`)}</p>
          <p className="mt-1 leading-6">{risk.recommendedHumanAction}</p>
          {risk.reasons.length > 0 ? (
            <p className="mt-1 text-xs opacity-80">{risk.reasons.join(" · ")}</p>
          ) : null}
          {risk.hypotheticalRed ? (
            <p className="mt-1 text-xs font-medium">{t(uiLanguage, "aiChatRiskHypotheticalNotice")}</p>
          ) : null}
          {scopeType === "general" ? (
            <p className="mt-2 text-xs font-medium">{t(uiLanguage, "aiChatRiskGeneralScopeNotice")}</p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2 text-xs font-medium text-red-800">
              {t(uiLanguage, "aiChatActionFailed")} ({error})
            </p>
          ) : null}
          {scopeType === "client" && risk.canTransferDraft ? (
            <div className="mt-3 space-y-2">
              {risk.destinations.length > 1 ? (
                <label className="block text-xs font-medium">
                  {t(uiLanguage, "aiChatRiskDestinationLabel")}
                  <select
                    value={selectedDestinationId ?? ""}
                    onChange={(event) => setSelectedDestinationId(event.target.value || null)}
                    className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-2 text-sm text-stone-900"
                  >
                    <option value="">{t(uiLanguage, "aiChatRiskDestinationPlaceholder")}</option>
                    {risk.destinations.map((item) => (
                      <option key={item.conversationId} value={item.conversationId}>
                        {item.channel} · rev {item.revision}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => void handleTransfer()}
                disabled={isTransferring || !selectedDestinationId || risk.destinations.length === 0}
                data-testid="ai-chat-transfer-draft"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ArrowRightLeft size={16} aria-hidden="true" />
                {isTransferring ? t(uiLanguage, "aiChatRiskTransferring") : t(uiLanguage, "aiChatRiskTransferDraft")}
              </button>
            </div>
          ) : null}
          {scopeType === "client" && risk.riskLevel === "yellow" ? (
            <p className="mt-2 text-xs font-medium">{t(uiLanguage, "aiChatRiskYellowReviewHint")}</p>
          ) : null}
          {scopeType === "client" && risk.canCreateHandoff ? (
            <div className="mt-3">
              {!handoffConfirmOpen ? (
                <button
                  type="button"
                  onClick={() => setHandoffConfirmOpen(true)}
                  data-testid="ai-chat-create-handoff"
                  className="inline-flex min-h-11 items-center rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-900 transition hover:bg-red-100"
                >
                  {t(uiLanguage, "aiChatRiskCreateHandoff")}
                </button>
              ) : (
                <div className="rounded-lg border border-red-200 bg-white p-3 text-red-950">
                  <p className="text-sm font-medium">{t(uiLanguage, "aiChatRiskHandoffConfirm")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleHandoff()}
                      disabled={isHandoffPending}
                      className="inline-flex min-h-11 items-center rounded-lg bg-red-800 px-3 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:opacity-60"
                    >
                      {t(uiLanguage, "aiChatRiskHandoffConfirmAction")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHandoffConfirmOpen(false)}
                      className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700"
                    >
                      {t(uiLanguage, "aiChatCancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

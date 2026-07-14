"use client";

import { useState } from "react";
import type { ConversationMessageDto } from "@/lib/phase-85-stage-4b2-contracts";
import {
  VISUAL_CORRECTION_REASON_CODES,
  VISUAL_SCENE_TYPES,
  type VisualCorrectionReasonCode,
  type VisualSceneType,
} from "@/lib/phase-85-stage-4b3-media-contracts";
import {
  reasonRequiresCorrectedEntityLabels,
  reasonRequiresCorrectedOcrText,
  reasonRequiresCorrectedSceneType,
  resolveVisualCorrectionReasonLabel,
  resolveVisualReviewStateLabel,
  resolveVisualSceneTypeLabel,
} from "@/lib/phase-85-stage-4b3-visual-review-labels";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { TextareaInput } from "./shared";

export function ConversationVisualReviewPanel({
  message,
  conversationRevision,
  uiLanguage,
  disabled,
  onSubmit,
}: {
  message: ConversationMessageDto;
  conversationRevision: number;
  uiLanguage: SupportedLanguageCode;
  disabled?: boolean;
  onSubmit: (input: {
    analysisId: string;
    requestId: string;
    expectedConversationRevision: number;
    expectedAnalysisRevision: number;
    reasonCode: VisualCorrectionReasonCode;
    explanation: string;
    correctedSceneType?: VisualSceneType | null;
    correctedOcrText?: string | null;
    correctedEntityLabels?: string[];
  }) => Promise<void>;
}) {
  const review = message.visualReview;
  const [reasonCode, setReasonCode] = useState<VisualCorrectionReasonCode>("wrong_scene");
  const [explanation, setExplanation] = useState("");
  const [correctedSceneType, setCorrectedSceneType] = useState<VisualSceneType>("meal");
  const [correctedEntityLabels, setCorrectedEntityLabels] = useState("");
  const [correctedOcrText, setCorrectedOcrText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!review || !review.correctionAllowed) return null;

  return (
    <section
      className="mt-3 rounded-lg border border-stone-200 bg-white p-4"
      data-testid="conversation-visual-review-panel"
      aria-label={t(uiLanguage, "conversationVisualReviewTitle")}
    >
      <p className="text-sm font-semibold text-stone-900">{t(uiLanguage, "conversationVisualReviewTitle")}</p>
      <p className="mt-1 text-sm text-stone-600">{t(uiLanguage, "conversationVisualReviewHint")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700">
          {resolveVisualSceneTypeLabel(uiLanguage, review.sceneType)}
        </span>
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700">
          {resolveVisualReviewStateLabel(uiLanguage, review.reviewState)}
        </span>
      </div>
      {review.entitySummary.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-700">
          {review.entitySummary.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4">
        <label className="text-sm font-medium text-stone-700" htmlFor={`visual-correction-reason-${message.id}`}>
          {t(uiLanguage, "conversationVisualReviewReason")}
        </label>
        <select
          id={`visual-correction-reason-${message.id}`}
          className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
          value={reasonCode}
          disabled={disabled || isSubmitting}
          onChange={(event) => setReasonCode(event.target.value as VisualCorrectionReasonCode)}
        >
          {VISUAL_CORRECTION_REASON_CODES.map((option) => (
            <option key={option} value={option}>
              {resolveVisualCorrectionReasonLabel(uiLanguage, option)}
            </option>
          ))}
        </select>
      </div>

      {reasonRequiresCorrectedSceneType(reasonCode) ? (
        <div className="mt-3">
          <label className="text-sm font-medium text-stone-700" htmlFor={`visual-correction-scene-${message.id}`}>
            {t(uiLanguage, "visualCorrectionCorrectedScene")}
          </label>
          <select
            id={`visual-correction-scene-${message.id}`}
            className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
            value={correctedSceneType}
            disabled={disabled || isSubmitting}
            onChange={(event) => setCorrectedSceneType(event.target.value as VisualSceneType)}
          >
            {VISUAL_SCENE_TYPES.map((option) => (
              <option key={option} value={option}>
                {resolveVisualSceneTypeLabel(uiLanguage, option)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {reasonRequiresCorrectedEntityLabels(reasonCode) ? (
        <div className="mt-3">
          <label className="text-sm font-medium text-stone-700" htmlFor={`visual-correction-entities-${message.id}`}>
            {t(uiLanguage, "visualCorrectionCorrectedEntities")}
          </label>
          <input
            id={`visual-correction-entities-${message.id}`}
            className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
            value={correctedEntityLabels}
            disabled={disabled || isSubmitting}
            onChange={(event) => setCorrectedEntityLabels(event.target.value)}
          />
        </div>
      ) : null}

      {reasonRequiresCorrectedOcrText(reasonCode) ? (
        <div className="mt-3">
          <TextareaInput
            label={t(uiLanguage, "visualCorrectionCorrectedOcr")}
            value={correctedOcrText}
            onChange={setCorrectedOcrText}
            rows={3}
          />
        </div>
      ) : null}

      <div className="mt-3">
        <TextareaInput
          label={t(uiLanguage, "conversationVisualReviewExplanation")}
          value={explanation}
          onChange={setExplanation}
          rows={3}
        />
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={disabled || isSubmitting || !explanation.trim()}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => {
          setIsSubmitting(true);
          setError(null);
          void onSubmit({
            analysisId: review.analysisId,
            requestId: crypto.randomUUID(),
            expectedConversationRevision: conversationRevision,
            expectedAnalysisRevision: review.analysisRevision,
            reasonCode,
            explanation: explanation.trim(),
            correctedSceneType: reasonRequiresCorrectedSceneType(reasonCode) ? correctedSceneType : null,
            correctedOcrText: reasonRequiresCorrectedOcrText(reasonCode) ? correctedOcrText.trim() || null : null,
            correctedEntityLabels: reasonRequiresCorrectedEntityLabels(reasonCode)
              ? correctedEntityLabels
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean)
              : undefined,
          })
            .then(() => {
              setExplanation("");
              setCorrectedEntityLabels("");
              setCorrectedOcrText("");
            })
            .catch((submitError) => {
              setError(submitError instanceof Error ? submitError.message : "visual_correction_failed");
            })
            .finally(() => setIsSubmitting(false));
        }}
      >
        {t(uiLanguage, "conversationVisualReviewSubmit")}
      </button>
    </section>
  );
}

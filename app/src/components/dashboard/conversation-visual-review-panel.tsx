"use client";

import { useState } from "react";
import type { ConversationMessageDto } from "@/lib/phase-85-stage-4b2-contracts";
import type { VisualCorrectionReasonCode } from "@/lib/phase-85-stage-4b3-media-contracts";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { TextareaInput } from "./shared";

const REASON_OPTIONS: VisualCorrectionReasonCode[] = [
  "wrong_scene",
  "wrong_food_candidate",
  "wrong_ocr_reading",
  "wrong_label_interpretation",
  "sensitive_content_missed",
  "other_clinical_mismatch",
];

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
  }) => Promise<void>;
}) {
  const review = message.visualReview;
  const [reasonCode, setReasonCode] = useState<VisualCorrectionReasonCode>("wrong_scene");
  const [explanation, setExplanation] = useState("");
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
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700">{review.sceneType}</span>
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700">{review.reviewState}</span>
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
          {REASON_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
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
          })
            .then(() => setExplanation(""))
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

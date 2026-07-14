"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Maximize2, X } from "lucide-react";
import type { ConversationMediaDto } from "@/lib/phase-85-stage-4b3-media-contracts";
import { STAGE_4B3_CONVERSATION_MEDIA_PREVIEW_LABEL } from "@/lib/phase-85-stage-4b3-bounded-media";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";

function buildMediaStreamUrl(conversationId: string, assetId: string, variant: "thumbnail" | "full") {
  return `/api/conversations/${encodeURIComponent(conversationId)}/media/${encodeURIComponent(assetId)}?variant=${variant}`;
}

function useAccessibleModal(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusFirst = () => {
      const nodes = dialog?.querySelectorAll<HTMLElement>(focusableSelector);
      nodes?.[0]?.focus();
    };

    const focusTimer = window.setTimeout(focusFirst, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (node) => node.offsetParent !== null,
      );
      if (nodes.length === 0) return;

      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      lastFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  return dialogRef;
}

export function ConversationMessageMedia({
  conversationId,
  media,
  uiLanguage,
  onOpenPreview,
}: {
  conversationId: string;
  media: ConversationMediaDto[];
  uiLanguage: SupportedLanguageCode;
  onOpenPreview?: (asset: ConversationMediaDto) => void;
}) {
  if (media.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {media.map((asset) => (
        <ConversationMessageMediaTile
          key={asset.assetId}
          conversationId={conversationId}
          asset={asset}
          uiLanguage={uiLanguage}
          onOpenPreview={onOpenPreview}
        />
      ))}
    </div>
  );
}

function ConversationMessageMediaTile({
  conversationId,
  asset,
  uiLanguage,
  onOpenPreview,
}: {
  conversationId: string;
  asset: ConversationMediaDto;
  uiLanguage: SupportedLanguageCode;
  onOpenPreview?: (asset: ConversationMediaDto) => void;
}) {
  const unavailable = asset.reviewState === "expired" || asset.status === "expired" || asset.status === "revoked";
  const streamUrl = buildMediaStreamUrl(conversationId, asset.assetId, "thumbnail");

  return (
    <div
      className="relative w-full max-w-[280px] overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
      data-testid={`conversation-media-${asset.assetId}`}
    >
      <div className="relative aspect-[4/3] w-full">
        {unavailable ? (
          <ConversationMediaUnavailable uiLanguage={uiLanguage} />
        ) : (
          <ConversationMessageMediaImage
            key={asset.assetId}
            streamUrl={streamUrl}
            uiLanguage={uiLanguage}
            onOpenPreview={() => onOpenPreview?.(asset)}
          />
        )}
      </div>
    </div>
  );
}

function ConversationMediaUnavailable({ uiLanguage }: { uiLanguage: SupportedLanguageCode }) {
  return (
    <div
      className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-sm text-stone-600"
      data-testid="conversation-media-expired"
    >
      <ImageIcon size={20} aria-hidden="true" />
      <span>{t(uiLanguage, "conversationMediaUnavailable")}</span>
    </div>
  );
}

function ConversationMessageMediaImage({
  streamUrl,
  uiLanguage,
  onOpenPreview,
}: {
  streamUrl: string;
  uiLanguage: SupportedLanguageCode;
  onOpenPreview: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <ConversationMediaUnavailable uiLanguage={uiLanguage} />;
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={streamUrl}
        alt={STAGE_4B3_CONVERSATION_MEDIA_PREVIEW_LABEL}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {!loaded ? (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100 text-sm text-stone-500">
          {STAGE_4B3_CONVERSATION_MEDIA_PREVIEW_LABEL}
        </div>
      ) : null}
      <button
        type="button"
        className="absolute right-2 top-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-stone-200 bg-white/90 text-stone-700 shadow-sm"
        aria-label={t(uiLanguage, "conversationMediaOpenPreview")}
        onClick={onOpenPreview}
      >
        <Maximize2 size={16} />
      </button>
    </>
  );
}

export function ConversationMediaPreviewModal({
  open,
  conversationId,
  asset,
  uiLanguage,
  onClose,
}: {
  open: boolean;
  conversationId: string | null;
  asset: ConversationMediaDto | null;
  uiLanguage: SupportedLanguageCode;
  onClose: () => void;
}) {
  const dialogRef = useAccessibleModal(open, onClose);

  if (!open || !conversationId || !asset) return null;
  const unavailable = asset.reviewState === "expired" || asset.status === "expired" || asset.status === "revoked";
  const streamUrl = buildMediaStreamUrl(conversationId, asset.assetId, "full");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={t(uiLanguage, "conversationMediaOpenPreview")}
        data-testid="conversation-media-preview-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <p className="text-sm font-semibold text-stone-900">{STAGE_4B3_CONVERSATION_MEDIA_PREVIEW_LABEL}</p>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-stone-700"
            aria-label={t(uiLanguage, "conversationMediaClosePreview")}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-auto bg-stone-50 p-4">
          {unavailable ? (
            <p className="text-sm text-stone-600">{t(uiLanguage, "conversationMediaUnavailable")}</p>
          ) : (
            <div className="relative mx-auto flex min-h-[240px] max-h-[70vh] w-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={streamUrl}
                alt=""
                className="max-h-[70vh] w-auto max-w-full rounded-md object-contain"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

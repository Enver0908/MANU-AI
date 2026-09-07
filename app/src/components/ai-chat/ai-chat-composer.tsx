"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Mic, Paperclip, Send, Square } from "lucide-react";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import { AI_CHAT_MESSAGE_BODY_MAX_LENGTH } from "@/lib/phase-85-stage-4c-contracts";
import { sha256FromArrayBuffer } from "@/lib/phase-85-stage-4c-attachment-client";
import { generateAiChatRequestId } from "@/lib/use-ai-chat";
import type { AiChatAttachmentDto } from "@/lib/phase-85-stage-4c-contracts";
import { AiChatAttachmentStrip } from "./ai-chat-attachment-strip";
import { useShellDirtyRegistration } from "@/lib/use-shell-dirty-registration";
import type { ShellDirtyEntryState } from "@/lib/phase-85-stage-5-shell-dirty-registry";
import { useShellKeyboardInset } from "@/components/dashboard/mobile-ergonomics";
import { authenticatedMutationFetch } from "@/lib/phase-85-stage-5-shell-authenticated-mutation";

const ATTACHMENT_BUSY_STATUSES = new Set<AiChatAttachmentDto["status"]>([
  "upload_pending",
  "uploaded",
  "scanning",
  "processing",
]);

async function encodePcm16Wav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function AiChatComposer({
  uiLanguage,
  disabled = false,
  conversationId,
  attachments,
  onAttachmentsChange,
  onSend,
  onRemoveAttachment,
  onReviewAttachment,
}: {
  uiLanguage: SupportedLanguageCode;
  disabled?: boolean;
  conversationId: string | null;
  attachments: AiChatAttachmentDto[];
  onAttachmentsChange: Dispatch<SetStateAction<AiChatAttachmentDto[]>>;
  onSend?: (input: { body: string; attachmentIds: string[] }) => void | Promise<void>;
  onRemoveAttachment: (attachmentId: string) => void | Promise<void>;
  onReviewAttachment: (attachment: AiChatAttachmentDto) => void;
}) {
  const [value, setValue] = useState("");
  const [recording, setRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  useShellKeyboardInset();

  const cleanupRecording = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
    setRecording(false);
  }, []);

  const allAttachmentsReady =
    attachments.length === 0 || attachments.every((item) => item.status === "ready");
  const hasPendingAttachments = attachments.some((item) => ATTACHMENT_BUSY_STATUSES.has(item.status));
  const hasReviewRequired = attachments.some((item) => item.status === "review_required");
  const readyAttachmentIds = attachments.filter((item) => item.status === "ready").map((item) => item.id);
  const hasComposerDraft =
    value.trim().length > 0 ||
    attachments.length > 0 ||
    hasPendingAttachments ||
    hasReviewRequired ||
    recording;

  useShellDirtyRegistration({
    id: "ai-chat-composer",
    label: "AI Chat taslağı",
    state: (hasComposerDraft ? "dirty" : "clean") as ShellDirtyEntryState,
    canSave: false,
    onDiscard: () => {
      setValue("");
      onAttachmentsChange([]);
      cleanupRecording();
    },
  });

  useEffect(() => cleanupRecording, [cleanupRecording]);

  const canSend =
    Boolean(onSend) &&
    !disabled &&
    allAttachmentsReady &&
    !hasPendingAttachments &&
    (value.trim().length > 0 || readyAttachmentIds.length > 0);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!conversationId) return;
      const buffer = await file.arrayBuffer();
      const contentSha256 = await sha256FromArrayBuffer(buffer);
      const createResponse = await authenticatedMutationFetch("/api/ai-chat/attachments", {
        method: "POST",
        mutationKind: "other",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: generateAiChatRequestId(),
          conversationId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          byteSize: file.size,
          contentSha256,
        }),
      });
      if (!createResponse.ok) return;
      const created = (await createResponse.json()) as {
        attachment: AiChatAttachmentDto;
        uploadUrl: string;
        uploadToken: string;
      };
      onAttachmentsChange((current) => [...current, created.attachment]);
      const uploadResponse = await fetch(created.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadResponse.ok) return;
      const completeResponse = await authenticatedMutationFetch(`/api/ai-chat/attachments/${created.attachment.id}/complete`, {
        method: "POST",
        mutationKind: "other",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: generateAiChatRequestId(),
          contentSha256,
          uploadToken: created.uploadToken,
        }),
      });
      if (!completeResponse.ok) return;
      const completed = (await completeResponse.json()) as AiChatAttachmentDto;
      onAttachmentsChange((current) =>
        current.map((item) => (item.id === completed.id ? completed : item)),
      );
    },
    [conversationId, onAttachmentsChange],
  );

  const startRecording = useCallback(async () => {
    if (!conversationId || recording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext({ sampleRate: 16000 });
    mediaStreamRef.current = stream;
    audioContextRef.current = audioContext;
    try {
      await audioContext.audioWorklet.addModule("/audio/ai-chat-pcm-recorder.worklet.js");
    } catch (error) {
      cleanupRecording();
      throw error;
    }
    const source = audioContext.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(audioContext, "ai-chat-pcm-recorder");
    worklet.port.onmessage = async (event) => {
      if (event.data?.type !== "complete") return;
      try {
        const blob = await encodePcm16Wav(event.data.samples as Float32Array, event.data.sampleRate as number);
        const file = new File([blob], `voice-${Date.now()}.wav`, { type: "audio/wav" });
        await uploadFile(file);
      } finally {
        cleanupRecording();
      }
    };
    source.connect(worklet);
    worklet.connect(audioContext.destination);
    worklet.port.postMessage({ type: "start" });
    workletNodeRef.current = worklet;
    setRecording(true);
  }, [cleanupRecording, conversationId, recording, uploadFile]);

  const stopRecording = useCallback(() => {
    workletNodeRef.current?.port.postMessage({ type: "stop" });
  }, []);

  const submit = () => {
    if (!canSend || !onSend) return;
    void onSend({ body: value.trim(), attachmentIds: readyAttachmentIds });
    setValue("");
  };

  return (
    <div data-testid="ai-chat-composer">
      {hasReviewRequired ? (
        <p className="border-t border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {t(uiLanguage, "aiChatAttachmentReviewRequiredHint")}
        </p>
      ) : null}
      <AiChatAttachmentStrip
        uiLanguage={uiLanguage}
        attachments={attachments}
        onRemove={(attachmentId) => void onRemoveAttachment(attachmentId)}
        onReview={onReviewAttachment}
      />
      <div className="flex items-end gap-2 border-t border-stone-200 bg-white px-3 py-3 pb-safe">
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,image/webp,application/pdf,.docx,text/plain,text/csv,audio/wav,audio/ogg"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          disabled={disabled || !conversationId}
          aria-label={t(uiLanguage, "aiChatAttachmentAddFile")}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-200 text-stone-700"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={18} />
        </button>
        <button
          type="button"
          disabled={disabled || !conversationId}
          aria-label={t(uiLanguage, recording ? "aiChatAttachmentStopRecording" : "aiChatAttachmentStartRecording")}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-200 text-stone-700"
          onClick={() => (recording ? stopRecording() : void startRecording())}
        >
          {recording ? <Square size={18} /> : <Mic size={18} />}
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, AI_CHAT_MESSAGE_BODY_MAX_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          disabled={disabled}
          placeholder={t(uiLanguage, "aiChatComposerPlaceholder")}
          aria-label={t(uiLanguage, "aiChatComposerPlaceholder")}
          className="max-h-[212px] min-h-11 flex-1 resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-emerald-700 disabled:bg-stone-50 disabled:text-stone-400"
          style={{ overflowWrap: "anywhere" }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={t(uiLanguage, "aiChatComposerPlaceholder")}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-emerald-950 text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

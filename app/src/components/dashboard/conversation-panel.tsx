"use client";

import { useMemo, useRef, useState } from "react";
import { Bot, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import type { AiDecisionRecord, ClientRecord, ManuAppState, MessageRecord, SupportedLanguageCode } from "@/lib/types";
import { buildCopilotQualityReviewForPendingDraft } from "@/lib/phase-77v-copilot-quality-workflow";
import { t } from "@/lib/i18n";
import {
  buildClientHumanControlBanner,
  buildStructuredUpdateSourceLinks,
  resolveMessageProvenancePresentation,
} from "@/lib/phase-85-if-h-operational-visibility";
import {
  CopilotQualityReviewPanel,
  EmptyState,
  InfoLine,
  MessageBubble,
  TextareaInput,
  removeKey,
} from "./shared";
import { HumanControlSessionBanner, StructuredUpdateSourceLinksPanel } from "./operational-visibility";
import { MobileStickyActionBar } from "./mobile-ergonomics";
import { MOBILE_CHROME_CLASS } from "@/lib/phase-83e5-mobile-ergonomics";

export function ConversationPanel({
  client,
  messages,
  aiDecisions,
  state,
  uiLanguage,
  manualReply,
  onManualReply,
  onSendManualReply,
  onReleaseHumanTakeover,
  onActivateAi,
  isActivatingAi,
  onApproveDraft,
  onEditAndSendDraft,
  onDismissDraft,
  onOpenSimulator,
  onOpenClientPanel,
}: {
  client: ClientRecord;
  messages: MessageRecord[];
  aiDecisions: AiDecisionRecord[];
  state: ManuAppState;
  uiLanguage: SupportedLanguageCode;
  manualReply: string;
  onManualReply: (value: string) => void;
  onSendManualReply: () => void;
  onReleaseHumanTakeover: (clientId: string) => Promise<ManuAppState>;
  onActivateAi: (clientId: string) => Promise<ManuAppState>;
  isActivatingAi?: boolean;
  onApproveDraft: (messageId: string) => Promise<ManuAppState>;
  onEditAndSendDraft: (messageId: string, body: string) => Promise<ManuAppState>;
  onDismissDraft: (messageId: string) => Promise<ManuAppState>;
  onOpenSimulator: () => void;
  onOpenClientPanel?: (panelKey: string) => void;
}) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const redRiskLocked = client.redRiskLock.status === "locked";
  const yellowRiskHeld = client.yellowRiskHold.status === "active";
  const qualityReview = buildCopilotQualityReviewForPendingDraft(aiDecisions, messages, draftEdits);
  const humanControlBanner = useMemo(
    () => buildClientHumanControlBanner(state, client.id),
    [state, client.id],
  );
  const structuredSourceLinks = useMemo(
    () => buildStructuredUpdateSourceLinks(state, client.id),
    [state, client.id],
  );

  const scrollToMessage = (messageId: string) => {
    const target = timelineRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("ring-2", "ring-emerald-500");
      window.setTimeout(() => target.classList.remove("ring-2", "ring-emerald-500"), 1600);
    }
  };

  return (
    <>
    <div className={`grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] ${MOBILE_CHROME_CLASS.bottomNavWithStickyActions}`}>
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold">{client.fullName}</h3>
            <p className="mt-1 text-sm text-stone-600">Kaynak etiketli görüşme zaman çizelgesi</p>
          </div>
          <button
            onClick={onOpenSimulator}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
            type="button"
          >
            <Bot size={16} />
            Gelen mesajı simüle et
          </button>
        </div>

        {humanControlBanner ? (
          <div className="mt-4">
            <HumanControlSessionBanner
              banner={humanControlBanner}
              uiLanguage={uiLanguage}
              isActivating={isActivatingAi}
              onActivateAi={() => {
                void onActivateAi(client.id);
              }}
            />
          </div>
        ) : null}

        <div ref={timelineRef} className="mt-5 space-y-3">
          {messages.length === 0 ? (
            <EmptyState
              icon={MessageSquareText}
              title="Henüz mesaj yok"
              message="Simülatörü çalıştırın veya manuel yanıt gönderin."
            />
          ) : (
            messages.map((message) => {
              const provenance = resolveMessageProvenancePresentation(message);
              return (
              <MessageBubble
                key={message.id}
                message={message}
                provenanceLabel={t(uiLanguage, provenance.i18nKey)}
                provenanceTone={provenance.tone}
                draftEdit={draftEdits[message.id] ?? message.body}
                onDraftEdit={(value) => setDraftEdits((current) => ({ ...current, [message.id]: value }))}
                onApproveDraft={async () => {
                  await onApproveDraft(message.id);
                  setDraftEdits((current) => removeKey(current, message.id));
                }}
                onEditAndSendDraft={async () => {
                  await onEditAndSendDraft(message.id, draftEdits[message.id] ?? message.body);
                  setDraftEdits((current) => removeKey(current, message.id));
                }}
                onDismissDraft={async () => {
                  await onDismissDraft(message.id);
                  setDraftEdits((current) => removeKey(current, message.id));
                }}
              />
            );
            })
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <StructuredUpdateSourceLinksPanel
          links={structuredSourceLinks}
          uiLanguage={uiLanguage}
          onScrollToMessage={scrollToMessage}
          onOpenPanel={onOpenClientPanel}
        />

        <CopilotQualityReviewPanel review={qualityReview} />

        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Manuel yanıt</h3>
          <TextareaInput label="Yanıt metni" value={manualReply} onChange={onManualReply} rows={5} />
          <button
            onClick={onSendManualReply}
            className="mt-3 hidden min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 lg:inline-flex"
            type="button"
          >
            <Send size={16} />
            Manuel yanıtı kaydet
          </button>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Güncel kontroller</h3>
          <div className="mt-3 space-y-2 text-sm">
            <InfoLine label="AI" value={`${client.aiStatus} / ${client.aiMode}`} />
            <InfoLine label="Persona" value={client.selectedPersonaId} />
            <InfoLine label="Devralma" value={client.humanTakeoverLocked ? "kilitli" : "açık"} />
            <InfoLine label="İzin" value={client.channelPermission} />
            {redRiskLocked && <InfoLine label="Kırmızı risk" value="manuel reaktivasyon gerekli" />}
            {yellowRiskHeld && !redRiskLocked && <InfoLine label="Sarı risk" value="inceleme bekliyor" />}
          </div>
          {redRiskLocked && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900">
              AI yeniden etkinleştirilmeden önce kırmızı devir, devir kuyruğundan çözülmelidir.
            </div>
          )}
          {client.humanTakeoverLocked && !redRiskLocked && (
            <button
              onClick={() => onReleaseHumanTakeover(client.id)}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              type="button"
            >
              <ShieldCheck size={16} />
              Devralmayı bırak
            </button>
          )}
        </section>
      </aside>
    </div>

    <MobileStickyActionBar>
      <button
        onClick={onSendManualReply}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
        type="button"
      >
        <Send size={16} />
        Manuel yanıtı kaydet
      </button>
    </MobileStickyActionBar>
    </>
  );
}

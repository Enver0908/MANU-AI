"use client";

import { Send } from "lucide-react";
import type {
  ClientContextUpdateSource,
  ClientRecord,
  ClientUpdateProposalRecord,
  ContextIntakeProposalRecord,
  ManuAppState,
} from "@/lib/types";
import {
  PHASE_77B_DEPRECATED_PROPOSAL_HEADLINE,
  PHASE_77B_MANUAL_SOURCE_AUTHORITY_COPY,
} from "@/lib/phase-77b-chat-mutation-boundary";
import { CONTEXT_INTAKE_STRUCTURED_PANEL_LINKS } from "@/lib/phase-85-if-g-context-intake";
import { Badge, EmptyState, formatSafetyFlag, formatTime, groupProposalPatches } from "./shared";
import { MobileStickyActionBar } from "./mobile-ergonomics";
import { MOBILE_CHROME_CLASS, MOBILE_FIELD_CLASS } from "@/lib/phase-83e5-mobile-ergonomics";

export function CopilotPanel({
  state,
  selectedClient,
  input,
  isSending,
  isProposalUpdating,
  updateProposals,
  contextIntakeProposals,
  intakeSource,
  intakeSourceText,
  onIntakeSource,
  onIntakeSourceText,
  onCreateContextIntakeProposal,
  onConfirmContextIntakeProposal,
  onRecheckContextIntakeProposal,
  onApplyContextIntakeProposal,
  onRejectContextIntakeProposal,
  onInput,
  onAsk,
  onRejectProposal,
}: {
  state: ManuAppState;
  selectedClient: ClientRecord;
  input: string;
  isSending: boolean;
  isProposalUpdating: boolean;
  updateProposals: ClientUpdateProposalRecord[];
  contextIntakeProposals: ContextIntakeProposalRecord[];
  intakeSource: ClientContextUpdateSource;
  intakeSourceText: string;
  onIntakeSource: (value: ClientContextUpdateSource) => void;
  onIntakeSourceText: (value: string) => void;
  onCreateContextIntakeProposal: () => void;
  onConfirmContextIntakeProposal: (proposalId: string) => void;
  onRecheckContextIntakeProposal: (proposalId: string) => void;
  onApplyContextIntakeProposal: (proposalId: string) => void;
  onRejectContextIntakeProposal: (proposalId: string) => void;
  onInput: (value: string) => void;
  onAsk: (body?: string) => void;
  onRejectProposal: (proposalId: string) => void;
}) {
  const messages = state.internalCopilotMessages.slice(-40);
  const quickPrompts = [
    `${selectedClient.fullName} son durumu`,
    `${selectedClient.fullName} diyet plan ozeti`,
    `${selectedClient.fullName} son mesajlari`,
    `${selectedClient.fullName} acik handoff var mi?`,
  ];

  return (
    <>
    <div className={`grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] ${MOBILE_CHROME_CLASS.bottomNavWithStickyActions}`}>
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Internal read-only copilot</h3>
            <p className="mt-1 text-sm text-stone-600">
              Tenant-scoped tools only. Form/context changes require a separate proposal and dietitian approval.
            </p>
          </div>
          <Badge label="mock/local" tone="amber" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onAsk(prompt)}
              className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-[360px] space-y-3 rounded-lg border border-stone-100 bg-stone-50 p-3">
          {messages.length === 0 ? (
            <EmptyState
              title="Henüz soru yok"
              message="Danışan durumu, diyet planı, son mesajlar veya açık devir hakkında soru sorun."
            />
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-3xl rounded-lg border p-3 ${
                  message.role === "user"
                    ? "ml-auto border-emerald-200 bg-emerald-50"
                    : "border-stone-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase text-stone-500">{message.role}</p>
                  <Badge
                    label={message.safetyStatus}
                    tone={message.safetyStatus === "ok" ? "emerald" : message.safetyStatus === "unsupported" ? "stone" : "amber"}
                  />
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-800">{message.body}</p>
                {message.sourceRefs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.sourceRefs.map((ref) => (
                      <span
                        key={`${ref.entityType}-${ref.entityId}`}
                        className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600"
                      >
                        {ref.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 hidden gap-2 lg:flex">
          <input
            value={input}
            onChange={(event) => onInput(event.target.value)}
            className="min-h-11 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-base outline-none transition focus:border-emerald-700 sm:text-sm"
            placeholder={`${selectedClient.fullName} son durumu`}
            enterKeyHint="send"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onAsk();
              }
            }}
          />
          <button
            onClick={() => onAsk()}
            disabled={isSending}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
          >
            <Send size={16} />
            Ask
          </button>
        </div>
      </section>

      <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold">Read-only guarantees</h4>
        <div className="mt-3 space-y-3 text-sm text-stone-600">
          <p>{PHASE_77B_MANUAL_SOURCE_AUTHORITY_COPY}</p>
          <p>Tools read only from visible scoped app state.</p>
          <p>Assistant and auditor roles are blocked from copilot chat in v1.</p>
          <p>Client messages and form answers are treated as untrusted data, not instructions.</p>
          <p>Every assistant answer is stored with tool calls and source references.</p>
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4">
          <h4 className="text-sm font-semibold">Off-channel context intake</h4>
          <p className="mt-2 text-sm text-stone-500">
            Dedicated workflow for phone, Zoom, in-person, or other off-channel notes. Structured panel changes stay blocked until dashboard revision evidence exists.
          </p>
          <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
            <p className="font-semibold text-stone-900">Client confirmation</p>
            <p className="mt-1">{selectedClient.fullName}</p>
            <p>{selectedClient.primaryPhoneE164 || "No phone on file"}</p>
          </div>
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-semibold uppercase text-stone-500">
              Source
              <select
                value={intakeSource}
                onChange={(event) => onIntakeSource(event.target.value as ClientContextUpdateSource)}
                className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
              >
                <option value="phone">Phone</option>
                <option value="zoom">Zoom</option>
                <option value="in_person">In person</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase text-stone-500">
              Off-channel note
              <textarea
                value={intakeSourceText}
                onChange={(event) => onIntakeSourceText(event.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                placeholder="Summarize what was discussed off-channel..."
              />
            </label>
            <button
              onClick={onCreateContextIntakeProposal}
              disabled={isProposalUpdating}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
            >
              Create intake preview
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {contextIntakeProposals.length === 0 ? (
              <p className="text-sm text-stone-500">No pending context-intake proposals for this client.</p>
            ) : (
              contextIntakeProposals.slice(0, 5).map((proposal) => (
                <ContextIntakeProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  isProposalUpdating={isProposalUpdating}
                  onConfirm={onConfirmContextIntakeProposal}
                  onRecheck={onRecheckContextIntakeProposal}
                  onApply={onApplyContextIntakeProposal}
                  onReject={onRejectContextIntakeProposal}
                />
              ))
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4">
          <h4 className="text-sm font-semibold">Historical update proposals</h4>
          <p className="mt-2 text-sm text-stone-500">{PHASE_77B_DEPRECATED_PROPOSAL_HEADLINE}</p>
          <div className="mt-3 space-y-3">
            {updateProposals.length === 0 ? (
              <p className="text-sm text-stone-500">No historical chat-generated proposals for this client.</p>
            ) : (
              updateProposals.slice(0, 5).map((proposal) => (
                <UpdateProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  isProposalUpdating={isProposalUpdating}
                  onRejectProposal={onRejectProposal}
                />
              ))
            )}
          </div>
        </div>
      </aside>
    </div>

    <MobileStickyActionBar>
      <input
        value={input}
        onChange={(event) => onInput(event.target.value)}
        className={MOBILE_FIELD_CLASS}
        placeholder={`${selectedClient.fullName} son durumu`}
        enterKeyHint="send"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onAsk();
          }
        }}
      />
      <button
        onClick={() => onAsk()}
        disabled={isSending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
      >
        <Send size={16} />
        Ask
      </button>
    </MobileStickyActionBar>
    </>
  );
}

function ContextIntakeProposalCard({
  proposal,
  isProposalUpdating,
  onConfirm,
  onRecheck,
  onApply,
  onReject,
}: {
  proposal: ContextIntakeProposalRecord;
  isProposalUpdating: boolean;
  onConfirm: (proposalId: string) => void;
  onRecheck: (proposalId: string) => void;
  onApply: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}) {
  const structuredFlags = proposal.structuredImpactFlags;
  const canApply =
    proposal.status === "confirmed" &&
    (structuredFlags.length === 0 ? proposal.confirmationCount >= 1 : proposal.confirmationCount >= 2);

  return (
    <article className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge label={proposal.status} tone={proposal.status === "applied" ? "emerald" : "amber"} />
        <Badge label={proposal.intakeSource} tone="stone" />
        <span className="text-xs font-medium text-stone-500">{formatTime(proposal.createdAt)}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-stone-900">{proposal.title}</p>
      <p className="mt-1 text-sm text-stone-700">{proposal.summary}</p>
      {proposal.details && <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{proposal.details}</p>}
      {structuredFlags.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
          <p className="font-semibold">Structured update required</p>
          <ul className="mt-1 list-disc pl-5">
            {structuredFlags.map((flag) => (
              <li key={flag}>
                {flag} → {CONTEXT_INTAKE_STRUCTURED_PANEL_LINKS[flag as keyof typeof CONTEXT_INTAKE_STRUCTURED_PANEL_LINKS]}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {(proposal.status === "pending_confirmation" ||
          proposal.status === "blocked_structured_impact" ||
          (proposal.status === "confirmed" &&
            structuredFlags.length > 0 &&
            proposal.confirmationCount < 2)) && (
          <button
            onClick={() => onConfirm(proposal.id)}
            disabled={isProposalUpdating}
            className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700"
            type="button"
          >
            Confirm preview
          </button>
        )}
        {proposal.status === "blocked_structured_impact" && (
          <button
            onClick={() => onRecheck(proposal.id)}
            disabled={isProposalUpdating}
            className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700"
            type="button"
          >
            Recheck revisions
          </button>
        )}
        {canApply && (
          <button
            onClick={() => onApply(proposal.id)}
            disabled={isProposalUpdating}
            className="inline-flex min-h-11 items-center rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white"
            type="button"
          >
            Apply context update
          </button>
        )}
        {proposal.status !== "applied" && proposal.status !== "rejected" && (
          <button
            onClick={() => onReject(proposal.id)}
            disabled={isProposalUpdating}
            className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700"
            type="button"
          >
            Reject
          </button>
        )}
      </div>
    </article>
  );
}

function UpdateProposalCard({
  proposal,
  isProposalUpdating,
  onRejectProposal,
}: {
  proposal: ClientUpdateProposalRecord;
  isProposalUpdating: boolean;
  onRejectProposal: (proposalId: string) => void;
}) {
  const groupedPatches = groupProposalPatches(proposal.proposedPatches);

  return (
    <article className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge label="deprecated" tone="stone" />
        <Badge
          label={proposal.status}
          tone={proposal.status === "pending" ? "amber" : proposal.status === "applied" ? "emerald" : "stone"}
        />
        <span className="text-xs font-medium text-stone-500">{formatTime(proposal.createdAt)}</span>
      </div>
      <p className="mt-2 text-xs text-stone-500">{PHASE_77B_DEPRECATED_PROPOSAL_HEADLINE}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-stone-700">{proposal.sourceText}</p>

      {groupedPatches.map(([group, patches]) => (
        <div key={group} className="mt-3 space-y-2">
          <p className="text-xs font-semibold uppercase text-stone-500">{group}</p>
          {patches.map((patch, patchIndex) => (
            <div key={`${patch.target}-${patch.fieldId}-${patch.value}-${patchIndex}`} className="rounded-lg border border-stone-200 bg-white p-2">
              <p className="text-sm font-semibold text-stone-800">{patch.label}</p>
              <p className="mt-1 break-words text-sm text-stone-600">{patch.value}</p>
              {patch.impactLabel && <p className="mt-1 text-xs text-stone-500">{patch.impactLabel}</p>}
            </div>
          ))}
        </div>
      ))}

      {proposal.safetyFlags.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2">
          <p className="text-xs font-semibold uppercase text-amber-900">Manual remaining</p>
          <p className="mt-1 text-sm text-amber-900">{proposal.safetyFlags.map(formatSafetyFlag).join(", ")}</p>
        </div>
      )}

      {proposal.status === "pending" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onRejectProposal(proposal.id)}
            disabled={isProposalUpdating}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}
    </article>
  );
}

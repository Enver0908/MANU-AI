"use client";

import { useState } from "react";
import { Activity, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type {
  ClientContextUpdateSource,
  ClientFormFieldDefinition,
  ClientRecord,
  ClientUpdateProposalPatch,
  MessageRecord,
} from "@/lib/types";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { buildCopilotQualityReviewForPendingDraft } from "@/lib/phase-77v-copilot-quality-workflow";
import {
  MOBILE_FIELD_CLASS,
  resolveInputKeyboard,
  type InputKeyboardKind,
} from "@/lib/phase-83e5-mobile-ergonomics";

export { EmptyState } from "./state-primitives";

/**
 * Phase 83E-4 shared dashboard primitives, helpers, constants, and types.
 *
 * These are the low-level building blocks extracted verbatim from the former
 * monolithic dashboard so domain panels can be composed without changing any
 * clinical behavior, provenance labels, risk colors, or fail-closed logic.
 */

export type ViewKey =
  | "overview"
  | "clients"
  | "messages"
  | "simulator"
  | "alerts"
  | "notifications"
  | "copilot"
  | "voice"
  | "forms";

export type ClientDetailTab =
  | "tab_overview"
  | "tab_personal_form"
  | "tab_food_rules"
  | "tab_menu"
  | "tab_ai_assistant"
  | "tab_critical_context"
  | "tab_copilot"
  | "tab_export";

export type IconComponent = typeof Activity;
export type Tone = "emerald" | "amber" | "red" | "stone";

export const languageOptions: Array<[string, string]> = SUPPORTED_LANGUAGES.map((language) => [
  language.code,
  language.label,
]);

export const scenarioMessages = [
  {
    label: "Routine",
    body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
  },
  {
    label: "Yellow",
    body: "D vitamini takviyesi kullanayim mi?",
  },
  {
    label: "Red",
    body: "Alerjiden nefes alamiyorum, bogazim sisti.",
  },
  {
    label: "Plan",
    body: "Diyetimi degistirip ogunumu tamamen atlayabilir miyim?",
  },
];

export function splitLines(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseSchemaFields(raw: string): ClientFormFieldDefinition[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, label, type = "text", visibility = "never", required = "false", options = ""] = line
        .split("|")
        .map((part) => part.trim());
      return {
        id,
        label: label || id,
        type: type as ClientFormFieldDefinition["type"],
        required: required === "true",
        llmVisibility: visibility === "prompt_allowed" ? ("prompt_allowed" as const) : ("never" as const),
        options: options ? splitLines(options) : undefined,
      };
    })
    .filter((field) => field.id && field.label);
}

export function parseAnswerLines(raw: string) {
  return Object.fromEntries(
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, ...valueParts] = line.split(":");
        return [key.trim(), valueParts.join(":").trim()];
      })
      .filter(([key]) => key),
  );
}

export function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function removeKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

export function originLabel(origin: MessageRecord["origin"]) {
  const labels: Record<MessageRecord["origin"], string> = {
    client_inbound: "Client",
    ai_generated: "AI",
    dietitian_manual: "Dietitian",
    system_event: "System",
    imported_unknown: "Imported",
  };
  return labels[origin];
}

export function originTone(origin: MessageRecord["origin"]): Tone {
  if (origin === "ai_generated") return "emerald";
  if (origin === "dietitian_manual") return "amber";
  if (origin === "system_event") return "stone";
  return "stone";
}

export function sourceLabel(source: ClientContextUpdateSource) {
  const labels: Record<ClientContextUpdateSource, string> = {
    phone: "Phone",
    zoom: "Zoom",
    in_person: "In person",
    other: "Other",
  };
  return labels[source];
}

export function toneClass(tone: Tone, mode: "soft" | "icon") {
  const classes = {
    soft: {
      emerald: "bg-emerald-100 text-emerald-950",
      amber: "bg-amber-100 text-amber-950",
      red: "bg-red-100 text-red-950",
      stone: "bg-stone-100 text-stone-700",
    },
    icon: {
      emerald: "text-emerald-700",
      amber: "text-amber-700",
      red: "text-red-700",
      stone: "text-stone-500",
    },
  };
  return classes[mode][tone];
}

export function groupProposalPatches(patches: ClientUpdateProposalPatch[]) {
  const labels = {
    nutrition: "Nutrition",
    clinical_safety: "Clinical safety",
    sensitive_detail: "Sensitive form detail",
    food_rule: "Food rules",
  };
  const groups = new Map<string, ClientUpdateProposalPatch[]>();
  for (const patch of patches) {
    const label = labels[patch.category || "nutrition"];
    groups.set(label, [...(groups.get(label) || []), patch]);
  }
  return [...groups.entries()];
}

export function formatSafetyFlag(flag: string) {
  return flag.replace(/^manual_control_required_/, "").replace(/_/g, " ");
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-600">{label}</p>
        <span className={toneClass(tone, "icon")}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

export function WorkflowItem({ icon: Icon, title, body }: { icon: IconComponent; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center gap-2 font-semibold">
        <Icon size={17} className="text-emerald-800" />
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
    </div>
  );
}

export function ClientSummary({ client, compact = false }: { client: ClientRecord; compact?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="truncate font-semibold">{client.fullName}</p>
        <Badge label={client.aiStatus} tone={client.aiStatus === "active" ? "emerald" : "stone"} />
      </div>
      <div className={`mt-2 flex flex-wrap gap-1.5 ${compact ? "text-xs" : "text-sm"}`}>
        <Badge label={client.aiMode} tone={client.aiMode === "autopilot" ? "emerald" : "amber"} />
        <Badge label={client.selectedPersonaId} tone="stone" />
        {client.humanTakeoverLocked && <Badge label="takeover" tone="red" />}
      </div>
    </div>
  );
}

export function CopilotQualityReviewPanel({
  review,
}: {
  review: ReturnType<typeof buildCopilotQualityReviewForPendingDraft>;
}) {
  return (
    <section
      className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm"
      data-testid="copilot-quality-review-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-indigo-950">Copilot quality review</h3>
        <Badge label="internal only" tone="stone" />
      </div>
      {!review ? (
        <p className="mt-3 text-sm leading-6 text-indigo-900/80">
          Pending AI draft yoksa veya karar baglantisi bulunamadiysa ozet gosterilmez.
        </p>
      ) : (
        <div className="mt-3 space-y-3 text-sm text-indigo-950">
          {review.responsePlanSummary && (
            <div>
              <p className="font-semibold">Response plan</p>
              <div className="mt-1 space-y-1 text-indigo-900/90">
                <InfoLine label="Intent" value={String(review.responsePlanSummary.intentFamily ?? "n/a")} />
                <InfoLine label="Reply mode" value={String(review.responsePlanSummary.replyMode ?? "n/a")} />
                <InfoLine label="Template" value={String(review.responsePlanSummary.templateId ?? "n/a")} />
                <InfoLine label="Risk" value={String(review.responsePlanSummary.riskClass ?? "n/a")} />
              </div>
            </div>
          )}
          {review.sourceRefs.length > 0 && (
            <div>
              <p className="font-semibold">Source refs</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-indigo-900/90">
                {review.sourceRefs.map((ref) => (
                  <li key={`${ref.id}-${ref.category}`}>
                    {ref.category || "source"} {ref.segmentType ? `(${ref.segmentType})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {review.claimManifestSummary && (
            <div>
              <p className="font-semibold">Claim manifest</p>
              <InfoLine
                label="Claims"
                value={`${review.claimManifestSummary.claimTypeCount} / complete=${review.claimManifestSummary.complete ? "yes" : "no"}`}
              />
            </div>
          )}
          {review.blockOrHandoffReason && (
            <InfoLine label="Block / handoff" value={review.blockOrHandoffReason} />
          )}
          {review.suggestedEditFocus.length > 0 && (
            <div>
              <p className="font-semibold">Suggested edit focus</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {review.suggestedEditFocus.map((focus) => (
                  <Badge key={focus} label={focus} tone="stone" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function MessageBubble({
  message,
  provenanceLabel,
  provenanceTone,
  draftEdit,
  onDraftEdit,
  onApproveDraft,
  onEditAndSendDraft,
  onDismissDraft,
}: {
  message: MessageRecord;
  provenanceLabel?: string;
  provenanceTone?: Tone;
  draftEdit: string;
  onDraftEdit: (value: string) => void;
  onApproveDraft: () => void;
  onEditAndSendDraft: () => void;
  onDismissDraft: () => void;
}) {
  const isClient = message.sender === "client";
  const isAssistant = message.sender === "assistant";
  const isDraft = message.origin === "ai_generated" && message.status === "draft";
  const resolvedProvenanceLabel = provenanceLabel ?? originLabel(message.origin);
  const resolvedProvenanceTone = provenanceTone ?? originTone(message.origin);
  return (
    <div className={`flex ${isClient ? "justify-start" : "justify-end"}`} data-message-id={message.id}>
      <div
        className={`max-w-[min(720px,100%)] rounded-lg border p-3 shadow-sm ${
          isAssistant
            ? "border-emerald-200 bg-emerald-50"
            : isClient
              ? "border-stone-200 bg-white"
              : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={resolvedProvenanceLabel} tone={resolvedProvenanceTone} />
          {message.risk && <Badge label={message.risk} tone={message.risk === "red" ? "red" : message.risk === "yellow" ? "amber" : "emerald"} />}
          {message.status && <Badge label={message.status} tone="stone" />}
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-stone-900">{message.body}</p>
        {isDraft && (
          <div className="mt-3 border-t border-emerald-200 pt-3">
            <TextareaInput label="Draft edit" value={draftEdit} onChange={onDraftEdit} rows={3} />
            <div className="mt-3 flex flex-wrap gap-2">
              <ConfirmButton
                label="Approve"
                confirmLabel="Onayla ve gönder"
                onConfirm={onApproveDraft}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              />
              <ConfirmButton
                label="Edit & send"
                confirmLabel="Düzenleyip gönder"
                onConfirm={onEditAndSendDraft}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100"
                confirmClassName="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              />
              <button
                onClick={onDismissDraft}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-stone-200 px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-300"
                type="button"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-stone-500">{formatTime(message.createdAt)}</p>
      </div>
    </div>
  );
}

export function StatusPill({
  icon: Icon,
  label,
  tone,
}: {
  icon: IconComponent;
  label: string;
  tone: Tone;
}) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${toneClass(tone, "soft")}`}>
      <Icon size={16} />
      {label}
    </span>
  );
}

export function Badge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`inline-flex max-w-full items-center rounded-md px-2 py-1 text-xs font-semibold ${toneClass(tone, "soft")}`}>
      <span className="truncate">{label}</span>
    </span>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  keyboard = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboard?: InputKeyboardKind;
}) {
  const kb = resolveInputKeyboard(keyboard);
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={kb.type}
        inputMode={kb.inputMode}
        autoComplete={kb.autoComplete}
        enterKeyHint={kb.enterKeyHint}
        className={MOBILE_FIELD_CLASS}
      />
    </label>
  );
}

export function DateTimeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span>{label}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={MOBILE_FIELD_CLASS}
      />
    </label>
  );
}

export function TextareaInput({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={`${MOBILE_FIELD_CLASS} resize-y leading-6`}
      />
    </label>
  );
}

export function ArrayInput({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string) => void }) {
  return <TextareaInput label={label} value={value.join("\n")} onChange={onChange} rows={5} />;
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={MOBILE_FIELD_CLASS}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-700">{label}</p>
      <div className="mt-1 grid gap-1 rounded-lg bg-stone-100 p-1 sm:grid-cols-2 xl:grid-cols-4">
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            onClick={() => onChange(optionValue)}
            className={`min-h-11 rounded-md px-2 py-2 text-sm font-semibold transition ${
              value === optionValue ? "bg-white text-emerald-950 shadow-sm" : "text-stone-600 hover:bg-stone-200"
            }`}
            type="button"
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-6 w-6 rounded border-stone-300 text-emerald-900"
      />
    </label>
  );
}

/**
 * Reusable two-step confirmation control for safety-critical actions (send to
 * client, reactivate, destructive removal). The trigger keeps its original
 * label so existing affordances stay discoverable; tapping it arms an explicit
 * confirm/cancel pair. This adds the required confirmation step without changing
 * the underlying action semantics.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
  confirmClassName,
  icon: Icon,
  disabled = false,
  title,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className: string;
  confirmClassName?: string;
  icon?: IconComponent;
  disabled?: boolean;
  title?: string;
}) {
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2" role="group" aria-label={`${label} onayı`}>
        <button
          type="button"
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
          className={
            confirmClassName ||
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
          }
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
        >
          Vazgeç
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={() => setArmed(true)}
      className={className}
    >
      {Icon ? <Icon size={16} /> : null}
      {label}
    </button>
  );
}

export function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
      <span className="text-stone-500">{label}</span>
      <span className="max-w-[65%] truncate font-medium text-stone-900">{value}</span>
    </div>
  );
}

export function ConflictSummaryBox({ conflicts }: { conflicts: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? conflicts : conflicts.slice(0, 3);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="conflict-summary">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-700" />
        <p className="text-sm font-semibold text-amber-900">{conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""}</p>
      </div>
      <ul className="mt-2 space-y-1">
        {visible.map((msg, i) => (
          <li key={i} className="text-sm leading-6 text-amber-800">{msg}</li>
        ))}
      </ul>
      {conflicts.length > 3 && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 inline-flex min-h-11 items-center gap-1 px-2 text-xs font-medium text-amber-700">
          {expanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show all ({conflicts.length})</>}
        </button>
      )}
    </div>
  );
}

"use client";

import { Plus, SlidersHorizontal } from "lucide-react";
import type { ManuAppState } from "@/lib/types";
import { Badge, EmptyState, TextareaInput } from "./shared";

export function VoicePanel({
  state,
  rawInput,
  onRawInput,
  onAddSamples,
  onUpdateSampleStatus,
  onGenerateProfile,
}: {
  state: ManuAppState;
  rawInput: string;
  onRawInput: (value: string) => void;
  onAddSamples: () => void;
  onUpdateSampleStatus: (sampleId: string, status: "draft" | "approved" | "rejected") => Promise<ManuAppState>;
  onGenerateProfile: () => Promise<ManuAppState>;
}) {
  const profile = state.voiceProfiles.find((item) => item.status === "generated");
  const approvedCount = state.voiceSamples.filter((sample) => sample.status === "approved").length;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-xl font-semibold">Dietitian voice samples</h3>
        <TextareaInput
          label="Paste samples"
          value={rawInput}
          onChange={onRawInput}
          rows={8}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={onAddSamples}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white"
            type="button"
          >
            <Plus size={16} />
            Add samples
          </button>
          <button
            onClick={onGenerateProfile}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700"
            type="button"
          >
            <SlidersHorizontal size={16} />
            Generate profile
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {state.voiceSamples.map((sample) => (
            <div key={sample.id} className="rounded-lg border border-stone-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-stone-700">{sample.body}</p>
                <Badge label={sample.status} tone={sample.status === "approved" ? "emerald" : "stone"} />
              </div>
              <div className="mt-2 flex gap-2">
                {(["approved", "rejected"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => onUpdateSampleStatus(sample.id, status)}
                    className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700"
                    type="button"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold">Voice profile</h4>
        <p className="mt-2 text-sm text-stone-600">Approved samples: {approvedCount}/10 minimum</p>
        {profile ? (
          <div className="mt-3 space-y-2 text-sm text-stone-700">
            <p>Version: {profile.profileVersion}</p>
            <p>Formality: {profile.formality}</p>
            <p>Emoji: {profile.emojiPolicy}</p>
            <p>{profile.styleNotes}</p>
          </div>
        ) : (
          <EmptyState title="Profil yok" message="Onaylı örneklerden ses profili henüz oluşturulmadı." />
        )}
      </aside>
    </div>
  );
}

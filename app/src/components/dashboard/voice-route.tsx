"use client";

import { useCallback, useState } from "react";
import type { ManuAppState, VoiceSampleStatus } from "@/lib/types";
import { VoicePanel } from "@/components/dashboard/voice-panel";

export function VoiceRoute({
  state,
  onAddVoiceSamples,
  onUpdateVoiceSampleStatus,
  onGenerateVoiceProfile,
}: {
  state: ManuAppState;
  onAddVoiceSamples: (rawInput: string) => Promise<ManuAppState>;
  onUpdateVoiceSampleStatus: (sampleId: string, status: VoiceSampleStatus) => Promise<ManuAppState>;
  onGenerateVoiceProfile: () => Promise<ManuAppState>;
}) {
  const [rawInput, setRawInput] = useState("");
  const addSamples = useCallback(async () => {
    if (!rawInput.trim()) return;
    await onAddVoiceSamples(rawInput);
    setRawInput("");
  }, [onAddVoiceSamples, rawInput]);

  return (
    <VoicePanel
      state={state}
      rawInput={rawInput}
      onRawInput={setRawInput}
      onAddSamples={addSamples}
      onUpdateSampleStatus={onUpdateVoiceSampleStatus}
      onGenerateProfile={onGenerateVoiceProfile}
    />
  );
}

import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  addVoiceSamplesToState,
  generateVoiceProfileInState,
  parseVoiceSamples,
  updateVoiceSampleStatusInState,
} from "./voice-profile-workflow";

describe("dietitian voice sample workflow", () => {
  it("parses pasted samples and ignores duplicates", () => {
    const state = createInitialState();
    const next = addVoiceSamplesToState(state, "Merhaba, iyi gidiyoruz.\n\nMerhaba, iyi gidiyoruz.\n\nHarika devam.");

    expect(parseVoiceSamples("a\n\nb")).toEqual(["a", "b"]);
    expect(next.voiceSamples).toHaveLength(2);
    expect(next.auditEvents.at(-1)?.eventType).toBe("voice_sample_added");
  });

  it("requires ten approved samples before profile generation", () => {
    let state = addVoiceSamplesToState(
      createInitialState(),
      Array.from({ length: 9 }, (_, index) => `Merhaba ${index}, guzel gidiyoruz.`).join("\n\n"),
    );
    state = state.voiceSamples.reduce(
      (current, sample) => updateVoiceSampleStatusInState(current, sample.id, "approved"),
      state,
    );

    expect(() => generateVoiceProfileInState(state)).toThrow(/voice_profile_requires_approved_samples/);

    state = addVoiceSamplesToState(state, "Merhaba 10, super devam.");
    state = updateVoiceSampleStatusInState(state, state.voiceSamples.at(-1)?.id || "", "approved");
    const generated = generateVoiceProfileInState(state);

    expect(generated.voiceProfiles.at(-1)?.status).toBe("generated");
    expect(generated.voiceProfiles.at(-1)?.sampleCount).toBe(10);
  });
});

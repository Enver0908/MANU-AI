import test from "node:test";
import assert from "node:assert/strict";
import { buildDietitianVoiceProfile } from "../src/voice-profile.js";

test("voice profile detects informal english samples", () => {
  const profile = buildDietitianVoiceProfile([
    "Great job today, keep it up!",
    "Awesome progress, love it.",
  ]);

  assert.equal(profile.formality, "informal");
});

test("voice profile detects formal german samples", () => {
  const profile = buildDietitianVoiceProfile([
    "Sehr geehrte Frau, bitte beachten Sie die Empfehlung.",
    "Mit freundlichen Gruessen.",
  ]);

  assert.equal(profile.formality, "formal");
});

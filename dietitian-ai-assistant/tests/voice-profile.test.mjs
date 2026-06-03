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

test("voice profile detects informal turkish unicode samples", () => {
  const profile = buildDietitianVoiceProfile([
    "Harika gidiyorsun canım, bugün su takibini unutma.",
    "Süper, aynı şekilde devam.",
  ]);

  assert.equal(profile.formality, "informal");
});

test("voice profile detects formal french samples", () => {
  const profile = buildDietitianVoiceProfile([
    "Madame, veuillez noter cette recommandation.",
    "Cordialement.",
  ]);

  assert.equal(profile.formality, "formal");
});

test("voice profile detects informal portuguese samples", () => {
  const profile = buildDietitianVoiceProfile([
    "Otimo progresso, continue assim.",
    "Tudo bem, valeu pelo retorno.",
  ]);

  assert.equal(profile.formality, "informal");
});

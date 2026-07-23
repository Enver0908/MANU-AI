import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAiChatRedNotificationFingerprint,
  classifyDietitianChatRisk,
} from "../src/dietitian-chat-risk.js";

test("classifies fixture red deterministically", () => {
  const result = classifyDietitianChatRisk({
    triggerBody: "__fixture:risk:red__",
    scopeType: "client",
  });
  assert.equal(result.riskLevel, "red");
  assert.equal(result.safeDraft, null);
});

test("does not treat source-only red wording as verified client red", () => {
  const result = classifyDietitianChatRisk({
    triggerBody: "Please review this source excerpt.",
    attachmentExcerpts: ["Example case mentions chest pain in a hypothetical scenario."],
    scopeType: "client",
    providerRiskLevel: "green",
  });
  assert.equal(result.riskLevel, "yellow");
  assert.equal(result.hypotheticalRed, true);
  assert.ok(result.safeDraft);
});

test("treats verified client red signal as red", () => {
  const result = classifyDietitianChatRisk({
    triggerBody: "Client reports chest pain today.",
    verifiedFactTexts: ["Client reports chest pain today."],
    scopeType: "client",
    providerRiskLevel: "green",
  });
  assert.equal(result.riskLevel, "red");
  assert.equal(result.hypotheticalRed, false);
});

test("builds stable red notification fingerprint", () => {
  const left = buildAiChatRedNotificationFingerprint({
    clientId: "client-1",
    reasons: ["verified_client_red_signal", "provider_risk:red"],
    sourceRevisionDigest: "rev-1",
  });
  const right = buildAiChatRedNotificationFingerprint({
    clientId: "client-1",
    reasons: ["provider_risk:red", "verified_client_red_signal"],
    sourceRevisionDigest: "rev-1",
  });
  assert.equal(left, right);
});

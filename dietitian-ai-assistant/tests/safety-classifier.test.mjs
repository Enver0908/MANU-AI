import test from "node:test";
import assert from "node:assert/strict";
import { classifyDieteticRisk } from "../src/safety-classifier.js";
import { guardAssistantReply } from "../src/response-quality-guard.js";

const classifierCases = [
  ["routine meal swap is green", "Bugun kahvaltida yumurta yerine ne yiyebilirim?", "green"],
  ["supplement question is yellow", "D vitamini takviyesi kullanayim mi?", "yellow"],
  ["lab result question is yellow", "Kan sonucu ve ferritin degerim dusuk cikti.", "yellow"],
  ["plan change request is yellow", "Diyetimi değiştirip öğünü atlayabilir miyim?", "yellow"],
  ["pregnancy context is yellow", "Hamileyim, ara ogunumu nasil yapayim?", "yellow"],
  ["pregnancy complication is red", "Hamileyim ve kanamam var.", "red"],
  ["critical glucose issue is red", "Şekerim 50 çıktı, ne yapayım?", "red"],
  ["allergic reaction is red", "Alerjiden nefes alamiyorum ve bogazim sisti.", "red"],
  ["eating disorder crisis is red", "Kendimi kusturmak istiyorum.", "red"],
  ["self-harm language is red", "Yaşamak istemiyorum.", "red"],
];

for (const [name, body, expectedRisk] of classifierCases) {
  test(name, () => {
    const decision = classifyDieteticRisk(body);
    assert.equal(decision.level, expectedRisk);
  });
}

test("high-risk client context raises routine messages to yellow", () => {
  const decision = classifyDieteticRisk("Bugun kahvaltida ne yiyebilirim?", { highRisk: true });

  assert.equal(decision.level, "yellow");
  assert.ok(decision.reasons.includes("client_marked_high_risk"));
});

test("persona wording does not change safety classification", () => {
  const body = "D vitamini takviyesi kullanayim mi?";
  const risks = ["balanced_coach", "warm_supporter", "clinical_formal"].map(
    () => classifyDieteticRisk(body).level,
  );

  assert.deepEqual(risks, ["yellow", "yellow", "yellow"]);
});

test("quality guard blocks unsafe nutrition and medical phrasing", () => {
  const capsule = {
    voiceProfile: { averageMessageChars: 140 },
    client: {
      fullName: "Mert Kaya",
      knownOtherClientNames: [],
    },
    memory: { durableFacts: {} },
  };
  const riskDecision = { level: "green" };

  const unsafeDrafts = [
    "Sende tiroid olabilir, tanı için bunu kabul edelim.",
    "Metformin dozunu 500 mg artirabilirsin.",
    "Acile gitme gerek yok, bekleyebilirsin.",
    "Diyetini değiştirelim ve öğününü tamamen çıkar.",
  ];

  for (const draft of unsafeDrafts) {
    const quality = guardAssistantReply({ draft, capsule, riskDecision });
    assert.equal(quality.allowed, false);
  }
});

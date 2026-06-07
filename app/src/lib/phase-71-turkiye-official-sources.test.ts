import { describe, expect, it } from "vitest";
import { buildOfficialRegulationScopeRuleDrafts } from "./official-regulation-corpus";
import {
  PHASE_71_REQUIRED_P0_SOURCE_IDS,
  PHASE_71_TURKIYE_OFFICIAL_SOURCES,
  buildPhase71TurkiyeCorpusQaInput,
  evaluatePhase71TurkiyeCorpusIntake,
  evaluatePhase71TurkiyeSourcePackReadiness,
  type Phase71PdfArtifactEvidence,
} from "./phase-71-turkiye-official-sources";

describe("phase 71 Turkiye official health source pack", () => {
  it("captures the supplied 14-source Turkiye manifest with all P0 sources present", () => {
    const readiness = evaluatePhase71TurkiyeSourcePackReadiness();

    expect(PHASE_71_TURKIYE_OFFICIAL_SOURCES).toHaveLength(14);
    expect(readiness).toMatchObject({
      status: "pass",
      sourceCount: 14,
      p0SourceCount: 9,
      p1SourceCount: 4,
      p2SourceCount: 1,
      missingP0SourceIds: [],
    });
    expect(PHASE_71_REQUIRED_P0_SOURCE_IDS).toHaveLength(9);
  });

  it("fails source-pack readiness when a required P0 source is absent", () => {
    const withoutFirstP0 = PHASE_71_TURKIYE_OFFICIAL_SOURCES.filter((source) => source.sourceId !== "TR-P71-001");
    const readiness = evaluatePhase71TurkiyeSourcePackReadiness(withoutFirstP0);

    expect(readiness.status).toBe("fail");
    expect(readiness.blockingReasons).toContain("missing P0 source: TR-P71-001");
  });

  it("keeps metadata-only intake failed until PDF artifact evidence is supplied", () => {
    const intake = evaluatePhase71TurkiyeCorpusIntake({
      artifacts: [],
      sectionRefs: [],
      derivedRuleDrafts: [],
      goldenCases: [],
    });

    expect(intake.sourcePackReadiness.status).toBe("pass");
    expect(intake.qaEvaluation.status).toBe("fail");
    expect(intake.qaEvaluation.blockingReasons).toContain("no official PDF sources supplied");
    expect(intake.qaEvaluation.blockingReasons).toContain("no page/section map supplied");
  });

  it("rejects artifact evidence for unknown Phase 71 sources", () => {
    const intake = evaluatePhase71TurkiyeCorpusIntake({
      artifacts: [
        {
          sourceId: "unknown-source",
          sha256: "a".repeat(64),
          byteSize: 1024,
          pageCount: 1,
          receivedAt: "2026-06-07T12:00:00.000Z",
          pageExtractions: [],
        },
      ],
      sectionRefs: [],
      derivedRuleDrafts: [],
      goldenCases: [],
    });

    expect(intake.qaEvaluation.status).toBe("fail");
    expect(intake.unknownArtifactSourceIds).toEqual(["unknown-source"]);
    expect(intake.qaEvaluation.blockingReasons).toContain(
      "artifact references unknown Phase 71 source unknown-source",
    );
  });

  it("passes Phase 65 QA with complete synthetic artifact evidence and builds draft-only rules", () => {
    const sectionRef = {
      sourceId: "TR-P71-001",
      sectionId: "ek-madde-13",
      sectionTitle: "Diyetisyen gorev siniri",
      pageStart: 1,
      pageEnd: 1,
    };
    const artifact: Phase71PdfArtifactEvidence = {
      sourceId: "TR-P71-001",
      sha256: "a".repeat(64),
      byteSize: 4096,
      pageCount: 1,
      receivedAt: "2026-06-07T12:00:00.000Z",
      pageExtractions: [
        {
          sourceId: "TR-P71-001",
          pageNumber: 1,
          extractionStatus: "ok",
          textHash: "b".repeat(64),
          charCount: 500,
          extractedAt: "2026-06-07T12:05:00.000Z",
        },
      ],
    };
    const qaInput = buildPhase71TurkiyeCorpusQaInput({
      artifacts: [artifact],
      sectionRefs: [sectionRef],
      derivedRuleDrafts: [
        {
          id: "phase71-rule-medical-boundary",
          title: "Medical boundary requests require review",
          body: "Escalate diagnosis, treatment, medication, insulin, lab interpretation, and emergency symptoms.",
          languageCode: "tr",
          escalationLevel: "yellow",
          version: 1,
          sourceRefs: [sectionRef],
          createdAt: "2026-06-07T12:10:00.000Z",
        },
      ],
      goldenCases: [
        {
          id: "phase71-golden-medication",
          syntheticInput: "Insulin dozumu bugun degistireyim mi?",
          expectedRisk: "yellow",
          expectedMatchedRuleIds: ["phase71-rule-medical-boundary"],
          sourceRefs: [sectionRef],
        },
      ],
    });
    const intake = evaluatePhase71TurkiyeCorpusIntake({
      artifacts: [artifact],
      sectionRefs: qaInput.sectionRefs,
      derivedRuleDrafts: qaInput.derivedRuleDrafts,
      goldenCases: qaInput.goldenCases,
    });
    const draftRules = buildOfficialRegulationScopeRuleDrafts(intake.qaEvaluation, qaInput.derivedRuleDrafts);

    expect(intake.qaEvaluation.status).toBe("pass");
    expect(draftRules).toHaveLength(1);
    expect(draftRules[0]).toMatchObject({
      id: "phase71-rule-medical-boundary",
      status: "draft",
      approvedByDietitianId: null,
      approvedAt: null,
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  OFFICIAL_REGULATION_CORPUS_VERSION,
  buildOfficialRegulationClinicalEvidenceRecord,
  buildOfficialRegulationScopeRuleDrafts,
  evaluateOfficialRegulationCorpusQa,
  type OfficialRegulationCorpusQaInput,
} from "./official-regulation-corpus";

describe("official regulation corpus QA", () => {
  it("passes only with source metadata, checksums, page extraction, section refs, rule drafts, and golden cases", () => {
    const evaluation = evaluateOfficialRegulationCorpusQa(buildValidCorpusInput());

    expect(evaluation.status).toBe("pass");
    expect(evaluation.blockingReasons).toEqual([]);
    expect(evaluation.sourceChecksums).toEqual([
      "official-pdf-1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ]);
    expect(evaluation.derivedRuleCount).toBe(1);
    expect(evaluation.goldenCaseCount).toBe(1);
  });

  it("fails closed for incomplete PDF evidence", () => {
    const input = buildValidCorpusInput({
      sources: [
        {
          ...buildValidCorpusInput().sources[0],
          sha256: "not-a-sha",
          pageCount: 3,
        },
      ],
      pageExtractions: buildValidCorpusInput().pageExtractions.slice(0, 1),
    });
    const evaluation = evaluateOfficialRegulationCorpusQa(input);

    expect(evaluation.status).toBe("fail");
    expect(evaluation.blockingReasons).toContain("source official-pdf-1 has invalid sha256");
    expect(evaluation.blockingReasons).toContain(
      "source official-pdf-1 page 2 is missing extraction evidence",
    );
    expect(evaluation.blockingReasons).toContain(
      "source official-pdf-1 page 3 is missing extraction evidence",
    );
  });

  it("rejects unknown source and duplicate extraction evidence", () => {
    const input = buildValidCorpusInput({
      pageExtractions: [
        ...buildValidCorpusInput().pageExtractions,
        {
          ...buildValidCorpusInput().pageExtractions[0],
        },
        {
          ...buildValidCorpusInput().pageExtractions[0],
          sourceId: "unknown-source",
        },
      ],
    });
    const evaluation = evaluateOfficialRegulationCorpusQa(input);

    expect(evaluation.status).toBe("fail");
    expect(evaluation.blockingReasons).toContain(
      "source official-pdf-1 page 1 has duplicate extraction evidence",
    );
    expect(evaluation.blockingReasons).toContain("page extraction references unknown source unknown-source");
  });

  it("rejects derived rules without mapped page and section references", () => {
    const input = buildValidCorpusInput({
      derivedRuleDrafts: [
        {
          ...buildValidCorpusInput().derivedRuleDrafts[0],
          sourceRefs: [
            {
              sourceId: "official-pdf-1",
              sectionId: "missing-section",
              sectionTitle: "Missing",
              pageStart: 1,
              pageEnd: 1,
            },
          ],
        },
      ],
    });
    const evaluation = evaluateOfficialRegulationCorpusQa(input);

    expect(evaluation.status).toBe("fail");
    expect(evaluation.blockingReasons).toContain(
      "derived rule official-rule-plan-change references unmapped section missing-section",
    );
  });

  it("builds draft scope rules only after QA passes", () => {
    const input = buildValidCorpusInput();
    const evaluation = evaluateOfficialRegulationCorpusQa(input);
    const rules = buildOfficialRegulationScopeRuleDrafts(evaluation, input.derivedRuleDrafts);

    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      id: "official-rule-plan-change",
      status: "draft",
      approvedByDietitianId: null,
      approvedAt: null,
    });
    expect(rules[0]?.sourceRefs).toEqual([
      {
        sourceId: "official-pdf-1",
        sectionId: "scope-1",
        pageStart: 1,
        pageEnd: 1,
      },
    ]);
  });

  it("does not build draft scope rules when QA fails", () => {
    const input = buildValidCorpusInput({ goldenCases: [] });
    const evaluation = evaluateOfficialRegulationCorpusQa(input);

    expect(() => buildOfficialRegulationScopeRuleDrafts(evaluation, input.derivedRuleDrafts)).toThrow(
      "official_regulation_corpus_qa_failed",
    );
  });

  it("requires external clinical approval before producing approved launch-gate evidence", () => {
    const evaluation = evaluateOfficialRegulationCorpusQa(buildValidCorpusInput());
    const evidence = buildOfficialRegulationClinicalEvidenceRecord(evaluation, {
      artifactTitle: "Official PDF corpus clinical approval",
      artifactRef: "external-review://official-pdf-corpus/v1",
      owner: "Qualified dietitian reviewer",
      approvalStatus: "approved",
      approvedAt: "2026-06-04T09:00:00.000Z",
      reviewDueAt: "2026-12-04T09:00:00.000Z",
      sanitizedReference: true,
    });

    expect(evidence).toMatchObject({
      gateId: "clinical_taxonomy_approval",
      approvalStatus: "approved",
      coveredEvidence: ["approved official regulation PDF corpus version", "corpus golden-case report"],
    });
  });

  it("keeps launch-gate evidence draft when corpus QA fails", () => {
    const evaluation = evaluateOfficialRegulationCorpusQa(buildValidCorpusInput({ goldenCases: [] }));
    const evidence = buildOfficialRegulationClinicalEvidenceRecord(evaluation, {
      artifactTitle: "Official PDF corpus clinical approval",
      artifactRef: "external-review://official-pdf-corpus/v1",
      owner: "Qualified dietitian reviewer",
      approvalStatus: "approved",
      approvedAt: "2026-06-04T09:00:00.000Z",
      reviewDueAt: "2026-12-04T09:00:00.000Z",
      sanitizedReference: true,
    });

    expect(evidence.approvalStatus).toBe("draft");
    expect(evidence.coveredEvidence).toEqual([]);
  });
});

function buildValidCorpusInput(overrides: Partial<OfficialRegulationCorpusQaInput> = {}): OfficialRegulationCorpusQaInput {
  const sectionRef = {
    sourceId: "official-pdf-1",
    sectionId: "scope-1",
    sectionTitle: "Dietitian scope boundary",
    pageStart: 1,
    pageEnd: 1,
  };

  return {
    corpusVersion: OFFICIAL_REGULATION_CORPUS_VERSION,
    sources: [
      {
        id: "official-pdf-1",
        title: "Official Dietetic Regulation",
        jurisdiction: "TR",
        publisher: "Official regulator",
        sourceUrl: "https://example.invalid/regulation.pdf",
        fileName: "official-regulation.pdf",
        sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        byteSize: 1024,
        pageCount: 1,
        receivedAt: "2026-06-04T08:00:00.000Z",
      },
    ],
    pageExtractions: [
      {
        sourceId: "official-pdf-1",
        pageNumber: 1,
        extractionStatus: "ok",
        textHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        charCount: 220,
        extractedAt: "2026-06-04T08:05:00.000Z",
      },
    ],
    sectionRefs: [sectionRef],
    derivedRuleDrafts: [
      {
        id: "official-rule-plan-change",
        title: "Plan changes require dietitian review",
        body: "AI must escalate diet plan change requests to the dietitian.",
        languageCode: "en",
        escalationLevel: "yellow",
        version: 1,
        sourceRefs: [sectionRef],
        createdAt: "2026-06-04T08:10:00.000Z",
      },
    ],
    goldenCases: [
      {
        id: "golden-plan-change",
        syntheticInput: "Can you change my diet plan today?",
        expectedRisk: "yellow",
        expectedMatchedRuleIds: ["official-rule-plan-change"],
        sourceRefs: [sectionRef],
      },
    ],
    ...overrides,
  };
}

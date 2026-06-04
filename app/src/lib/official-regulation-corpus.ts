import type { LaunchGateEvidenceRecord } from "./launch-gates";
import type { RiskLevel, ScopeRuleRecord, SupportedLanguageCode } from "./types";

export const OFFICIAL_REGULATION_CORPUS_VERSION = "official-regulation-corpus-v0.1.0";

export type OfficialRegulationPdfSourceRecord = {
  id: string;
  title: string;
  jurisdiction: string;
  publisher: string;
  sourceUrl: string | null;
  fileName: string;
  sha256: string;
  byteSize: number;
  pageCount: number;
  receivedAt: string;
};

export type OfficialRegulationPdfPageExtractionRecord = {
  sourceId: string;
  pageNumber: number;
  extractionStatus: "ok" | "empty" | "failed";
  textHash: string | null;
  charCount: number;
  extractedAt: string;
};

export type OfficialRegulationSectionRef = {
  sourceId: string;
  sectionId: string;
  sectionTitle: string;
  pageStart: number;
  pageEnd: number;
};

export type OfficialRegulationDerivedRuleDraft = {
  id: string;
  title: string;
  body: string;
  languageCode: SupportedLanguageCode;
  escalationLevel: Extract<RiskLevel, "yellow" | "red">;
  version: number;
  sourceRefs: OfficialRegulationSectionRef[];
  createdAt: string;
};

export type OfficialRegulationGoldenCaseRecord = {
  id: string;
  syntheticInput: string;
  expectedRisk: RiskLevel;
  expectedMatchedRuleIds: string[];
  sourceRefs: OfficialRegulationSectionRef[];
};

export type OfficialRegulationCorpusQaInput = {
  corpusVersion: string;
  sources: OfficialRegulationPdfSourceRecord[];
  pageExtractions: OfficialRegulationPdfPageExtractionRecord[];
  sectionRefs: OfficialRegulationSectionRef[];
  derivedRuleDrafts: OfficialRegulationDerivedRuleDraft[];
  goldenCases: OfficialRegulationGoldenCaseRecord[];
};

export type OfficialRegulationCorpusQaEvaluation = {
  status: "pass" | "fail";
  blockingReasons: string[];
  corpusVersion: string;
  sourceCount: number;
  pageCount: number;
  extractedPageCount: number;
  sectionRefCount: number;
  derivedRuleCount: number;
  goldenCaseCount: number;
  sourceChecksums: string[];
};

export type OfficialRegulationClinicalApprovalInput = {
  artifactTitle: string;
  artifactRef: string;
  owner: string;
  approvalStatus: "approved" | "conditional" | "rejected" | "draft";
  approvedAt: string | null;
  reviewDueAt: string | null;
  expiresAt?: string | null;
  sanitizedReference: boolean;
};

const SHA_256_HEX = /^[a-f0-9]{64}$/i;

export function evaluateOfficialRegulationCorpusQa(
  input: OfficialRegulationCorpusQaInput,
): OfficialRegulationCorpusQaEvaluation {
  const blockingReasons = new Set<string>();
  const sourceIds = new Set<string>();
  const sectionKeys = new Set(input.sectionRefs.map(sectionKey));
  const ruleIds = new Set(input.derivedRuleDrafts.map((rule) => rule.id));

  if (!input.corpusVersion.trim()) blockingReasons.add("missing corpus version");
  if (input.sources.length === 0) blockingReasons.add("no official PDF sources supplied");
  if (input.sectionRefs.length === 0) blockingReasons.add("no page/section map supplied");
  if (input.derivedRuleDrafts.length === 0) blockingReasons.add("no derived rule drafts supplied");
  if (input.goldenCases.length === 0) blockingReasons.add("no corpus golden cases supplied");

  for (const source of input.sources) {
    validateSource(source, sourceIds, blockingReasons);
    validateSourcePageExtractions(source, input.pageExtractions, blockingReasons);
  }

  validatePageExtractionSources(input.pageExtractions, sourceIds, blockingReasons);

  for (const sectionRef of input.sectionRefs) {
    validateSectionRef(sectionRef, input.sources, blockingReasons);
  }

  const seenRuleIds = new Set<string>();
  for (const ruleDraft of input.derivedRuleDrafts) {
    validateDerivedRuleDraft(ruleDraft, sectionKeys, seenRuleIds, blockingReasons);
  }

  const seenGoldenCaseIds = new Set<string>();
  for (const goldenCase of input.goldenCases) {
    validateGoldenCase(goldenCase, ruleIds, sectionKeys, seenGoldenCaseIds, blockingReasons);
  }

  const extractedPageCount = input.pageExtractions.filter((page) => page.extractionStatus === "ok").length;
  const sourceChecksums = input.sources.map((source) => `${source.id}:${source.sha256}`);

  return {
    status: blockingReasons.size === 0 ? "pass" : "fail",
    blockingReasons: [...blockingReasons],
    corpusVersion: input.corpusVersion,
    sourceCount: input.sources.length,
    pageCount: input.sources.reduce((total, source) => total + source.pageCount, 0),
    extractedPageCount,
    sectionRefCount: input.sectionRefs.length,
    derivedRuleCount: input.derivedRuleDrafts.length,
    goldenCaseCount: input.goldenCases.length,
    sourceChecksums,
  };
}

export function buildOfficialRegulationScopeRuleDrafts(
  evaluation: OfficialRegulationCorpusQaEvaluation,
  ruleDrafts: OfficialRegulationDerivedRuleDraft[],
): ScopeRuleRecord[] {
  if (evaluation.status !== "pass") {
    throw new Error("official_regulation_corpus_qa_failed");
  }

  return ruleDrafts.map((ruleDraft) => ({
    id: ruleDraft.id,
    title: ruleDraft.title,
    body: ruleDraft.body,
    languageCode: ruleDraft.languageCode,
    escalationLevel: ruleDraft.escalationLevel,
    version: ruleDraft.version,
    status: "draft",
    approvedByDietitianId: null,
    approvedAt: null,
    createdAt: ruleDraft.createdAt,
    sourceRefs: ruleDraft.sourceRefs.map(({ sourceId, sectionId, pageStart, pageEnd }) => ({
      sourceId,
      sectionId,
      pageStart,
      pageEnd,
    })),
  }));
}

export function buildOfficialRegulationClinicalEvidenceRecord(
  evaluation: OfficialRegulationCorpusQaEvaluation,
  approval: OfficialRegulationClinicalApprovalInput,
): LaunchGateEvidenceRecord {
  return {
    gateId: "clinical_taxonomy_approval",
    artifactTitle: approval.artifactTitle,
    artifactRef: approval.artifactRef,
    owner: approval.owner,
    approvalStatus: evaluation.status === "pass" ? approval.approvalStatus : "draft",
    approvedAt: approval.approvedAt,
    reviewDueAt: approval.reviewDueAt,
    expiresAt: approval.expiresAt,
    sanitizedReference: approval.sanitizedReference,
    coveredEvidence:
      evaluation.status === "pass"
        ? ["approved official regulation PDF corpus version", "corpus golden-case report"]
        : [],
  };
}

function validateSource(
  source: OfficialRegulationPdfSourceRecord,
  sourceIds: Set<string>,
  blockingReasons: Set<string>,
) {
  if (!source.id.trim()) blockingReasons.add("source is missing id");
  if (sourceIds.has(source.id)) blockingReasons.add(`duplicate source id: ${source.id}`);
  sourceIds.add(source.id);
  if (!source.title.trim()) blockingReasons.add(`source ${source.id} is missing title`);
  if (!source.jurisdiction.trim()) blockingReasons.add(`source ${source.id} is missing jurisdiction`);
  if (!source.publisher.trim()) blockingReasons.add(`source ${source.id} is missing publisher`);
  if (!source.fileName.trim()) blockingReasons.add(`source ${source.id} is missing file name`);
  if (!SHA_256_HEX.test(source.sha256)) blockingReasons.add(`source ${source.id} has invalid sha256`);
  if (source.byteSize <= 0) blockingReasons.add(`source ${source.id} has invalid byte size`);
  if (!Number.isInteger(source.pageCount) || source.pageCount <= 0) {
    blockingReasons.add(`source ${source.id} has invalid page count`);
  }
  if (Number.isNaN(new Date(source.receivedAt).getTime())) {
    blockingReasons.add(`source ${source.id} has invalid received date`);
  }
}

function validateSourcePageExtractions(
  source: OfficialRegulationPdfSourceRecord,
  pageExtractions: OfficialRegulationPdfPageExtractionRecord[],
  blockingReasons: Set<string>,
) {
  const pages = pageExtractions.filter((page) => page.sourceId === source.id);
  const pageNumbers = new Set(pages.map((page) => page.pageNumber));
  const seenPageNumbers = new Set<number>();

  for (let pageNumber = 1; pageNumber <= source.pageCount; pageNumber += 1) {
    if (!pageNumbers.has(pageNumber)) {
      blockingReasons.add(`source ${source.id} page ${pageNumber} is missing extraction evidence`);
    }
  }

  for (const page of pages) {
    if (seenPageNumbers.has(page.pageNumber)) {
      blockingReasons.add(`source ${source.id} page ${page.pageNumber} has duplicate extraction evidence`);
    }
    seenPageNumbers.add(page.pageNumber);
    if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1 || page.pageNumber > source.pageCount) {
      blockingReasons.add(`source ${source.id} page ${page.pageNumber} is outside page range`);
    }
    if (page.extractionStatus === "failed") {
      blockingReasons.add(`source ${source.id} page ${page.pageNumber} extraction failed`);
    }
    if (page.extractionStatus === "ok" && (!page.textHash || !SHA_256_HEX.test(page.textHash))) {
      blockingReasons.add(`source ${source.id} page ${page.pageNumber} is missing valid text hash`);
    }
    if (page.extractionStatus === "ok" && page.charCount <= 0) {
      blockingReasons.add(`source ${source.id} page ${page.pageNumber} has no extracted text`);
    }
    if (Number.isNaN(new Date(page.extractedAt).getTime())) {
      blockingReasons.add(`source ${source.id} page ${page.pageNumber} has invalid extraction date`);
    }
  }
}

function validatePageExtractionSources(
  pageExtractions: OfficialRegulationPdfPageExtractionRecord[],
  sourceIds: Set<string>,
  blockingReasons: Set<string>,
) {
  for (const page of pageExtractions) {
    if (!sourceIds.has(page.sourceId)) {
      blockingReasons.add(`page extraction references unknown source ${page.sourceId}`);
    }
  }
}

function validateSectionRef(
  sectionRef: OfficialRegulationSectionRef,
  sources: OfficialRegulationPdfSourceRecord[],
  blockingReasons: Set<string>,
) {
  const source = sources.find((candidate) => candidate.id === sectionRef.sourceId);
  if (!source) {
    blockingReasons.add(`section ${sectionRef.sectionId} references unknown source ${sectionRef.sourceId}`);
    return;
  }
  if (!sectionRef.sectionId.trim()) blockingReasons.add(`source ${sectionRef.sourceId} has section with missing id`);
  if (!sectionRef.sectionTitle.trim()) {
    blockingReasons.add(`section ${sectionRef.sectionId} is missing section title`);
  }
  if (sectionRef.pageStart < 1 || sectionRef.pageEnd > source.pageCount || sectionRef.pageStart > sectionRef.pageEnd) {
    blockingReasons.add(`section ${sectionRef.sectionId} has invalid page range`);
  }
}

function validateDerivedRuleDraft(
  ruleDraft: OfficialRegulationDerivedRuleDraft,
  sectionKeys: Set<string>,
  seenRuleIds: Set<string>,
  blockingReasons: Set<string>,
) {
  if (!ruleDraft.id.trim()) blockingReasons.add("derived rule is missing id");
  if (seenRuleIds.has(ruleDraft.id)) blockingReasons.add(`duplicate derived rule id: ${ruleDraft.id}`);
  seenRuleIds.add(ruleDraft.id);
  if (!ruleDraft.title.trim()) blockingReasons.add(`derived rule ${ruleDraft.id} is missing title`);
  if (!ruleDraft.body.trim()) blockingReasons.add(`derived rule ${ruleDraft.id} is missing body`);
  if (!["yellow", "red"].includes(ruleDraft.escalationLevel)) {
    blockingReasons.add(`derived rule ${ruleDraft.id} has invalid escalation level`);
  }
  if (ruleDraft.version <= 0) blockingReasons.add(`derived rule ${ruleDraft.id} has invalid version`);
  if (ruleDraft.sourceRefs.length === 0) {
    blockingReasons.add(`derived rule ${ruleDraft.id} has no source references`);
  }
  for (const ref of ruleDraft.sourceRefs) {
    if (!sectionKeys.has(sectionKey(ref))) {
      blockingReasons.add(`derived rule ${ruleDraft.id} references unmapped section ${ref.sectionId}`);
    }
  }
}

function validateGoldenCase(
  goldenCase: OfficialRegulationGoldenCaseRecord,
  ruleIds: Set<string>,
  sectionKeys: Set<string>,
  seenGoldenCaseIds: Set<string>,
  blockingReasons: Set<string>,
) {
  if (!goldenCase.id.trim()) blockingReasons.add("golden case is missing id");
  if (seenGoldenCaseIds.has(goldenCase.id)) blockingReasons.add(`duplicate golden case id: ${goldenCase.id}`);
  seenGoldenCaseIds.add(goldenCase.id);
  if (!goldenCase.syntheticInput.trim()) blockingReasons.add(`golden case ${goldenCase.id} is missing synthetic input`);
  if (goldenCase.expectedMatchedRuleIds.length === 0) {
    blockingReasons.add(`golden case ${goldenCase.id} has no expected matched rule ids`);
  }
  for (const ruleId of goldenCase.expectedMatchedRuleIds) {
    if (!ruleIds.has(ruleId)) blockingReasons.add(`golden case ${goldenCase.id} references unknown rule ${ruleId}`);
  }
  for (const ref of goldenCase.sourceRefs) {
    if (!sectionKeys.has(sectionKey(ref))) {
      blockingReasons.add(`golden case ${goldenCase.id} references unmapped section ${ref.sectionId}`);
    }
  }
}

function sectionKey(ref: OfficialRegulationSectionRef) {
  return `${ref.sourceId}:${ref.sectionId}:${ref.pageStart}:${ref.pageEnd}`;
}

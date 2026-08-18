export const STAGE5_EVIDENCE_SCHEMA_VERSION = "stage5-evidence-v2" as const;

export type Stage5EvidenceType = "dependency" | "rls" | "performance" | "real_device" | "local_verify";

export type Stage5EvidenceHeader = {
  schemaVersion: typeof STAGE5_EVIDENCE_SCHEMA_VERSION;
  evidenceType: Stage5EvidenceType;
  sourceRevision: string;
  sourceTreeClean: boolean;
  packageLockSha256: string | null;
  generatedAt: string;
  command: string;
  environment: {
    nodeVersion: string;
    platform: string;
    architecture: string;
  };
};

export type Stage5DependencySecurityEvidence = Stage5EvidenceHeader & {
  evidenceType: "dependency";
  status: "PASS" | "FAIL";
  r405Status: "technically_resolved" | "open";
  productionStatus: "NO-GO";
  packages: {
    next: string | null;
    eslintConfigNext: string | null;
    nextNestedPostcss: string | null;
    nextNestedSharp: string | null;
    directSharp: string | null;
  };
  productionAudit: {
    status: "PASS" | "FAIL";
    command: "npm audit --omit=dev --json";
    exitCode: number;
    totals?: {
      total?: number;
      high?: number;
      critical?: number;
      [key: string]: number | undefined;
    };
    findings?: Array<{ key: string; severity: string }>;
  };
  assertions: Array<{ code: string; passed: boolean; [key: string]: unknown }>;
  blockers: string[];
  evidencePath: string;
};

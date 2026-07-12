import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildClientScopedExport } from "./data-governance";
import { exportClientInState } from "./app-state-store";
import { createInitialState } from "./seed-data";
import { assertClientExportExcludesConversationReadReceipts } from "./phase-85-stage-4b2-messaging-integration";
import {
  createStage4B2R5ScaleFixture,
  evaluateStage4B2R5ScaleEvidence,
  evaluateStage4B2R5SqlContractEvidence,
  STAGE_4B2_R5_SCALE_TARGETS,
} from "./phase-85-stage-4b2-remediation-r5-evidence";

const runFullScale = process.env.STAGE_4B2_R5_FULL_SCALE === "1";

function repoPath(...segments: string[]) {
  return resolve(process.cwd(), "..", ...segments);
}

describe("phase 85 stage 4b-2 remediation R5 evidence", () => {
  it("rebuilds bounded list/detail and cross-page unread evidence at a focused scale", () => {
    const { source, heavyConversationId } = createStage4B2R5ScaleFixture(500);
    const evidence = evaluateStage4B2R5ScaleEvidence(source, heavyConversationId);

    expect(evidence.status).toBe("pass");
    expect(evidence.failures).toEqual([]);
    expect(evidence.conversationCount).toBe(500);
    expect(evidence.heavyTranscriptMessageCount).toBe(STAGE_4B2_R5_SCALE_TARGETS.heavyTranscriptMessageCount);
    expect(evidence.firstPageSize).toBe(STAGE_4B2_R5_SCALE_TARGETS.listDefaultPageSize);
    expect(evidence.maxPageSize).toBe(STAGE_4B2_R5_SCALE_TARGETS.listMaxPageSize);
    expect(evidence.defaultDetailSize).toBe(STAGE_4B2_R5_SCALE_TARGETS.detailDefaultPageSize);
    expect(evidence.maxDetailSize).toBe(STAGE_4B2_R5_SCALE_TARGETS.detailMaxPageSize);
  }, 120_000);

  it("locks the R2 bounded-read and R3 atomic-mutation SQL contracts", () => {
    const sql = evaluateStage4B2R5SqlContractEvidence({
      r2Migration: readFileSync(
        repoPath("app", "supabase", "migrations", "20260712170000_phase_85_stage_4b2_r2_bounded_reads_rls.sql"),
        "utf8",
      ),
      r3Migration: readFileSync(
        repoPath("app", "supabase", "migrations", "20260712180000_phase_85_stage_4b2_r3_atomic_mutations.sql"),
        "utf8",
      ),
    });
    expect(sql.status).toBe("pass");
    expect(sql.failures).toEqual([]);
  });

  it("keeps read receipts and lifecycle internals out of client exports", () => {
    const state = createInitialState();
    const exported = exportClientInState(state, "client-mert") as Record<string, unknown>;
    const scoped = buildClientScopedExport(state, "client-mert") as Record<string, unknown>;
    expect(() => assertClientExportExcludesConversationReadReceipts(exported)).not.toThrow();
    expect(() => assertClientExportExcludesConversationReadReceipts(scoped)).not.toThrow();
    expect(JSON.stringify(exported)).not.toContain("conversationReadReceipts");
    expect(JSON.stringify(scoped)).not.toContain("conversation_read_receipts");
  });

  if (runFullScale) {
    it("repeats the 10,000 conversation evidence path in full-scale mode", () => {
      const { source, heavyConversationId } = createStage4B2R5ScaleFixture();
      const evidence = evaluateStage4B2R5ScaleEvidence(source, heavyConversationId);
      expect(evidence.status).toBe("pass");
      expect(evidence.failures).toEqual([]);
    }, 180_000);
  }
});

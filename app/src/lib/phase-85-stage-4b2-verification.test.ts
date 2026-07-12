import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createInitialState, DEMO_DIETITIAN_ID, DEMO_TENANT_ID } from "./seed-data";
import {
  buildConversationDetailResponseFromAppState,
  buildConversationListResponseFromAppState,
  createStage4B2MessagingScaleFixture,
} from "./phase-85-stage-4b2-messaging";
import {
  assertConversationInboxItemDtoSafety,
  assertConversationMessageDtoSafety,
  CONVERSATION_INBOX_ITEM_DTO_KEYS,
  CONVERSATION_MESSAGE_DTO_KEYS,
  evaluateStage4B2BoundedMessagingEvidence,
  evaluateStage4B2WorkspaceHygieneEvidence,
  PHASE_85_STAGE_4B_2_VERIFICATION_VERSION,
  ownerContextForVerification,
  runStage4B2VerificationRehearsalFull,
  runStage4B2VerificationRehearsalSample,
  STAGE_4B2_SCALE_TARGETS,
  STAGE_4B2_SENSITIVE_DTO_PATTERNS,
} from "./phase-85-stage-4b2-verification";

const runFullScale = process.env.STAGE_4B2_FULL_SCALE === "1";
const fullScaleIt = runFullScale ? it : it.skip;

function repoPath(...segments: string[]) {
  return resolve(process.cwd(), "..", ...segments);
}

function readRepoSnippet(...segments: string[]) {
  return readFileSync(repoPath(...segments), "utf8");
}

describe("phase 85 stage 4b-2 verification", () => {
  it("locks inbox and message DTO allowlists on seed state", () => {
    const state = createInitialState();
    const context = ownerContextForVerification(state);
    const list = buildConversationListResponseFromAppState(state, context, [], {
      generatedAt: "2026-07-12T12:00:00.000Z",
    });
    const detail = buildConversationDetailResponseFromAppState(
      state,
      context,
      [],
      state.conversations[0]!.id,
      { generatedAt: "2026-07-12T12:00:00.000Z" },
    );

    expect(CONVERSATION_INBOX_ITEM_DTO_KEYS).toHaveLength(11);
    expect(CONVERSATION_MESSAGE_DTO_KEYS).toHaveLength(11);
    for (const item of list.items) {
      assertConversationInboxItemDtoSafety(item);
    }
    for (const message of detail.messages) {
      assertConversationMessageDtoSafety(message);
    }
    expect(STAGE_4B2_SENSITIVE_DTO_PATTERNS.test(JSON.stringify(list.items))).toBe(false);
    expect(STAGE_4B2_SENSITIVE_DTO_PATTERNS.test(JSON.stringify(detail.messages))).toBe(false);
  });

  it("keeps bounded list/detail page sizes on scale fixture", () => {
    const source = createStage4B2MessagingScaleFixture(400, {
      tenantId: DEMO_TENANT_ID,
      dietitianId: DEMO_DIETITIAN_ID,
      messagesPerConversation: 120,
    });
    const evidence = evaluateStage4B2BoundedMessagingEvidence(source);
    expect(evidence.ready).toBe(true);
    expect(evidence.failures).toEqual([]);
    expect(evidence.listDefaultPageSize).toBe(STAGE_4B2_SCALE_TARGETS.defaultListPageSize);
    expect(evidence.listMaxPageSize).toBe(STAGE_4B2_SCALE_TARGETS.maxListPageSize);
    expect(evidence.detailDefaultPageSize).toBe(STAGE_4B2_SCALE_TARGETS.defaultDetailPageSize);
    expect(evidence.detailMaxPageSize).toBe(STAGE_4B2_SCALE_TARGETS.maxDetailPageSize);
    expect(evidence.filteredTotal).toBeGreaterThan(STAGE_4B2_SCALE_TARGETS.defaultListPageSize);
  });

  it("locks the R3 mutation RPC contract to one transaction and server-side scope", () => {
    const migration = readRepoSnippet(
      "app",
      "supabase",
      "migrations",
      "20260712180000_phase_85_stage_4b2_r3_atomic_mutations.sql",
    );
    expect(migration).toContain("p85_stage_4b2_commit_conversation_mutation_v2");
    expect(migration).toContain("on conflict (tenant_id, request_id) do nothing");
    expect(migration).toContain("for update of cl");
    expect(migration).toContain("p85_stage_4b2_actor_can_mutate_conversation");
    expect(migration).toContain("p85_stage_4b2_assert_mutation_payload_scope");
    expect(migration).toContain("red_lock_superseded");
    expect(migration).toContain("set response_json = p_response_json");
    expect(migration).toContain("to service_role");
  });

  it("rejects Phase 86 references and embedded secret markers in tracked snippets", () => {
    const hygiene = evaluateStage4B2WorkspaceHygieneEvidence({
      action_plan: readRepoSnippet("docs", "PHASE_85_STAGE_4B_2_MESAJLASMA_ACTION_PLAN.md"),
      integration: readRepoSnippet("app", "src", "lib", "phase-85-stage-4b2-messaging-integration.ts"),
      verification: readRepoSnippet("app", "src", "lib", "phase-85-stage-4b2-verification.ts"),
    });
    expect(hygiene.ready).toBe(true);
    expect(hygiene.failures).toEqual([]);
    expect(
      evaluateStage4B2WorkspaceHygieneEvidence({
        bad: "Next step is Phase 86 rollout with sk_live_abc123",
      }).failures.length,
    ).toBeGreaterThan(0);
  });

  it("passes sample Stage 4B-2 verification rehearsal", async () => {
    const metrics = await runStage4B2VerificationRehearsalSample({
      action_plan: readRepoSnippet("docs", "PHASE_85_STAGE_4B_2_MESAJLASMA_ACTION_PLAN.md"),
    });
    expect(metrics.phase).toBe(PHASE_85_STAGE_4B_2_VERIFICATION_VERSION);
    expect(metrics.status).toBe("pass");
    expect(metrics.production_pilot_go).toBe(false);
    expect(metrics.failures).toEqual([]);
    expect(metrics.conversation_count).toBe(500);
    expect(metrics.list_default_page_size).toBe(STAGE_4B2_SCALE_TARGETS.defaultListPageSize);
    expect(metrics.list_max_page_size).toBe(STAGE_4B2_SCALE_TARGETS.maxListPageSize);
  });

  fullScaleIt(
    "runs full 10,000 conversation Stage 4B-2 scale rehearsal",
    async () => {
      const metrics = await runStage4B2VerificationRehearsalFull({
        action_plan: readRepoSnippet("docs", "PHASE_85_STAGE_4B_2_MESAJLASMA_ACTION_PLAN.md"),
      });
      expect(metrics.status).toBe("pass");
      expect(metrics.conversation_count).toBe(STAGE_4B2_SCALE_TARGETS.conversationCount);
      expect(metrics.list_default_page_size).toBe(STAGE_4B2_SCALE_TARGETS.defaultListPageSize);
      expect(metrics.list_max_page_size).toBe(STAGE_4B2_SCALE_TARGETS.maxListPageSize);
      expect(metrics.detail_max_page_size).toBeLessThanOrEqual(STAGE_4B2_SCALE_TARGETS.maxDetailPageSize);
      expect(metrics.failures).toEqual([]);
    },
    180_000,
  );
});

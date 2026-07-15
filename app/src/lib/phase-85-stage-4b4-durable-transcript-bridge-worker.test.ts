import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runStage4B4DurableTranscriptBridgeWorkerBatch } from "./phase-85-stage-4b4-durable-transcript-bridge-worker";

function createMockSupabase(handlers: {
  promotion?: () => unknown;
  claims?: Array<Record<string, unknown> | null>;
  transcriptText?: string | null;
}): SupabaseClient {
  let claimIndex = 0;
  const rpc = vi.fn(async (name: string) => {
    if (name === "p85_stage_4b4_promote_voice_bundle_deadlines_v2") {
      return { data: handlers.promotion?.() ?? { promoted: 1, transcriptionTimeouts: 0 }, error: null };
    }
    if (name === "p85_stage_4b4_claim_transcript_bridge_work_v2") {
      const row = handlers.claims?.[claimIndex] ?? null;
      claimIndex += 1;
      return { data: row ? [row] : [], error: null };
    }
    if (name === "p85_stage_4b4_complete_transcript_bridge_v2") {
      return { data: { bodyUpdated: true }, error: null };
    }
    if (name === "p85_stage_4b4_fail_transcript_bridge_work_v2") {
      return { data: { status: "retry_scheduled" }, error: null };
    }
    throw new Error(`unexpected_rpc:${name}`);
  });

  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data:
                handlers.transcriptText === null
                  ? null
                  : {
                      transcript_text: handlers.transcriptText ?? "Bugun mercimek corbasi yedim",
                      status: "accepted",
                      transcription_revision: 1,
                    },
              error: null,
            }),
          }),
        }),
      }),
    }),
  }));

  return { rpc, from } as unknown as SupabaseClient;
}

describe("phase-85-stage-4b4-durable-transcript-bridge-worker", () => {
  it("promotes bundle deadlines and completes claimed bridge jobs", async () => {
    const supabase = createMockSupabase({
      claims: [
        {
          id: "bridge-1",
          tenant_id: "tenant-1",
          transcription_id: "transcription-1",
          transcription_revision: 1,
          conversation_id: "conversation-1",
          media_asset_id: "asset-1",
          message_id: "message-1",
          bundle_id: "bundle-1",
          lease_token: "lease-1",
        },
        null,
      ],
    });

    const summary = await runStage4B4DurableTranscriptBridgeWorkerBatch({
      supabase,
      tenantId: "tenant-1",
      workerId: "bridge-worker-test",
      now: "2026-07-15T12:00:00.000Z",
    });

    expect(summary.claimed).toBe(1);
    expect(summary.completed).toBe(1);
    expect(summary.bodyUpdated).toBe(1);
    expect(summary.promoted).toBe(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "p85_stage_4b4_complete_transcript_bridge_v2",
      expect.objectContaining({
        p_bridge_job_id: "bridge-1",
      }),
    );
  });

  it("fails bridge jobs when accepted transcript text is missing", async () => {
    const supabase = createMockSupabase({
      claims: [
        {
          id: "bridge-2",
          tenant_id: "tenant-1",
          transcription_id: "transcription-2",
          transcription_revision: 1,
          conversation_id: "conversation-1",
          media_asset_id: "asset-2",
          message_id: "message-2",
          bundle_id: "bundle-1",
          lease_token: "lease-2",
        },
      ],
      transcriptText: null,
    });

    const summary = await runStage4B4DurableTranscriptBridgeWorkerBatch({
      supabase,
      tenantId: "tenant-1",
      workerId: "bridge-worker-test",
    });

    expect(summary.claimed).toBe(1);
    expect(summary.completed).toBe(0);
    expect(summary.failed).toBe(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "p85_stage_4b4_fail_transcript_bridge_work_v2",
      expect.objectContaining({
        p_failure_code: "transcript_not_accepted",
      }),
    );
  });
});

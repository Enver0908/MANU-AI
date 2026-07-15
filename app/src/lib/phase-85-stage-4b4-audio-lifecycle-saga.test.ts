import { describe, expect, it, vi } from "vitest";
import { createInMemoryStage4B4AudioStorage } from "./phase-85-stage-4b4-audio-storage";
import {
  runStage4B4AudioLifecycleWorkerBatch,
  STAGE_4B4_AUDIO_LIFECYCLE_SAGA_VERSION,
} from "./phase-85-stage-4b4-audio-lifecycle-saga";
import { DEMO_TENANT_ID } from "./seed-data";

describe("phase-85-stage-4b4-audio-lifecycle-saga", () => {
  it("uses dedicated audio lifecycle claim RPC and never skips unrelated leases", async () => {
    const storage = createInMemoryStage4B4AudioStorage();
    await storage.uploadObject(`${DEMO_TENANT_ID}/asset-voice-1/voice.wav`, Buffer.from("voice"), "audio/wav");

    const rpcCalls: string[] = [];
    const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
      rpcCalls.push(name);
      if (name === "p85_stage_4b4_process_due_audio_expiry_batch_v1") {
        return { data: { prepared: 1 }, error: null };
      }
      if (name === "p85_stage_4b4_resume_legal_hold_audio_deletions_v1") {
        return { data: { enqueued: 0 }, error: null };
      }
      if (name === "p85_stage_4b4_redact_stale_audio_transcription_evidence_v1") {
        return { data: { transcriptionsRedacted: 1 }, error: null };
      }
      if (name === "p85_stage_4b4_claim_audio_lifecycle_work_v1") {
        if (rpcCalls.filter((entry) => entry === "p85_stage_4b4_claim_audio_lifecycle_work_v1").length === 1) {
          return {
            data: [
              {
                id: "op-audio-1",
                tenant_id: DEMO_TENANT_ID,
                media_asset_id: "asset-voice-1",
                object_key: `${DEMO_TENANT_ID}/asset-voice-1/voice.wav`,
                operation_kind: "delete_object",
                lease_token: "lease-1",
                retry_count: 0,
              },
            ],
            error: null,
          };
        }
        return { data: [], error: null };
      }
      if (name === "p85_stage_4b4_complete_audio_lifecycle_work_v1") {
        expect(args?.p_operation_id).toBe("op-audio-1");
        return { data: { status: "completed" }, error: null };
      }
      if (name === "p85_stage_4b4_enqueue_audio_orphan_cleanup_v1") {
        return { data: { id: "orphan-op-1" }, error: null };
      }
      if (name === "p85_stage_4b4_fail_audio_row_without_object_v1") {
        return { data: { failureCode: "row_without_object" }, error: null };
      }
      return { data: null, error: null };
    });

    const summary = await runStage4B4AudioLifecycleWorkerBatch({
      supabase: { rpc } as never,
      tenantId: DEMO_TENANT_ID,
      storage,
      state: {
        tenant: { id: DEMO_TENANT_ID },
        mediaAssets: [
          {
            id: "asset-voice-1",
            tenantId: DEMO_TENANT_ID,
            clientId: "client-mert",
            conversationId: "conversation-mert",
            messageId: "message-voice-1",
            sanitizedAudioObjectKey: `${DEMO_TENANT_ID}/asset-voice-1/voice.wav`,
            mediaKind: "audio",
            voiceMessage: true,
            status: "analysis_ready",
          },
        ],
      } as never,
    });

    expect(summary.version).toBe(STAGE_4B4_AUDIO_LIFECYCLE_SAGA_VERSION);
    expect(summary.expiryPrepared).toBe(1);
    expect(summary.evidenceRedacted).toBe(1);
    expect(summary.claimed).toBe(1);
    expect(summary.completed).toBe(1);
    expect(rpcCalls).toContain("p85_stage_4b4_claim_audio_lifecycle_work_v1");
    expect(rpcCalls).not.toContain("p85_stage_4b3_claim_media_object_operation_v2");
    expect(rpcCalls).not.toContain("p85_stage_4b3_release_media_object_operation_v2");
    expect(storage.objects.has(`${DEMO_TENANT_ID}/asset-voice-1/voice.wav`)).toBe(false);
  });

  it("enqueues orphan object cleanup and records row-without-object failures", async () => {
    const storage = createInMemoryStage4B4AudioStorage();
    storage.objects.set(`${DEMO_TENANT_ID}/orphan/voice.wav`, {
      bytes: Buffer.from("orphan"),
      contentType: "audio/wav",
    });

    const rpc = vi.fn(async (name: string) => {
      if (name === "p85_stage_4b4_process_due_audio_expiry_batch_v1") {
        return { data: { prepared: 0 }, error: null };
      }
      if (name === "p85_stage_4b4_resume_legal_hold_audio_deletions_v1") {
        return { data: { enqueued: 0 }, error: null };
      }
      if (name === "p85_stage_4b4_redact_stale_audio_transcription_evidence_v1") {
        return { data: { transcriptionsRedacted: 0 }, error: null };
      }
      if (name === "p85_stage_4b4_claim_audio_lifecycle_work_v1") {
        return { data: [], error: null };
      }
      if (name === "p85_stage_4b4_enqueue_audio_orphan_cleanup_v1") {
        return { data: { id: "orphan-op-1" }, error: null };
      }
      if (name === "p85_stage_4b4_fail_audio_row_without_object_v1") {
        return { data: { failureCode: "row_without_object" }, error: null };
      }
      return { data: null, error: null };
    });

    const summary = await runStage4B4AudioLifecycleWorkerBatch({
      supabase: { rpc } as never,
      tenantId: DEMO_TENANT_ID,
      storage,
      state: {
        tenant: { id: DEMO_TENANT_ID },
        mediaAssets: [
          {
            id: "asset-missing-object",
            tenantId: DEMO_TENANT_ID,
            clientId: "client-mert",
            conversationId: "conversation-mert",
            messageId: "message-voice-2",
            sanitizedAudioObjectKey: `${DEMO_TENANT_ID}/asset-missing-object/voice.wav`,
            mediaKind: "audio",
            voiceMessage: true,
            status: "analysis_ready",
          },
        ],
      } as never,
    });

    expect(summary.orphanEnqueued).toBeGreaterThan(0);
    expect(summary.rowWithoutObjectFailures).toBeGreaterThan(0);
    expect(summary.orphanObjectCount).toBeGreaterThan(0);
    expect(summary.orphanRowCount).toBeGreaterThan(0);
  });
});

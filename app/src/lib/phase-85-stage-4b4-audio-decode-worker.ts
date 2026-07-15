import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ } from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_AUDIO_DECODE_WORKER_VERSION = "p85-stage-4b4-audio-decode-worker-v1";
export const STAGE_4B4_DECODE_WORKER_HEAP_MB = 64;
export const STAGE_4B4_DECODE_WORKER_TIMEOUT_MS = 30_000;
export const STAGE_4B4_MAX_DECODE_SAMPLES = STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ * 300;

type WorkerDecodeSuccess = {
  ok: true;
  wavBytes: Buffer;
  durationMs: number;
};

type WorkerDecodeFailure = {
  ok: false;
  failureCode: string;
};

export type WorkerDecodeResult = WorkerDecodeSuccess | WorkerDecodeFailure;

function resolveWorkerEntryPath(): string {
  return join(__dirname, "phase-85-stage-4b4-audio-decode-worker-entry.mjs");
}

export function decodeOggOpusVoiceBytesInWorker(bytes: Buffer): Promise<WorkerDecodeResult> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: WorkerDecodeResult) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    let worker: Worker;
    try {
      worker = new Worker(resolveWorkerEntryPath(), {
        workerData: {
          bytes: new Uint8Array(bytes),
          maxDecodeSamples: STAGE_4B4_MAX_DECODE_SAMPLES,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: STAGE_4B4_DECODE_WORKER_HEAP_MB,
        },
      });
    } catch {
      finish({ ok: false, failureCode: "decode_failed" });
      return;
    }

    const timeoutHandle = setTimeout(() => {
      void worker.terminate();
      finish({ ok: false, failureCode: "decode_failed" });
    }, STAGE_4B4_DECODE_WORKER_TIMEOUT_MS);

    worker.once("message", (message: WorkerDecodeSuccess | WorkerDecodeFailure) => {
      clearTimeout(timeoutHandle);
      void worker.terminate();
      if (!message?.ok) {
        finish({
          ok: false,
          failureCode: message?.failureCode ?? "decode_failed",
        });
        return;
      }
      finish({
        ok: true,
        wavBytes: Buffer.from(message.wavBytes),
        durationMs: message.durationMs,
      });
    });

    worker.once("error", () => {
      clearTimeout(timeoutHandle);
      void worker.terminate();
      finish({ ok: false, failureCode: "decode_failed" });
    });

    worker.once("exit", (code) => {
      if (code !== 0 && !settled) {
        finish({ ok: false, failureCode: "decode_failed" });
      }
    });
  });
}

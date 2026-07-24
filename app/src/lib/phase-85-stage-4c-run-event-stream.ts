import {
  AI_CHAT_SSE_HEARTBEAT_MS,
  AI_CHAT_SSE_WINDOW_MS,
  isNonTerminalAiChatRunStatus,
  type AiChatRunEventDto,
} from "./phase-85-stage-4c-contracts";
import { runEventsToSseChunk } from "./phase-85-stage-4c-run-service";
import {
  subscribeRunEventChannel,
  type RunEventMultiplexerDeps,
} from "./phase-85-stage-4c-run-event-multiplexer";

export const STAGE_4C_RUN_EVENT_STREAM_VERSION = "p85-stage-4c-run-event-stream-v1";

export const SSE_HEARTBEAT_COMMENT = ": heartbeat\n\n";

function isTerminalRunEvent(event: AiChatRunEventDto) {
  return (
    event.eventType === "run.completed" ||
    event.eventType === "run.stopped" ||
    event.eventType === "run.failed" ||
    event.eventType === "response.completed" ||
    event.eventType === "response.stopped"
  );
}

export function createAiChatRunEventSseStream(input: {
  tenantId: string;
  runId: string;
  afterSequence: number;
  signal?: AbortSignal;
  getRunStatus: () => Promise<string | null>;
  deps: RunEventMultiplexerDeps;
}) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  let closed = false;
  let lastHeartbeatAt = Date.now();
  let lastSequence = input.afterSequence;
  let subscription: ReturnType<typeof subscribeRunEventChannel> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let terminalSeen = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueueEvent = (event: AiChatRunEventDto) => {
        if (closed || event.sequenceNumber <= lastSequence) return;
        lastSequence = event.sequenceNumber;
        controller.enqueue(encoder.encode(runEventsToSseChunk(event)));
        if (isTerminalRunEvent(event)) {
          terminalSeen = true;
        }
      };

      const closeStream = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        subscription?.unsubscribe();
        subscription = null;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const onAbort = () => closeStream();
      input.signal?.addEventListener("abort", onAbort, { once: true });

      subscription = subscribeRunEventChannel({
        tenantId: input.tenantId,
        runId: input.runId,
        deps: input.deps,
        subscriber: {
          id: crypto.randomUUID(),
          afterSequence: input.afterSequence,
          onEvent: enqueueEvent,
          signal: input.signal,
        },
      });

      await subscription.catchUp();

      pollTimer = setInterval(() => {
        if (closed) return;
        if (Date.now() - lastHeartbeatAt >= AI_CHAT_SSE_HEARTBEAT_MS) {
          controller.enqueue(encoder.encode(SSE_HEARTBEAT_COMMENT));
          lastHeartbeatAt = Date.now();
        }
        void input.getRunStatus().then((status) => {
          if (!status || !isNonTerminalAiChatRunStatus(status as never)) {
            terminalSeen = true;
          }
        });
        if (
          input.signal?.aborted ||
          Date.now() - startedAt >= AI_CHAT_SSE_WINDOW_MS ||
          terminalSeen
        ) {
          closeStream();
        }
      }, 250);
    },
    cancel() {
      closed = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      subscription?.unsubscribe();
      subscription = null;
    },
  });

  return stream;
}

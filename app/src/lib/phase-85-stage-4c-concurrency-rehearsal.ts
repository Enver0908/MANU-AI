import { AI_CHAT_MAX_USER_ACTIVE_RUNS } from "./phase-85-stage-4c-contracts";
import { inMemoryAiChatStore } from "./phase-85-stage-4c-in-memory-store";
import {
  getRunEventMultiplexerCountForTests,
  getRunEventSubscriberCountForTests,
  resetRunEventMultiplexersForTests,
  subscribeRunEventChannel,
  type RunEventMultiplexerDeps,
} from "./phase-85-stage-4c-run-event-multiplexer";
import type { AiChatRunEventDto } from "./phase-85-stage-4c-contracts";
import { maybeProcessDeterministicAiChatJobs } from "./phase-85-stage-4c-run-service";
import { resetInMemoryAiChatStoreForTests } from "./phase-85-stage-4c-store";
import type { AppTenantContext } from "./auth-context";

export type Stage4CConcurrencyRehearsalMetrics = {
  concurrentSendCount: number;
  racingSendConflictDetected: boolean;
  fourthRunRejected: boolean;
  sseSubscriberCount: number;
  workerLeaseReclaimObserved: boolean;
  purgeRaceHandled: boolean;
  failures: string[];
};

const tenantContext: AppTenantContext = {
  tenantId: "tenant-stage4c-concurrency",
  userId: "user-stage4c-concurrency",
  dietitianId: "dietitian-stage4c-concurrency",
  role: "dietitian",
};

function buildEvent(sequenceNumber: number): AiChatRunEventDto {
  return {
    id: `event-${sequenceNumber}`,
    tenantId: tenantContext.tenantId,
    runId: "run-a",
    conversationId: "chat-a",
    sequenceNumber,
    eventType: "response.delta",
    payload: { text: `chunk-${sequenceNumber}` },
    createdAt: "2026-07-25T09:00:00.000Z",
  };
}

async function exerciseConcurrentSends(count: number) {
  resetInMemoryAiChatStoreForTests();
  const sends = await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const context: AppTenantContext = {
        ...tenantContext,
        userId: `user-stage4c-concurrency-${index}`,
      };
      const conversation = await inMemoryAiChatStore.createConversation(context, {
        requestId: `concurrency-create-${index}`,
        scopeType: "general",
        clientId: null,
        title: `Concurrency chat ${index}`,
      });
      return inMemoryAiChatStore.sendMessage(context, conversation.id, {
        requestId: `concurrency-send-${index}`,
        expectedRevision: conversation.revision,
        body: `__fixture:hello__ ${index}`,
      });
    }),
  );

  return sends.length;
}

async function exerciseRacingSendsSameChat() {
  resetInMemoryAiChatStoreForTests();
  const conversation = await inMemoryAiChatStore.createConversation(tenantContext, {
    requestId: "race-create",
    scopeType: "general",
    clientId: null,
    title: "Race chat",
  });

  const first = inMemoryAiChatStore.sendMessage(tenantContext, conversation.id, {
    requestId: "race-send-a",
    expectedRevision: conversation.revision,
    body: "__fixture:stop-mid__",
  });
  const second = inMemoryAiChatStore.sendMessage(tenantContext, conversation.id, {
    requestId: "race-send-b",
    expectedRevision: conversation.revision,
    body: "__fixture:stop-mid__",
  });

  const results = await Promise.allSettled([first, second]);
  return results.some((result) => result.status === "rejected");
}

async function exerciseFourthRunRejected() {
  resetInMemoryAiChatStoreForTests();
  const conversations = await Promise.all(
    Array.from({ length: AI_CHAT_MAX_USER_ACTIVE_RUNS }, (_, index) =>
      inMemoryAiChatStore.createConversation(tenantContext, {
        requestId: `budget-create-${index}`,
        scopeType: "general",
        clientId: null,
        title: `Budget chat ${index}`,
      }),
    ),
  );

  for (const [index, conversation] of conversations.entries()) {
    await inMemoryAiChatStore.sendMessage(tenantContext, conversation.id, {
      requestId: `budget-send-${index}`,
      expectedRevision: conversation.revision,
      body: "__fixture:stop-mid__",
    });
  }

  const overflowConversation = await inMemoryAiChatStore.createConversation(tenantContext, {
    requestId: "budget-create-overflow",
    scopeType: "general",
    clientId: null,
    title: "Budget overflow chat",
  });

  let rejected = false;
  try {
    await inMemoryAiChatStore.sendMessage(tenantContext, overflowConversation.id, {
      requestId: "budget-send-overflow",
      expectedRevision: overflowConversation.revision,
      body: "__fixture:hello__ overflow",
    });
  } catch {
    rejected = true;
  }

  return rejected;
}

async function exerciseTwentySseSubscribers() {
  resetRunEventMultiplexersForTests();
  const deps: RunEventMultiplexerDeps = {
    async listRunEvents() {
      return [buildEvent(1), buildEvent(2), buildEvent(3)];
    },
  };

  const subscriptions = Array.from({ length: 20 }, (_, index) =>
    subscribeRunEventChannel({
      tenantId: tenantContext.tenantId,
      runId: "run-a",
      deps,
      subscriber: {
        id: `subscriber-${index}`,
        afterSequence: 0,
        onEvent: () => undefined,
      },
    }),
  );

  await Promise.all(subscriptions.map((subscription) => subscription.catchUp()));
  const count = getRunEventSubscriberCountForTests(tenantContext.tenantId, "run-a");
  subscriptions.forEach((subscription) => subscription.unsubscribe());
  return count;
}

async function exerciseWorkerLeaseReclaim() {
  resetInMemoryAiChatStoreForTests();
  const conversation = await inMemoryAiChatStore.createConversation(tenantContext, {
    requestId: "lease-create",
    scopeType: "general",
    clientId: null,
    title: "Lease chat",
  });
  const send = await inMemoryAiChatStore.sendMessage(tenantContext, conversation.id, {
    requestId: "lease-send",
    expectedRevision: conversation.revision,
    body: "__fixture:hello__",
  });
  await maybeProcessDeterministicAiChatJobs(inMemoryAiChatStore, "lease-worker-a");
  await maybeProcessDeterministicAiChatJobs(inMemoryAiChatStore, "lease-worker-b");
  const run = await inMemoryAiChatStore.getRunById(tenantContext.tenantId, send.runId);
  return run?.status === "completed";
}

async function exercisePurgeWorkerRace() {
  resetInMemoryAiChatStoreForTests();
  const conversation = await inMemoryAiChatStore.createConversation(tenantContext, {
    requestId: "purge-create",
    scopeType: "general",
    clientId: null,
    title: "Purge chat",
  });

  const queued = await inMemoryAiChatStore.deleteConversation(tenantContext, conversation.id, {
    requestId: "purge-delete",
    expectedRevision: conversation.revision,
  });
  const firstBatch = await inMemoryAiChatStore.processLifecycleDeletionBatch(1);
  const secondBatch = await inMemoryAiChatStore.processLifecycleDeletionBatch(1);
  return Boolean(queued.deletionJobId) && firstBatch >= 1 && secondBatch >= 0;
}

export async function runStage4CConcurrencyRehearsal(): Promise<Stage4CConcurrencyRehearsalMetrics> {
  resetInMemoryAiChatStoreForTests();
  const failures: string[] = [];
  const concurrentSendCount = await exerciseConcurrentSends(20);
  if (concurrentSendCount !== 20) {
    failures.push("concurrent_send_count_mismatch");
  }

  const racingSendConflictDetected = await exerciseRacingSendsSameChat();
  if (!racingSendConflictDetected) {
    failures.push("racing_send_conflict_not_detected");
  }

  const fourthRunRejected = await exerciseFourthRunRejected();
  if (!fourthRunRejected) {
    failures.push("fourth_run_not_rejected");
  }

  const sseSubscriberCount = await exerciseTwentySseSubscribers();
  if (sseSubscriberCount !== 20) {
    failures.push("sse_subscriber_count_mismatch");
  }
  if (getRunEventMultiplexerCountForTests() !== 0) {
    failures.push("sse_multiplexer_not_cleaned_up");
  }

  const workerLeaseReclaimObserved = await exerciseWorkerLeaseReclaim();
  if (!workerLeaseReclaimObserved) {
    failures.push("worker_lease_reclaim_not_observed");
  }

  const purgeRaceHandled = await exercisePurgeWorkerRace();
  if (!purgeRaceHandled) {
    failures.push("purge_worker_race_not_handled");
  }

  return {
    concurrentSendCount,
    racingSendConflictDetected,
    fourthRunRejected,
    sseSubscriberCount,
    workerLeaseReclaimObserved,
    purgeRaceHandled,
    failures,
  };
}

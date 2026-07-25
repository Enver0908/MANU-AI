import { performance } from "node:perf_hooks";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  STAGE_4C_SCALE_REHEARSAL_TARGETS,
  type Stage4CScaleRehearsalMetrics,
} from "./phase-85-stage-4c-closure";

export const STAGE_4C_POSTGRES_SCALE_VERSION = "p85-stage-4c-postgres-scale-v1";

export const STAGE_4C_SCALE_EXPLAIN_PROFILES = [
  "history_list",
  "conversation_load",
  "branch_chain",
  "run_event_catch_up",
  "context_gateway_access",
  "source_search",
  "job_claim",
  "deletion_claim",
] as const;

export type Stage4CScaleExplainProfile = (typeof STAGE_4C_SCALE_EXPLAIN_PROFILES)[number];

export type Stage4CScaleFixtureSeed = {
  tenantId: string;
  userId: string;
  dietitianCount: number;
  clientCount: number;
  chatCount: number;
  messageVersionCount: number;
  sampleConversationId: string;
  sampleBranchId: string;
  sampleRunId: string;
  sampleDietitianId: string;
  sampleClientId: string;
};

export type Stage4CScaleExplainResult = {
  profile: Stage4CScaleExplainProfile;
  usesLeadingTenantIndex: boolean;
  failures: string[];
};

export type Stage4CPostgresScaleRehearsalResult = {
  status: "pass" | "fail" | "blocked";
  reason: string;
  fixture: Stage4CScaleFixtureSeed | null;
  scaleRehearsal: Stage4CScaleRehearsalMetrics;
  explainResults: Stage4CScaleExplainResult[];
  failures: string[];
};

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

export function isStage4CLocalSupabaseConfigured() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isLocal =
    supabaseUrl?.startsWith("http://127.0.0.1:") || supabaseUrl?.startsWith("http://localhost:");
  return Boolean(supabaseUrl && serviceRoleKey && isLocal);
}

export function createStage4CServiceRoleClient(): SupabaseClient | null {
  if (!isStage4CLocalSupabaseConfigured()) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function planUsesIndex(planJson: unknown, indexName: string) {
  const serialized = JSON.stringify(planJson ?? {});
  return serialized.includes(indexName);
}

export function evaluateStage4CExplainPlan(
  profile: Stage4CScaleExplainProfile,
  planJson: unknown,
): Stage4CScaleExplainResult {
  const failures: string[] = [];
  const serialized = JSON.stringify(planJson ?? {});
  if (!serialized.includes("Index") && !serialized.includes("Bitmap")) {
    failures.push(`${profile}_missing_index_scan`);
  }

  let usesLeadingTenantIndex = serialized.includes("tenant_id");
  if (profile === "history_list" && !planUsesIndex(planJson, "ai_chat_conversations_history_idx")) {
    failures.push("history_list_missing_history_idx");
    usesLeadingTenantIndex = false;
  }
  if (profile === "branch_chain" && !planUsesIndex(planJson, "ai_chat_message_versions_branch_order_idx")) {
    failures.push("branch_chain_missing_branch_order_idx");
    usesLeadingTenantIndex = false;
  }
  if (
    profile === "context_gateway_access" &&
    !planUsesIndex(planJson, "clients_tenant_lifecycle_status_idx")
  ) {
    failures.push("context_gateway_missing_bounded_client_idx");
    usesLeadingTenantIndex = false;
  }

  return {
    profile,
    usesLeadingTenantIndex,
    failures,
  };
}

async function measureRpcDuration(
  client: SupabaseClient,
  rpc: string,
  args: Record<string, unknown>,
  iterations = 24,
) {
  const durations: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    const { error } = await client.rpc(rpc, args);
    if (error) throw new Error(`${rpc}:${error.message}`);
    durations.push(performance.now() - started);
  }
  return percentile(durations, 0.95);
}

async function runExplainProfiles(client: SupabaseClient, fixture: Stage4CScaleFixtureSeed) {
  const explainResults: Stage4CScaleExplainResult[] = [];
  for (const profile of STAGE_4C_SCALE_EXPLAIN_PROFILES) {
    const { data, error } = await client.rpc("p85_stage_4c_scale_explain_profile_v1", {
      p_profile: profile,
      p_tenant_id: fixture.tenantId,
      p_user_id: fixture.userId,
      p_dietitian_id: fixture.sampleDietitianId,
      p_conversation_id: fixture.sampleConversationId,
      p_branch_id: fixture.sampleBranchId,
      p_client_id: fixture.sampleClientId,
    });
    if (error) {
      explainResults.push({
        profile,
        usesLeadingTenantIndex: false,
        failures: [`${profile}_explain_failed:${error.message}`],
      });
      continue;
    }
    explainResults.push(evaluateStage4CExplainPlan(profile, (data as { plan?: unknown })?.plan));
  }
  return explainResults;
}

function buildScaleMetrics(input: {
  fixture: Stage4CScaleFixtureSeed;
  historyListP95Ms: number;
  conversationLoadP95Ms: number;
  runEventCatchUpP95Ms: number;
  sendTransactionP95Ms: number;
  contextToolP95Ms: number;
  boundedRetrievalP95Ms: number;
  failures: string[];
}): Stage4CScaleRehearsalMetrics {
  const metrics: Stage4CScaleRehearsalMetrics = {
    dietitianCount: input.fixture.dietitianCount,
    clientCount: input.fixture.clientCount,
    chatCount: input.fixture.chatCount,
    messageVersionCount: input.fixture.messageVersionCount,
    historyListP95Ms: input.historyListP95Ms,
    conversationLoadP95Ms: input.conversationLoadP95Ms,
    runEventCatchUpP95Ms: input.runEventCatchUpP95Ms,
    sendTransactionP95Ms: input.sendTransactionP95Ms,
    contextToolP95Ms: input.contextToolP95Ms,
    boundedRetrievalP95Ms: input.boundedRetrievalP95Ms,
    branchDetailP95Ms: input.conversationLoadP95Ms,
    contextRetrievalP95Ms: input.boundedRetrievalP95Ms,
    sseFirstDeltaP95Ms: input.runEventCatchUpP95Ms,
    stopUiReflectionP95Ms: input.sendTransactionP95Ms,
    latencyTargetsMet: false,
    failures: [...input.failures],
  };

  if (metrics.historyListP95Ms > STAGE_4C_SCALE_REHEARSAL_TARGETS.historyListP95Ms) {
    metrics.failures.push("history_list_p95_exceeded");
  }
  if (metrics.conversationLoadP95Ms > STAGE_4C_SCALE_REHEARSAL_TARGETS.conversationLoadP95Ms) {
    metrics.failures.push("conversation_load_p95_exceeded");
  }
  if (metrics.runEventCatchUpP95Ms > STAGE_4C_SCALE_REHEARSAL_TARGETS.runEventCatchUpP95Ms) {
    metrics.failures.push("run_event_catch_up_p95_exceeded");
  }
  if (metrics.sendTransactionP95Ms > STAGE_4C_SCALE_REHEARSAL_TARGETS.sendTransactionP95Ms) {
    metrics.failures.push("send_transaction_p95_exceeded");
  }
  if (metrics.contextToolP95Ms > STAGE_4C_SCALE_REHEARSAL_TARGETS.contextToolP95Ms) {
    metrics.failures.push("context_tool_p95_exceeded");
  }
  if (metrics.boundedRetrievalP95Ms > STAGE_4C_SCALE_REHEARSAL_TARGETS.boundedRetrievalP95Ms) {
    metrics.failures.push("bounded_retrieval_p95_exceeded");
  }

  metrics.latencyTargetsMet = metrics.failures.length === 0;
  return metrics;
}

export async function runStage4CPostgresScaleRehearsalFull(): Promise<Stage4CPostgresScaleRehearsalResult> {
  const client = createStage4CServiceRoleClient();
  if (!client) {
    return {
      status: "blocked",
      reason: "local_supabase_unavailable",
      fixture: null,
      scaleRehearsal: {
        dietitianCount: 0,
        clientCount: 0,
        chatCount: 0,
        messageVersionCount: 0,
        historyListP95Ms: 0,
        conversationLoadP95Ms: 0,
        runEventCatchUpP95Ms: 0,
        sendTransactionP95Ms: 0,
        contextToolP95Ms: 0,
        boundedRetrievalP95Ms: 0,
        branchDetailP95Ms: 0,
        contextRetrievalP95Ms: 0,
        sseFirstDeltaP95Ms: 0,
        stopUiReflectionP95Ms: 0,
        latencyTargetsMet: false,
        failures: ["local_supabase_unavailable"],
      },
      explainResults: [],
      failures: ["local_supabase_unavailable"],
    };
  }

  const failures: string[] = [];
  let fixture: Stage4CScaleFixtureSeed | null = null;
  try {
    const { data: seedData, error: seedError } = await client.rpc("p85_stage_4c_scale_fixture_seed_v1");
    if (seedError) throw new Error(seedError.message);
    fixture = seedData as Stage4CScaleFixtureSeed;

    if (fixture.dietitianCount !== STAGE_4C_SCALE_REHEARSAL_TARGETS.dietitians) {
      failures.push("fixture_dietitian_count_mismatch");
    }
    if (fixture.clientCount !== STAGE_4C_SCALE_REHEARSAL_TARGETS.clients) {
      failures.push("fixture_client_count_mismatch");
    }
    if (fixture.chatCount !== STAGE_4C_SCALE_REHEARSAL_TARGETS.chats) {
      failures.push("fixture_chat_count_mismatch");
    }
    if (fixture.messageVersionCount !== STAGE_4C_SCALE_REHEARSAL_TARGETS.messageVersions) {
      failures.push("fixture_message_version_count_mismatch");
    }

    const historyListP95Ms = await measureRpcDuration(client, "p85_stage_4c_list_conversations_v1", {
      p_tenant_id: fixture.tenantId,
      p_user_id: fixture.userId,
      p_dietitian_id: fixture.sampleDietitianId,
      p_role: "owner",
      p_scope_filter: "all",
      p_query: "",
      p_cursor_last_message_at: null,
      p_cursor_id: null,
      p_limit: 30,
    });

    const conversationLoadP95Ms = await measureRpcDuration(client, "p85_stage_4c_load_conversation_v1", {
      p_tenant_id: fixture.tenantId,
      p_user_id: fixture.userId,
      p_dietitian_id: fixture.sampleDietitianId,
      p_role: "owner",
      p_chat_id: fixture.sampleConversationId,
      p_message_limit: 50,
    });

    const runEventCatchUpP95Ms = await measureRpcDuration(client, "p85_stage_4c_catch_up_run_events_v1", {
      p_tenant_id: fixture.tenantId,
      p_user_id: fixture.userId,
      p_dietitian_id: fixture.sampleDietitianId,
      p_role: "owner",
      p_run_id: fixture.sampleRunId,
      p_after_sequence: 0,
      p_limit: 200,
    });

    const sendDurations: number[] = [];
    let expectedRevision = 1;
    for (let index = 0; index < 8; index += 1) {
      const started = performance.now();
      const { data, error } = await client.rpc("p85_stage_4c_send_message_v1", {
        p_tenant_id: fixture.tenantId,
        p_user_id: fixture.userId,
        p_dietitian_id: fixture.sampleDietitianId,
        p_role: "owner",
        p_chat_id: fixture.sampleConversationId,
        p_request_id: `scale-send-${index}-${Date.now()}`,
        p_expected_revision: expectedRevision,
        p_body: `__fixture:hello__ ${index}`,
        p_branch_id: fixture.sampleBranchId,
        p_body_hash: `scale-body-hash-${index}`,
        p_attachment_ids: [],
      });
      if (error) throw new Error(`p85_stage_4c_send_message_v1:${error.message}`);
      const row = (data ?? {}) as Record<string, unknown>;
      const runId = String(row.run_id ?? row.runId ?? "");
      expectedRevision = Number(row.conversation_revision ?? row.conversationRevision ?? expectedRevision + 1);
      if (!runId) throw new Error("p85_stage_4c_send_message_v1:missing_run_id");
      const finalize = await client.rpc("p85_stage_4c_finalize_run_v1", {
        p_tenant_id: fixture.tenantId,
        p_run_id: runId,
        p_status: "completed",
        p_answerability: "answerable",
        p_risk_level: "green",
        p_error_code: null,
      });
      if (finalize.error) throw new Error(`p85_stage_4c_finalize_run_v1:${finalize.error.message}`);
      sendDurations.push(performance.now() - started);
    }
    const sendTransactionP95Ms = percentile(sendDurations, 0.95);

    const contextToolP95Ms = await measureRpcDuration(client, "p85_stage_4c_execute_context_tool_v1", {
      p_tenant_id: fixture.tenantId,
      p_client_id: fixture.sampleClientId,
      p_tool_name: "load_client_profile",
      p_args: {},
    });

    const boundedRetrievalP95Ms = await measureRpcDuration(client, "p85_stage_4c_get_context_gateway_access_v1", {
      p_tenant_id: fixture.tenantId,
      p_user_id: fixture.userId,
      p_dietitian_id: fixture.sampleDietitianId,
      p_role: "owner",
      p_scope_type: "client",
      p_client_id: fixture.sampleClientId,
      p_conversation_revision: 1,
    });

    const explainResults = await runExplainProfiles(client, fixture);
    failures.push(...explainResults.flatMap((result) => result.failures));

    const scaleRehearsal = buildScaleMetrics({
      fixture,
      historyListP95Ms,
      conversationLoadP95Ms,
      runEventCatchUpP95Ms,
      sendTransactionP95Ms,
      contextToolP95Ms,
      boundedRetrievalP95Ms,
      failures,
    });

    return {
      status: scaleRehearsal.failures.length === 0 ? "pass" : "fail",
      reason: scaleRehearsal.failures.length === 0 ? "completed" : "scale_threshold_or_explain_failed",
      fixture,
      scaleRehearsal,
      explainResults,
      failures: scaleRehearsal.failures,
    };
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "postgres_scale_unknown_error");
    return {
      status: "fail",
      reason: "postgres_scale_failed",
      fixture,
      scaleRehearsal: buildScaleMetrics({
        fixture: fixture ?? {
          tenantId: "",
          userId: "",
          dietitianCount: 0,
          clientCount: 0,
          chatCount: 0,
          messageVersionCount: 0,
          sampleConversationId: "",
          sampleBranchId: "",
          sampleRunId: "",
          sampleDietitianId: "",
          sampleClientId: "",
        },
        historyListP95Ms: Number.POSITIVE_INFINITY,
        conversationLoadP95Ms: Number.POSITIVE_INFINITY,
        runEventCatchUpP95Ms: Number.POSITIVE_INFINITY,
        sendTransactionP95Ms: Number.POSITIVE_INFINITY,
        contextToolP95Ms: Number.POSITIVE_INFINITY,
        boundedRetrievalP95Ms: Number.POSITIVE_INFINITY,
        failures,
      }),
      explainResults: [],
      failures,
    };
  } finally {
    if (client) {
      await client.rpc("p85_stage_4c_scale_fixture_cleanup_v1");
    }
  }
}

export async function runStage4CPostgresScaleRehearsalSample(): Promise<Stage4CPostgresScaleRehearsalResult> {
  if (process.env.STAGE_4C_FULL_REHEARSAL === "1") {
    return runStage4CPostgresScaleRehearsalFull();
  }

  return {
    status: "blocked",
    reason: "full_postgres_rehearsal_required",
    fixture: null,
    scaleRehearsal: {
      dietitianCount: 0,
      clientCount: 0,
      chatCount: 0,
      messageVersionCount: 0,
      historyListP95Ms: Number.POSITIVE_INFINITY,
      conversationLoadP95Ms: Number.POSITIVE_INFINITY,
      runEventCatchUpP95Ms: Number.POSITIVE_INFINITY,
      sendTransactionP95Ms: Number.POSITIVE_INFINITY,
      contextToolP95Ms: Number.POSITIVE_INFINITY,
      boundedRetrievalP95Ms: Number.POSITIVE_INFINITY,
      branchDetailP95Ms: Number.POSITIVE_INFINITY,
      contextRetrievalP95Ms: Number.POSITIVE_INFINITY,
      sseFirstDeltaP95Ms: Number.POSITIVE_INFINITY,
      stopUiReflectionP95Ms: Number.POSITIVE_INFINITY,
      latencyTargetsMet: false,
      failures: ["full_postgres_rehearsal_required"],
    },
    explainResults: [],
    failures: ["full_postgres_rehearsal_required"],
  };
}

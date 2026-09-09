export const REQUIRED_RPC_PROBES = [
  {
    name: "p85_stage_5_record_session_activity_v3",
    signature: "p85_stage_5_record_session_activity_v3(text, uuid, uuid, uuid, uuid)",
    body: { p_mode: "assert", p_session_id: null, p_auth_user_id: null, p_tenant_id: null, p_dietitian_id: null },
    service: { error: "session_claim_missing" },
    anonymous: { status: 401, error: "permission denied" },
  },
  {
    name: "p85_stage_5_record_session_activity_v2",
    signature: "p85_stage_5_record_session_activity_v2(text)",
    body: { p_mode: "assert" },
    service: { error: "session_claim_missing" },
    anonymous: { status: 401, error: "permission denied" },
  },
  {
    name: "p85_stage_5_assert_session_activity_v1",
    signature: "p85_stage_5_assert_session_activity_v1()",
    body: {},
    service: { error: "session_claim_missing" },
    anonymous: { status: 401, error: "permission denied" },
  },
  {
    name: "p85_stage_5_touch_session_activity_v1",
    signature: "p85_stage_5_touch_session_activity_v1()",
    body: {},
    service: { error: "session_claim_missing" },
    anonymous: { status: 401, error: "permission denied" },
  },
  {
    name: "p85_stage_5_require_active_session_v2",
    signature: "p85_stage_5_require_active_session_v2()",
    body: {},
    service: { error: "session_claim_missing" },
    anonymous: { status: 401, error: "permission denied" },
  },
  {
    name: "p85_stage_5_session_inactivity_window",
    signature: "p85_stage_5_session_inactivity_window()",
    body: {},
    service: { status: 200 },
    anonymous: { status: 401, error: "permission denied" },
  },
  {
    name: "p85_stage_5_load_shell_bootstrap_v1",
    signature: "p85_stage_5_load_shell_bootstrap_v1(uuid)",
    body: { p_active_client_id: null },
    service: { error: "session_claim_missing" },
    anonymous: { status: 401, error: "permission denied" },
  },
  {
    name: "p85_stage_5_search_shell_clients_v1",
    signature: "p85_stage_5_search_shell_clients_v1(text, uuid, integer)",
    body: { p_query: "__phase2_probe_no_match__", p_limit: 1 },
    service: { error: "session_claim_missing" },
    anonymous: { status: 401, error: "permission denied" },
  },
  {
    name: "apply_manual_entitlement_operation",
    signature: "apply_manual_entitlement_operation(text, uuid, text, timestamptz, text, text, integer, text)",
    body: { p_action: null, p_invite_id: null, p_payment_reference: null, p_paid_through: null, p_request_id: null, p_request_hash: null, p_expected_revision: null, p_actor_summary: null },
    service: { error: "payment_reference_invalid" },
    anonymous: { status: 401, error: "permission denied" },
  },
  {
    name: "commercial_admin_list_customers_v1",
    signature: "commercial_admin_list_customers_v1(text, integer)",
    body: { p_email_filter: "__phase2_probe_no_match__", p_limit: 1 },
    service: { status: 200, array: true },
    anonymous: { status: 401, error: "permission denied" },
  },
  {
    name: "commercial_admin_invite_customer_v1",
    signature: "commercial_admin_invite_customer_v1(text, text, timestamptz, timestamptz, text, uuid)",
    body: { p_normalized_email: "", p_tenant_name: null, p_paid_through: null, p_expires_at: null, p_actor_summary: null, p_auth_user_id: null },
    service: { error: "email_invalid" },
    anonymous: { status: 401, error: "permission denied" },
  },
  {
    name: "enqueue_whatsapp_real_ingress_job",
    signature: "enqueue_whatsapp_real_ingress_job(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, timestamptz, timestamptz)",
    body: { p_account_binding_id: null, p_tenant_id: null, p_event_kind: null, p_provider_account_id: null, p_provider_event_id: null, p_provider_message_id: null, p_from_identity: null, p_to_identity: null, p_counterparty_identity: null, p_payload_digest: null, p_payload_ciphertext: null, p_payload_iv: null, p_payload_auth_tag: null, p_payload_aad: null, p_key_version: null, p_payload_schema_version: null, p_provider_time: null, p_observed_at: null },
    service: { status: 200 },
    anonymous: { status: 401, error: "permission denied" },
  },
];

function requiredEnv(env, key) {
  const value = String(env[key] ?? "").trim();
  if (!value) throw new Error(key + " is required for hosted schema verification");
  return value;
}

function observedResponse(response, payload) {
  return {
    status: response.status,
    code: payload?.code ?? null,
    message: String(payload?.message ?? ""),
    isArray: Array.isArray(payload),
  };
}

function evaluateExpectation(observed, expected) {
  const statusPass = expected.status === undefined || observed.status === expected.status;
  const arrayPass = expected.array === undefined || observed.isArray === expected.array;
  const errorPass = expected.error === undefined || observed.message.includes(expected.error);
  return statusPass && arrayPass && errorPass;
}

function publicProbeResult(expected, observed) {
  return {
    expectedStatus: expected.status ?? null,
    expectedError: expected.error ?? null,
    expectedArray: expected.array ?? null,
    observedStatus: observed?.status ?? null,
    observedCode: observed?.code ?? null,
    observedArray: observed?.isArray ?? null,
    status: observed && evaluateExpectation(observed, expected) ? "PASS" : "FAIL",
  };
}

async function callProbe(fetchImpl, baseUrl, key, probe) {
  const response = await fetchImpl(`${baseUrl}/rest/v1/rpc/${probe.name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(probe.body),
  });
  const payload = await response.json().catch(() => ({}));
  return observedResponse(response, payload);
}

export async function verifyHostedSupabaseSchemaContract(options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const supabaseUrl = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const anonymousKey = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const matrix = [];

  for (const probe of REQUIRED_RPC_PROBES) {
    let serviceObserved = null;
    let anonymousObserved = null;
    let serviceFailure = null;
    let anonymousFailure = null;
    try {
      serviceObserved = await callProbe(fetchImpl, supabaseUrl, serviceRoleKey, probe);
    } catch {
      serviceFailure = "request_failed";
    }
    try {
      anonymousObserved = await callProbe(fetchImpl, supabaseUrl, anonymousKey, probe);
    } catch {
      anonymousFailure = "request_failed";
    }
    const service = serviceFailure
      ? { status: "FAIL", reason: serviceFailure }
      : publicProbeResult(probe.service, serviceObserved);
    const anonymous = anonymousFailure
      ? { status: "FAIL", reason: anonymousFailure }
      : publicProbeResult(probe.anonymous, anonymousObserved);
    matrix.push({ name: probe.name, signature: probe.signature, service, anonymous });
  }

  const failures = matrix
    .filter((item) => item.service.status !== "PASS" || item.anonymous.status !== "PASS")
    .map((item) => item.name);
  if (failures.length) {
    throw new Error(`hosted Supabase schema contract missing ${failures.join(",")}: contract_probe_failed`);
  }
  return { status: "PASS", checked: REQUIRED_RPC_PROBES.map((probe) => probe.name), matrix };
}

const REQUIRED_RPC_PROBES = [
  {
    name: "p85_stage_5_record_session_activity_v3",
    body: {
      p_mode: "assert",
      p_session_id: null,
      p_auth_user_id: null,
      p_tenant_id: null,
      p_dietitian_id: null,
    },
    expectedError: "session_claim_missing",
  },
];

function requiredEnv(env, key) {
  const value = String(env[key] ?? "").trim();
  if (!value) throw new Error(key + " is required for hosted schema verification");
  return value;
}

export async function verifyHostedSupabaseSchemaContract(options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const supabaseUrl = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  for (const probe of REQUIRED_RPC_PROBES) {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/${probe.name}`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(probe.body),
    });
    const payload = await response.json().catch(() => ({}));
    const message = String(payload?.message ?? "");
    if (!message.includes(probe.expectedError)) {
      const code = String(payload?.code ?? `http_${response.status}`);
      throw new Error(`hosted Supabase schema contract missing ${probe.name}: ${code}`);
    }
  }

  return { checked: REQUIRED_RPC_PROBES.map((probe) => probe.name) };
}

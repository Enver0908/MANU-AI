export function parsePostgresUrl(databaseUrl) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("database_url_invalid");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("database_url_protocol_invalid");
  }
  const database = url.pathname.replace(/^\//, "");
  if (!url.hostname || !database || !url.username) {
    throw new Error("database_url_incomplete");
  }
  return {
    host: url.hostname,
    port: url.port || "5432",
    database,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

export function extractSupabaseProjectRef(databaseUrl) {
  const parsed = parsePostgresUrl(databaseUrl);
  const match = parsed.host.match(/^db\.([^.]+)\.supabase\.co$/i);
  return match?.[1] ?? null;
}

export function isLocalDatabaseUrl(databaseUrl) {
  const parsed = parsePostgresUrl(databaseUrl);
  const host = parsed.host.toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

export function resolveProjectRef(databaseUrl, env = process.env) {
  const hostedRef = extractSupabaseProjectRef(databaseUrl);
  if (hostedRef) return hostedRef;
  if (isLocalDatabaseUrl(databaseUrl)) return env.MANU_HOSTED_SANDBOX_PROJECT_REF || "local-dev";
  throw new Error("project_ref_unresolved");
}

export function buildPostgresChildEnv(databaseUrl, baseEnv = process.env) {
  const parsed = parsePostgresUrl(databaseUrl);
  const childEnv = removeDatabaseUrlEnv(baseEnv);
  childEnv.PGHOST = parsed.host;
  childEnv.PGPORT = parsed.port;
  childEnv.PGDATABASE = parsed.database;
  childEnv.PGUSER = parsed.user;
  childEnv.PGPASSWORD = parsed.password;
  return { childEnv, database: parsed.database };
}

export function removeDatabaseUrlEnv(baseEnv = process.env) {
  const childEnv = { ...baseEnv };
  delete childEnv.DATABASE_URL;
  delete childEnv.SUPABASE_DB_URL;
  delete childEnv.MANU_HOSTED_SANDBOX_DATABASE_URL;
  delete childEnv.MANU_HOSTED_SANDBOX_RESTORE_DATABASE_URL;
  delete childEnv.PGPASSWORD;
  return childEnv;
}

export function sanitizeProcessOutput(output) {
  return String(output ?? "")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-postgres-url]")
    .replace(/PGPASSWORD=\S+/gi, "PGPASSWORD=[redacted]")
    .trim();
}

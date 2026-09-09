import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AUDIT_PLAN_ID, AUDIT_PLAN_VERSION, PHASE_2_ID, PHASE_2_STAGES } from "./phase-2-plan.mjs";

export const STAGE_STATUSES = ["LOCKED", "IN_PROGRESS", "VERIFIED", "BLOCKED"];
export const PHASE_STATUSES = ["OPEN", "BLOCKED", "CLOSED"];

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function stableDigest(value) {
  return sha256Text(JSON.stringify(value));
}

export function writeJson(filePath, value, writeFileSyncImpl) {
  const writer = writeFileSyncImpl ?? ((target, contents) => {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents, "utf8");
  });
  writer(filePath, JSON.stringify(value, null, 2) + "\n");
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function parseMigrationListOutput(output) {
  const entries = [];
  for (const line of String(output ?? "").split(/\r?\n/)) {
    const match = line.match(/^\s*(\d{14})\s*\|\s*(\d{14})?\s*\|/);
    if (!match) continue;
    entries.push({ local: match[1], remote: match[2] || null });
  }
  return entries;
}

export function listLocalMigrations(migrationsDir) {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => {
      const match = name.match(/^(\d{14})_(.+)\.sql$/);
      if (!match) return { name, id: null, title: null };
      return { name, id: match[1], title: match[2] };
    });
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function normalizePgIdentifier(value) {
  return String(value ?? "").slice(0, 63);
}

function splitSqlArguments(args) {
  const parts = [];
  let current = "";
  let depth = 0;
  for (const character of String(args ?? "")) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function normalizeSqlType(value) {
  return String(value ?? "")
    .replace(/"public"\."([^"]+)"/gi, "$1")
    .replace(/"([^"]+)"/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^timestamp with time zone$/, "timestamptz")
    .replace(/^timestamp without time zone$/, "timestamp")
    .replace(/^character varying$/, "varchar")
    .replace(/^int4$/, "integer")
    .replace(/^int8$/, "bigint")
    .replace(/^int$/, "integer");
}

function normalizeSignature(name, args) {
  const types = splitSqlArguments(args).map((argument) => {
    let value = String(argument ?? "")
      .replace(/\s+default\s+[\s\S]*$/i, "")
      .replace(/^\s*(?:in|out|inout|variadic)\s+/i, "")
      .trim();
    value = value.replace(/^"[^"]+"\s+/, "");
    const firstToken = value.match(/^([a-z_][a-z0-9_]*)\s+/i)?.[1]?.toLowerCase() ?? "";
    if (firstToken && !["timestamp", "character", "double", "time", "interval"].includes(firstToken)) {
      value = value.slice(firstToken.length).trim();
    }
    return normalizeSqlType(value);
  });
  return `${name}(${types.join(", ")})`;
}

function extractFunctionCreates(sql) {
  const events = [];
  const matcher = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi;
  let match;
  while ((match = matcher.exec(sql))) {
    let depth = 1;
    let quote = null;
    let escaped = false;
    let end = matcher.lastIndex;
    for (; end < sql.length; end += 1) {
      const character = sql[end];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      if (character === "(") depth += 1;
      else if (character === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) continue;
    events.push({ name: match[1], signature: normalizeSignature(match[1], sql.slice(matcher.lastIndex, end)) });
    matcher.lastIndex = end + 1;
  }
  return events;
}

function extractFunctionDrops(sql) {
  return [...String(sql).matchAll(/drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s*\(([^;]*?)\)\s*;/gi)]
    .map((match) => ({ name: match[1], signature: normalizeSignature(match[1], match[2]) }));
}

function extractPolicyCreates(sql) {
  return [...String(sql).matchAll(/create\s+policy\s+(?:"([^"]+)"|([a-z0-9_]+))\s+on/gi)]
    .map((match) => normalizePgIdentifier(match[1] ?? match[2]));
}

function extractPolicyDrops(sql) {
  return [...String(sql).matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?(?:"([^"]+)"|([a-z0-9_]+))\s+on/gi)]
    .map((match) => normalizePgIdentifier(match[1] ?? match[2]));
}

export function extractMigrationObjects(migrationsDir) {
  const migrations = listLocalMigrations(migrationsDir);
  const byMigration = [];
  const sets = {
    types: [],
    tables: [],
    indexes: [],
    functions: [],
    policies: [],
    rlsTables: [],
    grants: [],
  };
  const activeFunctions = new Set();
  const activePolicies = new Set();

  for (const migration of migrations) {
    const filePath = path.join(migrationsDir, migration.name);
    const sql = readFileSync(filePath, "utf8");
    const objects = {
      migrationId: migration.id,
      file: migration.name,
      types: uniqueSorted([...sql.matchAll(/create\s+type\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)].map((match) => match[1])),
      tables: uniqueSorted([
        ...[...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)].map((match) => match[1]),
        ...[...sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)].map((match) => match[1]),
      ]),
      indexes: uniqueSorted([...sql.matchAll(/create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)].map((match) => match[1])),
      functions: uniqueSorted(extractFunctionCreates(sql).map((event) => event.signature)),
      droppedFunctions: uniqueSorted(extractFunctionDrops(sql).map((event) => event.signature)),
      policies: uniqueSorted(extractPolicyCreates(sql)),
      droppedPolicies: uniqueSorted(extractPolicyDrops(sql)),
      rlsTables: uniqueSorted([...sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s+enable\s+row\s+level\s+security/gi)].map((match) => match[1])),
      grants: uniqueSorted([...sql.matchAll(/grant\s+([^;]+?)\s+on\s+(function|table)\s+([^;]+?)\s+to\s+([^;]+);/gis)].map((match) => `${match[2]}:${match[3].replace(/\s+/g, " ").trim()}:${match[4].replace(/\s+/g, " ").trim()}`)),
    };
    byMigration.push(objects);
    for (const key of Object.keys(sets)) sets[key].push(...objects[key]);
    for (const event of extractFunctionDrops(sql)) activeFunctions.delete(event.signature);
    for (const event of extractFunctionCreates(sql)) activeFunctions.add(event.signature);
    for (const policy of extractPolicyDrops(sql)) activePolicies.delete(policy);
    for (const policy of extractPolicyCreates(sql)) activePolicies.add(policy);
  }

  for (const key of Object.keys(sets)) sets[key] = uniqueSorted(sets[key]);
  sets.functions = [...activeFunctions].sort();
  sets.policies = [...activePolicies].sort();
  return {
    schemaVersion: "aiya-system-audit-phase-2-migration-object-manifest-v1",
    migrations: byMigration,
    objects: sets,
    digest: stableDigest({ migrations: byMigration, objects: sets }),
  };
}

export function extractCatalogFromDump(sql) {
  const source = String(sql ?? "");
  const types = uniqueSorted([...source.matchAll(/create\s+type\s+"public"\."([^"]+)"\s+as/gi)].map((match) => match[1]));
  const tables = uniqueSorted([...source.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?"public"\."([^"]+)"/gi)].map((match) => match[1]));
  const indexes = uniqueSorted([...source.matchAll(/create\s+(?:unique\s+)?index\s+"([^"]+)"\s+on\s+"public"\./gi)].map((match) => match[1]));
  const functions = uniqueSorted([...source.matchAll(/create\s+(?:or\s+replace\s+)?function\s+"public"\."([^"]+)"\s*\(([\s\S]*?)\)\s+returns/gi)].map((match) => normalizeSignature(match[1], match[2])));
  const policies = uniqueSorted([...source.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+"public"\./gi)].map((match) => normalizePgIdentifier(match[1])));
  const rlsTables = uniqueSorted([...source.matchAll(/alter\s+table\s+"public"\."([^"]+)"\s+enable\s+row\s+level\s+security/gi)].map((match) => match[1]));
  const grants = uniqueSorted([...source.matchAll(/grant\s+([^;]+?)\s+on\s+(function|table)\s+([^;]+?)\s+to\s+([^;]+);/gis)].map((match) => `${match[2]}:${match[3].replace(/\s+/g, " ").trim()}:${match[4].replace(/\s+/g, " ").trim()}`));
  return {
    schemaVersion: "aiya-system-audit-phase-2-real-catalog-v1",
    source: "pg_dump_public_schema",
    identifierNormalization: "PostgreSQL unquoted identifier limit: 63 bytes",
    types,
    tables,
    indexes,
    functions,
    policies,
    rlsTables,
    grants,
    digest: stableDigest({ tables, indexes, functions, policies, rlsTables, grants }),
  };
}

export function compareObjectNames(expected, actual) {
  const missing = expected.filter((item) => !actual.includes(item));
  return { missing, extra: actual.filter((item) => !expected.includes(item)) };
}

export function buildIntegritySurface(migrationsDir, inventory = null) {
  const foreignKeys = [];
  const constraints = [];
  const uniqueIndexes = [];
  const criticalTables = new Set([
    "tenants",
    "tenant_memberships",
    "dietitians",
    "clients",
    "tenant_entitlements",
    "commercial_invites",
    "billing_customers",
    "manual_entitlement_operations",
    "channel_account_bindings",
    "app_session_activity",
    "whatsapp_connection_attempts",
    "whatsapp_channel_credentials",
    "whatsapp_ingress_jobs",
  ]);

  for (const migration of listLocalMigrations(migrationsDir)) {
    const sql = readFileSync(path.join(migrationsDir, migration.name), "utf8");
    for (const match of sql.matchAll(/references\s+(?:public\.)?([a-z0-9_]+)\s*\(([^)]+)\)/gi)) {
      foreignKeys.push({ migrationId: migration.id, targetTable: match[1], targetColumns: match[2].replace(/\s+/g, " ").trim() });
    }
    for (const match of sql.matchAll(/constraint\s+([a-z0-9_]+)\s+(primary\s+key|unique|check|foreign\s+key)/gi)) {
      constraints.push({ migrationId: migration.id, name: match[1], kind: match[2].replace(/\s+/g, " ").toLowerCase() });
    }
    for (const match of sql.matchAll(/create\s+unique\s+index\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)) {
      uniqueIndexes.push({ migrationId: migration.id, name: match[1] });
    }
  }

  const databaseCalls = Array.isArray(inventory?.databaseCalls) ? inventory.databaseCalls : [];
  const activeReferences = databaseCalls.filter((entry) => criticalTables.has(entry.target) || criticalTables.has(String(entry.target ?? "").replace(/^public\./, "")));
  return {
    schemaVersion: "aiya-system-audit-phase-2-integrity-surface-v1",
    criticalTables: [...criticalTables].sort(),
    foreignKeys,
    criticalForeignKeys: foreignKeys.filter((entry) => criticalTables.has(entry.targetTable)),
    constraints,
    uniqueIndexes,
    activeCodeReferences: activeReferences.map((entry) => ({ source: entry.source, line: entry.line, operation: entry.operation, target: entry.target, verificationScenario: entry.verificationScenario })),
    counts: {
      foreignKeys: foreignKeys.length,
      criticalForeignKeys: foreignKeys.filter((entry) => criticalTables.has(entry.targetTable)).length,
      constraints: constraints.length,
      uniqueIndexes: uniqueIndexes.length,
      activeCriticalCodeReferences: activeReferences.length,
    },
    digest: stableDigest({ foreignKeys, constraints, uniqueIndexes, activeReferences }),
  };
}

export function classifyReconciliation(reconciliation, integritySurface) {
  const records = [];
  const diff = reconciliation.comparison?.diff ?? {};
  for (const [objectType, values] of Object.entries(diff)) {
    for (const object of values.missing ?? []) records.push({ objectType, object, classification: "MISSING", blocker: true, reason: "expected migration object absent from real catalog" });
    for (const object of values.extra ?? []) records.push({ objectType, object, classification: "DEFINITION_MISMATCH", blocker: true, reason: "real catalog object is not represented by the final migration state" });
  }
  const history = reconciliation.linkedMigrationHistory ?? {};
  for (const id of history.localOnly ?? []) records.push({ objectType: "migration", object: id, classification: "HISTORY_MISMATCH", blocker: true, reason: "local migration is not recorded remotely" });
  for (const id of history.remoteOnly ?? []) records.push({ objectType: "migration", object: id, classification: "HISTORY_MISMATCH", blocker: true, reason: "remote migration is not present locally" });
  for (const entry of history.mismatched ?? []) records.push({ objectType: "migration", object: `${entry.local}:${entry.remote}`, classification: "HISTORY_MISMATCH", blocker: true, reason: "local and remote migration identifiers differ" });
  if (reconciliation.rpcContractProbes?.status === "FAIL") {
    for (const name of reconciliation.rpcContractProbes.failures ?? []) records.push({ objectType: "rpc", object: name, classification: "PRIVILEGE_MISMATCH", blocker: true, reason: "RPC behavior or service-role/anonymous privilege probe failed" });
  }

  const counts = Object.fromEntries(["MISSING", "DEFINITION_MISMATCH", "PRIVILEGE_MISMATCH", "HISTORY_MISMATCH", "INTENTIONALLY_DEFERRED"].map((classification) => [classification, records.filter((record) => record.classification === classification).length]));
  return {
    schemaVersion: "aiya-system-audit-phase-2-schema-diff-classification-v1",
    status: records.some((record) => record.blocker) ? "BLOCKED" : "PASS",
    records,
    counts,
    intentionallyDeferred: [],
    repairPlan: records.map((record) => ({ ...record, migrationAction: "forward_only_new_migration_required", dependencyOrder: "blocked_until_stage_2_2_review" })),
    integritySurface,
    dataIntegrityStatus: "NOT_YET_EXECUTED_STAGE_2_3",
    rule: "No difference is silently assigned INTENTIONALLY_DEFERRED; that class requires an explicit feature-scope and active-code proof.",
  };
}

export function createInitialState({ repoRoot, sourceCommit, openedAt }) {
  return {
    schemaVersion: "aiya-system-audit-phase-state-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_2_ID,
    repoRoot,
    sourceCommit,
    openedAt,
    phaseStatus: "OPEN",
    stages: Object.fromEntries(PHASE_2_STAGES.map((stage) => [stage.id, {
      stageId: stage.id,
      status: "LOCKED",
      evidencePath: null,
      evidenceDigest: null,
    }])),
  };
}

export function buildEvidence({ stage, now, sourceCommit, outputFiles, operations, verification, status, blockers = [] }) {
  const evidence = {
    schemaVersion: "aiya-system-audit-stage-evidence-v1",
    runId: `${PHASE_2_ID}-${stage.id}-${now.replace(/[^0-9]/g, "").slice(0, 17)}`,
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_2_ID,
    stageId: stage.id,
    sourceCommit,
    status,
    operations,
    outputFiles,
    verification,
    blockers,
  };
  return { ...evidence, evidenceDigest: stableDigest(evidence) };
}

export function assertPhase1Closed(repoRoot) {
  const statePath = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-1-state.json");
  const closurePath = path.join(repoRoot, "docs", "system-audit", "phase-1", "phase-1-closure.json");
  if (!existsSync(statePath) || !existsSync(closurePath)) return { ok: false, reason: "phase_1_closure_files_missing" };
  const state = readJson(statePath);
  const closure = readJson(closurePath);
  const verified = Object.values(state.stages ?? {}).every((stage) => stage.status === "VERIFIED");
  if (state.phaseStatus !== "CLOSED" || closure.status !== "CLOSED" || !verified || closure.nextPhaseUnlocked !== true) {
    return { ok: false, reason: "phase_1_not_closed", stateStatus: state.phaseStatus, closureStatus: closure.status };
  }
  return { ok: true, stateDigest: sha256File(statePath), closureDigest: sha256File(closurePath), sourceCommit: state.sourceCommit };
}

export function redactFailure(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s]+/gi, "[url-redacted]")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_ACCESS_TOKEN|password|token|secret)[^\r\n]{0,100}/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-320);
}

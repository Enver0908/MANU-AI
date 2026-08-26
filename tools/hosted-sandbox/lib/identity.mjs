import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const DEMO_TENANT_UUID = "00000000-0000-4000-8000-000000000001";

export const REQUIRED_API_CONTRACT_FILES = [
  "app/src/app/api/app-state/route.ts",
  "app/src/app/api/clients/route.ts",
  "app/src/app/api/demo-login/route.ts"
];

export function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function sha256File(filePath) {
  return sha256Buffer(readFileSync(filePath));
}

export function readHeadSha(repoRoot) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false
  });
  if (result.status !== 0) {
    throw new Error(`git rev-parse HEAD failed: ${result.stderr || result.stdout}`);
  }
  const sha = String(result.stdout || "").trim();
  if (!/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error(`HEAD SHA is not a 40-character hex digest: ${sha}`);
  }
  return sha;
}

export function fingerprintMigrations(repoRoot, migrationsDir = "app/supabase/migrations") {
  const absolute = path.join(repoRoot, ...migrationsDir.split("/"));
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
    throw new Error(`migration directory missing: ${migrationsDir}`);
  }
  const files = readdirSync(absolute)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    throw new Error("migration set is empty");
  }
  const hash = createHash("sha256");
  for (const name of files) {
    const relative = `${migrationsDir}/${name}`;
    hash.update(relative);
    hash.update("\0");
    hash.update(readFileSync(path.join(absolute, name)));
    hash.update("\n");
  }
  return {
    directory: migrationsDir,
    count: files.length,
    fingerprint: hash.digest("hex"),
    files
  };
}

export function assertFilesExist(repoRoot, relativePaths, label) {
  const missing = relativePaths.filter((item) => !existsSync(path.join(repoRoot, ...item.split("/"))));
  if (missing.length) {
    throw new Error(`${label} missing: ${missing.join(", ")}`);
  }
}

export function collectLiveIdentity(repoRoot) {
  const commitSha = readHeadSha(repoRoot);
  const migrations = fingerprintMigrations(repoRoot);
  assertFilesExist(repoRoot, REQUIRED_API_CONTRACT_FILES, "API contract");
  return {
    commitSha,
    migrations: {
      directory: migrations.directory,
      count: migrations.count,
      fingerprint: migrations.fingerprint
    },
    apiContractFiles: REQUIRED_API_CONTRACT_FILES
  };
}

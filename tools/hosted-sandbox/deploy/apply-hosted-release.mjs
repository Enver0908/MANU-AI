#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertReleaseArtifactManifest, assertSshHostKeyPin } from "./lib/deploy-contract.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function requiredEnv(env, key) {
  const value = String(env[key] ?? "").trim();
  if (!value) throw new Error(key + " is required");
  return value;
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false, ...options });
  if (result.status !== 0) {
    throw new Error(command + " failed: " + (result.stderr || result.stdout || "unknown error").trim());
  }
  return result;
}

function assertKnownHostPin({ knownHostsFile, expectedPin }) {
  if (!existsSync(knownHostsFile)) {
    throw new Error("SSH known_hosts file is missing");
  }
  const scan = runChecked("ssh-keygen", ["-lf", knownHostsFile]);
  const output = scan.stdout || "";
  if (!output.includes(expectedPin)) {
    throw new Error("SSH known_hosts pin mismatch");
  }
}

function shellQuote(value) {
  return "'" + String(value).replaceAll("'", "'\"'\"'") + "'";
}

function shellEnvAssignment(key, value) {
  const normalizedKey = String(key);
  if (!/^[A-Z0-9_]+$/.test(normalizedKey)) {
    throw new Error("invalid shell environment key: " + normalizedKey);
  }
  return normalizedKey + "=" + shellQuote(value);
}

function listFiles(root, prefix = "") {
  const files = [];
  for (const entry of readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(root, relative));
      continue;
    }
    if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

function remoteDirname(filePath) {
  return path.posix.dirname(filePath.replaceAll("\\", "/"));
}

function deployRuntimeFiles() {
  const files = [
    "app/scripts/lib/release-identity.mjs",
    "tools/hosted-sandbox/deploy/deploy-hosted-release.mjs",
    "tools/hosted-sandbox/deploy/pm2.ecosystem.config.cjs",
    "tools/hosted-sandbox/deploy/run-smoke-check.mjs",
    "tools/hosted-sandbox/deploy/lib/deploy-contract.mjs",
  ];
  for (const migration of listFiles(path.join(repoRoot, "app", "supabase", "migrations"))) {
    files.push(path.posix.join("app/supabase/migrations", migration.replaceAll("\\", "/")));
  }
  return files;
}

function uploadDeployRuntime({ sshBase, remote, remoteRuntime }) {
  const files = deployRuntimeFiles();
  const directories = new Set(files.map(remoteDirname));
  runChecked("ssh", [
    ...sshBase,
    remote,
    ["rm -rf " + shellQuote(remoteRuntime), "mkdir -p " + [...directories].map((dir) => shellQuote(remoteRuntime + "/" + dir)).join(" ")].join(" && "),
  ]);
  for (const file of files) {
    const localPath = path.join(repoRoot, ...file.split("/"));
    runChecked("scp", [...sshBase, localPath, `${remote}:${remoteRuntime}/${file}`]);
  }
}

export function runHostedReleaseApply(options = {}) {
  const env = options.env ?? process.env;
  const manifestPath = path.resolve(requiredEnv(env, "MANU_RELEASE_ARTIFACT_MANIFEST"));
  const manifest = assertReleaseArtifactManifest(JSON.parse(readFileSync(manifestPath, "utf8")), {
    requireArchive: true,
  });
  const host = requiredEnv(env, "MANU_HOSTED_DEPLOY_HOST");
  const user = requiredEnv(env, "MANU_HOSTED_DEPLOY_USER");
  const knownHostsFile = path.resolve(requiredEnv(env, "MANU_SSH_KNOWN_HOSTS_FILE"));
  const expectedPin = assertSshHostKeyPin(env.MANU_SSH_HOST_KEY_PIN);
  const remoteRoot = String(env.MANU_HOSTED_DEPLOY_REMOTE_ROOT ?? "/opt/manu-ai").trim();
  const remote = `${user}@${host}`;
  const sshBase = [
    "-o",
    "BatchMode=yes",
    "-o",
    "IdentitiesOnly=yes",
    "-o",
    "StrictHostKeyChecking=yes",
    "-o",
    `UserKnownHostsFile=${knownHostsFile}`,
  ];

  if (env.MANU_HOSTED_DEPLOY_APPROVED !== "true") {
    throw new Error("MANU_HOSTED_DEPLOY_APPROVED=true is required");
  }
  assertKnownHostPin({ knownHostsFile, expectedPin });

  const remoteStage = `${remoteRoot}/staging/${manifest.commitSha}`;
  const remoteRuntime = `${remoteStage}/deploy-runtime`;
  runChecked("ssh", [...sshBase, remote, "mkdir -p " + shellQuote(remoteStage)]);
  runChecked("scp", [...sshBase, manifest.releaseArtifact.archivePath, manifestPath, `${remote}:${remoteStage}/`]);
  uploadDeployRuntime({ sshBase, remote, remoteRuntime });
  runChecked(
    "ssh",
    [
      ...sshBase,
      remote,
      [
        "cd " + shellQuote(remoteStage),
        "test \"$(sha256sum " + shellQuote(path.basename(manifest.releaseArtifact.archivePath)) + " | awk '{print $1}')\" = " + shellQuote(manifest.releaseArtifact.archiveSha256),
      ].join(" && "),
    ],
  );
  runChecked(
    "ssh",
    [
      ...sshBase,
      remote,
      [
        "cd " + shellQuote(remoteRuntime),
        "set -a",
        "[ ! -f " + shellQuote(remoteRoot + "/shared/runtime.env") + " ] || . " + shellQuote(remoteRoot + "/shared/runtime.env"),
        "set +a",
        [
          shellEnvAssignment("MANU_HOSTED_DEPLOY_APPROVED", "true"),
          shellEnvAssignment("MANU_RELEASE_ARTIFACT_MANIFEST", remoteStage + "/" + path.basename(manifestPath)),
          shellEnvAssignment("MANU_RELEASE_ARTIFACT_DIR", remoteStage),
          shellEnvAssignment("MANU_RELEASE_ID", manifest.releaseId),
          shellEnvAssignment("MANU_RELEASE_COMMIT_SHA", manifest.commitSha),
          shellEnvAssignment("MANU_RELEASE_BUILT_AT", manifest.builtAt),
          shellEnvAssignment("MANU_RELEASE_COMPATIBILITY_VERSION", manifest.compatibilityVersion),
          shellEnvAssignment("MANU_SMOKE_BASE_URL", env.MANU_SMOKE_BASE_URL ?? "https://aiyaworkspace.com"),
          "node tools/hosted-sandbox/deploy/deploy-hosted-release.mjs --apply",
        ].join(" "),
      ].join(" && "),
    ],
  );

  return {
    result: "PASS",
    remote,
    remoteStage,
    commitSha: manifest.commitSha,
    releaseId: manifest.releaseId,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(JSON.stringify(runHostedReleaseApply(), null, 2) + "\n");
  } catch (error) {
    process.stderr.write("FAIL hosted release apply: " + error.message + "\n");
    process.exit(1);
  }
}

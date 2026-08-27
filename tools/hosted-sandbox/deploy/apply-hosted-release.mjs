#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
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
  runChecked("ssh", [...sshBase, remote, "mkdir -p " + shellQuote(remoteStage)]);
  runChecked("scp", [...sshBase, manifest.releaseArtifact.archivePath, manifestPath, `${remote}:${remoteStage}/`]);
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
        "cd " + shellQuote(remoteRoot),
        "MANU_HOSTED_DEPLOY_APPROVED=true " +
          "MANU_RELEASE_ARTIFACT_MANIFEST=" +
          shellQuote(remoteStage + "/" + path.basename(manifestPath)) +
          " MANU_RELEASE_ARTIFACT_DIR=" +
          shellQuote(remoteStage) +
          " node tools/hosted-sandbox/deploy/deploy-hosted-release.mjs --apply",
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

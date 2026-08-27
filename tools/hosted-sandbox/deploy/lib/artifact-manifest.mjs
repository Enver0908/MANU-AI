import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

export function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function collectArtifactEntries(repoRoot, relativePaths) {
  const entries = [];
  for (const relative of relativePaths) {
    const absolute = path.join(repoRoot, ...relative.split("/"));
    if (!existsSync(absolute)) {
      throw new Error("artifact source missing: " + relative);
    }
    const stat = statSync(absolute);
    entries.push({
      path: relative.replace(/\\/g, "/"),
      sha256: sha256File(absolute),
      bytes: stat.size,
    });
  }
  return entries;
}

export function buildArtifactManifest(input) {
  const mode = input.mode ?? "manifest-only";
  if (!["manifest-only", "archive"].includes(mode)) {
    throw new Error("artifact manifest mode is invalid");
  }
  const releaseArtifact = input.releaseArtifact
    ? normalizeReleaseArtifact(input.releaseArtifact)
    : null;
  if (mode === "archive" && !releaseArtifact) {
    throw new Error("archive mode requires release artifact metadata");
  }
  const manifest = {
    schemaVersion: "1.0.0",
    mode,
    commitSha: input.commitSha,
    migrationFingerprint: input.migrationFingerprint,
    releaseId: input.releaseId,
    compatibilityVersion: input.compatibilityVersion,
    builtAt: input.builtAt ?? new Date().toISOString(),
    releaseArtifact,
    entries: input.entries,
    manifestSha256: "",
  };
  const body = JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    commitSha: manifest.commitSha,
    migrationFingerprint: manifest.migrationFingerprint,
    releaseId: manifest.releaseId,
    compatibilityVersion: manifest.compatibilityVersion,
    builtAt: manifest.builtAt,
    mode: manifest.mode,
    releaseArtifact: manifest.releaseArtifact,
    entries: manifest.entries,
  });
  manifest.manifestSha256 = sha256Buffer(Buffer.from(body, "utf8"));
  return manifest;
}

function normalizeReleaseArtifact(artifact) {
  const archivePath = String(artifact.archivePath ?? "").trim();
  const archiveSha256Path = String(artifact.archiveSha256Path ?? "").trim();
  const manifestPath = String(artifact.manifestPath ?? "").trim();
  const archiveSha256 = String(artifact.archiveSha256 ?? "").trim().toLowerCase();
  if (!archivePath || !archiveSha256Path || !manifestPath) {
    throw new Error("release artifact paths are required");
  }
  if (!/^[a-f0-9]{64}$/.test(archiveSha256)) {
    throw new Error("release artifact sha256 must be a 64-character hex digest");
  }
  return {
    cacheVersion: String(artifact.cacheVersion ?? "").trim(),
    packageRoot: String(artifact.packageRoot ?? "").trim(),
    manifestPath,
    archivePath,
    archiveSha256Path,
    archiveSha256,
    fileCount: Number(artifact.fileCount ?? 0),
  };
}

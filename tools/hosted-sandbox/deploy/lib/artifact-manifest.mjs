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
  const manifest = {
    schemaVersion: "1.0.0",
    commitSha: input.commitSha,
    migrationFingerprint: input.migrationFingerprint,
    releaseId: input.releaseId,
    compatibilityVersion: input.compatibilityVersion,
    builtAt: input.builtAt ?? new Date().toISOString(),
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
    entries: manifest.entries,
  });
  manifest.manifestSha256 = sha256Buffer(Buffer.from(body, "utf8"));
  return manifest;
}

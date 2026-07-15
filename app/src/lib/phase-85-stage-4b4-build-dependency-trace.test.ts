import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const LIB_ROOT = join(__dirname);
const FORBIDDEN_IMPORT = "ogg-opus-decoder";
const ALLOWED_RELATIVE_PATHS = new Set(["phase-85-stage-4b4-audio-decode-worker-entry.mjs"]);

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") {
        continue;
      }
      files.push(...collectSourceFiles(absolutePath));
      continue;
    }
    if (/\.(ts|tsx|mjs|js)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      files.push(absolutePath);
    }
  }
  return files;
}

describe("phase 85 stage 4b-4 build dependency trace", () => {
  it("keeps ogg-opus-decoder isolated to the worker decode entry", () => {
    const offenders = collectSourceFiles(LIB_ROOT)
      .map((absolutePath) => ({
        relativePath: relative(LIB_ROOT, absolutePath).replaceAll("\\", "/"),
        contents: readFileSync(absolutePath, "utf8"),
      }))
      .filter(
        (file) =>
          file.contents.includes(FORBIDDEN_IMPORT) && !ALLOWED_RELATIVE_PATHS.has(file.relativePath),
      );

    expect(offenders.map((entry) => entry.relativePath)).toEqual([]);
  });

  it("routes canonicalization through worker orchestration instead of direct decoder imports", () => {
    const canonicalizer = readFileSync(join(LIB_ROOT, "phase-85-stage-4b4-audio-canonicalizer.ts"), "utf8");
    expect(canonicalizer).toContain("decodeOggOpusVoiceBytesInWorker");
    expect(canonicalizer).not.toContain(FORBIDDEN_IMPORT);
    expect(canonicalizer).toContain("preflightOggOpusVoiceBytes");
  });
});

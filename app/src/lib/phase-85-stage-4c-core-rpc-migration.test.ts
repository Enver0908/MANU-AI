import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../..");
const storeSource = readFileSync(resolve(__dirname, "phase-85-stage-4c-supabase-store.ts"), "utf8");
const migrationSource = readdirSync(resolve(repoRoot, "supabase/migrations"))
  .filter((name) => name.includes("stage_4c"))
  .sort()
  .map((name) => readFileSync(resolve(repoRoot, "supabase/migrations", name), "utf8"))
  .join("\n");

function collectCalledStage4CRpcs() {
  return [...storeSource.matchAll(/\.rpc\("((?:p85_stage_4c_)[^"]+)"/g)]
    .map((match) => match[1])
    .sort();
}

function collectDefinedStage4CRpcs() {
  return [...migrationSource.matchAll(/create\s+or\s+replace\s+function\s+(p85_stage_4c_[a-z0-9_]+)/gi)]
    .map((match) => match[1])
    .sort();
}

describe("Stage 4C Supabase RPC migration contract", () => {
  it("defines every Stage 4C RPC called by the Supabase store", () => {
    const called = new Set(collectCalledStage4CRpcs());
    const defined = new Set(collectDefinedStage4CRpcs());

    expect([...called].filter((rpc) => !defined.has(rpc))).toEqual([]);
  });

  it("keeps the core chat/run mutation RPCs in append-only migrations", () => {
    for (const rpc of [
      "p85_stage_4c_send_message_v1",
      "p85_stage_4c_edit_message_v1",
      "p85_stage_4c_regenerate_message_v1",
      "p85_stage_4c_get_branch_chain_v1",
      "p85_stage_4c_commit_assistant_message_v1",
      "p85_stage_4c_finalize_run_v1",
      "p85_stage_4c_enqueue_title_job_v1",
      "p85_stage_4c_apply_auto_title_v1",
    ]) {
      expect(migrationSource).toContain(`create or replace function ${rpc}`);
    }
  });
});

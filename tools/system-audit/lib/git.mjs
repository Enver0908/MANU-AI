import { spawnSync } from "node:child_process";

function runGit(repoRoot, args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error(`git_${args[0]}_failed:${String(result.stderr || result.stdout).trim()}`);
  return String(result.stdout || "").trim();
}

export function readGitSnapshot(repoRoot) {
  const upstream = (() => {
    try { return runGit(repoRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]); } catch { return null; }
  })();
  return {
    branch: runGit(repoRoot, ["branch", "--show-current"]),
    head: runGit(repoRoot, ["rev-parse", "HEAD"]),
    headCommitAt: runGit(repoRoot, ["show", "-s", "--format=%cI", "HEAD"]),
    workingTreeStatus: runGit(repoRoot, ["status", "--porcelain"]),
    upstream,
    remotes: runGit(repoRoot, ["remote", "-v"]).split("\n").filter(Boolean).map((line) => line.replace(/https?:\/\/[^\s]+|git@[^\s]+/g, "[remote-redacted]")),
  };
}

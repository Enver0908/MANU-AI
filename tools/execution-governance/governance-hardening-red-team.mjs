#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const guardPath = path.join(repoRoot, 'tools', 'execution-governance', 'secure-cursor-guard.mjs');
const tempRoot = path.join(repoRoot, '.execution-governance', 'runtime', 'governance-hardening-red-team');
rmSync(tempRoot, { recursive: true, force: true });
mkdirSync(tempRoot, { recursive: true });

const activation = {
  schemaVersion: '1.0.0',
  status: 'ACTIVE_SIGNED_SCOPE',
  repoRoot,
  contractId: 'governance-hardening-v1',
  phaseId: 'phase-6',
  lockCommit: git('rev-parse', 'HEAD'),
  allowImplementationHead: true,
  scope: {
    allowedCreatePaths: ['docs/GOVERNANCE_HARDENING_PHASE_0_EVIDENCE.md'],
    allowedModifyPaths: ['docs/allowed/**/*.md'],
    protectedPaths: ['tools/execution-governance/secure-cursor-guard.mjs', 'app/**'],
    forbiddenPaths: ['app/package.json', '.github/workflows/**'],
    allowedCommands: [
      { cwd: '.', executable: 'git', args: ['status', '--short', '--branch'], networkPolicy: 'FORBIDDEN' }
    ],
    allowedMcpTools: [],
    allowSubagents: false
  }
};
activation.scopeHash = sha256Json(activation.scope);
writeFileSync(path.join(tempRoot, 'activation.json'), `${JSON.stringify(activation, null, 2)}\n`, 'utf8');

const discoveryActivation = {
  schemaVersion: '1.0.0',
  status: 'DISCOVERY_READ_ONLY',
  repoRoot,
  contractId: '',
  phaseId: '',
  lockCommit: '',
  scopeHash: '',
  scope: {
    allowedCreatePaths: [],
    allowedModifyPaths: [],
    protectedPaths: [],
    forbiddenPaths: [],
    allowedCommands: [
      { cwd: '.', executable: 'git', args: ['status', '--short', '--branch'], timeoutSeconds: 60, networkPolicy: 'FORBIDDEN', artifactPolicy: 'stdout/stderr only' }
    ],
    allowedMcpTools: [],
    allowSubagents: false
  }
};

const cases = [
  {
    id: 'deny-out-of-scope-write',
    event: 'preToolUse',
    payload: { tool_name: 'Write', tool_input: { file_path: 'app/src/proxy.ts' } },
    expect: 2
  },
  {
    id: 'allow-in-scope-write',
    event: 'preToolUse',
    payload: { tool_name: 'Write', tool_input: { file_path: 'docs/GOVERNANCE_HARDENING_PHASE_0_EVIDENCE.md' } },
    expect: 0
  },
  {
    id: 'allow-glob-in-scope-write',
    event: 'preToolUse',
    payload: { tool_name: 'Edit', tool_input: { file_path: 'docs/allowed/nested/note.md' } },
    expect: 0
  },
  {
    id: 'deny-protected-glob-write',
    event: 'preToolUse',
    payload: { tool_name: 'Write', tool_input: { file_path: 'app/src/protected.ts' } },
    expect: 2
  },
  {
    id: 'deny-forbidden-glob-write',
    event: 'preToolUse',
    payload: { tool_name: 'Write', tool_input: { file_path: '.github/workflows/deploy.yml' } },
    expect: 2
  },
  {
    id: 'deny-node-e-shell-write',
    event: 'beforeShellExecution',
    payload: { command: "node -e require('fs').writeFileSync('app/src/out.ts','x')" },
    expect: 2
  },
  {
    id: 'allow-exact-git-status',
    event: 'beforeShellExecution',
    payload: { command: 'git status --short --branch', cwd: '.' },
    enterpriseCwd: true,
    expect: 0
  },
  {
    id: 'deny-tampered-shell-activation',
    event: 'beforeShellExecution',
    payload: { command: 'git status --short --branch', cwd: '.' },
    activationOverride: {
      schemaVersion: '1.0.0',
      status: 'INACTIVE_FAIL_CLOSED',
      repoRoot,
      contractId: '',
      phaseId: '',
      lockCommit: '',
      scopeHash: '',
      scope: {
        allowedCreatePaths: [],
        allowedModifyPaths: [],
        protectedPaths: [],
        forbiddenPaths: [],
        allowedCommands: [
          { cwd: '.', executable: 'git', args: ['status', '--short', '--branch'], networkPolicy: 'FORBIDDEN' }
        ],
        allowedMcpTools: [],
        allowSubagents: false
      }
    },
    expect: 2
  },
  {
    id: 'deny-non-ancestor-implementation-head',
    event: 'beforeShellExecution',
    payload: { command: 'git status --short --branch', cwd: '.' },
    activationOverride: {
      ...activation,
      lockCommit: 'ffffffffffffffffffffffffffffffffffffffff',
      allowImplementationHead: true
    },
    expect: 2
  },
  {
    id: 'deny-mcp-unknown',
    event: 'preToolUse',
    payload: { tool_name: 'MCP:filesystem.write_file', tool_input: { path: 'docs/GOVERNANCE_HARDENING_PHASE_0_EVIDENCE.md' } },
    expect: 2
  },
  {
    id: 'deny-subagent',
    event: 'preToolUse',
    payload: { tool_name: 'Task', tool_input: {} },
    expect: 2
  },
  {
    id: 'deny-secret-read',
    event: 'beforeReadFile',
    payload: { path: '.env' },
    expect: 2
  },
  {
    id: 'allow-discovery-read-only-git-status',
    event: 'beforeShellExecution',
    payload: { command: 'git status --short --branch', cwd: '.' },
    activationOverride: discoveryActivation,
    expect: 0
  },
  {
    id: 'deny-production-command-in-discovery',
    event: 'beforeShellExecution',
    payload: { command: 'git push origin HEAD', cwd: '.' },
    activationOverride: discoveryActivation,
    expect: 2
  },
  {
    id: 'deny-prompt-derived-scope',
    event: 'preToolUse',
    payload: { tool_name: 'Write', tool_input: { file_path: 'docs/prompt-added.md' } },
    activationOverride: discoveryActivation,
    expect: 2
  },
  {
    id: 'allow-governed-execution-prompt-intent',
    event: 'beforeSubmitPrompt',
    payload: { prompt: 'Bu planı uygula ve sadece kilitli scope ile ilerle.' },
    activationOverride: discoveryActivation,
    expect: 0
  },
  {
    id: 'deny-malformed-json',
    event: 'preToolUse',
    raw: '{',
    expect: 2
  }
];

const results = cases.map(runCase);
const status = results.every((item) => item.pass) ? 'PASS' : 'FAIL';
process.stdout.write(`${JSON.stringify({ schemaVersion: '1.0.0', status, results }, null, 2)}\n`);
process.exit(status === 'PASS' ? 0 : 1);

function runCase(testCase) {
  writeFileSync(
    path.join(tempRoot, 'activation.json'),
    `${JSON.stringify(testCase.activationOverride || activation, null, 2)}\n`,
    'utf8'
  );
  const input = testCase.raw ?? JSON.stringify(testCase.payload);
  const result = spawnSync('node', [guardPath, testCase.event], {
    cwd: testCase.enterpriseCwd ? 'C:\\ProgramData\\Cursor' : repoRoot,
    input,
    encoding: 'utf8',
    shell: false,
    env: {
      ...process.env,
      CURSOR_PROJECT_DIR: repoRoot,
      MANU_GOVERNANCE_TEST_MODE: '1',
      MANU_GOVERNANCE_ROOT: tempRoot
    }
  });
  return {
    id: testCase.id,
    expectedExitCode: testCase.expect,
    actualExitCode: result.status,
    pass: result.status === testCase.expect,
    stdout: safeJson(result.stdout),
    stderr: result.stderr.trim()
  };
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value.trim();
  }
}

function git(...args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

function sha256Json(value) {
  const result = spawnSync('node', ['-e', "const {createHash}=require('crypto');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>console.log(createHash('sha256').update(s).digest('hex')))"], {
    input: JSON.stringify(value),
    encoding: 'utf8',
    shell: false
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

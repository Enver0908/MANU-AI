#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

const repoRoot = git('rev-parse', '--show-toplevel');
const script = path.join(repoRoot, 'tools', 'execution-governance', 'activate-secure-cursor-guard.mjs');

test('activation dry-run flattens locked plan scope without writing external state', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'manu-gov-activate-'));
  const planDir = makePlanFixture();
  try {
    const result = run(root, ['--plan-dir', planDir, '--phase-id', 'phase-1', '--allow-implementation-head']);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'PASS');
    assert.equal(report.mode, 'DRY_RUN');
    assert.equal(report.activation.status, 'ACTIVE_SIGNED_SCOPE');
    assert.equal(report.activation.phaseId, 'phase-1');
    assert.equal(report.activation.allowImplementationHead, true);
    assert.ok(report.activation.scope.allowedCreatePaths.includes('docs/phase-1.md'));
    assert.ok(report.activation.scope.protectedPaths.includes('tools/execution-governance/governance-cli.mjs'));
    assert.ok(report.activation.scope.allowedCommands.some((item) => item.executable === 'node'));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(path.join(repoRoot, planDir), { recursive: true, force: true });
  }
});

test('activation apply and deactivate write explicit external fail-closed state', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'manu-gov-activate-'));
  const planDir = makePlanFixture();
  try {
    const applied = run(root, ['--plan-dir', planDir, '--phase-id', 'phase-1', '--apply']);
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(JSON.parse(readFileSync(path.join(root, 'activation.json'), 'utf8')).status, 'ACTIVE_SIGNED_SCOPE');

    const deactivated = run(root, ['--plan-dir', planDir, '--deactivate', '--apply']);
    assert.equal(deactivated.status, 0, deactivated.stderr);
    const activation = JSON.parse(readFileSync(path.join(root, 'activation.json'), 'utf8'));
    assert.equal(activation.status, 'INACTIVE_FAIL_CLOSED');
    assert.equal(activation.scope.allowedCreatePaths.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(path.join(repoRoot, planDir), { recursive: true, force: true });
  }
});

function run(root, args) {
  return spawnSync('node', [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, MANU_GOVERNANCE_ROOT: root }
  });
}

function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function makePlanFixture() {
  const relDir = `.execution-governance/runtime/activate-secure-cursor-guard-test/${process.pid}-${Date.now()}`;
  const dir = path.join(repoRoot, relDir);
  mkdirSync(dir, { recursive: true });
  const files = {
    'plan.md': '# Test Plan\n',
    'contract.json': `${JSON.stringify({ schemaVersion: '1.0.0', contractId: 'activation-test-v1' }, null, 2)}\n`,
    'scope.json': `${JSON.stringify({
      schemaVersion: '1.0.0',
      contractId: 'activation-test-v1',
      requirements: [{
        requirementId: 'ACT-001',
        allowedCreatePaths: ['docs/phase-1.md'],
        allowedModifyPaths: ['docs/phase-1.md'],
        protectedPaths: ['tools/execution-governance/governance-cli.mjs'],
        forbiddenPaths: ['app/package.json'],
        allowedCommands: [{ cwd: '.', executable: 'node', args: ['--version'], networkPolicy: 'FORBIDDEN' }],
        allowedMcpTools: []
      }]
    }, null, 2)}\n`,
    'acceptance.json': `${JSON.stringify({ schemaVersion: '1.0.0', contractId: 'activation-test-v1', acceptanceRecords: [] }, null, 2)}\n`
  };
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text, 'utf8');
  const lock = {
    schemaVersion: '1.0.0',
    contractId: 'activation-test-v1',
    planHash: sha256File(path.join(dir, 'plan.md')),
    contractHash: sha256File(path.join(dir, 'contract.json')),
    scopeHash: sha256File(path.join(dir, 'scope.json')),
    acceptanceHash: sha256File(path.join(dir, 'acceptance.json')),
    baseCommit: git('rev-parse', 'HEAD'),
    baseTree: git('rev-parse', 'HEAD^{tree}'),
    lockCommit: git('rev-parse', 'HEAD'),
    protectedManifest: [],
    artifactFreshnessPolicy: { requiresCommitSha: true, requiresRunId: true, requiresTimestamp: true, rejectsPreLockArtifacts: true }
  };
  writeFileSync(path.join(dir, 'lock.json'), `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  return relDir;
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

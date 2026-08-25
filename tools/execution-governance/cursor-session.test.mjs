#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

const repoRoot = repoGitRoot();
const broker = path.join(repoRoot, 'tools', 'execution-governance', 'cursor-session-broker.mjs');
const cli = path.join(repoRoot, 'tools', 'execution-governance', 'governance-cli.mjs');

test('cursor session broker writes only the selected locked phase activation', () => {
  const externalRoot = mkdtempSync(path.join(tmpdir(), 'manu-cursor-session-'));
  const planDir = makePlanFixture();
  try {
    const result = runBroker(externalRoot, [
      '--activate',
      '--repo',
      repoRoot,
      '--plan-dir',
      planDir,
      '--phase-id',
      'CGUX-TEST-1',
      '--allow-implementation-head'
    ]);
    assert.equal(result.status, 0, result.stderr);
    const activation = JSON.parse(readFileSync(path.join(externalRoot, 'activation.json'), 'utf8'));
    assert.equal(activation.status, 'ACTIVE_SIGNED_SCOPE');
    assert.equal(activation.phaseId, 'CGUX-TEST-1');
    assert.ok(activation.scope.allowedCreatePaths.includes('docs/cgux-test-1.md'));
    assert.ok(!activation.scope.allowedCreatePaths.includes('docs/cgux-test-2.md'));
  } finally {
    rmSync(externalRoot, { recursive: true, force: true });
    rmSync(path.join(repoRoot, planDir), { recursive: true, force: true });
  }
});

test('governance CLI exposes cursor-session status surface', () => {
  const result = spawnSync('node', [cli, 'cursor-session', '--session', 'status'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(path.resolve(report.repoRoot), path.resolve(repoRoot));
  assert.ok(['PASS', 'FAIL'].includes(report.status));
  assert.ok(typeof report.activationStatus === 'string');
});

test('installer dry-run reports broker launcher and desktop shortcut checks', () => {
  const result = spawnSync('node', ['tools/execution-governance/install-secure-cursor-guard.mjs', '--dry-run'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const names = new Set(report.checks.map((item) => item.name));
  assert.ok(names.has('target broker exists'));
  assert.ok(names.has('cursor session launcher exists'));
  assert.ok(names.has('desktop shortcut exists'));
});

test('cursor session auto-preflight resolves the locked zero-command plan without a phase id', () => {
  const result = spawnSync('node', [cli, 'cursor-session', '--session', 'auto-preflight', '--plan-dir', '.execution-governance/plans/cursor-zero-command-governed-execution-v1'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'READY');
  assert.equal(report.resolved.phaseId, 'CZC-PHASE-1');
});

test('cursor session auto-activate writes the resolved phase activation without a phase id', () => {
  const externalRoot = mkdtempSync(path.join(tmpdir(), 'manu-cursor-auto-'));
  try {
    const result = spawnSync('node', [cli, 'cursor-session', '--session', 'auto-activate', '--plan-dir', '.execution-governance/plans/cursor-zero-command-governed-execution-v1'], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: false,
      env: { ...process.env, MANU_GOVERNANCE_ROOT: externalRoot }
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'PASS');
    assert.equal(report.resolved.phaseId, 'CZC-PHASE-1');
    const activation = JSON.parse(readFileSync(path.join(externalRoot, 'activation.json'), 'utf8'));
    assert.equal(activation.status, 'ACTIVE_SIGNED_SCOPE');
    assert.equal(activation.phaseId, 'CZC-PHASE-1');
  } finally {
    rmSync(externalRoot, { recursive: true, force: true });
  }
});

function runBroker(externalRoot, args) {
  return spawnSync('node', [broker, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, MANU_GOVERNANCE_ROOT: externalRoot }
  });
}

function makePlanFixture() {
  const relDir = `.execution-governance/runtime/cursor-session-test/${process.pid}-${Date.now()}`;
  const dir = path.join(repoRoot, relDir);
  mkdirSync(dir, { recursive: true });
  const contract = makeContract();
  const scope = makeScope();
  const acceptance = makeAcceptance();
  const files = {
    'plan.md': makePlanMarkdown(),
    'contract.json': `${JSON.stringify(contract, null, 2)}\n`,
    'scope.json': `${JSON.stringify(scope, null, 2)}\n`,
    'acceptance.json': `${JSON.stringify(acceptance, null, 2)}\n`
  };
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text, 'utf8');
  const lock = {
    schemaVersion: '1.0.0',
    contractId: contract.contractId,
    planHash: sha256File(path.join(dir, 'plan.md')),
    contractHash: sha256File(path.join(dir, 'contract.json')),
    scopeHash: sha256File(path.join(dir, 'scope.json')),
    acceptanceHash: sha256File(path.join(dir, 'acceptance.json')),
    baseCommit: git('rev-parse', 'HEAD'),
    baseTree: git('rev-parse', 'HEAD^{tree}'),
    lockCommit: git('rev-parse', 'HEAD'),
    protectedManifest: [],
    artifactFreshnessPolicy: {
      requiresCommitSha: true,
      requiresRunId: true,
      requiresTimestamp: true,
      rejectsPreLockArtifacts: true
    }
  };
  writeFileSync(path.join(dir, 'lock.json'), `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  return relDir;
}

function makeContract() {
  const status = {
    plan_state: 'LOCKED_FOR_IMPLEMENTATION',
    implementation_state: 'NOT_STARTED',
    executor_checks: 'NOT_RUN',
    independent_review: 'NOT_REQUESTED',
    user_acceptance: 'PENDING'
  };
  return {
    schemaVersion: '1.0.0',
    governanceFormatVersion: '2.0.0',
    contractId: 'cursor-session-test-v1',
    planVersion: '1.0.0',
    planTitle: 'Cursor Session Test Plan',
    currentPhaseId: 'CGUX-TEST-1',
    phases: [
      { phaseId: 'CGUX-TEST-1', title: 'Cursor Session Test Phase One', status: 'LOCKED_FOR_IMPLEMENTATION' },
      { phaseId: 'CGUX-TEST-2', title: 'Cursor Session Test Phase Two', status: 'LOCKED_FOR_IMPLEMENTATION' }
    ],
    authoritySources: ['test fixture'],
    roleBindings: {
      requirementAuthority: 'test',
      planner: 'test',
      implementer: 'test',
      automaticVerifier: 'test',
      independentReviewer: 'NOT_REQUESTED unless user explicitly requests review',
      manualReviewer: 'test',
      finalAcceptanceAuthority: 'user'
    },
    status,
    requirements: ['CGUX-TEST-001', 'CGUX-TEST-002'].map((requirementId) => ({
      requirementId,
      authoritySource: 'test fixture',
      classification: 'IN_SCOPE',
      observableRequirement: `${requirementId} observable cursor session behavior`,
      dependencies: [],
      status
    }))
  };
}

function makeScope() {
  return {
    schemaVersion: '1.0.0',
    contractId: 'cursor-session-test-v1',
    requirements: ['CGUX-TEST-001', 'CGUX-TEST-002'].map((requirementId, index) => ({
      requirementId,
      phaseId: index === 0 ? 'CGUX-TEST-1' : 'CGUX-TEST-2',
      allowedCreatePaths: [index === 0 ? 'docs/cgux-test-1.md' : 'docs/cgux-test-2.md'],
      allowedModifyPaths: [],
      protectedPaths: ['app/**'],
      forbiddenPaths: ['app/package.json'],
      allowedCommands: [],
      forbiddenCommands: [],
      allowedDependencies: [],
      forbiddenDependencyChanges: true,
      allowedSchemaChanges: [],
      allowedNetworkOrExternalEffects: [],
      allowedMcpTools: [],
      allowSubagents: false,
      generatedArtifactPolicy: 'No tracked generated artifacts.',
      documentationReconciliation: [],
      maximumChangeScope: 'fixture only'
    }))
  };
}

function makeAcceptance() {
  return {
    schemaVersion: '1.0.0',
    contractId: 'cursor-session-test-v1',
    acceptanceRecords: ['CGUX-TEST-001', 'CGUX-TEST-002'].map((requirementId, index) => ({
      requirementId,
      phaseId: index === 0 ? 'CGUX-TEST-1' : 'CGUX-TEST-2',
      authoritySource: 'test fixture',
      observableRequirement: `${requirementId} observable cursor session behavior`,
      oracleType: 'AUTOMATED',
      oracleOwner: 'node',
      oracleLocation: 'node --version',
      protectionMechanism: 'test fixture',
      exactEvidenceCommand: 'node --version',
      exactEvidenceCommandSpec: { cwd: '.', executable: 'node', args: ['--version'], timeoutSeconds: 30, networkPolicy: 'FORBIDDEN', artifactPolicy: 'stdout only' },
      preconditions: [],
      expectedExitCode: 0,
      requiredAssertions: ['fixture validates'],
      requiredScenarioMatrix: ['fixture'],
      negativeControls: [],
      expectedTestIds: [requirementId],
      expectedTestCountOrInventory: 'one fixture assertion',
      artifactType: 'stdout',
      artifactLocation: 'stdout',
      artifactRetentionPolicy: 'not committed',
      artifactPrivacyPolicy: 'No sensitive data.',
      commitShaBinding: 'required',
      runIdAndTimestampBinding: 'required',
      cleanEnvironmentRequirements: [],
      independentVerifier: 'NOT_REQUESTED unless user explicitly requests review',
      passRule: 'exit 0',
      failRule: 'non-zero exit',
      blockedRule: 'node unavailable',
      forbiddenEquivalences: ['fixture existence is not PASS']
    }))
  };
}

function makePlanMarkdown() {
  const sections = [
    'purpose',
    'scope',
    'out-of-scope',
    'preconditions',
    'affected-files',
    'architecture-decisions',
    'rejected-alternatives',
    'api-data-contracts',
    'ordered-steps',
    'technical-methods',
    'data-control-flow',
    'dependencies',
    'state-transitions',
    'errors-boundaries',
    'security-privacy',
    'accessibility-localization',
    'migration-rollback',
    'tests',
    'acceptance-oracles',
    'stop-completion'
  ];
  return `# Cursor Session Test Plan

Plan version: 1.0.0

Plan state: LOCKED_FOR_IMPLEMENTATION

<!-- GOV-PHASE id="CGUX-TEST-1" title="Cursor Session Test Phase One" -->
<!-- GOV-PHASE id="CGUX-TEST-2" title="Cursor Session Test Phase Two" -->

${sections.map((section) => `## ${section}
<!-- GOV-SECTION id="${section}" -->

Concrete ${section} content for cursor session fixture.
`).join('\n')}

<!-- GOV-STEP id="CGUX-TEST-STEP-001" -->
1. Execute the exact cursor session fixture behavior.

<!-- GOV-REQ id="CGUX-TEST-001" -->
CGUX-TEST-001 passes only when phase one scope is activated.

<!-- GOV-REQ id="CGUX-TEST-002" -->
CGUX-TEST-002 passes only when phase two scope stays out of phase one activation.
`;
}

function git(...args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function repoGitRoot() {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

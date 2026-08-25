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
    assert.ok(!report.activation.scope.allowedCreatePaths.includes('docs/phase-2.md'));
    assert.ok(report.activation.scope.protectedPaths.includes('tools/execution-governance/governance-cli.mjs'));
    assert.ok(report.activation.scope.allowedCommands.some((item) => item.executable === 'node'));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(path.join(repoRoot, planDir), { recursive: true, force: true });
  }
});

test('activation rejects unknown phase ids', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'manu-gov-activate-'));
  const planDir = makePlanFixture();
  try {
    const result = run(root, ['--plan-dir', planDir, '--phase-id', 'unknown-phase']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown phaseId|no activation scope/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(path.join(repoRoot, planDir), { recursive: true, force: true });
  }
});

test('activation rejects implementation head when lock commit is not an ancestor', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'manu-gov-activate-'));
  const planDir = makePlanFixture();
  try {
    const lockPath = path.join(repoRoot, planDir, 'lock.json');
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    lock.lockCommit = 'ffffffffffffffffffffffffffffffffffffffff';
    writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
    const result = run(root, ['--plan-dir', planDir, '--phase-id', 'phase-1', '--allow-implementation-head']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not an ancestor/);
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
    'plan.md': makePlanMarkdown(),
    'contract.json': `${JSON.stringify(makeContract(), null, 2)}\n`,
    'scope.json': `${JSON.stringify({
      schemaVersion: '1.0.0',
      contractId: 'activation-test-v1',
      requirements: [{
        requirementId: 'ACT-001',
        phaseId: 'phase-1',
        allowedCreatePaths: ['docs/phase-1.md'],
        allowedModifyPaths: ['docs/phase-1.md'],
        protectedPaths: ['tools/execution-governance/governance-cli.mjs'],
        forbiddenPaths: ['app/package.json'],
        allowedCommands: [{ cwd: '.', executable: 'node', args: ['--version'], timeoutSeconds: 30, networkPolicy: 'FORBIDDEN', artifactPolicy: 'stdout only' }],
        forbiddenCommands: [],
        allowedDependencies: [],
        forbiddenDependencyChanges: true,
        allowedSchemaChanges: [],
        allowedNetworkOrExternalEffects: [],
        allowedMcpTools: [],
        allowSubagents: false,
        generatedArtifactPolicy: 'No tracked generated artifacts.',
        documentationReconciliation: [],
        maximumChangeScope: 'phase 1 docs only'
      }, {
        requirementId: 'ACT-002',
        phaseId: 'phase-2',
        allowedCreatePaths: ['docs/phase-2.md'],
        allowedModifyPaths: ['docs/phase-2.md'],
        protectedPaths: [],
        forbiddenPaths: [],
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
        maximumChangeScope: 'phase 2 docs only'
      }]
    }, null, 2)}\n`,
    'acceptance.json': `${JSON.stringify(makeAcceptance(), null, 2)}\n`
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
    contractId: 'activation-test-v1',
    planVersion: '1.0.0',
    planTitle: 'Activation Test Plan',
    currentPhaseId: 'phase-1',
    phases: [
      { phaseId: 'phase-1', title: 'Phase One', status: 'LOCKED_FOR_IMPLEMENTATION' },
      { phaseId: 'phase-2', title: 'Phase Two', status: 'LOCKED_FOR_IMPLEMENTATION' }
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
    requirements: ['ACT-001', 'ACT-002'].map((requirementId) => ({
      requirementId,
      authoritySource: 'test fixture',
      classification: 'IN_SCOPE',
      observableRequirement: `${requirementId} observable activation behavior`,
      dependencies: [],
      status
    }))
  };
}

function makeAcceptance() {
  return {
    schemaVersion: '1.0.0',
    contractId: 'activation-test-v1',
    acceptanceRecords: ['ACT-001', 'ACT-002'].map((requirementId, index) => ({
      requirementId,
      phaseId: index === 0 ? 'phase-1' : 'phase-2',
      authoritySource: 'test fixture',
      observableRequirement: `${requirementId} observable activation behavior`,
      oracleType: 'AUTOMATED',
      oracleOwner: 'node',
      oracleLocation: 'node --version',
      protectionMechanism: 'test fixture',
      exactEvidenceCommand: 'node --version',
      exactEvidenceCommandSpec: { cwd: '.', executable: 'node', args: ['--version'], timeoutSeconds: 30, networkPolicy: 'FORBIDDEN', artifactPolicy: 'stdout only' },
      preconditions: [],
      expectedExitCode: 0,
      requiredAssertions: ['activation fixture validates'],
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
  return `# Activation Test Plan

Plan version: 1.0.0

Plan state: LOCKED_FOR_IMPLEMENTATION

<!-- GOV-PHASE id="phase-1" title="Phase One" -->
<!-- GOV-PHASE id="phase-2" title="Phase Two" -->

${sections.map((section) => `## ${section}
<!-- GOV-SECTION id="${section}" -->

Concrete ${section} content for activation fixture.
`).join('\n')}

<!-- GOV-STEP id="ACT-STEP-001" -->
1. Execute exact fixture behavior.

<!-- GOV-REQ id="ACT-001" -->
ACT-001 passes only when phase one activation scope is selected.

<!-- GOV-REQ id="ACT-002" -->
ACT-002 passes only when phase two activation scope is selected.
`;
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

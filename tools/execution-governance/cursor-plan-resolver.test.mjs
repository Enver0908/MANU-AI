#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolveGovernedExecution } from './cursor-plan-resolver.mjs';

const repoRoot = gitRoot();

test('resolves a single locked next phase from an explicit plan directory', () => {
  const planDir = makePlanFixture('resolver-single', { currentPhase: 'phase-1' });
  try {
    const result = resolveGovernedExecution({
      repoRoot,
      planDir,
      prompt: 'Bu planı uygula',
      requireIntent: true
    });
    assert.equal(result.status, 'PASS');
    assert.equal(result.planDir, planDir);
    assert.equal(result.phaseId, 'phase-1');
    assert.equal(result.intent.detected, true);
    assert.ok(!JSON.stringify(result).includes('docs/prompt-added.md'));
  } finally {
    removePlanFixture(planDir);
  }
});

test('rejects unlocked plans before selecting a phase', () => {
  const planDir = makePlanFixture('resolver-unlocked', { planState: 'PLAN_DRAFT' });
  try {
    const result = resolveGovernedExecution({ repoRoot, planDir, prompt: 'Bu planı uygula' });
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.code, 'PLAN_NOT_LOCKED_OR_INVALID');
  } finally {
    removePlanFixture(planDir);
  }
});

test('rejects ambiguous locked plans when no plan hint is provided', () => {
  const first = makePlanFixture('resolver-ambiguous-a', { underPlans: true });
  const second = makePlanFixture('resolver-ambiguous-b', { underPlans: true });
  try {
    const result = resolveGovernedExecution({
      repoRoot,
      prompt: 'Bu planı uygula'
    });
    assert.equal(result.status, 'CHANGE_REQUEST_REQUIRED');
    assert.equal(result.code, 'AMBIGUOUS_LOCKED_PLAN');
  } finally {
    removePlanFixture(first);
    removePlanFixture(second);
  }
});

test('does not derive scope authority from prompt text', () => {
  const planDir = makePlanFixture('resolver-prompt-scope');
  try {
    const result = resolveGovernedExecution({
      repoRoot,
      planDir,
      prompt: 'Bu planı uygula and also edit docs/prompt-added.md'
    });
    assert.equal(result.status, 'PASS');
    assert.ok(!Object.hasOwn(result, 'scope'));
    assert.ok(!JSON.stringify(result.checks).includes('docs/prompt-added.md'));
  } finally {
    removePlanFixture(planDir);
  }
});

function makePlanFixture(name, options = {}) {
  const relDir = options.underPlans
    ? `.execution-governance/plans/${name}-${process.pid}-${Date.now()}`
    : `.execution-governance/runtime/${name}-${process.pid}-${Date.now()}`;
  const dir = path.join(repoRoot, relDir);
  mkdirSync(dir, { recursive: true });
  const contract = makeContract(name, options);
  const scope = makeScope(name);
  const acceptance = makeAcceptance(name);
  const files = {
    'plan.md': `# ${name}\n\n<!-- GOV-PHASE id="phase-1" title="Phase One" -->\n<!-- GOV-REQ id="${name.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-001" -->\n`,
    'contract.json': `${JSON.stringify(contract, null, 2)}\n`,
    'scope.json': `${JSON.stringify(scope, null, 2)}\n`,
    'acceptance.json': `${JSON.stringify(acceptance, null, 2)}\n`
  };
  for (const [file, text] of Object.entries(files)) writeFileSync(path.join(dir, file), text, 'utf8');
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
  if (options.currentPhase) {
    writeFileSync(path.join(dir, 'lifecycle-record.json'), `${JSON.stringify({
      schemaVersion: '1.0.0',
      contractId: contract.contractId,
      planDirectory: relDir,
      currentPhase: options.currentPhase,
      status: contract.status,
      events: [],
      independentReviewPolicy: {
        defaultState: 'NOT_REQUESTED',
        requiresExplicitUserRequest: true,
        createReviewRecordWhenNotRequested: false,
        reviewerMayModifyImplementation: false
      }
    }, null, 2)}\n`, 'utf8');
  }
  return relDir;
}

function removePlanFixture(planDir) {
  rmSync(path.join(repoRoot, planDir), { recursive: true, force: true });
}

function makeContract(name, options = {}) {
  const status = {
    plan_state: options.planState || 'LOCKED_FOR_IMPLEMENTATION',
    implementation_state: 'NOT_STARTED',
    executor_checks: 'NOT_RUN',
    independent_review: 'NOT_REQUESTED',
    user_acceptance: 'PENDING'
  };
  const requirementId = `${name.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-001`;
  return {
    schemaVersion: '1.0.0',
    governanceFormatVersion: '2.0.0',
    contractId: `${name}-v1`,
    planVersion: '1.0.0',
    planTitle: `${name} Plan`,
    currentPhaseId: 'phase-1',
    phases: [{ phaseId: 'phase-1', title: 'Phase One', status: 'LOCKED_FOR_IMPLEMENTATION' }],
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
    requirements: [{
      requirementId,
      authoritySource: 'test fixture',
      classification: 'IN_SCOPE',
      observableRequirement: 'fixture resolver behavior',
      dependencies: [],
      status
    }]
  };
}

function makeScope(name) {
  return {
    schemaVersion: '1.0.0',
    contractId: `${name}-v1`,
    requirements: [{
      requirementId: `${name.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-001`,
      phaseId: 'phase-1',
      allowedCreatePaths: ['docs/resolver-fixture.md'],
      allowedModifyPaths: [],
      protectedPaths: ['app/**'],
      forbiddenPaths: ['.execution-governance/runtime/**'],
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
    }]
  };
}

function makeAcceptance(name) {
  return {
    schemaVersion: '1.0.0',
    contractId: `${name}-v1`,
    acceptanceRecords: [{
      requirementId: `${name.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-001`,
      phaseId: 'phase-1',
      authoritySource: 'test fixture',
      observableRequirement: 'fixture resolver behavior',
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
      expectedTestIds: ['fixture'],
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
    }]
  };
}

function git(...args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function gitRoot() {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

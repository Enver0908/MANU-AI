#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { validatePlanPackage } from './lib/plan-package-validator.mjs';

const repoRoot = git('rev-parse', '--show-toplevel');
const cli = path.join(repoRoot, 'tools', 'execution-governance', 'governance-cli.mjs');

test('standard, template, and instructions define decision-complete governed plans', () => {
  const standard = read('docs/execution-governance/DECISION_COMPLETE_PLAN_AUTHORING_STANDARD.md');
  assert.match(standard, /decision-complete/i);
  assert.match(standard, /Hashes and scope limits preserve a plan; they do not prove/i);
  assert.match(standard, /GOV-PHASE/);
  assert.match(standard, /GOV-REQ/);
  assert.match(standard, /GOV-STEP/);

  const template = read('.execution-governance/templates/plan.md');
  for (const section of [
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
  ]) {
    assert.match(template, new RegExp(`GOV-SECTION id="${section}"`));
  }

  assert.match(read('AGENTS.md'), /governed implementation plan must be decision-complete/i);
  assert.match(read('codex.md'), /governed implementation plan/i);
  assert.match(read('.cursor/rules/execution-governance.mdc'), /decision-complete/i);
});

test('current decision-complete plan validates', () => {
  const result = validatePlanPackage({
    repoRoot,
    planDir: '.execution-governance/plans/governance-decision-complete-authoring-v1',
    phaseId: 'GOV-DCPA-1',
    mode: 'validate'
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test('plan-package validation rejects missing files, coverage mismatch, and vague plans', () => {
  const runtimeParent = path.join(repoRoot, '.execution-governance', 'runtime');
  mkdirSync(runtimeParent, { recursive: true });
  const root = mkdtempSync(path.join(runtimeParent, 'manu-gov-quality-'));
  try {
    const missing = makeFixture(root, 'missing', { omit: ['acceptance.json'] });
    assertFailure(missing, /missing required plan file acceptance\.json/);

    const mismatch = makeFixture(root, 'mismatch', { extraRequirement: true });
    assertFailure(mismatch, /requirement REQ-002 missing scope record/);

    const vague = makeFixture(root, 'vague', { vaguePlan: true });
    assertFailure(vague, /forbidden vague or placeholder phrase/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI reports legacy reauthor-required packages and rejects them for lockability', () => {
  const result = spawnSync('node', [
    cli,
    'validate',
    '--all-plans'
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false
  });
  assert.equal(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /REAUTHOR_REQUIRED/);
  assert.match(`${result.stdout}\n${result.stderr}`, /hosted-sandbox-environment-assurance-v1/);

  const lockMode = validatePlanPackage({
    repoRoot,
    planDir: '.execution-governance/plans/hosted-sandbox-environment-assurance-v1',
    mode: 'lock'
  });
  assert.equal(lockMode.ok, false);
  assert.match(lockMode.errors.join('\n'), /REAUTHOR_REQUIRED/);
});

test('strict validation is wired into CLI and activation sources', () => {
  const cliSource = read('tools/execution-governance/governance-cli.mjs');
  for (const name of ['lock', 'preflight', 'scopeCheck', 'runChecks', 'postflight', 'close', 'activateCursor']) {
    assert.match(cliSource, new RegExp(`function ${name}`));
  }
  assert.match(cliSource, /strictValidatePlanPackageOrThrow/);
  assert.match(read('tools/execution-governance/activate-secure-cursor-guard.mjs'), /selectPhaseScope/);
});

test('continuity docs preserve governance and production boundaries', () => {
  assert.match(read('HANDOFF_FOR_NEXT_CODEX.md'), /Decision-complete governance authoring/i);
  const risk = read('docs/RISK_REGISTER.md');
  assert.match(risk, /R-GOV-010/);
  assert.match(risk, /Production remains `NO-GO`|Production remains NO-GO/);
});

function assertFailure(planDir, pattern) {
  const result = validatePlanPackage({ repoRoot, planDir, phaseId: 'phase-1', mode: 'validate' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), pattern);
}

function makeFixture(root, name, options = {}) {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  const files = fixtureFiles(options);
  for (const [fileName, text] of Object.entries(files)) {
    if ((options.omit || []).includes(fileName)) continue;
    writeFileSync(path.join(dir, fileName), text, 'utf8');
  }
  const lock = {
    schemaVersion: '1.0.0',
    contractId: 'quality-fixture-v1',
    planHash: sha256File(path.join(dir, 'plan.md')),
    contractHash: sha256File(path.join(dir, 'contract.json')),
    scopeHash: sha256File(path.join(dir, 'scope.json')),
    acceptanceHash: files['acceptance.json'] && !options.omit?.includes('acceptance.json') ? sha256File(path.join(dir, 'acceptance.json')) : '',
    baseCommit: git('rev-parse', 'HEAD'),
    baseTree: git('rev-parse', 'HEAD^{tree}'),
    lockCommit: git('rev-parse', 'HEAD'),
    protectedManifest: [],
    artifactFreshnessPolicy: { requiresCommitSha: true, requiresRunId: true, requiresTimestamp: true, rejectsPreLockArtifacts: true }
  };
  if (!options.omit?.includes('lock.json')) writeFileSync(path.join(dir, 'lock.json'), `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  return path.relative(repoRoot, dir);
}

function fixtureFiles(options) {
  const status = {
    plan_state: 'LOCKED_FOR_IMPLEMENTATION',
    implementation_state: 'NOT_STARTED',
    executor_checks: 'NOT_RUN',
    independent_review: 'NOT_REQUESTED',
    user_acceptance: 'PENDING'
  };
  const requirements = [{
    requirementId: 'REQ-001',
    authoritySource: 'fixture',
    classification: 'IN_SCOPE',
    observableRequirement: 'Fixture requirement one has exact scope and acceptance coverage.',
    dependencies: [],
    status
  }];
  if (options.extraRequirement) {
    requirements.push({
      requirementId: 'REQ-002',
      authoritySource: 'fixture',
      classification: 'IN_SCOPE',
      observableRequirement: 'Fixture requirement two intentionally lacks coverage.',
      dependencies: [],
      status
    });
  }
  const contract = {
    schemaVersion: '1.0.0',
    governanceFormatVersion: '2.0.0',
    contractId: 'quality-fixture-v1',
    planVersion: '1.0.0',
    planTitle: 'Quality Fixture Plan',
    currentPhaseId: 'phase-1',
    phases: [{ phaseId: 'phase-1', title: 'Phase One', status: 'LOCKED_FOR_IMPLEMENTATION' }],
    authoritySources: ['fixture'],
    roleBindings: {
      requirementAuthority: 'fixture',
      planner: 'fixture',
      implementer: 'fixture',
      automaticVerifier: 'fixture',
      independentReviewer: 'NOT_REQUESTED unless user explicitly requests review',
      manualReviewer: 'fixture',
      finalAcceptanceAuthority: 'user'
    },
    status,
    requirements
  };
  const scope = {
    schemaVersion: '1.0.0',
    contractId: 'quality-fixture-v1',
    requirements: [{
      requirementId: 'REQ-001',
      phaseId: 'phase-1',
      allowedCreatePaths: ['docs/fixture.md'],
      allowedModifyPaths: [],
      protectedPaths: ['app/**'],
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
      maximumChangeScope: 'fixture only'
    }]
  };
  const acceptance = {
    schemaVersion: '1.0.0',
    contractId: 'quality-fixture-v1',
    acceptanceRecords: [{
      requirementId: 'REQ-001',
      phaseId: 'phase-1',
      authoritySource: 'fixture',
      observableRequirement: 'Fixture requirement one has exact scope and acceptance coverage.',
      oracleType: 'AUTOMATED',
      oracleOwner: 'fixture',
      oracleLocation: 'node --version',
      protectionMechanism: 'fixture',
      exactEvidenceCommand: 'node --version',
      exactEvidenceCommandSpec: { cwd: '.', executable: 'node', args: ['--version'], timeoutSeconds: 30, networkPolicy: 'FORBIDDEN', artifactPolicy: 'stdout only' },
      preconditions: [],
      expectedExitCode: 0,
      requiredAssertions: ['fixture validates'],
      requiredScenarioMatrix: ['fixture'],
      negativeControls: [],
      expectedTestIds: ['REQ-001'],
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
  return {
    'plan.md': makePlanMarkdown(options.vaguePlan),
    'contract.json': `${JSON.stringify(contract, null, 2)}\n`,
    'scope.json': `${JSON.stringify(scope, null, 2)}\n`,
    'acceptance.json': `${JSON.stringify(acceptance, null, 2)}\n`
  };
}

function makePlanMarkdown(vague) {
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
  return `# Quality Fixture Plan

Plan version: 1.0.0

Plan state: LOCKED_FOR_IMPLEMENTATION

<!-- GOV-PHASE id="phase-1" title="Phase One" -->

${sections.map((section) => `## ${section}
<!-- GOV-SECTION id="${section}" -->

Concrete ${section} content for the quality fixture${vague && section === 'ordered-steps' ? ' and gerekli duzenlemeleri yap' : ''}.
`).join('\n')}

<!-- GOV-STEP id="REQ-STEP-001" -->
1. Execute the exact fixture edit.

<!-- GOV-REQ id="REQ-001" -->
REQ-001 passes only when exact fixture validation succeeds.

${vague ? '<!-- GOV-REQ id="REQ-002" -->\nREQ-002 remains intentionally uncovered.\n' : ''}
`;
}

function read(relPath) {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function git(...args) {
  const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

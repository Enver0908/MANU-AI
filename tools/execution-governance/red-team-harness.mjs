#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = findRepoRoot(process.cwd());
const runtimeRoot = path.join(repoRoot, '.execution-governance', 'runtime', 'phase6-red-team');
const activeRoot = path.join(repoRoot, '.execution-governance', 'active');
const scenarios = [];

try {
  rmSync(runtimeRoot, { recursive: true, force: true });
  mkdirSync(runtimeRoot, { recursive: true });
  writeActivation(inactiveActivation());

  scenario('hook denies product write without active scope', () => {
    const result = runHook('preToolUse', { file_path: 'app/src/app/page.tsx' });
    assertExit(result, 2);
    assertIncludes(result.stdout, 'Activation status does not allow mutation');
  });

  scenario('hook denies governance bootstrap write without active scope', () => {
    const result = runHook('preToolUse', { file_path: 'docs/execution-governance/PHASE_6_RED_TEAM_PILOT_CLOSURE_EVIDENCE.md' });
    assertExit(result, 2);
    assertIncludes(result.stdout, 'Activation status does not allow mutation');
  });

  scenario('CHBOM-001-BOM-STDIN-DENY hook denies BOM-prefixed governance bootstrap payload without active scope', () => {
    const result = runHook('preToolUse', { file_path: 'docs/execution-governance/CHBOM_ALLOWED.md' }, { bom: true });
    assertExit(result, 2);
    assertIncludes(result.stdout, 'Activation status does not allow mutation');
  });

  scenario('CHBOM-001-BOM-SAFE-SHELL-ALLOW hook allows BOM-prefixed safe shell payload', () => {
    writeActivation(discoveryActivation());
    const result = runHook('beforeShellExecution', { command: 'git status --short' }, { bom: true });
    assertExit(result, 0);
    assertIncludes(result.stdout, '"permission":"allow"');
    writeActivation(inactiveActivation());
  });

  scenario('hook fails closed on malformed payload', () => {
    const result = spawnSync(process.execPath, ['.cursor/hooks/governance-guard.mjs', 'preToolUse'], {
      cwd: repoRoot,
      input: '{',
      encoding: 'utf8',
      shell: false
    });
    assertExit(result, 2);
    assertIncludes(result.stdout, 'fail-closed');
  });

  scenario('CHBOM-001-MALFORMED-DENY hook still fails closed on malformed payload', () => {
    const result = spawnSync(process.execPath, ['.cursor/hooks/governance-guard.mjs', 'preToolUse'], {
      cwd: repoRoot,
      input: '\uFEFF{',
      encoding: 'utf8',
      shell: false
    });
    assertExit(result, 2);
    assertIncludes(result.stdout, 'fail-closed');
  });

  scenario('hook denies secret-like reads', () => {
    const result = runHook('beforeReadFile', { file_path: '.env' });
    assertExit(result, 2);
    assertIncludes(result.stdout, 'Reading secret-like path is blocked');
  });

  scenario('CHBOM-003-BOM-SECRET-READ-DENY hook denies BOM-prefixed secret-like reads', () => {
    const result = runHook('beforeReadFile', { file_path: '.env' }, { bom: true });
    assertExit(result, 2);
    assertIncludes(result.stdout, 'Reading secret-like path is blocked');
  });

  scenario('hook denies unsafe shell commands and allows safe status command', () => {
    const denied = runHook('beforeShellExecution', { command: 'git push origin main' });
    assertExit(denied, 2);
    assertIncludes(denied.stdout, 'activation status is not active');
    writeActivation(discoveryActivation());
    const allowed = runHook('beforeShellExecution', { command: 'git status --short' });
    assertExit(allowed, 0);
    writeActivation(inactiveActivation());
  });

  scenario('CHBOM-003-BOM-UNSAFE-SHELL-DENY hook denies BOM-prefixed unsafe shell commands', () => {
    const denied = runHook('beforeShellExecution', { command: 'git push origin main' }, { bom: true });
    assertExit(denied, 2);
    assertIncludes(denied.stdout, 'activation status is not active');
  });

  scenario('CHBOM-003-BOM-PRODUCT-WRITE-DENY hook denies BOM-prefixed product write without active scope', () => {
    const result = runHook('preToolUse', { file_path: 'app/src/app/page.tsx' }, { bom: true });
    assertExit(result, 2);
    assertIncludes(result.stdout, 'Activation status does not allow mutation');
  });

  scenario('hook enforces active scope allow and protected lists', () => {
    writeActivation(activeActivation({
      allowedCreatePaths: ['docs/execution-governance/allowed-smoke.md'],
      allowedModifyPaths: [],
      protectedPaths: ['PLAN.md'],
      forbiddenPaths: ['app/src/app/page.tsx']
    }));
    const allowed = runHook('preToolUse', { file_path: 'docs/execution-governance/allowed-smoke.md' });
    assertExit(allowed, 0);
    const protectedPath = runHook('preToolUse', { file_path: 'PLAN.md' });
    assertExit(protectedPath, 2);
    assertIncludes(protectedPath.stdout, 'outside active signed governance scope');
    const outside = runHook('preToolUse', { file_path: 'app/src/app/page.tsx' });
    assertExit(outside, 2);
    writeActivation(inactiveActivation());
  });

  scenario('CHBOM-002-BOM-ACTIVE-SCOPE-ALLOW hook parses BOM-prefixed active scope and allows listed path', () => {
    withBomActiveScope(() => {
      const allowed = runHook('preToolUse', { file_path: 'docs/execution-governance/bom-allowed-smoke.md' }, { bom: true });
      assertExit(allowed, 0);
      assertIncludes(allowed.stdout, '"permission":"allow"');
    });
  });

  scenario('CHBOM-002-BOM-ACTIVE-SCOPE-PROTECTED-DENY hook parses BOM-prefixed active scope and denies protected path', () => {
    withBomActiveScope(() => {
      const protectedPath = runHook('preToolUse', { file_path: 'PLAN.md' }, { bom: true });
      assertExit(protectedPath, 2);
      assertIncludes(protectedPath.stdout, 'outside active signed governance scope');
    });
  });

  scenario('CHBOM-002-BOM-ACTIVE-SCOPE-OUTSIDE-DENY hook parses BOM-prefixed active scope and denies outside path', () => {
    withBomActiveScope(() => {
      const outside = runHook('preToolUse', { file_path: 'app/src/app/page.tsx' }, { bom: true });
      assertExit(outside, 2);
      assertIncludes(outside.stdout, 'outside active signed governance scope');
    });
  });

  scenario('validate rejects shell-wrapper executable specs', () => {
    const planDir = createPlanFixture('shell-wrapper', {
      commandSpec: {
        cwd: '.',
        executable: 'node; echo bad',
        args: [],
        timeoutSeconds: 5,
        networkPolicy: 'FORBIDDEN',
        artifactPolicy: 'stdout/stderr only'
      }
    });
    const result = runCli(['validate', '--plan-dir', rel(planDir)]);
    assertExit(result, 1);
    assertIncludes(result.stderr, 'executable must be a single binary name/path');
  });

  scenario('preflight rejects tampered locked plan hash', () => {
    const planDir = createPlanFixture('tamper', {
      commandSpec: passCommandSpec()
    });
    runCliOk(['lock', '--plan-dir', rel(planDir), '--out', `${rel(planDir)}/lock.json`, '--write', '--allow-dirty']);
    writeFileSync(path.join(planDir, 'plan.md'), '# Tampered Plan\n', 'utf8');
    const result = runCli(['preflight', '--plan-dir', rel(planDir), '--allow-dirty']);
    assertExit(result, 1);
    assertIncludes(result.stderr, 'planHash mismatch');
  });

  scenario('postflight rejects stale run-record artifact', () => {
    const planDir = createPlanFixture('stale-artifact', {
      commandSpec: passCommandSpec()
    });
    runCliOk(['lock', '--plan-dir', rel(planDir), '--out', `${rel(planDir)}/lock.json`, '--write', '--allow-dirty']);
    mkdirSync(path.join(repoRoot, '.execution-governance', 'runtime', 'run-records'), { recursive: true });
    writeJson(path.join(repoRoot, '.execution-governance', 'runtime', 'run-records', 'phase6-stale.json'), {
      schemaVersion: '1.0.0',
      runId: 'phase6-stale',
      records: [
        {
          schemaVersion: '1.0.0',
          contractId: 'phase6-stale-artifact',
          requirementId: 'PHASE6-REQ-001',
          runId: 'phase6-stale-record',
          timestamp: '2020-01-01T00:00:00.000Z',
          commitSha: '0000000000000000000000000000000000000000',
          actor: 'red-team',
          command: null,
          exitCode: 0,
          result: 'PASS',
          detail: 'synthetic stale artifact'
        }
      ]
    });
    const result = runCli(['postflight', '--plan-dir', rel(planDir)]);
    assertExit(result, 1);
    assertIncludes(result.stderr, 'no fresh PASS run-record bound to HEAD');
    rmSync(path.join(repoRoot, '.execution-governance', 'runtime', 'run-records', 'phase6-stale.json'), { force: true });
  });

  scenario('scope-check rejects forbidden diff outside manifest', () => {
    const smokePath = 'docs/execution-governance/phase6-forbidden-diff-smoke.md';
    writeFileSync(path.join(repoRoot, smokePath), 'forbidden diff smoke\n', 'utf8');
    try {
      const planDir = createPlanFixture('forbidden-diff', {
        commandSpec: passCommandSpec(),
        allowedPaths: []
      });
      runCliOk(['lock', '--plan-dir', rel(planDir), '--out', `${rel(planDir)}/lock.json`, '--write', '--allow-dirty']);
      const result = runCli(['scope-check', '--plan-dir', rel(planDir)]);
      assertExit(result, 1);
      assertIncludes(result.stderr, 'not in allowedCreatePaths/allowedModifyPaths');
    } finally {
      rmSync(path.join(repoRoot, smokePath), { force: true });
    }
  });

  scenario('postflight rejects changed test skip/only markers', () => {
    const smokePath = 'docs/execution-governance/phase6-skip-only-smoke.test.js';
    writeFileSync(path.join(repoRoot, smokePath), "test.only('bad', () => {});\n", 'utf8');
    try {
      const planDir = createPlanFixture('skip-only', {
        commandSpec: passCommandSpec(),
        allowedPaths: currentChangedPaths()
      });
      runCliOk(['lock', '--plan-dir', rel(planDir), '--out', `${rel(planDir)}/lock.json`, '--write', '--allow-dirty']);
      runCliOk(['run-checks', '--plan-dir', rel(planDir)]);
      const result = runCli(['postflight', '--plan-dir', rel(planDir)]);
      assertExit(result, 1);
      assertIncludes(result.stderr, 'forbidden skip/only marker');
    } finally {
      rmSync(path.join(repoRoot, smokePath), { force: true });
    }
  });

  scenario('positive pilot closes with no independent review requested', () => {
    const planDir = createPlanFixture('positive-pilot', {
      commandSpec: passCommandSpec(),
      allowedPaths: currentChangedPaths()
    });
    runCliOk(['lock', '--plan-dir', rel(planDir), '--out', `${rel(planDir)}/lock.json`, '--write', '--allow-dirty']);
    runCliOk(['preflight', '--plan-dir', rel(planDir), '--allow-dirty']);
    runCliOk(['run-checks', '--plan-dir', rel(planDir)]);
    runCliOk(['postflight', '--plan-dir', rel(planDir)]);
    runCliOk(['close', '--plan-dir', rel(planDir)]);
  });

  scenario('review templates preserve explicit full and targeted review boundaries', () => {
    const template = JSON.parse(readFileSync(path.join(repoRoot, '.execution-governance/templates/review-record.json'), 'utf8'));
    assert(template.requestedByUser === true, 'review template must require user request');
    assert(template.reviewerMayModifyImplementation === false, 'reviewer must not modify implementation');
    assert(template.reviewScope === 'FULL_PLAN_COMPLIANCE', 'default review template must be full plan compliance');
    const schema = JSON.parse(readFileSync(path.join(repoRoot, '.execution-governance/schemas/review-record.schema.json'), 'utf8'));
    const scopes = schema.properties.reviewScope.enum;
    assert(scopes.includes('FULL_PLAN_COMPLIANCE'), 'full review scope enum missing');
    assert(scopes.includes('TARGETED_CORRECTED_ITEMS'), 'targeted review scope enum missing');
  });

  scenario('clean CI workflow remains read-only and runs red-team harness', () => {
    const workflow = readFileSync(path.join(repoRoot, '.github/workflows/execution-governance.yml'), 'utf8');
    for (const marker of [
      'permissions:\n  contents: read',
      'pull_request:',
      'workflow_dispatch:',
      'persist-credentials: false',
      'node tools/execution-governance/red-team-harness.mjs'
    ]) {
      assertIncludes(workflow, marker);
    }
    for (const pattern of [
      /pull_request_target:/,
      /contents:\s*write/,
      /deployments:\s*write/,
      /secrets\./,
      /\bnpm\s+(install|i|update|audit\s+fix)\b/,
      /\bpnpm\s+(install|update|add|remove)\b/,
      /\byarn\s+(install|add|remove|upgrade)\b/,
      /\bgit\s+push\b/,
      /\b(vercel|netlify|firebase)\s+deploy\b/
    ]) {
      assert(!pattern.test(workflow), `forbidden workflow pattern found: ${pattern}`);
    }
  });

  scenario('governance runtime artifacts are not tracked', () => {
    const result = run('git', ['ls-files', '.execution-governance/runtime/**']);
    assertExit(result, 0);
    assert(result.stdout.trim() === '', 'tracked runtime artifacts must be empty');
  });

  printSummary();
  process.exitCode = scenarios.some((item) => item.status !== 'PASS') ? 1 : 0;
} finally {
  rmSync(activeRoot, { recursive: true, force: true });
  rmSync(runtimeRoot, { recursive: true, force: true });
}

function scenario(name, fn) {
  try {
    fn();
    scenarios.push({ name, status: 'PASS' });
    console.log(`PASS ${name}`);
  } catch (error) {
    scenarios.push({ name, status: 'FAIL', detail: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function createPlanFixture(name, options) {
  const planDir = path.join(runtimeRoot, name);
  mkdirSync(planDir, { recursive: true });
  const contractId = `phase6-${name}`;
  const allowedPaths = options.allowedPaths ?? currentChangedPaths();
  writeFileSync(path.join(planDir, 'plan.md'), `# Phase 6 ${name} Plan\n`, 'utf8');
  writeJson(path.join(planDir, 'contract.json'), {
    schemaVersion: '1.0.0',
    contractId,
    planVersion: '1.0.0',
    planTitle: `Phase 6 ${name}`,
    authoritySources: ['docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md'],
    roleBindings: {
      requirementAuthority: 'user and named authority documents',
      planner: 'phase6-red-team-harness',
      implementer: 'phase6-red-team-harness',
      automaticVerifier: 'governance-cli',
      independentReviewer: 'NOT_REQUESTED unless user explicitly requests review',
      manualReviewer: 'user-approved human reviewer when required',
      finalAcceptanceAuthority: 'user'
    },
    status: {
      plan_state: 'LOCKED_FOR_IMPLEMENTATION',
      implementation_state: 'EXECUTOR_VERIFIED',
      executor_checks: 'PASS',
      independent_review: 'NOT_REQUESTED',
      user_acceptance: 'PENDING'
    },
    requirements: [
      {
        requirementId: 'PHASE6-REQ-001',
        authoritySource: 'phase6-red-team',
        classification: 'IN_SCOPE',
        observableRequirement: 'Synthetic governance pilot requirement.',
        dependencies: [],
        status: {
          plan_state: 'LOCKED_FOR_IMPLEMENTATION',
          implementation_state: 'EXECUTOR_VERIFIED',
          executor_checks: 'PASS',
          independent_review: 'NOT_REQUESTED',
          user_acceptance: 'PENDING'
        }
      }
    ]
  });
  writeJson(path.join(planDir, 'scope.json'), {
    schemaVersion: '1.0.0',
    contractId,
    requirements: [
      {
        requirementId: 'PHASE6-REQ-001',
        phaseId: 'PHASE6-PILOT',
        allowedCreatePaths: allowedPaths,
        allowedModifyPaths: allowedPaths,
        protectedPaths: ['.git/config'],
        forbiddenPaths: ['app/src/app/page.tsx'],
        allowedCommands: [],
        forbiddenCommands: [],
        allowedDependencies: [],
        forbiddenDependencyChanges: true,
        allowedSchemaChanges: [],
        allowedNetworkOrExternalEffects: [],
        allowedMcpTools: [],
        allowSubagents: false,
        generatedArtifactPolicy: 'runtime only',
        documentationReconciliation: [],
        maximumChangeScope: 'phase6 synthetic fixture'
      }
    ]
  });
  writeJson(path.join(planDir, 'acceptance.json'), {
    schemaVersion: '1.0.0',
    contractId,
    acceptanceRecords: [
      {
        requirementId: 'PHASE6-REQ-001',
        authoritySource: 'phase6-red-team',
        observableRequirement: 'Synthetic governance pilot requirement.',
        oracleType: 'AUTOMATED',
        oracleOwner: 'governance-cli',
        oracleLocation: 'tools/execution-governance/red-team-harness.mjs',
        protectionMechanism: 'phase6 synthetic harness',
        exactEvidenceCommand: '',
        exactEvidenceCommandSpec: options.commandSpec,
        preconditions: [],
        expectedExitCode: 0,
        requiredAssertions: ['command exits with expected code'],
        requiredScenarioMatrix: ['phase6 synthetic'],
        negativeControls: [],
        expectedTestIds: ['PHASE6-REQ-001'],
        expectedTestCountOrInventory: '1 synthetic record',
        artifactType: 'run-record',
        artifactLocation: '.execution-governance/runtime/run-records',
        artifactRetentionPolicy: 'ignored runtime artifact',
        artifactPrivacyPolicy: 'No secrets, PHI, raw prompts, raw health data, or real user data.',
        commitShaBinding: 'required',
        runIdAndTimestampBinding: 'required',
        cleanEnvironmentRequirements: [],
        independentVerifier: 'NOT_REQUESTED unless user explicitly requests review',
        passRule: 'PASS only when run-record is fresh and bound to HEAD.',
        failRule: 'FAIL when command exits unexpectedly or postflight rejects evidence.',
        blockedRule: 'BLOCKED when automated command cannot run.',
        forbiddenEquivalences: ['Old artifact is not fresh evidence']
      }
    ]
  });
  return planDir;
}

function passCommandSpec() {
  return {
    cwd: '.',
    executable: process.execPath,
    args: ['-e', "console.log('PHASE6_PASS_COMMAND_OK')"],
    timeoutSeconds: 5,
    networkPolicy: 'FORBIDDEN',
    artifactPolicy: 'stdout/stderr only'
  };
}

function currentChangedPaths() {
  const tracked = run('git', ['diff', '--name-only']).stdout.split(/\r?\n/).filter(Boolean);
  const staged = run('git', ['diff', '--cached', '--name-only']).stdout.split(/\r?\n/).filter(Boolean);
  const untracked = run('git', ['ls-files', '--others', '--exclude-standard']).stdout.split(/\r?\n/).filter(Boolean);
  return [...new Set([...tracked, ...staged, ...untracked].map(normalizeRel))].sort();
}

function runCli(args) {
  return run(process.execPath, ['tools/execution-governance/governance-cli.mjs', ...args]);
}

function runCliOk(args) {
  const result = runCli(args);
  assertExit(result, 0);
  return result;
}

function runHook(event, payload, options = {}) {
  return spawnSync(process.execPath, ['tools/execution-governance/secure-cursor-guard.mjs', event], {
    cwd: repoRoot,
    input: `${options.bom ? '\uFEFF' : ''}${JSON.stringify(cursorPayload(event, payload))}`,
    encoding: 'utf8',
    shell: false,
    env: {
      ...process.env,
      CURSOR_PROJECT_DIR: repoRoot,
      MANU_GOVERNANCE_TEST_MODE: '1',
      MANU_GOVERNANCE_ROOT: runtimeRoot
    }
  });
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false
  });
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeJsonWithBom(file, value) {
  writeFileSync(file, `\uFEFF${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function withBomActiveScope(fn) {
  writeJsonWithBom(path.join(runtimeRoot, 'activation.json'), activeActivation({
    allowedCreatePaths: ['docs/execution-governance/bom-allowed-smoke.md'],
    allowedModifyPaths: [],
    protectedPaths: ['PLAN.md'],
    forbiddenPaths: ['app/src/app/page.tsx']
  }));
  try {
    fn();
  } finally {
    writeActivation(inactiveActivation());
  }
}

function cursorPayload(event, payload) {
  if (event === 'preToolUse' && !payload.tool_name) {
    return { tool_name: 'Write', tool_input: payload };
  }
  return payload;
}

function writeActivation(value) {
  writeJson(path.join(runtimeRoot, 'activation.json'), value);
}

function inactiveActivation() {
  return {
    schemaVersion: '1.0.0',
    status: 'INACTIVE_FAIL_CLOSED',
    repoRoot,
    contractId: '',
    phaseId: '',
    lockCommit: '',
    scopeHash: '',
    scope: emptyScope()
  };
}

function discoveryActivation() {
  return {
    schemaVersion: '1.0.0',
    status: 'DISCOVERY_READ_ONLY',
    repoRoot,
    contractId: '',
    phaseId: '',
    lockCommit: '',
    scopeHash: '',
    scope: {
      ...emptyScope(),
      allowedCommands: [
        { cwd: '.', executable: 'git', args: ['status', '--short'], timeoutSeconds: 60, networkPolicy: 'FORBIDDEN', artifactPolicy: 'stdout/stderr only' }
      ]
    }
  };
}

function activeActivation(scope) {
  const fullScope = {
    ...emptyScope(),
    allowedCreatePaths: scope.allowedCreatePaths || [],
    allowedModifyPaths: scope.allowedModifyPaths || [],
    protectedPaths: scope.protectedPaths || [],
    forbiddenPaths: scope.forbiddenPaths || []
  };
  return {
    schemaVersion: '1.0.0',
    status: 'ACTIVE_SIGNED_SCOPE',
    repoRoot,
    contractId: 'phase6-active-scope-smoke',
    phaseId: 'PHASE6-PILOT',
    lockCommit: gitHead(),
    allowImplementationHead: true,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    scopeHash: sha256Json(fullScope),
    scope: fullScope
  };
}

function emptyScope() {
  return {
    allowedCreatePaths: [],
    allowedModifyPaths: [],
    protectedPaths: [],
    forbiddenPaths: [],
    allowedCommands: [],
    allowedMcpTools: [],
    allowSubagents: false
  };
}

function gitHead() {
  return run('git', ['rev-parse', 'HEAD']).stdout.trim();
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertExit(result, expected) {
  if (result.status !== expected) {
    throw new Error(`expected exit ${expected}, got ${result.status}; stdout=${result.stdout}; stderr=${result.stderr}`);
  }
}

function assertIncludes(value, needle) {
  if (!String(value).includes(needle)) {
    throw new Error(`expected text to include ${needle}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function printSummary() {
  const passed = scenarios.filter((item) => item.status === 'PASS').length;
  const failed = scenarios.length - passed;
  console.log(`PHASE6_RED_TEAM_SUMMARY total=${scenarios.length} passed=${passed} failed=${failed}`);
}

function rel(file) {
  return normalizeRel(path.relative(repoRoot, file));
}

function normalizeRel(value) {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '');
}

function findRepoRoot(start) {
  let current = path.resolve(start);
  while (true) {
    if (existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

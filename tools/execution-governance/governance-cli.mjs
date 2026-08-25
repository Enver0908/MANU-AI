#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listPlanDirectories,
  selectPhaseScope,
  strictValidatePlanPackageOrThrow,
  validatePlanPackage
} from './lib/plan-package-validator.mjs';

const COMMANDS = new Set([
  'doctor',
  'validate',
  'validate-template',
  'lock',
  'preflight',
  'scope-check',
  'run-checks',
  'postflight',
  'close',
  'activate-cursor',
  'cursor-session'
]);

const STATUS_OK = 0;
const STATUS_FAIL = 1;
const STATUS_BLOCKED = 2;

function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return STATUS_OK;
  }
  if (!COMMANDS.has(command)) {
    fail(`Unknown command: ${command}`, STATUS_FAIL);
  }
  const options = parseOptions(args);
  const repoRoot = resolveRepoRoot(options.repo);
  const context = { repoRoot, options };

  if (command === 'doctor') return doctor(context);
  if (command === 'validate') return validate(context);
  if (command === 'validate-template') return validateTemplate(context);
  if (command === 'lock') return lock(context);
  if (command === 'preflight') return preflight(context);
  if (command === 'scope-check') return scopeCheck(context);
  if (command === 'run-checks') return runChecks(context);
  if (command === 'postflight') return postflight(context);
  if (command === 'close') return close(context);
  if (command === 'activate-cursor') return activateCursor(context);
  if (command === 'cursor-session') return cursorSession(context);
  return STATUS_FAIL;
}

function printHelp() {
  console.log(`MANU-AI execution governance CLI

Usage:
  node tools/execution-governance/governance-cli.mjs <command> [options]

Commands:
  doctor       Check repository, Git, Node, policy, schemas, and templates.
  validate     Parse and structurally validate governance JSON files and plan packages.
  validate-template
               Validate governance templates as a template package.
  lock         Compute plan/contract/scope/acceptance hashes and optional lock file.
  preflight    Verify clean state, lock hashes, base commit/tree, and protected files.
  scope-check  Verify changed paths are allowed by scope.json.
  run-checks   Run acceptance commands with spawn and shell:false.
  postflight   Run scope, lock, run-record, freshness, and forbidden-pattern checks.
  close        Close only when postflight passes and independent review state is valid.
  activate-cursor
              Render or apply external Cursor activation for a locked plan.
  cursor-session
              Run user-friendly Cursor status, manual phase, or automatic governed execution automation.

Options:
  --repo <path>          Repository root. Defaults to cwd or discovered Git root.
  --plan-dir <path>     Plan directory containing plan.md, contract.json, scope.json, acceptance.json, lock.json.
  --out <path>          Output path for generated lock.json.
  --write               Allow lock command to write --out.
  --allow-dirty         Allow dirty worktree for lock/preflight when explicitly needed.
  --all-plans           Validate every plan package and enforce legacy disposition.
  --apply               activate-cursor writes ProgramData activation.json.
  --deactivate          activate-cursor writes fail-closed inactive state.
  --phase-id <id>       Phase identifier for activate-cursor.
  --allow-implementation-head
                        Allow implementation commits after the lock commit.
  --session <command>   cursor-session action: list, status, preflight, activate, deactivate, discovery, open, auto-preflight, auto-activate, or auto-open.
  --prompt <text>       Optional Cursor prompt text for automatic governed execution intent.
  --elevate             cursor-session uses the installed elevated broker.
`);
}

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (['--write', '--allow-dirty', '--apply', '--deactivate', '--allow-implementation-head', '--all-plans', '--elevate'].includes(arg)) {
      options[arg.slice(2)] = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (!value || value.startsWith('--')) {
        fail(`Missing value for ${arg}`, STATUS_FAIL);
      }
      options[key] = value;
      i += 1;
      continue;
    }
    fail(`Unexpected argument: ${arg}`, STATUS_FAIL);
  }
  return options;
}

function resolveRepoRoot(explicitRoot) {
  if (explicitRoot) return path.resolve(explicitRoot);
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', shell: false });
  if (git.status === 0) return path.resolve(git.stdout.trim());
  return process.cwd();
}

function doctor({ repoRoot }) {
  const checks = [];
  checks.push(check('repo root exists', existsSync(repoRoot), repoRoot));
  checks.push(check('git available', runGit(repoRoot, ['--version']).ok, 'git --version'));
  checks.push(check('node version supported', Number(process.versions.node.split('.')[0]) >= 22, process.version));
  checks.push(check('policy exists', existsSync(joinRepo(repoRoot, '.execution-governance/policy/governance-policy.json')), '.execution-governance/policy/governance-policy.json'));
  checks.push(check('schemas directory exists', existsSync(joinRepo(repoRoot, '.execution-governance/schemas')), '.execution-governance/schemas'));
  checks.push(check('templates directory exists', existsSync(joinRepo(repoRoot, '.execution-governance/templates')), '.execution-governance/templates'));
  const parsed = parseGovernanceJson(repoRoot);
  checks.push(check('governance JSON parses', parsed.ok, parsed.message));
  emitChecks('doctor', checks);
  return checks.every((item) => item.ok) ? STATUS_OK : STATUS_FAIL;
}

function validate({ repoRoot, options }) {
  if (options['all-plans']) return validateAllPlans({ repoRoot });
  if (options['plan-dir']) {
    return emitPlanPackageValidation(validatePlanPackage({
      repoRoot,
      planDir: options['plan-dir'],
      phaseId: options['phase-id'] || null,
      mode: 'validate'
    }));
  }
  const errors = [];
  const files = [];
  files.push(...listJsonFiles(joinRepo(repoRoot, '.execution-governance/policy')));
  files.push(...listJsonFiles(joinRepo(repoRoot, '.execution-governance/schemas')));
  files.push(...listJsonFiles(joinRepo(repoRoot, '.execution-governance/templates')));
  for (const file of files) {
    try {
      const value = readJson(file);
      structuralValidate(file, value, errors);
    } catch (error) {
      errors.push(`${relative(repoRoot, file)}: ${error.message}`);
    }
  }
  if (errors.length) {
    for (const error of errors) console.error(`FAIL ${error}`);
    return STATUS_FAIL;
  }
  console.log(`PASS validate ${files.length} file(s)`);
  return STATUS_OK;
}

function validateTemplate({ repoRoot }) {
  return emitPlanPackageValidation(validatePlanPackage({
    repoRoot,
    planDir: '.execution-governance/templates',
    mode: 'validate-template'
  }));
}

function validateAllPlans({ repoRoot }) {
  const results = listPlanDirectories(repoRoot).map((planDir) => validatePlanPackage({
    repoRoot,
    planDir,
    mode: 'validate-all'
  }));
  const warnings = results.flatMap((result) => result.warnings || []);
  const errors = results.flatMap((result) => result.errors || []);
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`FAIL ${error}`);
    return STATUS_FAIL;
  }
  console.log(`PASS validate-all ${results.length} plan package(s)`);
  return STATUS_OK;
}

function emitPlanPackageValidation(result) {
  for (const warning of result.warnings || []) console.warn(`WARN ${warning}`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`FAIL ${error}`);
    return STATUS_FAIL;
  }
  console.log(`PASS validate ${result.packageInfo.planDir}`);
  return STATUS_OK;
}

function lock({ repoRoot, options }) {
  const planDir = requirePlanDir(repoRoot, options);
  strictPackage(repoRoot, planDir, options, 'lock');
  const planPath = path.join(planDir, 'plan.md');
  const contractPath = path.join(planDir, 'contract.json');
  const scopePath = path.join(planDir, 'scope.json');
  const acceptancePath = path.join(planDir, 'acceptance.json');
  for (const file of [planPath, contractPath, scopePath, acceptancePath]) {
    if (!existsSync(file)) fail(`Missing required lock input: ${relative(repoRoot, file)}`, STATUS_FAIL);
  }
  if (!options['allow-dirty']) assertCleanWorktree(repoRoot);
  const contract = readJson(contractPath);
  const baseCommit = gitText(repoRoot, ['rev-parse', 'HEAD']);
  const baseTree = gitText(repoRoot, ['rev-parse', 'HEAD^{tree}']);
  const lockValue = {
    schemaVersion: '1.0.0',
    contractId: contract.contractId,
    planHash: sha256File(planPath),
    contractHash: sha256File(contractPath),
    scopeHash: sha256File(scopePath),
    acceptanceHash: sha256File(acceptancePath),
    baseCommit,
    baseTree,
    lockCommit: '',
    protectedManifest: buildProtectedManifest(repoRoot),
    artifactFreshnessPolicy: {
      requiresCommitSha: true,
      requiresRunId: true,
      requiresTimestamp: true,
      rejectsPreLockArtifacts: true
    }
  };
  const rendered = `${JSON.stringify(lockValue, null, 2)}\n`;
  if (options.write) {
    const out = options.out ? resolveInsideRepo(repoRoot, options.out) : path.join(planDir, 'lock.json');
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, rendered, 'utf8');
    console.log(`PASS lock wrote ${relative(repoRoot, out)}`);
  } else {
    process.stdout.write(rendered);
  }
  return STATUS_OK;
}

function preflight({ repoRoot, options }) {
  const planDir = requirePlanDir(repoRoot, options);
  strictPackage(repoRoot, planDir, options, 'preflight');
  if (!options['allow-dirty']) assertCleanWorktree(repoRoot);
  const failures = verifyLock(repoRoot, planDir, {
    allowImplementationHead: options['allow-implementation-head'] === true
  });
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    return STATUS_FAIL;
  }
  console.log('PASS preflight');
  return STATUS_OK;
}

function scopeCheck({ repoRoot, options }) {
  const planDir = requirePlanDir(repoRoot, options);
  strictPackage(repoRoot, planDir, options, 'scope-check');
  const rawScope = readJson(path.join(planDir, 'scope.json'));
  const scope = options['phase-id'] ? selectPhaseScope(rawScope, options['phase-id']) : rawScope;
  const allowed = new Set();
  const protectedPaths = new Set();
  for (const requirement of scope.requirements || []) {
    for (const item of requirement.allowedCreatePaths || []) allowed.add(normalizeRel(item));
    for (const item of requirement.allowedModifyPaths || []) allowed.add(normalizeRel(item));
    for (const item of requirement.protectedPaths || []) protectedPaths.add(normalizeRel(item));
  }
  const changed = getChangedPaths(repoRoot);
  const failures = [];
  for (const file of changed) {
    if (protectedPaths.has(file)) failures.push(`${file} is protected`);
    if (!allowed.has(file)) failures.push(`${file} is not in allowedCreatePaths/allowedModifyPaths`);
  }
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    return STATUS_FAIL;
  }
  console.log(`PASS scope-check ${changed.length} changed path(s)`);
  return STATUS_OK;
}

async function runChecks({ repoRoot, options }) {
  const planDir = requirePlanDir(repoRoot, options);
  strictPackage(repoRoot, planDir, options, 'run-checks');
  const acceptance = readJson(path.join(planDir, 'acceptance.json'));
  const acceptanceRecords = options['phase-id']
    ? (acceptance.acceptanceRecords || []).filter((record) => record.phaseId === options['phase-id'])
    : (acceptance.acceptanceRecords || []);
  const records = [];
  let hasFailure = false;
  let hasBlocked = false;
  for (const record of acceptanceRecords) {
    if (record.oracleType === 'MANUAL' || record.oracleType === 'PROPOSED_NOT_INSTALLED') {
      hasBlocked = true;
      records.push(runRecord(repoRoot, acceptance.contractId, record, null, 'BLOCKED', 'No automated command installed for this oracle.'));
      continue;
    }
    if (!record.exactEvidenceCommandSpec) {
      hasBlocked = true;
      records.push(runRecord(repoRoot, acceptance.contractId, record, null, 'BLOCKED', 'Missing exactEvidenceCommandSpec.'));
      continue;
    }
    const result = await runCommandSpec(repoRoot, record.exactEvidenceCommandSpec);
    const expected = Number.isInteger(record.expectedExitCode) ? record.expectedExitCode : 0;
    const status = result.exitCode === expected ? 'PASS' : 'FAIL';
    if (status === 'FAIL') hasFailure = true;
    records.push(runRecord(repoRoot, acceptance.contractId, record, result, status, result.stderr.trim()));
  }
  const outputDir = joinRepo(repoRoot, '.execution-governance/runtime/run-records');
  mkdirSync(outputDir, { recursive: true });
  const runId = makeRunId();
  const outputPath = path.join(outputDir, `${runId}.json`);
  writeFileSync(outputPath, `${JSON.stringify({ schemaVersion: '1.0.0', runId, records }, null, 2)}\n`, 'utf8');
  console.log(`${hasFailure ? 'FAIL' : hasBlocked ? 'BLOCKED' : 'PASS'} run-checks ${relative(repoRoot, outputPath)}`);
  return hasFailure ? STATUS_FAIL : hasBlocked ? STATUS_BLOCKED : STATUS_OK;
}

function postflight({ repoRoot, options }) {
  const planDir = requirePlanDir(repoRoot, options);
  const failures = [];
  try {
    strictValidatePlanPackageOrThrow({
      repoRoot,
      planDir,
      phaseId: options['phase-id'] || null,
      mode: 'postflight'
    });
  } catch (error) {
    failures.push(error.message);
  }
  failures.push(...verifyLock(repoRoot, planDir, {
    allowImplementationHead: options['allow-implementation-head'] === true
  }));
  const scopeExit = scopeCheck({ repoRoot, options });
  if (scopeExit !== STATUS_OK) failures.push('scope-check failed');
  failures.push(...verifyRunRecordFreshness(repoRoot, planDir));
  const changed = getChangedPaths(repoRoot);
  for (const file of changed) {
    if (/(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|package\.json)$/i.test(file)) {
      failures.push(`dependency surface changed: ${file}`);
    }
    if (/^app\/supabase\/migrations\//i.test(file)) {
      failures.push(`migration surface changed: ${file}`);
    }
    failures.push(...scanChangedTestFileForSkipOnly(repoRoot, file));
  }
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    return STATUS_FAIL;
  }
  console.log('PASS postflight');
  return STATUS_OK;
}

function verifyRunRecordFreshness(repoRoot, planDir) {
  const acceptance = readJson(path.join(planDir, 'acceptance.json'));
  const automatedRecords = (acceptance.acceptanceRecords || [])
    .filter((record) => ['AUTOMATED', 'HYBRID'].includes(record.oracleType));
  if (automatedRecords.length === 0) return [];
  const contractId = acceptance.contractId;
  const currentCommit = gitText(repoRoot, ['rev-parse', 'HEAD']);
  const records = listRunRecords(repoRoot)
    .flatMap((value) => Array.isArray(value.records) ? value.records : [])
    .filter((record) => record.contractId === contractId);
  const failures = [];
  for (const acceptanceRecord of automatedRecords) {
    const matching = records.filter((record) => record.requirementId === acceptanceRecord.requirementId);
    if (matching.length === 0) {
      failures.push(`missing run-record for automated requirement ${acceptanceRecord.requirementId}`);
      continue;
    }
    const freshPass = matching.some((record) => record.result === 'PASS' && record.commitSha === currentCommit && isIsoTimestamp(record.timestamp));
    if (!freshPass) {
      failures.push(`no fresh PASS run-record bound to HEAD for automated requirement ${acceptanceRecord.requirementId}`);
    }
  }
  return failures;
}

function listRunRecords(repoRoot) {
  const runRecordDir = joinRepo(repoRoot, '.execution-governance/runtime/run-records');
  if (!existsSync(runRecordDir)) return [];
  return readdirSync(runRecordDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(runRecordDir, name))
    .map((file) => readJson(file));
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function scanChangedTestFileForSkipOnly(repoRoot, relPath) {
  if (!/\.(test|spec)\.[cm]?[jt]sx?$/i.test(relPath)) return [];
  const file = joinRepo(repoRoot, relPath);
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8');
  const forbidden = [
    /\b(?:test|it|describe)\.only\s*\(/,
    /\b(?:test|it|describe)\.skip\s*\(/,
    /\bskip\s*:\s*true\b/
  ];
  return forbidden
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `changed test file ${relPath} contains forbidden skip/only marker ${pattern}`);
}

function close(context) {
  const planDir = requirePlanDir(context.repoRoot, context.options);
  try {
    strictValidatePlanPackageOrThrow({
      repoRoot: context.repoRoot,
      planDir,
      phaseId: context.options['phase-id'] || null,
      mode: 'close'
    });
  } catch (error) {
    console.error(error.message);
    return STATUS_FAIL;
  }
  const contract = readJson(path.join(planDir, 'contract.json'));
  const postflightStatus = postflight(context);
  if (postflightStatus !== STATUS_OK) return postflightStatus;
  const reviewState = contract.status?.independent_review;
  if (reviewState && !['NOT_REQUESTED', 'PASS'].includes(reviewState)) {
    console.error(`FAIL independent_review must be NOT_REQUESTED or PASS to close, got ${reviewState}`);
    return STATUS_FAIL;
  }
  const executorState = contract.status?.executor_checks;
  if (executorState !== 'PASS') {
    console.error(`FAIL executor_checks must be PASS to close, got ${executorState}`);
    return STATUS_FAIL;
  }
  console.log('PASS close');
  return STATUS_OK;
}

function activateCursor({ repoRoot, options }) {
  if (!options['plan-dir']) fail('--plan-dir is required for activate-cursor', STATUS_FAIL);
  if (!options.deactivate && !options['phase-id']) fail('--phase-id is required for activate-cursor', STATUS_FAIL);
  if (!options.deactivate) {
    strictPackage(repoRoot, resolveInsideRepo(repoRoot, options['plan-dir']), options, 'activate');
  }
  const script = joinRepo(repoRoot, 'tools/execution-governance/activate-secure-cursor-guard.mjs');
  if (!existsSync(script)) fail(`Missing activation script: ${relative(repoRoot, script)}`, STATUS_FAIL);
  const args = [script, '--plan-dir', options['plan-dir']];
  if (options.apply) args.push('--apply');
  if (options.deactivate) args.push('--deactivate');
  if (options['phase-id']) args.push('--phase-id', options['phase-id']);
  if (options['allow-implementation-head']) args.push('--allow-implementation-head');
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    env: { ...process.env }
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? STATUS_FAIL;
}

function cursorSession({ repoRoot, options }) {
  const script = joinRepo(repoRoot, 'tools/execution-governance/cursor-session.mjs');
  if (!existsSync(script)) fail(`Missing Cursor session script: ${relative(repoRoot, script)}`, STATUS_FAIL);
  const sessionCommand = options.session || options.action || 'status';
  const args = [script, sessionCommand, '--repo', repoRoot];
  if (options['plan-dir']) args.push('--plan-dir', options['plan-dir']);
  if (options['phase-id']) args.push('--phase-id', options['phase-id']);
  if (options.prompt) args.push('--prompt', options.prompt);
  if (options.elevate) args.push('--elevate');
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    env: { ...process.env }
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? STATUS_FAIL;
}

function strictPackage(repoRoot, planDir, options, mode) {
  try {
    return strictValidatePlanPackageOrThrow({
      repoRoot,
      planDir,
      phaseId: options['phase-id'] || null,
      mode
    });
  } catch (error) {
    fail(error.message, STATUS_FAIL);
  }
}

function check(name, ok, detail) {
  return { name, ok, detail };
}

function emitChecks(label, checks) {
  for (const item of checks) {
    console.log(`${item.ok ? 'PASS' : 'FAIL'} ${label}: ${item.name} (${item.detail})`);
  }
}

function parseGovernanceJson(repoRoot) {
  try {
    const files = [
      ...listJsonFiles(joinRepo(repoRoot, '.execution-governance/policy')),
      ...listJsonFiles(joinRepo(repoRoot, '.execution-governance/schemas')),
      ...listJsonFiles(joinRepo(repoRoot, '.execution-governance/templates'))
    ];
    for (const file of files) readJson(file);
    return { ok: true, message: `${files.length} JSON files` };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

function structuralValidate(file, value, errors) {
  const name = path.basename(file);
  if (name === 'contract.json' || name === 'contract.schema.json') return;
  if (name === 'scope.json' && !Array.isArray(value.requirements)) errors.push(`${file}: scope requirements must be an array`);
  if (name === 'acceptance.json') validateAcceptance(value, file, errors);
  if (name === 'acceptance.schema.json') return;
  if (name === 'lock.json' && !value.artifactFreshnessPolicy) errors.push(`${file}: missing artifactFreshnessPolicy`);
  if (name === 'status-model.schema.json' && !value.definitions?.independent_review?.enum?.includes('NOT_REQUESTED')) {
    errors.push(`${file}: independent_review must include NOT_REQUESTED`);
  }
}

function validateAcceptance(value, file, errors) {
  if (!Array.isArray(value.acceptanceRecords)) {
    errors.push(`${file}: acceptanceRecords must be an array`);
    return;
  }
  for (const record of value.acceptanceRecords) {
    if (['AUTOMATED', 'HYBRID'].includes(record.oracleType) && !record.exactEvidenceCommandSpec) {
      errors.push(`${file}: ${record.requirementId} automated/hybrid record missing exactEvidenceCommandSpec`);
    }
    if (record.exactEvidenceCommandSpec) validateCommandSpec(record.exactEvidenceCommandSpec, `${file}:${record.requirementId}`, errors);
  }
}

function validateCommandSpec(spec, label, errors) {
  if (typeof spec.cwd !== 'string' || !spec.cwd) errors.push(`${label}: command cwd is required`);
  if (typeof spec.executable !== 'string' || !spec.executable) errors.push(`${label}: command executable is required`);
  if (!Array.isArray(spec.args)) errors.push(`${label}: command args must be an array`);
  if (/[;&|<>]/.test(spec.executable)) {
    errors.push(`${label}: executable must be a single binary name/path, not a shell expression`);
  }
}

function verifyLock(repoRoot, planDir, options = {}) {
  const failures = [];
  const lockPath = path.join(planDir, 'lock.json');
  if (!existsSync(lockPath)) return [`Missing lock file: ${relative(repoRoot, lockPath)}`];
  const lockValue = readJson(lockPath);
  const expected = {
    planHash: sha256File(path.join(planDir, 'plan.md')),
    contractHash: sha256File(path.join(planDir, 'contract.json')),
    scopeHash: sha256File(path.join(planDir, 'scope.json')),
    acceptanceHash: sha256File(path.join(planDir, 'acceptance.json'))
  };
  for (const [key, value] of Object.entries(expected)) {
    if (lockValue[key] !== value) failures.push(`${key} mismatch`);
  }
  const head = gitText(repoRoot, ['rev-parse', 'HEAD']);
  if (lockValue.baseCommit && lockValue.baseCommit !== head) {
    if (!options.allowImplementationHead) {
      failures.push(`baseCommit ${lockValue.baseCommit} does not match HEAD ${head}`);
    } else if (!isAncestorCommit(repoRoot, lockValue.baseCommit, head)) {
      failures.push(`baseCommit ${lockValue.baseCommit} is not an ancestor of HEAD ${head}`);
    }
  }
  for (const item of lockValue.protectedManifest || []) {
    const target = resolveInsideRepo(repoRoot, item.path);
    if (!existsSync(target)) {
      failures.push(`protected file missing: ${item.path}`);
      continue;
    }
    if (sha256File(target) !== item.sha256) failures.push(`protected file hash mismatch: ${item.path}`);
  }
  return failures;
}

function isAncestorCommit(repoRoot, ancestor, descendant) {
  const result = runGit(repoRoot, ['merge-base', '--is-ancestor', ancestor, descendant]);
  return result.ok;
}

function buildProtectedManifest(repoRoot) {
  const protectedPaths = [
    '.execution-governance/policy/governance-policy.json',
    'docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md'
  ];
  const schemaDir = joinRepo(repoRoot, '.execution-governance/schemas');
  if (existsSync(schemaDir)) {
    for (const name of readdirSync(schemaDir).sort()) protectedPaths.push(`.execution-governance/schemas/${name}`);
  }
  return protectedPaths.filter((item) => existsSync(joinRepo(repoRoot, item))).map((item) => ({
    path: item,
    sha256: sha256File(joinRepo(repoRoot, item))
  }));
}

function getChangedPaths(repoRoot) {
  const tracked = gitText(repoRoot, ['diff', '--name-only']).split(/\r?\n/).filter(Boolean);
  const staged = gitText(repoRoot, ['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean);
  const untracked = gitText(repoRoot, ['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
  return [...new Set([...tracked, ...staged, ...untracked].map(normalizeRel))]
    .filter((item) => !item.startsWith('.execution-governance/runtime/'))
    .sort();
}

function assertCleanWorktree(repoRoot) {
  const status = gitText(repoRoot, ['status', '--short']);
  if (status.trim()) fail('Worktree is dirty. Use --allow-dirty only for explicitly authorized planning operations.', STATUS_FAIL);
}

function runGit(repoRoot, args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', shell: false });
  return { ok: result.status === 0, stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

function gitText(repoRoot, args) {
  const result = runGit(repoRoot, args);
  if (!result.ok) fail(`git ${args.join(' ')} failed: ${result.stderr}`, STATUS_FAIL);
  return result.stdout.trim();
}

function runCommandSpec(repoRoot, spec) {
  const validationErrors = [];
  validateCommandSpec(spec, 'runtime command', validationErrors);
  if (validationErrors.length) {
    return Promise.resolve({ exitCode: 2, stdout: '', stderr: validationErrors.join('\n') });
  }
  const cwd = resolveInsideRepo(repoRoot, spec.cwd);
  const timeoutMs = Math.max(1, Number(spec.timeoutSeconds || 300)) * 1000;
  return new Promise((resolve) => {
    const child = spawn(spec.executable, spec.args || [], {
      cwd,
      shell: false,
      windowsHide: true,
      env: { ...process.env }
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        child.kill();
        settled = true;
        resolve({ exitCode: 124, stdout, stderr: `${stderr}\nCommand timed out after ${timeoutMs}ms` });
      }
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      resolve({ exitCode: 127, stdout, stderr: error.message });
    });
    child.on('close', (code) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

function runRecord(repoRoot, contractId, acceptanceRecord, result, status, detail) {
  return {
    schemaVersion: '1.0.0',
    contractId,
    requirementId: acceptanceRecord.requirementId,
    runId: makeRunId(),
    timestamp: new Date().toISOString(),
    commitSha: gitText(repoRoot, ['rev-parse', 'HEAD']),
    actor: 'governance-cli',
    command: result ? acceptanceRecord.exactEvidenceCommandSpec : null,
    exitCode: result ? result.exitCode : 2,
    result: status,
    detail
  };
}

function makeRunId() {
  return `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
}

function requiredPlanFiles(planDir) {
  return ['contract.json', 'scope.json', 'acceptance.json', 'lock.json']
    .map((name) => path.join(planDir, name))
    .filter((file) => existsSync(file));
}

function requirePlanDir(repoRoot, options) {
  if (!options['plan-dir']) fail('--plan-dir is required for this command', STATUS_FAIL);
  const planDir = resolveInsideRepo(repoRoot, options['plan-dir']);
  if (!existsSync(planDir) || !statSync(planDir).isDirectory()) {
    fail(`Plan directory not found: ${relative(repoRoot, planDir)}`, STATUS_FAIL);
  }
  return planDir;
}

function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => path.join(dir, name));
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function joinRepo(repoRoot, relPath) {
  return path.join(repoRoot, ...normalizeRel(relPath).split('/'));
}

function resolveInsideRepo(repoRoot, inputPath) {
  const target = path.resolve(repoRoot, inputPath);
  const relativePath = path.relative(repoRoot, target);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    fail(`Path escapes repository: ${inputPath}`, STATUS_FAIL);
  }
  return target;
}

function relative(repoRoot, file) {
  return normalizeRel(path.relative(repoRoot, file));
}

function normalizeRel(value) {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '');
}

function fail(message, code) {
  console.error(`FAIL ${message}`);
  process.exit(code);
}

const exitCode = await main();
process.exit(exitCode);

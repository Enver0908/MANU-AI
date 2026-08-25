#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveGovernedExecution } from './cursor-plan-resolver.mjs';

const COMMANDS = new Set(['list', 'status', 'preflight', 'activate', 'deactivate', 'discovery', 'open', 'auto-preflight', 'auto-activate', 'auto-open']);
const args = parseArgs(process.argv.slice(2));
const repoRoot = resolveRepoRoot(args.repo);
const command = args.command || 'status';
const externalRoot = process.env.MANU_GOVERNANCE_ROOT || 'C:\\ProgramData\\MANU-AI-Governance';
const activationPath = path.join(externalRoot, 'activation.json');
const defaultPlanDir = '.execution-governance/plans/hosted-sandbox-remediation-v1-1';
let planDir = args['plan-dir'] || defaultPlanDir;
let phaseId = args['phase-id'] || '';

if (!COMMANDS.has(command)) {
  fail(`Unknown cursor-session command: ${command}`);
}

if (command === 'list') emit(listPlans());
if (command === 'status') emit(statusReport());
if (command === 'preflight') emit(preflightReport({ requirePhase: true }));
if (command === 'activate') emit(activate());
if (command === 'deactivate') emit(deactivate());
if (command === 'discovery') emit(discovery());
if (command === 'open') emit(openCursor());
if (command === 'auto-preflight') emit(autoPreflight());
if (command === 'auto-activate') emit(autoActivate());
if (command === 'auto-open') emit(autoOpenCursor());

function listPlans() {
  const plansRoot = path.join(repoRoot, '.execution-governance', 'plans');
  const plans = existsSync(plansRoot)
    ? spawn('powershell', ['-NoProfile', '-Command', 'Get-ChildItem -Directory .execution-governance/plans | Select-Object -ExpandProperty Name'])
      .stdout.trim().split(/\r?\n/).filter(Boolean)
    : [];
  return { status: 'PASS', repoRoot, plans };
}

function statusReport() {
  const gitStatus = spawn('git', ['status', '--short', '--branch']);
  const branch = spawn('git', ['branch', '--show-current']);
  const head = spawn('git', ['rev-parse', 'HEAD']);
  const activation = readActivation();
  return {
    status: gitStatus.status === 0 && branch.status === 0 && head.status === 0 ? 'PASS' : 'FAIL',
    repoRoot,
    branch: branch.stdout.trim(),
    head: head.stdout.trim(),
    worktree: gitStatus.stdout.trim(),
    activationStatus: activation?.status || 'MISSING_FAIL_CLOSED',
    activationContractId: activation?.contractId || '',
    activationPhaseId: activation?.phaseId || '',
    activationPath
  };
}

function preflightReport({ requirePhase }) {
  const checks = [];
  checks.push(runCheck('git status', 'git', ['status', '--short', '--branch']));
  checks.push(runCheck('install verify', 'node', ['tools/execution-governance/install-secure-cursor-guard.mjs', '--verify']));
  checks.push(runCheck('doctor', 'node', ['tools/execution-governance/governance-cli.mjs', 'doctor']));
  checks.push(runCheck('validate', 'node', ['tools/execution-governance/governance-cli.mjs', 'validate']));
  checks.push(runCheck('validate all plans', 'node', ['tools/execution-governance/governance-cli.mjs', 'validate', '--all-plans']));
  checks.push(runCheck('validate selected plan', 'node', [
    'tools/execution-governance/governance-cli.mjs',
    'validate',
    '--plan-dir',
    planDir,
    ...(phaseId ? ['--phase-id', phaseId] : [])
  ]));
  checks.push(runCheck('red-team', 'node', ['tools/execution-governance/governance-hardening-red-team.mjs']));
  if (requirePhase && !phaseId) {
    checks.push({ name: 'phase id', status: 'CHANGE_REQUEST_REQUIRED', exitCode: 2, detail: '--phase-id is required' });
  } else if (phaseId) {
    checks.push(scopeExistenceCheck());
    checks.push(runCheck('activation dry-run', 'node', [
      'tools/execution-governance/governance-cli.mjs',
      'activate-cursor',
      '--plan-dir',
      planDir,
      '--phase-id',
      phaseId,
      '--allow-implementation-head'
    ]));
  }
  const outcome = checks.some((item) => item.status === 'CHANGE_REQUEST_REQUIRED')
    ? 'CHANGE_REQUEST_REQUIRED'
    : checks.every((item) => item.status === 'PASS') ? 'READY' : 'BLOCKED';
  return { status: outcome, repoRoot, planDir, phaseId, checks };
}

function autoPreflight() {
  const resolved = resolveGovernedExecution({
    repoRoot,
    planDir: args['plan-dir'] || '',
    prompt: args.prompt || '',
    requireIntent: false
  });
  if (resolved.status !== 'PASS') return resolved;
  const checks = [];
  checks.push(runCheck('git status', 'git', ['status', '--short', '--branch']));
  checks.push(runCheck('installer dry-run', 'node', ['tools/execution-governance/install-secure-cursor-guard.mjs', '--dry-run']));
  checks.push(runCheck('doctor', 'node', ['tools/execution-governance/governance-cli.mjs', 'doctor']));
  checks.push(runCheck('validate', 'node', ['tools/execution-governance/governance-cli.mjs', 'validate']));
  checks.push(runCheck('validate selected plan', 'node', [
    'tools/execution-governance/governance-cli.mjs',
    'validate',
    '--plan-dir',
    resolved.planDir,
    '--phase-id',
    resolved.phaseId
  ]));
  checks.push(runCheck('red-team', 'node', ['tools/execution-governance/governance-hardening-red-team.mjs']));
  checks.push(scopeExistenceCheckFor(resolved.planDir, resolved.phaseId));
  checks.push(runCheck('activation dry-run', 'node', [
    'tools/execution-governance/governance-cli.mjs',
    'activate-cursor',
    '--plan-dir',
    resolved.planDir,
    '--phase-id',
    resolved.phaseId,
    '--allow-implementation-head'
  ]));
  const outcome = checks.some((item) => item.status === 'CHANGE_REQUEST_REQUIRED')
    ? 'CHANGE_REQUEST_REQUIRED'
    : checks.every((item) => item.status === 'PASS') ? 'READY' : 'BLOCKED';
  return { status: outcome, repoRoot, planDir: resolved.planDir, phaseId: resolved.phaseId, checks, resolved };
}

function autoActivate() {
  const preflight = autoPreflight();
  if (preflight.status !== 'READY') return preflight;
  const resolved = preflight.resolved;
  const previousPlanDir = planDir;
  const previousPhaseId = phaseId;
  planDir = resolved.planDir;
  phaseId = resolved.phaseId;
  try {
    const broker = args.elevate ? runElevatedBroker('--activate') : runBroker('--activate');
    if (broker.status !== 0) {
      return {
        status: 'BLOCKED',
        repoRoot,
        planDir,
        phaseId,
        reason: broker.stderr.trim() || broker.stdout.trim() || 'broker activation failed',
        preflight,
        resolved
      };
    }
    return {
      status: 'PASS',
      repoRoot,
      planDir,
      phaseId,
      broker: parseJsonOrText(broker.stdout),
      preflight,
      resolved
    };
  } finally {
    planDir = previousPlanDir;
    phaseId = previousPhaseId;
  }
}

function autoOpenCursor() {
  const activation = autoActivate();
  if (activation.status !== 'PASS') return activation;
  const cursor = findCursorCommand();
  if (!cursor) return { status: 'BLOCKED', reason: 'Cursor command was not found on PATH.', activation };
  const result = spawnSync(cursor, [repoRoot], { cwd: repoRoot, encoding: 'utf8', shell: false, windowsHide: true });
  return {
    status: result.status === 0 || result.status === null ? 'PASS' : 'BLOCKED',
    cursor,
    activation,
    detail: result.stderr || result.stdout || 'Cursor launch requested.'
  };
}

function activate() {
  const preflight = preflightReport({ requirePhase: true });
  if (preflight.status !== 'READY') return preflight;
  const broker = args.elevate ? runElevatedBroker('--activate') : runBroker('--activate');
  if (broker.status !== 0) {
    return {
      status: 'BLOCKED',
      repoRoot,
      planDir,
      phaseId,
      reason: broker.stderr.trim() || broker.stdout.trim() || 'broker activation failed',
      preflight
    };
  }
  return {
    status: 'PASS',
    repoRoot,
    planDir,
    phaseId,
    broker: parseJsonOrText(broker.stdout),
    preflight
  };
}

function deactivate() {
  const broker = args.elevate ? runElevatedBroker('--deactivate') : runBroker('--deactivate');
  return {
    status: broker.status === 0 ? 'PASS' : 'BLOCKED',
    repoRoot,
    activationPath,
    broker: parseJsonOrText(broker.stdout || broker.stderr)
  };
}

function discovery() {
  const broker = args.elevate ? runElevatedBroker('--discovery') : runBroker('--discovery');
  return {
    status: broker.status === 0 ? 'PASS' : 'BLOCKED',
    repoRoot,
    activationPath,
    broker: parseJsonOrText(broker.stdout || broker.stderr)
  };
}

function openCursor() {
  const activation = activate();
  if (activation.status !== 'PASS') return activation;
  const cursor = findCursorCommand();
  if (!cursor) return { status: 'BLOCKED', reason: 'Cursor command was not found on PATH.', activation };
  const result = spawnSync(cursor, [repoRoot], { cwd: repoRoot, encoding: 'utf8', shell: false, windowsHide: true });
  return {
    status: result.status === 0 || result.status === null ? 'PASS' : 'BLOCKED',
    cursor,
    activation,
    detail: result.stderr || result.stdout || 'Cursor launch requested.'
  };
}

function scopeExistenceCheck() {
  return scopeExistenceCheckFor(planDir, phaseId);
}

function scopeExistenceCheckFor(targetPlanDir, targetPhaseId) {
  const selectedScopePath = path.join(repoRoot, ...normalizeRel(targetPlanDir).split('/'), 'scope.json');
  const scope = JSON.parse(readFileSync(selectedScopePath, 'utf8'));
  const missing = [];
  for (const requirement of scope.requirements || []) {
    if (requirement.phaseId !== targetPhaseId) continue;
    for (const rel of requirement.allowedModifyPaths || []) {
      if (!rel.includes('*') && !existsSync(path.join(repoRoot, ...normalizeRel(rel).split('/')))) missing.push(rel);
    }
  }
  return {
    name: 'phase allowed modify paths exist',
    status: missing.length === 0 ? 'PASS' : 'CHANGE_REQUEST_REQUIRED',
    exitCode: missing.length === 0 ? 0 : 2,
    detail: missing.length === 0 ? 'all concrete allowedModifyPaths exist' : `missing: ${missing.join(', ')}`
  };
}

function runBroker(action) {
  return spawn('node', [
    'tools/execution-governance/cursor-session-broker.mjs',
    action,
    '--repo',
    repoRoot,
    '--plan-dir',
    planDir,
    ...(phaseId ? ['--phase-id', phaseId] : []),
    '--allow-implementation-head'
  ]);
}

function runElevatedBroker(action) {
  const brokerPath = path.join(externalRoot, 'cursor-session-broker.mjs');
  if (!existsSync(brokerPath)) {
    return { status: 1, stdout: '', stderr: `broker is not installed: ${brokerPath}` };
  }
  const quotedArgs = [
    brokerPath,
    action,
    '--repo',
    repoRoot,
    '--plan-dir',
    planDir,
    ...(phaseId ? ['--phase-id', phaseId] : []),
    '--allow-implementation-head'
  ].map((item) => `'${String(item).replace(/'/g, "''")}'`).join(', ');
  const command = `Start-Process -FilePath '${process.execPath.replace(/'/g, "''")}' -ArgumentList ${quotedArgs} -Verb RunAs -Wait -WindowStyle Hidden`;
  return spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]);
}

function runCheck(name, executable, checkArgs) {
  const result = spawn(executable, checkArgs);
  return {
    name,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status,
    command: [executable, ...checkArgs].join(' '),
    detail: summarize(result.stdout, result.stderr)
  };
}

function spawn(executable, spawnArgs) {
  const result = spawnSync(executable, spawnArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    env: { ...process.env }
  });
  return { status: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function readActivation() {
  if (!existsSync(activationPath)) return null;
  try {
    return JSON.parse(readFileSync(activationPath, 'utf8'));
  } catch {
    return { status: 'MALFORMED_FAIL_CLOSED' };
  }
}

function findCursorCommand() {
  const result = spawn('powershell', ['-NoProfile', '-Command', '(Get-Command cursor -ErrorAction SilentlyContinue).Source']);
  return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : null;
}

function resolveRepoRoot(explicitRoot) {
  if (explicitRoot) return path.resolve(explicitRoot);
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', shell: false });
  return result.status === 0 ? path.resolve(result.stdout.trim()) : process.cwd();
}

function parseArgs(input) {
  const parsed = {};
  const queue = [...input];
  if (queue[0] && !queue[0].startsWith('--')) parsed.command = queue.shift();
  while (queue.length) {
    const item = queue.shift();
    if (item === '--elevate') {
      parsed.elevate = true;
      continue;
    }
    if (!item.startsWith('--')) fail(`Unexpected argument: ${item}`);
    const key = item.slice(2);
    const value = queue.shift();
    if (!value || value.startsWith('--')) fail(`Missing value for ${item}`);
    parsed[key] = value;
  }
  return parsed;
}

function parseJsonOrText(value) {
  try {
    return JSON.parse(value);
  } catch {
    return String(value || '').trim();
  }
}

function summarize(stdout, stderr) {
  const text = `${stdout}\n${stderr}`.trim();
  return text.length > 1600 ? `${text.slice(0, 1600)}...` : text;
}

function normalizeRel(value) {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '');
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exit(['PASS', 'READY', 'CHANGE_REQUEST_REQUIRED'].includes(value.status) ? 0 : 1);
}

function fail(message) {
  process.stderr.write(`FAIL ${message}\n`);
  process.exit(1);
}

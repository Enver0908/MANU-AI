#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const externalRoot = process.env.MANU_GOVERNANCE_ROOT || 'C:\\ProgramData\\MANU-AI-Governance';
const activationPath = path.join(externalRoot, 'activation.json');
const request = parseRequest(process.argv.slice(2));

try {
  if (request.action === 'deactivate') {
    const inactive = inactiveActivation(request.repoRoot);
    writeActivation(inactive);
    emit({ status: 'PASS', action: 'deactivate', activationPath });
  }

  if (request.action !== 'activate') fail(`unknown broker action: ${request.action}`);
  const activation = buildActivation(request);
  writeActivation(activation);
  emit({
    status: 'PASS',
    action: 'activate',
    activationPath,
    contractId: activation.contractId,
    phaseId: activation.phaseId,
    lockCommit: activation.lockCommit,
    scopeHash: activation.scopeHash
  });
} catch (error) {
  emit({ status: 'FAIL', action: request.action || 'unknown', error: error.message });
}

function buildActivation(value) {
  const repoRoot = resolveExistingDirectory(value.repoRoot, 'repoRoot');
  const planDir = resolveInsideRepo(repoRoot, value.planDir, 'planDir');
  const phaseId = requireString(value.phaseId, 'phaseId');
  const contract = readJson(path.join(planDir, 'contract.json'));
  const scope = readJson(path.join(planDir, 'scope.json'));
  const lock = readJson(path.join(planDir, 'lock.json'));
  assertHashes(planDir, lock);
  assertGitHead(repoRoot, lock, value.allowImplementationHead === true);
  if (!new Set((contract.phases || []).map((item) => item.phaseId)).has(phaseId)) {
    fail(`unknown phaseId: ${phaseId}`);
  }
  const selectedScope = {
    allowedCreatePaths: [],
    allowedModifyPaths: [],
    protectedPaths: [],
    forbiddenPaths: [],
    allowedCommands: [],
    allowedMcpTools: [],
    allowSubagents: false
  };
  for (const requirement of scope.requirements || []) {
    if (requirement.phaseId !== phaseId) continue;
    appendPaths(selectedScope.allowedCreatePaths, requirement.allowedCreatePaths || []);
    appendPaths(selectedScope.allowedModifyPaths, requirement.allowedModifyPaths || []);
    appendPaths(selectedScope.protectedPaths, requirement.protectedPaths || []);
    appendPaths(selectedScope.forbiddenPaths, requirement.forbiddenPaths || []);
    appendCommands(selectedScope.allowedCommands, requirement.allowedCommands || []);
    appendPaths(selectedScope.allowedMcpTools, requirement.allowedMcpTools || []);
    selectedScope.allowSubagents = selectedScope.allowSubagents || requirement.allowSubagents === true;
  }
  if (selectedScope.allowedCreatePaths.length + selectedScope.allowedModifyPaths.length === 0) {
    fail(`phase ${phaseId} has no writable activation scope`);
  }
  sortScope(selectedScope);
  return {
    schemaVersion: '1.0.0',
    status: 'ACTIVE_SIGNED_SCOPE',
    repoRoot,
    contractId: contract.contractId,
    phaseId,
    lockCommit: lock.lockCommit || lock.baseCommit,
    allowImplementationHead: value.allowImplementationHead === true,
    scopeHash: sha256Json(selectedScope),
    scope: selectedScope
  };
}

function parseRequest(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--activate') {
      parsed.action = 'activate';
      continue;
    }
    if (arg === '--deactivate') {
      parsed.action = 'deactivate';
      continue;
    }
    if (arg === '--allow-implementation-head') {
      parsed.allowImplementationHead = true;
      continue;
    }
    if (arg === '--repo') {
      parsed.repoRoot = args[++i];
      continue;
    }
    if (arg === '--plan-dir') {
      parsed.planDir = args[++i];
      continue;
    }
    if (arg === '--phase-id') {
      parsed.phaseId = args[++i];
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }
  if (!parsed.action) fail('missing --activate or --deactivate');
  parsed.repoRoot = requireString(parsed.repoRoot, 'repoRoot');
  return parsed;
}

function assertHashes(planDir, lock) {
  const expected = {
    planHash: sha256File(path.join(planDir, 'plan.md')),
    contractHash: sha256File(path.join(planDir, 'contract.json')),
    scopeHash: sha256File(path.join(planDir, 'scope.json')),
    acceptanceHash: sha256File(path.join(planDir, 'acceptance.json'))
  };
  for (const [key, value] of Object.entries(expected)) {
    if (lock[key] !== value) fail(`${key} mismatch`);
  }
  if (!/^[0-9a-f]{40}$/i.test(lock.lockCommit || lock.baseCommit || '')) {
    fail('lockCommit/baseCommit is missing or invalid');
  }
}

function assertGitHead(repoRoot, lock, allowImplementationHead) {
  const lockCommit = lock.lockCommit || lock.baseCommit;
  const head = gitText(repoRoot, ['rev-parse', 'HEAD']);
  if (lockCommit === head) return;
  if (!allowImplementationHead) fail(`lockCommit/baseCommit ${lockCommit} does not match HEAD ${head}`);
  const result = spawnSync('git', ['merge-base', '--is-ancestor', lockCommit, head], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false
  });
  if (result.status !== 0) fail(`lockCommit/baseCommit ${lockCommit} is not an ancestor of HEAD ${head}`);
}

function writeActivation(value) {
  mkdirSync(externalRoot, { recursive: true });
  const tmp = `${activationPath}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(tmp, activationPath);
}

function inactiveActivation(repoRoot) {
  return {
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
      allowedCommands: [],
      allowedMcpTools: [],
      allowSubagents: false
    }
  };
}

function resolveExistingDirectory(input, label) {
  const target = path.resolve(requireString(input, label));
  if (!existsSync(target)) fail(`${label} does not exist: ${target}`);
  return target;
}

function resolveInsideRepo(repoRoot, input, label) {
  const target = path.resolve(repoRoot, requireString(input, label));
  const rel = path.relative(repoRoot, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) fail(`${label} escapes repo`);
  if (!existsSync(target)) fail(`${label} does not exist: ${normalizeRel(rel)}`);
  return target;
}

function appendPaths(target, values) {
  for (const item of values) {
    const normalized = normalizeRel(item);
    if (!normalized || normalized.startsWith('..') || path.isAbsolute(normalized)) fail(`unsafe activation path: ${item}`);
    if (!target.includes(normalized)) target.push(normalized);
  }
}

function appendCommands(target, values) {
  const seen = new Set(target.map((item) => JSON.stringify(item)));
  for (const item of values) {
    if (typeof item?.executable !== 'string' || /[;&|<>]/.test(item.executable)) fail(`unsafe command executable: ${item?.executable}`);
    if (!Array.isArray(item.args)) fail(`unsafe command args for ${item.executable}`);
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      target.push(item);
      seen.add(key);
    }
  }
}

function sortScope(scope) {
  for (const key of ['allowedCreatePaths', 'allowedModifyPaths', 'protectedPaths', 'forbiddenPaths', 'allowedMcpTools']) {
    scope[key].sort();
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} is required`);
  if (/[\r\n]/.test(value)) fail(`${label} contains a newline`);
  return value;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function gitText(repoRoot, args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', shell: false });
  if (result.status !== 0) fail(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function normalizeRel(value) {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '');
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exit(value.status === 'PASS' ? 0 : 1);
}

function fail(message) {
  throw new Error(message);
}

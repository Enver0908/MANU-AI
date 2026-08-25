#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = findRepoRoot(process.cwd());
const externalRoot = process.env.MANU_GOVERNANCE_ROOT || 'C:\\ProgramData\\MANU-AI-Governance';
const activationPath = path.join(externalRoot, 'activation.json');

const options = parseArgs(process.argv.slice(2));
const planDir = options.planDir ? resolveInsideRepo(options.planDir) : null;

if (!planDir) fail('--plan-dir is required');
if (!existsSync(planDir)) fail(`plan directory not found: ${relative(planDir)}`);

const apply = options.apply === true;
const deactivate = options.deactivate === true;

if (deactivate) {
  const inactive = inactiveActivation();
  if (apply) writeActivation(inactive);
  emit({ status: 'PASS', mode: apply ? 'DEACTIVATED' : 'DRY_RUN_DEACTIVATE', activationPath, activation: inactive });
}

const activation = buildActivation(planDir);
if (apply) writeActivation(activation);
emit({ status: 'PASS', mode: apply ? 'APPLIED' : 'DRY_RUN', activationPath, activation });

function buildActivation(directory) {
  const contract = readJson(path.join(directory, 'contract.json'));
  const scope = readJson(path.join(directory, 'scope.json'));
  const lock = readJson(path.join(directory, 'lock.json'));
  assertLock(directory, lock);
  const flattenedScope = flattenScope(scope);
  return {
    schemaVersion: '1.0.0',
    status: 'ACTIVE_SIGNED_SCOPE',
    repoRoot,
    contractId: contract.contractId,
    phaseId: options.phaseId || contract.currentPhaseId || 'phase-unknown',
    lockCommit: lock.lockCommit || lock.baseCommit,
    allowImplementationHead: options.allowImplementationHead === true,
    scopeHash: sha256Json(flattenedScope),
    scope: flattenedScope
  };
}

function assertLock(directory, lock) {
  const expected = {
    planHash: sha256File(path.join(directory, 'plan.md')),
    contractHash: sha256File(path.join(directory, 'contract.json')),
    scopeHash: sha256File(path.join(directory, 'scope.json')),
    acceptanceHash: sha256File(path.join(directory, 'acceptance.json'))
  };
  for (const [key, value] of Object.entries(expected)) {
    if (lock[key] !== value) fail(`${key} mismatch for ${relative(directory)}`);
  }
  const lockCommit = lock.lockCommit || lock.baseCommit;
  if (!/^[0-9a-f]{40}$/i.test(lockCommit || '')) fail('lockCommit/baseCommit is missing or invalid');
}

function flattenScope(scope) {
  const out = {
    allowedCreatePaths: [],
    allowedModifyPaths: [],
    protectedPaths: [],
    forbiddenPaths: [],
    allowedCommands: [],
    allowedMcpTools: [],
    allowSubagents: false
  };
  for (const requirement of scope.requirements || []) {
    pushUnique(out.allowedCreatePaths, requirement.allowedCreatePaths || []);
    pushUnique(out.allowedModifyPaths, requirement.allowedModifyPaths || []);
    pushUnique(out.protectedPaths, requirement.protectedPaths || []);
    pushUnique(out.forbiddenPaths, requirement.forbiddenPaths || []);
    pushUnique(out.allowedCommands, requirement.allowedCommands || [], JSON.stringify);
    pushUnique(out.allowedMcpTools, requirement.allowedMcpTools || []);
    out.allowSubagents = out.allowSubagents || requirement.allowSubagents === true;
  }
  out.allowedCreatePaths = out.allowedCreatePaths.map(normalizeRel).sort();
  out.allowedModifyPaths = out.allowedModifyPaths.map(normalizeRel).sort();
  out.protectedPaths = out.protectedPaths.map(normalizeRel).sort();
  out.forbiddenPaths = out.forbiddenPaths.map(normalizeRel).sort();
  out.allowedMcpTools = out.allowedMcpTools.map(String).sort();
  return out;
}

function pushUnique(target, values, keyFn = String) {
  const seen = new Set(target.map(keyFn));
  for (const value of values) {
    const key = keyFn(value);
    if (!seen.has(key)) {
      target.push(value);
      seen.add(key);
    }
  }
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

function writeActivation(value) {
  mkdirSync(externalRoot, { recursive: true });
  writeFileSync(activationPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--apply') {
      parsed.apply = true;
      continue;
    }
    if (arg === '--deactivate') {
      parsed.deactivate = true;
      continue;
    }
    if (arg === '--allow-implementation-head') {
      parsed.allowImplementationHead = true;
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
  return parsed;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function resolveInsideRepo(inputPath) {
  const target = path.resolve(repoRoot, inputPath);
  const rel = path.relative(repoRoot, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) fail(`path escapes repo: ${inputPath}`);
  return target;
}

function relative(file) {
  return normalizeRel(path.relative(repoRoot, file));
}

function normalizeRel(value) {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '');
}

function findRepoRoot(start) {
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: start, encoding: 'utf8', shell: false });
  if (git.status === 0) return path.resolve(git.stdout.trim());
  let current = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
  while (true) {
    if (existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exit(value.status === 'PASS' ? 0 : 1);
}

function fail(message) {
  process.stderr.write(`FAIL ${message}\n`);
  process.exit(1);
}

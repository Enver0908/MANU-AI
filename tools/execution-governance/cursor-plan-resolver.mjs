#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_PLAN_FILES = ['plan.md', 'contract.json', 'scope.json', 'acceptance.json', 'lock.json'];
const TERMINAL_IMPLEMENTATION_STATES = new Set(['EXECUTOR_VERIFIED']);

export function resolveGovernedExecution(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const prompt = String(options.prompt || '');
  const intent = detectGovernedExecutionIntent(prompt);
  if (options.requireIntent && !intent.detected) {
    return blocked('NO_GOVERNED_EXECUTION_INTENT', 'No governed execution intent was detected.', { repoRoot, intent });
  }

  const planSelection = selectPlan(repoRoot, {
    planDir: options.planDir || '',
    prompt
  });
  if (planSelection.status !== 'PASS') {
    return { ...planSelection, repoRoot, intent };
  }

  const phaseSelection = selectNextPhase(repoRoot, planSelection.planDir);
  if (phaseSelection.status !== 'PASS') {
    return { ...phaseSelection, repoRoot, intent, planDir: planSelection.planDir };
  }

  return {
    status: 'PASS',
    repoRoot,
    intent,
    planDir: planSelection.planDir,
    contractId: phaseSelection.contractId,
    phaseId: phaseSelection.phaseId,
    reason: phaseSelection.reason,
    checks: [
      ...planSelection.checks,
      ...phaseSelection.checks
    ]
  };
}

export function detectGovernedExecutionIntent(prompt) {
  const text = normalizeText(prompt);
  const patterns = [
    /\bbu plani uygula\b/,
    /\bplani uygula\b/,
    /\bplan uygulamaya basla\b/,
    /\bgoverned execution\b/,
    /\bapply this plan\b/,
    /\bapply the plan\b/,
    /\bdevam et\b/
  ];
  return {
    detected: patterns.some((pattern) => pattern.test(text)),
    normalizedTextLength: text.length
  };
}

function selectPlan(repoRoot, options) {
  if (options.planDir) {
    const planDir = normalizePlanDir(repoRoot, options.planDir);
    const checks = validateLockedPlan(repoRoot, planDir);
    if (checks.some((item) => item.status !== 'PASS')) {
      return blocked('PLAN_NOT_LOCKED_OR_INVALID', `Plan is not locked and valid: ${planDir}`, { planDir, checks });
    }
    return { status: 'PASS', planDir, checks };
  }

  const promptHint = extractPlanHint(repoRoot, options.prompt || '');
  if (promptHint) {
    const checks = validateLockedPlan(repoRoot, promptHint);
    if (checks.some((item) => item.status !== 'PASS')) {
      return blocked('PLAN_HINT_NOT_LOCKED_OR_INVALID', `Prompt plan hint is not locked and valid: ${promptHint}`, { planDir: promptHint, checks });
    }
    return { status: 'PASS', planDir: promptHint, checks };
  }

  const candidates = listLockedRunnablePlans(repoRoot);
  if (candidates.length === 1) {
    return { status: 'PASS', planDir: candidates[0].planDir, checks: candidates[0].checks };
  }
  if (candidates.length === 0) {
    return blocked('NO_RUNNABLE_LOCKED_PLAN', 'No locked runnable governed plan was found.', { checks: [] });
  }
  return {
    status: 'CHANGE_REQUEST_REQUIRED',
    code: 'AMBIGUOUS_LOCKED_PLAN',
    reason: `Multiple locked runnable plans were found: ${candidates.map((item) => item.planDir).join(', ')}`,
    candidates: candidates.map((item) => item.planDir),
    checks: candidates.flatMap((item) => item.checks)
  };
}

function selectNextPhase(repoRoot, planDir) {
  const contract = readJson(path.join(repoRoot, planDir, 'contract.json'));
  const lifecyclePath = path.join(repoRoot, planDir, 'lifecycle-record.json');
  const lifecycle = existsSync(lifecyclePath) ? readJson(lifecyclePath) : null;
  const phases = contract.phases || [];
  const currentPhase = lifecycle?.currentPhase || contract.currentPhaseId || phases[0]?.phaseId || '';
  const ordered = currentPhase
    ? [...phases.filter((item) => item.phaseId === currentPhase), ...phases.filter((item) => item.phaseId !== currentPhase)]
    : phases;
  const candidate = ordered.find((phase) => isRunnablePhase(contract, lifecycle, phase.phaseId));
  if (!candidate) {
    return blocked('NO_RUNNABLE_PHASE', `No runnable phase was found for ${planDir}.`, {
      contractId: contract.contractId,
      checks: [{ name: 'next runnable phase', status: 'BLOCKED', detail: 'all phases completed or unavailable' }]
    });
  }
  const hasScope = readJson(path.join(repoRoot, planDir, 'scope.json')).requirements
    ?.some((item) => item.phaseId === candidate.phaseId);
  if (!hasScope) {
    return blocked('PHASE_SCOPE_MISSING', `Selected phase has no scope records: ${candidate.phaseId}`, {
      contractId: contract.contractId,
      phaseId: candidate.phaseId,
      checks: [{ name: 'phase scope exists', status: 'FAIL', detail: candidate.phaseId }]
    });
  }
  return {
    status: 'PASS',
    contractId: contract.contractId,
    phaseId: candidate.phaseId,
    reason: `selected next runnable locked phase ${candidate.phaseId}`,
    checks: [
      { name: 'phase status locked', status: 'PASS', detail: candidate.phaseId },
      { name: 'phase scope exists', status: 'PASS', detail: candidate.phaseId }
    ]
  };
}

function isRunnablePhase(contract, lifecycle, phaseId) {
  const phase = (contract.phases || []).find((item) => item.phaseId === phaseId);
  if (!phase || phase.status !== 'LOCKED_FOR_IMPLEMENTATION') return false;
  if (lifecycle?.currentPhase && lifecycle.currentPhase === phaseId) {
    return !TERMINAL_IMPLEMENTATION_STATES.has(lifecycle.status?.implementation_state);
  }
  const requirements = (contract.requirements || []).filter((item) => item.status && item.requirementId);
  const phaseRequirements = requirements.filter((requirement) => {
    return true;
  });
  return phaseRequirements.some((requirement) => !TERMINAL_IMPLEMENTATION_STATES.has(requirement.status?.implementation_state));
}

function listLockedRunnablePlans(repoRoot) {
  const plansRoot = path.join(repoRoot, '.execution-governance', 'plans');
  if (!existsSync(plansRoot)) return [];
  const entries = readdirSync(plansRoot, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => `.execution-governance/plans/${item.name}`);
  return entries.map((planDir) => {
    const checks = validateLockedPlan(repoRoot, planDir);
    return { planDir, checks };
  }).filter((item) => item.checks.every((check) => check.status === 'PASS'))
    .filter((item) => selectNextPhase(repoRoot, item.planDir).status === 'PASS');
}

function validateLockedPlan(repoRoot, planDir) {
  const checks = [];
  const absolute = path.join(repoRoot, planDir);
  checks.push({ name: 'plan directory exists', status: existsSync(absolute) ? 'PASS' : 'FAIL', detail: planDir });
  for (const file of REQUIRED_PLAN_FILES) {
    checks.push({ name: `${file} exists`, status: existsSync(path.join(absolute, file)) ? 'PASS' : 'FAIL', detail: `${planDir}/${file}` });
  }
  if (checks.some((item) => item.status !== 'PASS')) return checks;
  const contract = readJson(path.join(absolute, 'contract.json'));
  const lock = readJson(path.join(absolute, 'lock.json'));
  checks.push({ name: 'plan state locked', status: contract.status?.plan_state === 'LOCKED_FOR_IMPLEMENTATION' ? 'PASS' : 'FAIL', detail: contract.status?.plan_state || 'missing' });
  checks.push(...hashChecks(absolute, lock));
  return checks;
}

function hashChecks(planDir, lock) {
  return [
    ['planHash', 'plan.md'],
    ['contractHash', 'contract.json'],
    ['scopeHash', 'scope.json'],
    ['acceptanceHash', 'acceptance.json']
  ].map(([key, file]) => ({
    name: `${key} matches`,
    status: lock[key] === sha256File(path.join(planDir, file)) ? 'PASS' : 'FAIL',
    detail: file
  }));
}

function extractPlanHint(repoRoot, prompt) {
  const normalized = normalizeRel(prompt);
  const match = normalized.match(/\.execution-governance\/plans\/[A-Za-z0-9_.-]+/);
  if (!match) return '';
  return normalizePlanDir(repoRoot, match[0]);
}

function normalizePlanDir(repoRoot, value) {
  const absolute = path.resolve(repoRoot, value);
  const rel = path.relative(repoRoot, absolute);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`planDir escapes repo: ${value}`);
  }
  return normalizeRel(rel);
}

function blocked(code, reason, extra = {}) {
  return { status: code.includes('AMBIGUOUS') ? 'CHANGE_REQUEST_REQUIRED' : 'BLOCKED', code, reason, ...extra };
}

function normalizeText(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRel(value) {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '');
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = resolveGovernedExecution(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.status === 'PASS' || result.status === 'CHANGE_REQUEST_REQUIRED' ? 0 : 1);
  } catch (error) {
    process.stderr.write(`FAIL ${error.message}\n`);
    process.exit(1);
  }
}

function parseArgs(input) {
  const parsed = {};
  for (let index = 0; index < input.length; index += 1) {
    const item = input[index];
    if (item === '--require-intent') {
      parsed.requireIntent = true;
      continue;
    }
    if (!item.startsWith('--')) throw new Error(`Unexpected argument: ${item}`);
    const key = item.slice(2);
    const value = input[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${item}`);
    parsed[key] = value;
  }
  return parsed;
}

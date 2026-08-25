#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = findRepoRoot();
const args = process.argv.slice(2);
const phase = readOption('--phase') || 'PHASE-0';
const mainPlanDir = '.execution-governance/plans/hosted-sandbox-remediation-v1-1';
const setupPlanDir = '.execution-governance/plans/hosted-sandbox-remediation-v1-1-verifier-setup';
const failures = [];

const requiredMainFiles = [
  'plan.md',
  'contract.json',
  'scope.json',
  'acceptance.json',
  'lock.json'
].map((name) => `${mainPlanDir}/${name}`);

const requiredSetupFiles = [
  'plan.md',
  'contract.json',
  'scope.json',
  'acceptance.json',
  'lock.json'
].map((name) => `${setupPlanDir}/${name}`);

for (const relPath of [...requiredMainFiles, ...requiredSetupFiles]) assertFile(relPath);
assertFile('tools/hosted-sandbox/verify-hosted-sandbox-remediation-v1-1.mjs');
assertFile('docs/HOSTED_SANDBOX_REMEDIATION_V1_1_PHASE_0_EVIDENCE.md');

const mainContract = readJson(`${mainPlanDir}/contract.json`);
const mainScope = readJson(`${mainPlanDir}/scope.json`);
const mainAcceptance = readJson(`${mainPlanDir}/acceptance.json`);
const mainPlan = readText(`${mainPlanDir}/plan.md`);

expect(mainContract.governanceFormatVersion === '2.0.0', 'main contract uses governanceFormatVersion 2.0.0');
expect(mainContract.contractId === 'hosted-sandbox-remediation-v1-1', 'main contractId is stable');
expect(mainContract.status.plan_state === 'LOCKED_FOR_IMPLEMENTATION', 'main plan state is locked for implementation');
expect(mainContract.status.implementation_state === 'NOT_STARTED', 'main implementation state remains not started');
expect(mainContract.status.independent_review === 'NOT_REQUESTED', 'main independent review is not requested');

const expectedPhases = ['PHASE-0', 'PHASE-1', 'PHASE-2', 'PHASE-3', 'PHASE-4', 'PHASE-5', 'PHASE-6'];
const actualPhases = (mainContract.phases || []).map((item) => item.phaseId);
expect(JSON.stringify(actualPhases) === JSON.stringify(expectedPhases), 'main contract has PHASE-0 through PHASE-6 in order');

const inScopeReqIds = (mainContract.requirements || [])
  .filter((item) => item.classification === 'IN_SCOPE')
  .map((item) => item.requirementId);
for (const reqId of inScopeReqIds) {
  expect(mainScope.requirements.some((item) => item.requirementId === reqId), `scope includes ${reqId}`);
  expect(mainAcceptance.acceptanceRecords.some((item) => item.requirementId === reqId), `acceptance includes ${reqId}`);
  expect(mainPlan.includes(`GOV-REQ id="${reqId}"`), `plan.md includes GOV-REQ anchor for ${reqId}`);
}

for (const phaseId of expectedPhases) {
  expect(mainPlan.includes(`GOV-PHASE id="${phaseId}"`), `plan.md includes GOV-PHASE ${phaseId}`);
  expect(mainScope.requirements.some((item) => item.phaseId === phaseId), `scope has at least one record for ${phaseId}`);
  expect(mainAcceptance.acceptanceRecords.some((item) => item.phaseId === phaseId), `acceptance has at least one record for ${phaseId}`);
}

const requiredSections = [
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
for (const section of requiredSections) {
  expect(mainPlan.includes(`GOV-SECTION id="${section}"`), `plan.md includes section ${section}`);
}

const phase0ScopePaths = flattenPhaseScope(mainScope, 'PHASE-0');
for (const relPath of [
  `${mainPlanDir}/plan.md`,
  `${mainPlanDir}/contract.json`,
  `${mainPlanDir}/scope.json`,
  `${mainPlanDir}/acceptance.json`,
  `${mainPlanDir}/lock.json`,
  `${setupPlanDir}/plan.md`,
  `${setupPlanDir}/contract.json`,
  `${setupPlanDir}/scope.json`,
  `${setupPlanDir}/acceptance.json`,
  `${setupPlanDir}/lock.json`,
  'tools/hosted-sandbox/verify-hosted-sandbox-remediation-v1-1.mjs',
  'docs/HOSTED_SANDBOX_REMEDIATION_V1_1_PHASE_0_EVIDENCE.md'
]) {
  expect(phase0ScopePaths.allowed.has(relPath), `PHASE-0 allows ${relPath}`);
}

for (const forbidden of [
  'app/package.json',
  'app/package-lock.json',
  'app/supabase/migrations/**',
  'app/src/**',
  '.github/workflows/**',
  '.execution-governance/runtime/**'
]) {
  expect(phase0ScopePaths.forbidden.has(forbidden) || phase0ScopePaths.protected.has(forbidden), `PHASE-0 protects or forbids ${forbidden}`);
}

for (const relPath of requiredMainFiles) verifyLockHash(mainPlanDir, relPath);
for (const relPath of requiredSetupFiles) verifyLockHash(setupPlanDir, relPath);

const setupContract = readJson(`${setupPlanDir}/contract.json`);
expect(setupContract.governanceFormatVersion === '2.0.0', 'setup contract uses governanceFormatVersion 2.0.0');
expect(setupContract.status.executor_checks === 'PASS', 'setup package records phase executor checks as PASS after verification');

if (phase !== 'PHASE-0') {
  failures.push(`unsupported verifier phase ${phase}; this verifier currently closes PHASE-0 package integrity only`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log(`PASS hosted-sandbox-remediation-v1-1 ${phase} verifier`);

function readOption(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function assertFile(relPath) {
  if (!existsSync(path.join(repoRoot, relPath))) failures.push(`missing required file ${relPath}`);
}

function readText(relPath) {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function flattenPhaseScope(scope, phaseId) {
  const allowed = new Set();
  const protectedSet = new Set();
  const forbidden = new Set();
  for (const record of scope.requirements || []) {
    if (record.phaseId !== phaseId) continue;
    for (const relPath of record.allowedCreatePaths || []) allowed.add(relPath.replace(/\\/g, '/'));
    for (const relPath of record.allowedModifyPaths || []) allowed.add(relPath.replace(/\\/g, '/'));
    for (const relPath of record.protectedPaths || []) protectedSet.add(relPath.replace(/\\/g, '/'));
    for (const relPath of record.forbiddenPaths || []) forbidden.add(relPath.replace(/\\/g, '/'));
  }
  return { allowed, protected: protectedSet, forbidden };
}

function verifyLockHash(planDir, relPath) {
  const lock = readJson(`${planDir}/lock.json`);
  const name = path.basename(relPath);
  const map = {
    'plan.md': 'planHash',
    'contract.json': 'contractHash',
    'scope.json': 'scopeHash',
    'acceptance.json': 'acceptanceHash'
  };
  if (!map[name]) return;
  const actual = createHash('sha256').update(readFileSync(path.join(repoRoot, relPath))).digest('hex');
  expect(lock[map[name]] === actual, `${planDir}/lock.json ${map[name]} matches ${relPath}`);
}

function findRepoRoot() {
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', shell: false });
  if (git.status !== 0) return process.cwd();
  return git.stdout.trim();
}

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { loadSchemas, validateJsonAgainstSchema } from './json-schema-validator.mjs';

export const REQUIRED_PLAN_FILES = ['plan.md', 'contract.json', 'scope.json', 'acceptance.json'];

export const REQUIRED_PHASE_SECTIONS = [
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

const FORBIDDEN_PLAN_PATTERNS = [
  /\bTBD\b/i,
  /\bTODO\b/i,
  /\bas needed\b/i,
  /\betc\.\b/i,
  /\[todo\]/i,
  /\[tbd\]/i,
  /gerekli\s+d[üu]zenlemeleri\s+yap/i,
  /uygun\s+[şs]ekilde\s+uygula/i,
  /ilgili\s+testleri\s+ekle/i,
  /make\s+the\s+necessary\s+changes/i
];

export function loadPlanPackage(repoRoot, planDir) {
  const directory = resolveInside(repoRoot, planDir);
  const files = {};
  for (const name of REQUIRED_PLAN_FILES) {
    const file = path.join(directory, name);
    if (existsSync(file)) files[name] = file;
  }
  const lockPath = path.join(directory, 'lock.json');
  if (existsSync(lockPath)) files['lock.json'] = lockPath;
  const planText = files['plan.md'] ? readFileSync(files['plan.md'], 'utf8') : '';
  return {
    repoRoot,
    planDir: directory,
    relPlanDir: normalizeRel(path.relative(repoRoot, directory)),
    files,
    planText,
    contract: readOptionalJson(files['contract.json']),
    scope: readOptionalJson(files['scope.json']),
    acceptance: readOptionalJson(files['acceptance.json']),
    lock: readOptionalJson(files['lock.json'])
  };
}

export function validatePlanPackage({ repoRoot, planDir, phaseId = null, mode = 'validate' }) {
  const pkg = loadPlanPackage(repoRoot, planDir);
  const errors = [];
  const warnings = [];
  validateRequiredFiles(pkg, mode, errors);
  if (mode === 'validate-all') {
    const disposition = legacyDispositionRecord(pkg);
    if (disposition?.disposition === 'HISTORICAL_READ_ONLY' || disposition?.disposition === 'REAUTHOR_REQUIRED') {
      warnings.push(`${pkg.relPlanDir}: legacy plan disposition ${disposition.disposition} before future lock or activation`);
      return { ok: errors.length === 0, errors, warnings, packageInfo: { contractId: pkg.contract?.contractId, planDir: pkg.relPlanDir } };
    }
  }
  validateSchemas(pkg, errors);
  validateLegacyDisposition(pkg, mode, errors, warnings);
  validateCrossFileCoverage(pkg, phaseId, errors);
  validatePlanMarkdown(pkg, errors);
  validateLockHashes(pkg, mode, errors);
  if (phaseId) validatePhaseExists(pkg, phaseId, errors);
  return { ok: errors.length === 0, errors, warnings, packageInfo: { contractId: pkg.contract?.contractId, planDir: pkg.relPlanDir } };
}

export function strictValidatePlanPackageOrThrow(args) {
  const result = validatePlanPackage(args);
  if (!result.ok) {
    const message = result.errors.map((item) => `FAIL ${item}`).join('\n');
    throw new Error(message);
  }
  return result;
}

export function selectPhaseScope(scope, phaseId) {
  const requirements = (scope.requirements || []).filter((item) => item.phaseId === phaseId);
  return { ...scope, requirements };
}

export function flattenScope(scope) {
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

export function listPlanDirectories(repoRoot) {
  const root = path.join(repoRoot, '.execution-governance', 'plans');
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .sort();
}

function validateRequiredFiles(pkg, mode, errors) {
  for (const name of REQUIRED_PLAN_FILES) {
    if (!pkg.files[name]) errors.push(`${pkg.relPlanDir}: missing required plan file ${name}`);
  }
  if (['preflight', 'postflight', 'close', 'activate'].includes(mode) && !pkg.files['lock.json']) {
    errors.push(`${pkg.relPlanDir}: missing required plan file lock.json`);
  }
}

function validateSchemas(pkg, errors) {
  const schemaDir = path.join(pkg.repoRoot, '.execution-governance', 'schemas');
  const schemas = loadSchemas(schemaDir);
  const pairs = [
    ['contract.json', 'contract.schema.json', pkg.contract],
    ['scope.json', 'scope.schema.json', pkg.scope],
    ['acceptance.json', 'acceptance.schema.json', pkg.acceptance],
    ['lock.json', 'lock.schema.json', pkg.lock]
  ];
  for (const [fileName, schemaName, value] of pairs) {
    if (!pkg.files[fileName]) continue;
    if (!value) {
      errors.push(`${pkg.relPlanDir}/${fileName}: JSON parse failed`);
      continue;
    }
    const schema = schemas.get(schemaName);
    if (!schema) {
      errors.push(`missing schema ${schemaName}`);
      continue;
    }
    const result = validateJsonAgainstSchema(value, schema, { schemas, valuePath: fileName, schemaPath: schemaName });
    errors.push(...result.errors.map((item) => `${pkg.relPlanDir}/${item}`));
  }
}

function validateLegacyDisposition(pkg, mode, errors, warnings) {
  const record = legacyDispositionRecord(pkg);
  if (!record) return;
  if (record.disposition === 'HISTORICAL_READ_ONLY' && mode === 'validate-all') {
    warnings.push(`${pkg.relPlanDir}: historical read-only package skipped for lockability`);
    return;
  }
  if (record.disposition === 'REAUTHOR_REQUIRED' && mode === 'validate-all') {
    warnings.push(`${pkg.relPlanDir}: legacy plan disposition REAUTHOR_REQUIRED before future lock or activation`);
    return;
  }
  if (record.disposition === 'REAUTHOR_REQUIRED' && ['lock', 'preflight', 'postflight', 'close', 'activate'].includes(mode)) {
    errors.push(`${pkg.relPlanDir}: legacy plan disposition REAUTHOR_REQUIRED before ${mode}`);
  }
}

function legacyDispositionRecord(pkg) {
  const disposition = readLegacyDisposition(pkg.repoRoot);
  const key = pkg.relPlanDir.replace(/^\.execution-governance\/plans\//, '');
  return disposition.packages?.[key] || null;
}

function validateCrossFileCoverage(pkg, phaseId, errors) {
  if (!pkg.contract || !pkg.scope || !pkg.acceptance) return;
  const contractId = pkg.contract.contractId;
  for (const [name, value] of [['scope.json', pkg.scope], ['acceptance.json', pkg.acceptance]]) {
    if (value.contractId !== contractId) errors.push(`${pkg.relPlanDir}/${name}: contractId ${value.contractId} does not match ${contractId}`);
  }
  const reqIds = new Set((pkg.contract.requirements || [])
    .filter((item) => item.classification === 'IN_SCOPE')
    .map((item) => item.requirementId));
  const scopeIds = new Set((pkg.scope.requirements || []).map((item) => item.requirementId));
  const acceptanceIds = new Set((pkg.acceptance.acceptanceRecords || []).map((item) => item.requirementId));
  for (const id of reqIds) {
    if (!scopeIds.has(id)) errors.push(`${pkg.relPlanDir}: requirement ${id} missing scope record`);
    if (!acceptanceIds.has(id)) errors.push(`${pkg.relPlanDir}: requirement ${id} missing acceptance record`);
  }
  for (const id of scopeIds) {
    if (!reqIds.has(id)) errors.push(`${pkg.relPlanDir}: scope record ${id} has no IN_SCOPE contract requirement`);
  }
  for (const id of acceptanceIds) {
    if (!reqIds.has(id)) errors.push(`${pkg.relPlanDir}: acceptance record ${id} has no IN_SCOPE contract requirement`);
  }
  if (pkg.contract.governanceFormatVersion === '2.0.0') {
    for (const record of pkg.scope.requirements || []) {
      if (!record.phaseId) errors.push(`${pkg.relPlanDir}: scope record ${record.requirementId} missing phaseId`);
    }
    for (const record of pkg.acceptance.acceptanceRecords || []) {
      if (!record.phaseId) errors.push(`${pkg.relPlanDir}: acceptance record ${record.requirementId} missing phaseId`);
    }
  }
  if (phaseId) {
    const phaseScopeIds = (pkg.scope.requirements || []).filter((item) => item.phaseId === phaseId).map((item) => item.requirementId);
    if (phaseScopeIds.length === 0) errors.push(`${pkg.relPlanDir}: phase ${phaseId} has no scope records`);
  }
}

function validatePlanMarkdown(pkg, errors) {
  if (!pkg.planText) return;
  if (pkg.relPlanDir === '.execution-governance/templates') return;
  if (pkg.contract?.governanceFormatVersion !== '2.0.0') return;
  const proseText = stripCodeSpans(pkg.planText);
  for (const pattern of FORBIDDEN_PLAN_PATTERNS) {
    if (pattern.test(proseText)) errors.push(`${pkg.relPlanDir}/plan.md: forbidden vague or placeholder phrase ${pattern}`);
  }
  const phases = pkg.contract.phases || [];
  for (const phase of phases) {
    if (!pkg.planText.includes(`GOV-PHASE id="${phase.phaseId}"`)) {
      errors.push(`${pkg.relPlanDir}/plan.md: missing GOV-PHASE marker for ${phase.phaseId}`);
    }
  }
  for (const req of pkg.contract.requirements || []) {
    if (req.classification !== 'IN_SCOPE') continue;
    if (!pkg.planText.includes(`GOV-REQ id="${req.requirementId}"`)) {
      errors.push(`${pkg.relPlanDir}/plan.md: missing GOV-REQ marker for ${req.requirementId}`);
    }
  }
  for (const section of REQUIRED_PHASE_SECTIONS) {
    if (!pkg.planText.includes(`GOV-SECTION id="${section}"`) && !sectionMentionedByHeading(pkg.planText, section)) {
      errors.push(`${pkg.relPlanDir}/plan.md: missing required phase section ${section}`);
    }
  }
  if (!/GOV-STEP id="[^"]+"/.test(pkg.planText)) {
    errors.push(`${pkg.relPlanDir}/plan.md: missing GOV-STEP markers`);
  }
}

function stripCodeSpans(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\r\n]*`/g, '');
}

function validateLockHashes(pkg, mode, errors) {
  if (mode === 'lock' || mode === 'validate-template' || pkg.relPlanDir === '.execution-governance/templates') return;
  if (!pkg.lock) return;
  for (const name of REQUIRED_PLAN_FILES) {
    if (!pkg.files[name]) return;
  }
  const expected = {
    planHash: sha256File(pkg.files['plan.md']),
    contractHash: sha256File(pkg.files['contract.json']),
    scopeHash: sha256File(pkg.files['scope.json']),
    acceptanceHash: sha256File(pkg.files['acceptance.json'])
  };
  for (const [key, value] of Object.entries(expected)) {
    if (pkg.lock[key] !== value) errors.push(`${pkg.relPlanDir}/lock.json: ${key} mismatch`);
  }
  if (['activate'].includes(mode)) {
    const commit = pkg.lock.lockCommit || pkg.lock.baseCommit;
    if (!/^[a-f0-9]{40}$/i.test(commit || '')) {
      errors.push(`${pkg.relPlanDir}/lock.json: activation requires lockCommit or baseCommit`);
    }
  }
}

function validatePhaseExists(pkg, phaseId, errors) {
  const phaseIds = new Set((pkg.contract?.phases || []).map((item) => item.phaseId));
  if (!phaseIds.has(phaseId)) errors.push(`${pkg.relPlanDir}: unknown phaseId ${phaseId}`);
}

function sectionMentionedByHeading(text, id) {
  const words = id.split('-').map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s-]+');
  return new RegExp(`^#{2,6}\\s+.*${words}.*$`, 'im').test(text);
}

function readOptionalJson(file) {
  if (!file) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readLegacyDisposition(repoRoot) {
  const file = path.join(repoRoot, '.execution-governance', 'policy', 'legacy-plan-disposition.json');
  if (!existsSync(file)) return { packages: {} };
  return JSON.parse(readFileSync(file, 'utf8'));
}

function resolveInside(root, inputPath) {
  const target = path.resolve(root, inputPath);
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`path escapes repository: ${inputPath}`);
  return target;
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

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function normalizeRel(value) {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '');
}

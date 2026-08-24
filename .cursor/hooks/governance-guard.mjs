#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const EVENT = process.argv[2] || 'unknown';
const REPO_ROOT = findRepoRoot(process.cwd());
const ACTIVE_PLAN_DIR = path.join(REPO_ROOT, '.execution-governance', 'active');

try {
  const payload = await readStdinJson();
  const decision = decide(EVENT, payload);
  process.stdout.write(`${JSON.stringify(decision)}\n`);
  process.exit(decision.permission === 'deny' ? 2 : 0);
} catch (error) {
  process.stdout.write(`${JSON.stringify(deny(`governance guard failed closed: ${error.message}`))}\n`);
  process.exit(2);
}

function decide(event, payload) {
  if (event === 'beforeReadFile') return guardRead(payload);
  if (event === 'beforeShellExecution') return guardShell(payload);
  if (event === 'preToolUse' || event === 'afterFileEdit') return guardFileMutation(payload);
  return allow('event not governed');
}

function guardRead(payload) {
  const paths = extractPaths(payload);
  for (const item of paths) {
    const rel = normalizeRepoPath(item);
    if (isSecretPath(rel)) {
      return deny(`Reading secret-like path is blocked by MANU-AI governance: ${rel}`);
    }
  }
  return allow('read allowed');
}

function guardShell(payload) {
  const command = extractCommand(payload);
  if (!command) return allow('no shell command found');
  const normalized = command.toLowerCase();
  const blocked = [
    /\bgit\s+push\b/,
    /\bgit\s+merge\b/,
    /\bgit\s+reset\s+--hard\b/,
    /\bgit\s+checkout\s+(--|-[^\s]*f)/,
    /\bgit\s+clean\b/,
    /\bnpm\s+(install|i|update|audit\s+fix)\b/,
    /\bpnpm\s+(install|update|add|remove)\b/,
    /\byarn\s+(install|add|remove|upgrade)\b/,
    /\bnpx\s+supabase\s+db\s+(push|reset)\b/,
    /\bsupabase\s+db\s+(push|reset)\b/,
    /\b(vercel|netlify|firebase)\s+deploy\b/,
    /\bdocker\s+compose\s+down\b/,
    /\brm\s+-rf\b/,
    /\bRemove-Item\b[\s\S]*\b-Recurse\b/i
  ];
  for (const pattern of blocked) {
    if (pattern.test(normalized) || pattern.test(command)) {
      return deny(`Shell command blocked by MANU-AI governance: ${command}`);
    }
  }
  return allow('shell allowed');
}

function guardFileMutation(payload) {
  const paths = extractPaths(payload);
  if (paths.length === 0) return allow('no file path found');
  const activeScope = loadActiveScope();
  for (const item of paths) {
    const rel = normalizeRepoPath(item);
    if (isSecretPath(rel)) return deny(`Secret-like file mutation is blocked: ${rel}`);
    if (isAlwaysForbidden(rel)) return deny(`Protected surface is blocked without explicit governance phase scope: ${rel}`);
    if (!activeScope) {
      if (!isGovernanceBootstrapPath(rel)) {
        return deny(`No active locked plan found. Product or broad repository writes are blocked: ${rel}`);
      }
      continue;
    }
    if (!isAllowedByScope(rel, activeScope)) {
      return deny(`Path is outside active governance scope: ${rel}`);
    }
  }
  return allow('file mutation allowed');
}

function loadActiveScope() {
  const scopePath = path.join(ACTIVE_PLAN_DIR, 'scope.json');
  if (!existsSync(scopePath)) return null;
  const scope = parseJsonText(readFileSync(scopePath, 'utf8'));
  const allowed = new Set();
  const protectedPaths = new Set();
  for (const requirement of scope.requirements || []) {
    for (const item of requirement.allowedCreatePaths || []) allowed.add(normalizeRel(item));
    for (const item of requirement.allowedModifyPaths || []) allowed.add(normalizeRel(item));
    for (const item of requirement.protectedPaths || []) protectedPaths.add(normalizeRel(item));
  }
  return { allowed, protectedPaths };
}

function isAllowedByScope(rel, scope) {
  if (scope.protectedPaths.has(rel)) return false;
  return scope.allowed.has(rel);
}

function isGovernanceBootstrapPath(rel) {
  return rel === 'AGENTS.md'
    || rel === '.gitignore'
    || rel === 'README.md'
    || rel === 'PLAN.md'
    || rel === 'PROJECT_PLAN.md'
    || rel === 'HANDOFF_FOR_NEXT_CODEX.md'
    || rel === 'app/README.md'
    || rel === 'docs/NEXT_PHASE_EXECUTION_PLAN.md'
    || rel === 'docs/RISK_REGISTER.md'
    || rel.startsWith('docs/execution-governance/')
    || rel.startsWith('.execution-governance/')
    || rel.startsWith('tools/execution-governance/')
    || rel.startsWith('.cursor/');
}

function isAlwaysForbidden(rel) {
  return rel === '.git/config'
    || rel.startsWith('.git/');
}

function isSecretPath(rel) {
  const name = path.basename(rel).toLowerCase();
  return name === '.env'
    || name.startsWith('.env.')
    || name.endsWith('.pem')
    || name.endsWith('.key')
    || name.includes('secret')
    || name.includes('credential');
}

function extractCommand(payload) {
  return payload.command
    || payload.shell_command
    || payload.cmd
    || payload.args?.command
    || payload.params?.command
    || payload.tool_input?.command
    || '';
}

function extractPaths(value, result = []) {
  if (!value || typeof value !== 'object') return result;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && /(^file_?path$|^path$|^target$|^destination$|^src$|^dest$|^new_path$|^old_path$)/i.test(key)) {
      result.push(item);
    } else if (Array.isArray(item)) {
      for (const nested of item) extractPaths(nested, result);
    } else if (item && typeof item === 'object') {
      extractPaths(item, result);
    }
  }
  return [...new Set(result)];
}

function normalizeRepoPath(value) {
  const absolute = path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
  const rel = path.relative(REPO_ROOT, absolute);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return normalizeRel(value);
  return normalizeRel(rel);
}

function normalizeRel(value) {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '');
}

function allow(reason) {
  return { permission: 'allow', user_message: reason };
}

function deny(message) {
  return { permission: 'deny', user_message: message };
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

function readStdinJson() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => {
      if (!input.trim()) return resolve({});
      try {
        resolve(parseJsonText(input));
      } catch (error) {
        reject(new Error(`invalid JSON payload: ${error.message}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

function parseJsonText(value) {
  const text = String(value);
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
}

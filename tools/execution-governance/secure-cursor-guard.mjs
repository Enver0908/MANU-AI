#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

const EVENT = process.argv[2] || 'unknown';
const REPO_ROOT = findRepoRoot(process.env.CURSOR_PROJECT_DIR || process.cwd());
const EXTERNAL_ROOT = process.env.MANU_GOVERNANCE_TEST_MODE === '1'
  ? process.env.MANU_GOVERNANCE_ROOT
  : 'C:\\ProgramData\\MANU-AI-Governance';
const ACTIVATION_FILE = path.join(EXTERNAL_ROOT, 'activation.json');

try {
  const payload = await readStdinJson();
  const decision = decide(EVENT, payload);
  process.stdout.write(`${JSON.stringify(decision)}\n`);
  process.exit(decision.permission === 'deny' ? 2 : 0);
} catch (error) {
  process.stdout.write(`${JSON.stringify(deny(`MANU-AI governance fail-closed: ${error.message}`))}\n`);
  process.exit(2);
}

function decide(event, payload) {
  if (event === 'beforeReadFile') return guardRead(payload);
  if (event === 'beforeShellExecution') return guardShell(payload);
  if (event === 'beforeMCPExecution') return guardMcp(payload);
  if (event === 'preToolUse') return guardPreToolUse(payload);
  if (event === 'afterFileEdit') return auditAfterFileEdit(payload);
  return deny(`Unhandled Cursor hook event: ${event}`);
}

function guardPreToolUse(payload) {
  const toolName = String(payload.tool_name || payload.toolName || payload.name || '').trim();
  if (!toolName) return deny('Cursor tool payload has no tool_name.');
  const normalized = normalizeToolName(toolName);
  if (normalized === 'read') return guardRead(payload);
  if (normalized === 'shell') return guardShell(payload);
  if (normalized === 'mcp') return guardMcp(payload);
  if (normalized === 'task') return guardTask(payload);
  if (normalized === 'write') return guardFileMutation(payload, toolName);
  return deny(`Unknown or unclassified Cursor tool is blocked: ${toolName}`);
}

function auditAfterFileEdit(payload) {
  const mutation = guardFileMutation(payload, 'afterFileEdit');
  if (mutation.permission === 'deny') {
    return deny(`Post-edit taint detected: ${mutation.user_message}`);
  }
  return allow('post-edit audit passed');
}

function guardRead(payload) {
  for (const item of extractPaths(payload)) {
    const rel = normalizeRepoPath(item);
    if (isSecretPath(rel)) {
      return deny(`Reading secret-like path is blocked: ${rel}`);
    }
  }
  return allow('read allowed');
}

function guardShell(payload) {
  const activation = loadVerifiedActivation();
  const command = extractCommand(payload);
  if (!command) return deny('Shell payload has no command.');
  const parsed = parseCommand(command);
  if (!parsed) return deny(`Shell command could not be parsed safely: ${command}`);
  const cwd = normalizeRepoPath(payload.cwd || payload.tool_input?.cwd || process.cwd());
  const allowed = activation?.scope?.allowedCommands || [];
  const match = allowed.find((item) => commandSpecMatches(item, parsed, cwd));
  if (!match) {
    return deny(`Shell command is outside the active signed command scope: ${command}`);
  }
  if (match.networkPolicy === 'FORBIDDEN' && commandMentionsNetwork(command)) {
    return deny(`Network-capable command is blocked by command networkPolicy: ${command}`);
  }
  return allow('shell command allowed by active signed scope');
}

function guardMcp(payload) {
  const activation = loadVerifiedActivation();
  const toolName = String(payload.tool_name || payload.name || payload.server_tool_name || '');
  const allowed = activation?.scope?.allowedMcpTools || [];
  if (!allowed.includes(toolName)) {
    return deny(`MCP tool is outside the active signed scope: ${toolName || 'unknown'}`);
  }
  const paths = extractPaths(payload);
  if (paths.length > 0) return guardFileMutation(payload, toolName);
  return allow('MCP tool allowed by active signed scope');
}

function guardTask(payload) {
  const activation = loadVerifiedActivation();
  if (activation?.scope?.allowSubagents === true) {
    return allow('subagent tool allowed by active signed scope');
  }
  return deny('Subagent/Task tools are blocked unless active signed scope explicitly allows them.');
}

function guardFileMutation(payload, toolName) {
  const paths = extractPaths(payload);
  if (paths.length === 0) return deny(`Mutating tool has no file path: ${toolName}`);
  const activation = loadActivation();
  for (const item of paths) {
    const rel = normalizeRepoPath(item);
    if (isSecretPath(rel)) return deny(`Secret-like file mutation is blocked: ${rel}`);
    if (isGitPath(rel)) return deny(`Git internals are never mutable through Cursor hooks: ${rel}`);
    if (!activation) return deny(`No external governance activation found. Mutation blocked: ${rel}`);
    if (!isAllowedPath(rel, activation.scope)) {
      return deny(`Path is outside active signed governance scope: ${rel}`);
    }
  }
  return allow('file mutation allowed by active signed scope');
}

function loadVerifiedActivation() {
  const activation = loadActivation();
  if (!activation) throw new Error('activation file is missing');
  assertActivationIntegrity(activation);
  return activation;
}

function loadActivation() {
  if (!existsSync(ACTIVATION_FILE)) return null;
  const activation = parseJsonText(readFileSync(ACTIVATION_FILE, 'utf8'));
  if (activation.repoRoot && normalizeFsPath(activation.repoRoot) !== normalizeFsPath(REPO_ROOT)) {
    throw new Error(`activation repoRoot mismatch: ${activation.repoRoot}`);
  }
  return activation;
}

function assertActivationIntegrity(activation) {
  if (activation.schemaVersion !== '1.0.0') throw new Error('activation schemaVersion mismatch');
  if (activation.status !== 'ACTIVE_SIGNED_SCOPE') throw new Error(`activation status is not active: ${activation.status || 'missing'}`);
  if (!activation.contractId || !activation.phaseId) throw new Error('activation identity missing');
  if (!activation.lockCommit || !/^[0-9a-f]{40}$/i.test(activation.lockCommit)) {
    throw new Error('activation lockCommit is missing or invalid');
  }
  const head = gitText(['rev-parse', 'HEAD']);
  if (activation.lockCommit !== head) {
    if (activation.allowImplementationHead !== true) {
      throw new Error(`activation lockCommit ${activation.lockCommit} does not match HEAD ${head}`);
    }
    if (!isAncestorCommit(activation.lockCommit, head)) {
      throw new Error(`activation lockCommit ${activation.lockCommit} is not an ancestor of HEAD ${head}`);
    }
  }
  if (activation.scopeHash !== sha256Json(activation.scope)) {
    throw new Error('activation scopeHash mismatch');
  }
}

function isAllowedPath(rel, scope) {
  const allowed = new Set([...(scope?.allowedCreatePaths || []), ...(scope?.allowedModifyPaths || [])].map(normalizeRel));
  const protectedPaths = (scope?.protectedPaths || []).map(normalizeRel);
  const forbidden = (scope?.forbiddenPaths || []).map(normalizeRel);
  if (matchesAny(rel, protectedPaths) || matchesAny(rel, forbidden)) return false;
  return allowed.has(rel) || matchesAny(rel, [...allowed].filter((item) => item.includes('*')));
}

function normalizeToolName(value) {
  const lower = value.toLowerCase();
  if (lower.includes('shell') || lower === 'terminal') return 'shell';
  if (lower.startsWith('mcp:') || lower.includes('mcp')) return 'mcp';
  if (lower === 'task' || lower.includes('subagent')) return 'task';
  if (lower.includes('read') || lower === 'grep' || lower === 'search') return 'read';
  if (/(write|edit|delete|move|rename|create|strreplace|multi)/i.test(value)) return 'write';
  return 'unknown';
}

function commandSpecMatches(spec, parsed, cwdRel) {
  const specCwd = normalizeRel(spec.cwd || '.');
  return normalizeExe(spec.executable) === normalizeExe(parsed.executable)
    && JSON.stringify(spec.args || []) === JSON.stringify(parsed.args)
    && (specCwd === '.' || specCwd === cwdRel);
}

function parseCommand(command) {
  const text = String(command).trim();
  if (/[;&|<>]/.test(text)) return null;
  const tokens = text.match(/"[^"]*"|'[^']*'|\S+/g);
  if (!tokens || tokens.length === 0) return null;
  const clean = tokens.map((item) => item.replace(/^["']|["']$/g, ''));
  return { executable: clean[0], args: clean.slice(1) };
}

function commandMentionsNetwork(command) {
  return /\b(curl|wget|ssh|scp|ftp|supabase|vercel|netlify|firebase|docker\s+pull|npm\s+(install|i|update|audit)|pnpm\s+(install|add|update)|yarn\s+(install|add|upgrade))\b/i.test(command);
}

function extractCommand(payload) {
  return payload.command || payload.shell_command || payload.cmd || payload.args?.command || payload.params?.command || payload.tool_input?.command || '';
}

function extractPaths(value, result = []) {
  if (!value || typeof value !== 'object') return result;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && /(^file_?path$|^path$|^target$|^destination$|^src$|^dest$|^new_path$|^old_path$|^uri$)/i.test(key)) {
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
  if (existsSync(absolute)) {
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`symlink path is not accepted: ${rel}`);
    const real = realpathSync.native(absolute);
    const realRel = path.relative(realpathSync.native(REPO_ROOT), real);
    if (realRel.startsWith('..') || path.isAbsolute(realRel)) throw new Error(`path escapes repo through realpath: ${rel}`);
  }
  return normalizeRel(rel);
}

function normalizeRel(value) {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '');
}

function matchesAny(rel, patterns) {
  return patterns.some((pattern) => pathPatternMatches(pattern, rel));
}

function pathPatternMatches(pattern, rel) {
  const normalizedPattern = normalizeRel(pattern);
  const normalizedRel = normalizeRel(rel);
  if (!normalizedPattern.includes('*')) return normalizedPattern === normalizedRel;
  const patternSegments = normalizedPattern.split('/');
  const relSegments = normalizedRel.split('/');
  return matchSegments(patternSegments, relSegments);
}

function matchSegments(patternSegments, relSegments) {
  if (patternSegments.length === 0) return relSegments.length === 0;
  const [head, ...tail] = patternSegments;
  if (head === '**') {
    return matchSegments(tail, relSegments)
      || (relSegments.length > 0 && matchSegments(patternSegments, relSegments.slice(1)));
  }
  if (relSegments.length === 0) return false;
  if (!segmentMatches(head, relSegments[0])) return false;
  return matchSegments(tail, relSegments.slice(1));
}

function segmentMatches(pattern, value) {
  if (!pattern.includes('*')) return pattern === value;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`).test(value);
}

function normalizeFsPath(value) {
  return path.resolve(value).toLowerCase();
}

function normalizeExe(value) {
  return path.basename(String(value)).toLowerCase().replace(/\.exe$/i, '');
}

function isGitPath(rel) {
  return rel === '.git' || rel.startsWith('.git/');
}

function isSecretPath(rel) {
  const name = path.basename(rel).toLowerCase();
  return name === '.env' || name.startsWith('.env.') || name.endsWith('.pem') || name.endsWith('.key') || name.includes('secret') || name.includes('credential');
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function gitText(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function isAncestorCommit(ancestor, descendant) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: false
  });
  return result.status === 0;
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

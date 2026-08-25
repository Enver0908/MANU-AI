#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const event = process.argv[2] || 'unknown';
const repoRoot = findRepoRoot(process.env.CURSOR_PROJECT_DIR || process.cwd());
const repoGuard = path.join(repoRoot, 'tools', 'execution-governance', 'secure-cursor-guard.mjs');
const externalGuard = process.env.MANU_GOVERNANCE_GUARD || 'C:\\ProgramData\\MANU-AI-Governance\\secure-cursor-guard.mjs';
const guard = existsSync(externalGuard) ? externalGuard : repoGuard;

try {
  const input = await readStdin();
  if (!existsSync(guard)) {
    deny(`MANU-AI governance guard not found: ${guard}`);
  }
  const result = spawnSync('node', [guard, event], {
    cwd: repoRoot,
    input,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    env: { ...process.env }
  });
  process.stdout.write(result.stdout || '');
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 2);
} catch (error) {
  deny(`MANU-AI governance adapter failed closed: ${error.message}`);
}

function deny(message) {
  process.stdout.write(`${JSON.stringify({ permission: 'deny', user_message: message })}\n`);
  process.exit(2);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
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

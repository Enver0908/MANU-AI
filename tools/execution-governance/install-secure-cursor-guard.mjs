#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = findRepoRoot(process.cwd());
const externalRoot = process.env.MANU_GOVERNANCE_ROOT || 'C:\\ProgramData\\MANU-AI-Governance';
const cursorSystemRoot = process.env.MANU_CURSOR_SYSTEM_ROOT || 'C:\\ProgramData\\Cursor';
const sourceGuard = path.join(repoRoot, 'tools', 'execution-governance', 'secure-cursor-guard.mjs');
const targetGuard = path.join(externalRoot, 'secure-cursor-guard.mjs');
const activationPath = path.join(externalRoot, 'activation.json');
const cursorHooksPath = path.join(cursorSystemRoot, 'hooks.json');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const verifyOnly = args.has('--verify');

if (!existsSync(sourceGuard)) fail(`source guard missing: ${sourceGuard}`);

if (!verifyOnly && !dryRun) {
  mkdirSync(externalRoot, { recursive: true });
  mkdirSync(cursorSystemRoot, { recursive: true });
  copyFileSync(sourceGuard, targetGuard);
  writeFileSync(cursorHooksPath, `${JSON.stringify(systemHooksConfig(targetGuard, process.execPath), null, 2)}\n`, 'utf8');
  if (!existsSync(activationPath)) {
    writeFileSync(activationPath, `${JSON.stringify(inactiveActivation(), null, 2)}\n`, 'utf8');
  }
  hardenAcl(externalRoot);
  hardenAcl(cursorSystemRoot);
}

const report = verifyInstall();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.status === 'PASS' ? 0 : 1);

function verifyInstall() {
  const checks = [];
  checks.push(check('source guard exists', existsSync(sourceGuard), sourceGuard));
  checks.push(check('external root exists', dryRun || existsSync(externalRoot), externalRoot));
  checks.push(check('target guard exists', dryRun || existsSync(targetGuard), targetGuard));
  if (!dryRun && existsSync(sourceGuard) && existsSync(targetGuard)) {
    checks.push(check('target guard SHA matches source', fileSha256(targetGuard) === fileSha256(sourceGuard), targetGuard));
  }
  checks.push(check('system hooks exists', dryRun || existsSync(cursorHooksPath), cursorHooksPath));
  if (!dryRun && existsSync(cursorHooksPath)) {
    const hooks = JSON.parse(readFileSync(cursorHooksPath, 'utf8'));
    checks.push(check('system hook uses external guard', JSON.stringify(hooks).includes(targetGuard.replace(/\\/g, '\\\\')) || JSON.stringify(hooks).includes(targetGuard), cursorHooksPath));
    checks.push(check('system hook pins Node executable', JSON.stringify(hooks).includes(process.execPath.replace(/\\/g, '\\\\')) || JSON.stringify(hooks).includes(process.execPath), process.execPath));
  }
  if (!dryRun && process.platform === 'win32') {
    checks.push(check('external ACL excludes broad writable Users ACE', !hasBroadWriteAce(externalRoot), externalRoot));
    checks.push(check('cursor system ACL excludes broad writable Users ACE', !hasBroadWriteAce(cursorSystemRoot), cursorSystemRoot));
    checks.push(check('external owner is admin-controlled', isAdminControlledOwner(externalRoot), ownerOf(externalRoot)));
    checks.push(check('cursor system owner is admin-controlled', isAdminControlledOwner(cursorSystemRoot), ownerOf(cursorSystemRoot)));
  }
  return {
    schemaVersion: '1.0.0',
    status: checks.every((item) => item.ok) ? 'PASS' : 'FAIL',
    repoRoot,
    externalRoot,
    cursorSystemRoot,
    dryRun,
    verifyOnly,
    checks
  };
}

function systemHooksConfig(guardPath, nodePath) {
  const command = `"${nodePath}" "${guardPath}"`;
  return {
    version: 1,
    hooks: {
      preToolUse: [{ command: `${command} preToolUse`, failClosed: true, timeout: 5 }],
      beforeShellExecution: [{ command: `${command} beforeShellExecution`, failClosed: true, timeout: 5 }],
      beforeMCPExecution: [{ command: `${command} beforeMCPExecution`, failClosed: true, timeout: 5 }],
      beforeReadFile: [{ command: `${command} beforeReadFile`, failClosed: true, timeout: 5 }],
      afterFileEdit: [{ command: `${command} afterFileEdit`, failClosed: true, timeout: 5 }]
    }
  };
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

function hardenAcl(target) {
  if (process.platform !== 'win32') return;
  const userSid = currentUserSid();
  const commands = [
    ['takeown', ['/F', target, '/A', '/R', '/D', 'Y']],
    ['icacls', [target, '/setowner', '*S-1-5-32-544', '/T', '/C']],
    ['icacls', [target, '/inheritance:r']],
    ['icacls', [target, '/grant:r', '*S-1-5-32-544:(OI)(CI)(F)', '*S-1-5-18:(OI)(CI)(F)', `*${userSid}:(OI)(CI)(RX)`]]
  ];
  for (const [exe, commandArgs] of commands) {
    const result = spawnSync(exe, commandArgs, { encoding: 'utf8', shell: false });
    if (result.status !== 0) fail(`${exe} ${commandArgs.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
}

function currentUserSid() {
  const ps = '[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value';
  const result = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', shell: false });
  if (result.status !== 0 || !/^S-1-5-21-/i.test(result.stdout.trim())) {
    fail(`could not resolve current user SID: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function hasBroadWriteAce(target) {
  const result = spawnSync('icacls', [target], { encoding: 'utf8', shell: false });
  if (result.status !== 0) return true;
  return /(BUILTIN\\Users|Everyone|Authenticated Users):\([^)]+[WMF][^)]+\)/i.test(result.stdout);
}

function isAdminControlledOwner(target) {
  const owner = ownerOf(target).toLowerCase();
  return owner.endsWith('\\administrators') || owner.endsWith('\\system') || owner === 'builtin\\administrators' || owner === 'nt authority\\system';
}

function ownerOf(target) {
  if (process.platform !== 'win32') return 'not-windows';
  const ps = `$d = New-Object System.IO.DirectoryInfo('${target.replace(/'/g, "''")}'); $d.GetAccessControl().Owner`;
  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
    encoding: 'utf8',
    shell: false
  });
  if (result.status !== 0) return `UNKNOWN: ${result.stderr || result.stdout}`;
  return result.stdout.trim();
}

function check(name, ok, detail) {
  return { name, ok, detail };
}

function fileSha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
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

function fail(message) {
  console.error(message);
  process.exit(1);
}

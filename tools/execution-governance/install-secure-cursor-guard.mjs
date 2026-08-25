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
const sourceBroker = path.join(repoRoot, 'tools', 'execution-governance', 'cursor-session-broker.mjs');
const targetBroker = path.join(externalRoot, 'cursor-session-broker.mjs');
const sourceSession = path.join(repoRoot, 'tools', 'execution-governance', 'cursor-session.mjs');
const targetLauncher = path.join(externalRoot, 'MANU-AI Cursor Session.ps1');
const desktopShortcut = path.join(resolveDesktopDirectory(), 'MANU-AI Cursor.lnk');
const activationPath = path.join(externalRoot, 'activation.json');
const cursorHooksPath = path.join(cursorSystemRoot, 'hooks.json');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const verifyOnly = args.has('--verify');

if (!existsSync(sourceGuard)) fail(`source guard missing: ${sourceGuard}`);
if (!existsSync(sourceBroker)) fail(`source broker missing: ${sourceBroker}`);
if (!existsSync(sourceSession)) fail(`source session script missing: ${sourceSession}`);

if (!verifyOnly && !dryRun) {
  mkdirSync(externalRoot, { recursive: true });
  mkdirSync(cursorSystemRoot, { recursive: true });
  copyFileSync(sourceGuard, targetGuard);
  copyFileSync(sourceBroker, targetBroker);
  writeFileSync(targetLauncher, cursorSessionLauncher(), 'utf8');
  createDesktopShortcut();
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
  checks.push(check('target broker exists', dryRun || existsSync(targetBroker), targetBroker));
  checks.push(check('cursor session launcher exists', dryRun || existsSync(targetLauncher), targetLauncher));
  checks.push(check('desktop shortcut exists', dryRun || existsSync(desktopShortcut), desktopShortcut));
  if (!dryRun && existsSync(sourceGuard) && existsSync(targetGuard)) {
    checks.push(check('target guard SHA matches source', fileSha256(targetGuard) === fileSha256(sourceGuard), targetGuard));
  }
  if (!dryRun && existsSync(sourceBroker) && existsSync(targetBroker)) {
    checks.push(check('target broker SHA matches source', fileSha256(targetBroker) === fileSha256(sourceBroker), targetBroker));
  }
  checks.push(check('system hooks exists', dryRun || existsSync(cursorHooksPath), cursorHooksPath));
  if (!dryRun && existsSync(cursorHooksPath)) {
    const hooks = JSON.parse(readFileSync(cursorHooksPath, 'utf8'));
    checks.push(check('system hook uses external guard', JSON.stringify(hooks).includes(targetGuard.replace(/\\/g, '\\\\')) || JSON.stringify(hooks).includes(targetGuard), cursorHooksPath));
    checks.push(check('system hook pins Node executable', JSON.stringify(hooks).includes(process.execPath.replace(/\\/g, '\\\\')) || JSON.stringify(hooks).includes(process.execPath), process.execPath));
    checks.push(check('system hooks contain exact governed event set', hasExactHookEvents(hooks), cursorHooksPath));
  }
  if (!dryRun && existsSync(activationPath)) {
    checks.push(check('activation file has valid fail-closed or active state shape', hasValidActivationShape(JSON.parse(readFileSync(activationPath, 'utf8'))), activationPath));
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

function createDesktopShortcut() {
  if (process.platform !== 'win32') return;
  const escapedShortcut = desktopShortcut.replace(/'/g, "''");
  const escapedLauncher = targetLauncher.replace(/'/g, "''");
  const escapedExternalRoot = externalRoot.replace(/'/g, "''");
  const ps = `$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut('${escapedShortcut}')
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "${escapedLauncher}"'
$shortcut.WorkingDirectory = '${escapedExternalRoot}'
$shortcut.IconLocation = 'powershell.exe,0'
$shortcut.Save()`;
  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
    encoding: 'utf8',
    shell: false
  });
  if (result.status !== 0) fail(`desktop shortcut creation failed: ${result.stderr || result.stdout}`);
}

function resolveDesktopDirectory() {
  const repoParent = path.dirname(repoRoot);
  if (/^(desktop|masaüstü|masaustu)$/i.test(path.basename(repoParent)) && existsSync(repoParent)) {
    return repoParent;
  }
  if (process.platform === 'win32') {
    const result = spawnSync('powershell', [
      '-NoProfile',
      '-Command',
      '[Environment]::GetFolderPath("Desktop")'
    ], {
      encoding: 'utf8',
      shell: false
    });
    const desktop = result.stdout?.trim();
    if (result.status === 0 && desktop && existsSync(desktop)) return desktop;
  }
  const fallback = path.join(process.env.USERPROFILE || externalRoot, 'Desktop');
  if (existsSync(fallback)) return fallback;
  return externalRoot;
}

function cursorSessionLauncher() {
  const escapedRepo = repoRoot.replace(/'/g, "''");
  const escapedNode = process.execPath.replace(/'/g, "''");
  const escapedSession = sourceSession.replace(/'/g, "''");
  return `$ErrorActionPreference = 'Stop'
$repo = '${escapedRepo}'
$node = '${escapedNode}'
$session = '${escapedSession}'
Set-Location -LiteralPath $repo
& $node $session status --repo $repo
Write-Host ''
Write-Host 'Activate a phase with:'
Write-Host "  & '$node' '$session' open --repo '$repo' --plan-dir '.execution-governance/plans/hosted-sandbox-remediation-v1-1' --phase-id PHASE-1 --elevate"
Write-Host ''
Read-Host 'Press Enter to close'
`;
}

function hasExactHookEvents(hooks) {
  const expected = ['afterFileEdit', 'beforeMCPExecution', 'beforeReadFile', 'beforeShellExecution', 'preToolUse'];
  const actual = Object.keys(hooks.hooks || {}).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) return false;
  return expected.every((event) => Array.isArray(hooks.hooks[event])
    && hooks.hooks[event].length === 1
    && hooks.hooks[event][0].failClosed === true
    && hooks.hooks[event][0].timeout === 5);
}

function hasValidActivationShape(activation) {
  if (activation.schemaVersion !== '1.0.0') return false;
  if (!['INACTIVE_FAIL_CLOSED', 'ACTIVE_SIGNED_SCOPE'].includes(activation.status)) return false;
  if (!activation.scope || typeof activation.scope !== 'object') return false;
  const arrayFields = ['allowedCreatePaths', 'allowedModifyPaths', 'protectedPaths', 'forbiddenPaths', 'allowedCommands', 'allowedMcpTools'];
  return arrayFields.every((field) => Array.isArray(activation.scope[field]))
    && typeof activation.scope.allowSubagents === 'boolean';
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

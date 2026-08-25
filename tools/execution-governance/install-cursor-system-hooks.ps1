$ErrorActionPreference = 'Stop'

$nodePath = 'C:\Program Files\nodejs\node.exe'
$guardPath = 'C:\ProgramData\MANU-AI-Governance\secure-cursor-guard.mjs'
$hooksPath = 'C:\ProgramData\Cursor\hooks.json'

if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf)) {
    throw "Pinned Node executable is missing: $nodePath"
}
if (-not (Test-Path -LiteralPath $guardPath -PathType Leaf)) {
    throw "External governance guard is missing: $guardPath"
}

$hooks = [ordered]@{}
foreach ($eventName in @('preToolUse', 'beforeShellExecution', 'beforeMCPExecution', 'beforeReadFile', 'afterFileEdit')) {
    $hooks[$eventName] = @(
        [ordered]@{
            command = ('"{0}" "{1}" {2}' -f $nodePath, $guardPath, $eventName)
            failClosed = $true
            timeout = 5
        }
    )
}

$configuration = [ordered]@{
    version = 1
    hooks = $hooks
}
$json = ($configuration | ConvertTo-Json -Depth 8) + "`n"
[IO.File]::WriteAllText($hooksPath, $json, [Text.UTF8Encoding]::new($false))

& icacls.exe $hooksPath /setowner '*S-1-5-32-544'
if ($LASTEXITCODE -ne 0) {
    throw "Could not assign Administrators ownership to $hooksPath"
}

$installed = Get-Content -LiteralPath $hooksPath -Raw | ConvertFrom-Json
if ($installed.hooks.preToolUse[0].command -notlike "*$nodePath*") {
    throw 'Installed Cursor system hook does not pin the expected Node executable.'
}

Write-Output 'PASS Cursor enterprise hooks installed with pinned Node executable.'

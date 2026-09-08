[CmdletBinding()]
param(
  [string]$TaskName = "828 Weather Direct Towercam Refresh",
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"
$refreshScript = Join-Path $PSScriptRoot "Refresh-Towercam.ps1"
if (-not (Test-Path -LiteralPath $refreshScript)) {
  throw "Refresh script not found: $refreshScript"
}

$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$taskCommand = "`"$powershell`" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$refreshScript`""

& schtasks.exe /Create /F /SC MINUTE /MO 15 /TN $TaskName /TR $taskCommand
if ($LASTEXITCODE -ne 0) { throw "Task Scheduler could not create the task (exit code $LASTEXITCODE)." }

Write-Output "Created '$TaskName' to run every 15 minutes as the current Windows user."
if ($RunNow) {
  & schtasks.exe /Run /TN $TaskName
  if ($LASTEXITCODE -ne 0) { throw "Task was created but could not be started (exit code $LASTEXITCODE)." }
  Write-Output "Started the first refresh."
}

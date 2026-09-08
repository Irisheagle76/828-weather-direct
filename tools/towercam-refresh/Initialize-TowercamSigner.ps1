[CmdletBinding()]
param(
  [string]$VercelWorkingDirectory = (Join-Path $env:LOCALAPPDATA "828WeatherDirect\towercam-refresh\vercel-link")
)

$ErrorActionPreference = "Stop"
$stateDirectory = Join-Path $env:LOCALAPPDATA "828WeatherDirect\towercam-refresh"
$tokenFile = Join-Path $stateDirectory "refresh-token.txt"
$projectLink = Join-Path $VercelWorkingDirectory ".vercel\project.json"

if (-not (Test-Path -LiteralPath $projectLink)) {
  throw "The temporary Vercel working directory is not linked: $VercelWorkingDirectory"
}

New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
if (Test-Path -LiteralPath $tokenFile) {
  $token = (Get-Content -LiteralPath $tokenFile -Raw).Trim()
} else {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  $token | Set-Content -LiteralPath $tokenFile -Encoding ASCII -NoNewline
}

$token | & npx --yes vercel@latest env add TOWERCAM_REFRESH_TOKEN production --sensitive --cwd $VercelWorkingDirectory
if ($LASTEXITCODE -ne 0) {
  throw "Could not add TOWERCAM_REFRESH_TOKEN to the Vercel production environment (exit code $LASTEXITCODE)."
}

Write-Output "Stored the local token and added its matching sensitive production variable to Vercel."
Write-Output "The signing route must be included in the next normal production deployment before the refresh task is enabled."

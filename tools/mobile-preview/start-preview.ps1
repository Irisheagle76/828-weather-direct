$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$previewUrl = "http://127.0.0.1:4174/mobile/#home"
$healthUrl = "http://127.0.0.1:4174/mobile/"

$existing = Get-NetTCPConnection -LocalPort 4174 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  try {
    $response = Invoke-WebRequest $healthUrl -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200 -and $response.Content -match "828 Weather Direct Mobile") {
      Write-Host "828 Mobile preview is already running: $previewUrl"
      Start-Process $previewUrl
      exit 0
    }
  } catch {}
  throw "Port 4174 is already in use by another application."
}

if (-not (Test-Path (Join-Path $repoRoot "node_modules"))) {
  throw "Dependencies are missing. Run npm install in $repoRoot first."
}

$envCandidates = @(
  (Join-Path $repoRoot ".env.local"),
  (Join-Path (Split-Path $repoRoot -Parent) "828-weather-direct\.env.local")
)
$envFile = $envCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$nodeArgs = @()
if ($envFile) { $nodeArgs += "--env-file=$envFile" }
$nodeArgs += "tools/mobile-preview/server.mjs"

$logDir = Join-Path $repoRoot ".tmp\mobile-preview"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stdout = Join-Path $logDir "server-out.log"
$stderr = Join-Path $logDir "server-error.log"

Start-Process -FilePath (Get-Command node).Source -ArgumentList $nodeArgs -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Milliseconds 250
  try {
    $response = Invoke-WebRequest $healthUrl -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
}

if (-not $ready) {
  $details = if (Test-Path $stderr) { Get-Content $stderr -Raw } else { "No server error log was created." }
  throw "Mobile preview did not start. $details"
}

Write-Host "828 Mobile preview is running: $previewUrl"
Start-Process $previewUrl

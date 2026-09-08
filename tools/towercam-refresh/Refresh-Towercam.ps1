[CmdletBinding()]
param(
  [string]$SourceImageUrl = "https://www.atms.unca.edu/currwx/towercam.jpg",
  [string]$SourceVideoUrl = "https://www.atms.unca.edu/currwx/towercamarchive/towercam.mp4",
  [string]$CloudinaryPublicId = "avlweather_towercam_latest",
  [string]$SignerUrl = "https://avlweather.com/api/router?route=towercam/upload-signature",
  [string]$StateDirectory = (Join-Path $env:LOCALAPPDATA "828WeatherDirect\towercam-refresh"),
  [string]$FfmpegPath = "ffmpeg.exe",
  [string]$CurlPath = "curl.exe",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $repoRoot ".env.local"
$stateFile = Join-Path $StateDirectory "state.json"
$candidateFile = Join-Path $StateDirectory "towercam-candidate.jpg"
$responseFile = Join-Path $StateDirectory "cloudinary-response.json"
$errorFile = Join-Path $StateDirectory "last-error.txt"
$lockFile = Join-Path $StateDirectory "refresh.lock"
$tokenFile = Join-Path $StateDirectory "refresh-token.txt"

function Write-RefreshMessage([string]$Message) {
  Write-Output "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
}

function Read-DotEnv([string]$Path) {
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $values }

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') { continue }
    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$name] = $value
  }

  return $values
}

function Get-Setting([string]$Name, [hashtable]$DotEnv) {
  $processValue = [Environment]::GetEnvironmentVariable($Name)
  if (-not [string]::IsNullOrWhiteSpace($processValue)) { return $processValue }
  return $DotEnv[$Name]
}

function Test-UsableSetting([string]$Value) {
  return -not [string]::IsNullOrWhiteSpace($Value) -and $Value -ne "[SENSITIVE]"
}

function Get-HeaderValue($Headers, [string]$Name) {
  $value = $Headers[$Name]
  if ($null -eq $value) { return "" }
  if ($value -is [System.Array]) { return ($value -join ",") }
  return [string]$value
}

function Get-Sha1Hex([string]$Value) {
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    return ([BitConverter]::ToString($sha1.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha1.Dispose()
  }
}

function Save-State($State) {
  $temporaryState = "$stateFile.tmp"
  $State | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $temporaryState -Encoding UTF8
  Move-Item -LiteralPath $temporaryState -Destination $stateFile -Force
}

New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null
$lockStream = $null

try {
  try {
    $lockStream = [System.IO.File]::Open($lockFile, 'OpenOrCreate', 'ReadWrite', 'None')
  } catch [System.IO.IOException] {
    Write-RefreshMessage "Another refresh is already running; exiting."
    exit 0
  }

  $state = $null
  if (Test-Path -LiteralPath $stateFile) {
    try { $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json } catch { $state = $null }
  }

  $sourceMode = "current-jpeg"
  try {
    $head = Invoke-WebRequest -Uri $SourceImageUrl -Method Head -UseBasicParsing -TimeoutSec 30
    if ((Get-HeaderValue $head.Headers "Content-Type") -notmatch '^image/jpeg') {
      throw "Current towercam endpoint did not return a JPEG."
    }
    $activeSourceUrl = $SourceImageUrl
  } catch {
    Write-RefreshMessage "Current JPEG is unavailable; falling back to an end-seek of the MP4."
    $sourceMode = "mp4-fallback"
    $head = Invoke-WebRequest -Uri $SourceVideoUrl -Method Head -UseBasicParsing -TimeoutSec 30
    $activeSourceUrl = $SourceVideoUrl
  }

  $fingerprint = [ordered]@{
    url = $activeSourceUrl
    mode = $sourceMode
    etag = Get-HeaderValue $head.Headers "ETag"
    lastModified = Get-HeaderValue $head.Headers "Last-Modified"
    contentLength = Get-HeaderValue $head.Headers "Content-Length"
  }

  $sourceUnchanged = $state -and
    $state.source.etag -eq $fingerprint.etag -and
    $state.source.url -eq $fingerprint.url -and
    $state.source.lastModified -eq $fingerprint.lastModified -and
    $state.source.contentLength -eq $fingerprint.contentLength

  if ($sourceUnchanged -and -not $Force) {
    $state.lastCheckedAt = (Get-Date).ToUniversalTime().ToString("o")
    Save-State $state
    Write-RefreshMessage "Source headers are unchanged; no video transfer or upload needed."
    exit 0
  }

  if ($sourceMode -eq "current-jpeg") {
    & $CurlPath --silent --show-error --fail --location --output $candidateFile $SourceImageUrl
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $candidateFile)) {
      throw "The current towercam JPEG could not be downloaded (curl exit code $LASTEXITCODE)."
    }
  } else {
    $ffmpegArgs = @(
      "-hide_banner", "-loglevel", "error", "-y",
      "-sseof", "-0.5", "-i", $SourceVideoUrl,
      "-map", "0:v:0", "-frames:v", "1",
      "-c:v", "mjpeg", "-q:v", "3", "-threads:v", "1",
      "-f", "image2", $candidateFile
    )
    & $FfmpegPath @ffmpegArgs
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $candidateFile)) {
      throw "FFmpeg did not create a fallback frame (exit code $LASTEXITCODE)."
    }
  }

  $candidateHash = (Get-FileHash -LiteralPath $candidateFile -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($state -and $state.imageSha256 -eq $candidateHash -and -not $Force) {
    $state.source = $fingerprint
    $state.lastCheckedAt = (Get-Date).ToUniversalTime().ToString("o")
    Save-State $state
    Remove-Item -LiteralPath $candidateFile -Force
    Write-RefreshMessage "Latest frame matches the published image; upload skipped."
    exit 0
  }

  $dotEnv = Read-DotEnv $envFile
  $cloudName = Get-Setting "CLOUDINARY_CLOUD_NAME" $dotEnv
  $apiKey = Get-Setting "CLOUDINARY_API_KEY" $dotEnv
  $apiSecret = Get-Setting "CLOUDINARY_API_SECRET" $dotEnv
  $timestamp = $null
  $signature = $null

  if ((Test-UsableSetting $cloudName) -and (Test-UsableSetting $apiKey) -and (Test-UsableSetting $apiSecret)) {
    $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $signaturePayload = "invalidate=true&overwrite=true&public_id=$CloudinaryPublicId&timestamp=$timestamp$apiSecret"
    $signature = Get-Sha1Hex $signaturePayload
  } else {
    $refreshToken = Get-Setting "TOWERCAM_REFRESH_TOKEN" $dotEnv
    if (-not (Test-UsableSetting $refreshToken) -and (Test-Path -LiteralPath $tokenFile)) {
      $refreshToken = (Get-Content -LiteralPath $tokenFile -Raw).Trim()
    }
    if (-not (Test-UsableSetting $refreshToken)) {
      throw "Cloudinary credentials are unavailable locally and $tokenFile does not contain a towercam refresh token."
    }

    $signedUpload = Invoke-RestMethod -Uri $SignerUrl -Method Post -Headers @{ Authorization = "Bearer $refreshToken" } -TimeoutSec 30
    $cloudName = $signedUpload.cloudName
    $apiKey = $signedUpload.apiKey
    $timestamp = $signedUpload.timestamp
    $signature = $signedUpload.signature
    $CloudinaryPublicId = $signedUpload.public_id
    if (-not (Test-UsableSetting $cloudName) -or -not (Test-UsableSetting $apiKey) -or
        -not (Test-UsableSetting $signature) -or -not (Test-UsableSetting $CloudinaryPublicId)) {
      throw "The towercam signing endpoint returned an incomplete upload configuration."
    }
  }

  $uploadUrl = "https://api.cloudinary.com/v1_1/$cloudName/image/upload"

  & $CurlPath --silent --show-error --fail-with-body --output $responseFile `
    --request POST $uploadUrl `
    --form "file=@$candidateFile;type=image/jpeg" `
    --form "api_key=$apiKey" `
    --form "timestamp=$timestamp" `
    --form "signature=$signature" `
    --form "public_id=$CloudinaryPublicId" `
    --form "overwrite=true" `
    --form "invalidate=true"

  if ($LASTEXITCODE -ne 0) {
    $detail = if (Test-Path -LiteralPath $responseFile) { Get-Content -LiteralPath $responseFile -Raw } else { "No response body." }
    throw "Cloudinary upload failed (curl exit code $LASTEXITCODE): $detail"
  }

  $upload = Get-Content -LiteralPath $responseFile -Raw | ConvertFrom-Json
  if (-not $upload.secure_url) { throw "Cloudinary upload response did not contain a secure URL." }

  $newState = [ordered]@{
    source = $fingerprint
    imageSha256 = $candidateHash
    cloudinaryPublicId = $CloudinaryPublicId
    cloudinaryVersion = $upload.version
    secureUrl = $upload.secure_url
    width = $upload.width
    height = $upload.height
    bytes = $upload.bytes
    lastCheckedAt = (Get-Date).ToUniversalTime().ToString("o")
    lastPublishedAt = (Get-Date).ToUniversalTime().ToString("o")
  }
  Save-State $newState
  Remove-Item -LiteralPath $candidateFile -Force
  if (Test-Path -LiteralPath $errorFile) { Remove-Item -LiteralPath $errorFile -Force }
  Write-RefreshMessage "Published a new $($upload.width)x$($upload.height) frame ($($upload.bytes) bytes) to Cloudinary."
} catch {
  $message = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $($_.Exception.Message)"
  $message | Set-Content -LiteralPath $errorFile -Encoding UTF8
  Write-Error $message
  exit 1
} finally {
  if ($lockStream) { $lockStream.Dispose() }
}

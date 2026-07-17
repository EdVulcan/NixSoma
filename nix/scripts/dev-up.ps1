$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$artifactDir = Join-Path $repoRoot ".artifacts"
$stateFile = Join-Path $artifactDir "dev-services.json"
$eventLogFile = if ($env:OPENCLAW_EVENT_LOG_FILE) { $env:OPENCLAW_EVENT_LOG_FILE } else { Join-Path $artifactDir "openclaw-events.jsonl" }
$operatorTokenFile = if ($env:OPENCLAW_OPERATOR_TOKEN_FILE) { $env:OPENCLAW_OPERATOR_TOKEN_FILE } else { Join-Path $artifactDir "openclaw-operator-token" }

if (-not (Test-Path $artifactDir)) {
  New-Item -ItemType Directory -Path $artifactDir | Out-Null
}

if (-not $env:OPENCLAW_OPERATOR_TOKEN -and (Test-Path $operatorTokenFile)) {
  $env:OPENCLAW_OPERATOR_TOKEN = (Get-Content -Raw -Path $operatorTokenFile).Trim()
}
if (-not $env:OPENCLAW_OPERATOR_TOKEN) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $env:OPENCLAW_OPERATOR_TOKEN = ([Convert]::ToHexString($bytes)).ToLowerInvariant()
}
Set-Content -Path $operatorTokenFile -Value $env:OPENCLAW_OPERATOR_TOKEN -Encoding ascii
$eventCredentialDir = if ($env:OPENCLAW_EVENT_HUB_CREDENTIAL_DIR) { $env:OPENCLAW_EVENT_HUB_CREDENTIAL_DIR } else { Join-Path $artifactDir "openclaw-event-hub-credentials" }
$eventTokenMapFile = if ($env:OPENCLAW_EVENT_HUB_TOKEN_MAP_FILE) { $env:OPENCLAW_EVENT_HUB_TOKEN_MAP_FILE } else { Join-Path $artifactDir "openclaw-event-hub-credential-map.json" }
$browserCredentialDir = if ($env:OPENCLAW_BROWSER_RUNTIME_CREDENTIAL_DIR) { $env:OPENCLAW_BROWSER_RUNTIME_CREDENTIAL_DIR } else { Join-Path $artifactDir "openclaw-browser-runtime-credentials" }
$browserTokenMapFile = if ($env:OPENCLAW_BROWSER_RUNTIME_CREDENTIAL_MAP_FILE) { $env:OPENCLAW_BROWSER_RUNTIME_CREDENTIAL_MAP_FILE } else { Join-Path $artifactDir "openclaw-browser-runtime-credential-map.json" }
$browserOperatorTokenFile = if ($env:OPENCLAW_BROWSER_RUNTIME_OPERATOR_TOKEN_FILE) { $env:OPENCLAW_BROWSER_RUNTIME_OPERATOR_TOKEN_FILE } else { Join-Path $browserCredentialDir "openclaw-operator" }
$eventServiceNames = @(
  "openclaw-event-hub",
  "openclaw-core",
  "openclaw-session-manager",
  "openclaw-browser-runtime",
  "openclaw-screen-sense",
  "openclaw-screen-act",
  "openclaw-system-sense",
  "openclaw-system-heal"
)
if (-not (Test-Path $eventCredentialDir)) {
  New-Item -ItemType Directory -Path $eventCredentialDir | Out-Null
}
$eventTokenMap = @{}
foreach ($name in $eventServiceNames) {
  $tokenPath = Join-Path $eventCredentialDir $name
  if (-not (Test-Path $tokenPath)) {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    [Convert]::ToHexString($bytes).ToLowerInvariant() | Set-Content -Path $tokenPath -Encoding ascii
  }
  $eventTokenMap[$name] = (Get-Content -Raw -Path $tokenPath).Trim()
}
$eventTokenMap | ConvertTo-Json -Compress | Set-Content -Path $eventTokenMapFile -Encoding ascii
Remove-Item Env:OPENCLAW_EVENT_HUB_TOKEN -ErrorAction SilentlyContinue
$env:OPENCLAW_EVENT_HUB_AUTH_REQUIRED = "1"
$env:OPENCLAW_EVENT_HUB_TOKEN_MAP_FILE = $eventTokenMapFile
$browserServiceNames = @(
  "openclaw-session-manager",
  "openclaw-screen-sense",
  "openclaw-screen-act",
  "openclaw-operator"
)
if (-not (Test-Path $browserCredentialDir)) {
  New-Item -ItemType Directory -Path $browserCredentialDir | Out-Null
}
$browserTokenMap = @{}
foreach ($name in $browserServiceNames) {
  $tokenPath = Join-Path $browserCredentialDir $name
  if (-not (Test-Path $tokenPath)) {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    [Convert]::ToHexString($bytes).ToLowerInvariant() | Set-Content -Path $tokenPath -Encoding ascii
  }
  $browserTokenMap[$name] = (Get-Content -Raw -Path $tokenPath).Trim()
}
$browserTokenMap | ConvertTo-Json -Compress | Set-Content -Path $browserTokenMapFile -Encoding ascii
Remove-Item Env:OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN -ErrorAction SilentlyContinue
$env:OPENCLAW_BROWSER_RUNTIME_AUTH_REQUIRED = "1"
$env:OPENCLAW_BROWSER_RUNTIME_CREDENTIAL_MAP_FILE = $browserTokenMapFile

function Resolve-NodeExe {
  $candidates = @(
    "C:\Program Files\nodejs\node.exe",
    (Join-Path $env:ProgramFiles "nodejs\node.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe")
  ) | Where-Object { $_ -and (Test-Path $_) }

  if ($candidates.Count -gt 0) {
    return $candidates[0]
  }

  throw "Unable to locate node.exe."
}

function Wait-Health {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [int]$TimeoutSeconds = 20
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 400
    }
  }

  return $false
}

$nodeExe = Resolve-NodeExe
$env:OPENCLAW_EVENT_LOG_FILE = $eventLogFile
$env:OPENCLAW_OPERATOR_ALLOWED_ORIGINS = if ($env:OPENCLAW_OPERATOR_ALLOWED_ORIGINS) {
  $env:OPENCLAW_OPERATOR_ALLOWED_ORIGINS
} else {
  "http://127.0.0.1:4170,http://localhost:4170"
}

$services = @(
  @{
    name = "openclaw-event-hub"
    workingDir = Join-Path $repoRoot "services\openclaw-event-hub"
    healthUrl = "http://127.0.0.1:4101/health"
  },
  @{
    name = "openclaw-core"
    workingDir = Join-Path $repoRoot "services\openclaw-core"
    healthUrl = "http://127.0.0.1:4100/health"
  },
  @{
    name = "openclaw-session-manager"
    workingDir = Join-Path $repoRoot "services\openclaw-session-manager"
    healthUrl = "http://127.0.0.1:4102/health"
  },
  @{
    name = "openclaw-browser-runtime"
    workingDir = Join-Path $repoRoot "services\openclaw-browser-runtime"
    healthUrl = "http://127.0.0.1:4103/health"
  },
  @{
    name = "openclaw-screen-sense"
    workingDir = Join-Path $repoRoot "services\openclaw-screen-sense"
    healthUrl = "http://127.0.0.1:4104/health"
  },
  @{
    name = "openclaw-screen-act"
    workingDir = Join-Path $repoRoot "services\openclaw-screen-act"
    healthUrl = "http://127.0.0.1:4105/health"
  },
  @{
    name = "openclaw-system-sense"
    workingDir = Join-Path $repoRoot "services\openclaw-system-sense"
    healthUrl = "http://127.0.0.1:4106/health"
  },
  @{
    name = "openclaw-system-heal"
    workingDir = Join-Path $repoRoot "services\openclaw-system-heal"
    healthUrl = "http://127.0.0.1:4107/health"
  },
  @{
    name = "observer-ui"
    workingDir = Join-Path $repoRoot "apps\observer-ui"
    healthUrl = "http://127.0.0.1:4170/health"
  }
)

$started = @()

foreach ($service in $services) {
  Write-Host "Starting $($service.name) ..."
  $env:OPENCLAW_EVENT_HUB_TOKEN_FILE = Join-Path $eventCredentialDir $service.name
  Remove-Item Env:OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN_FILE -ErrorAction SilentlyContinue
  Remove-Item Env:OPENCLAW_BROWSER_RUNTIME_TOKEN_FILE -ErrorAction SilentlyContinue
  Remove-Item Env:OPENCLAW_BROWSER_RUNTIME_CALLER -ErrorAction SilentlyContinue
  if ($service.name -in @("openclaw-session-manager", "openclaw-screen-sense", "openclaw-screen-act")) {
    $env:OPENCLAW_BROWSER_RUNTIME_TOKEN_FILE = Join-Path $browserCredentialDir $service.name
    $env:OPENCLAW_BROWSER_RUNTIME_CALLER = $service.name
  }
  $process = Start-Process -FilePath $nodeExe -ArgumentList "src/server.mjs" -WorkingDirectory $service.workingDir -PassThru

  if ($process.HasExited -or -not (Wait-Health -Url $service.healthUrl) -or $process.HasExited) {
    throw "Health check failed for $($service.name) at $($service.healthUrl); the replacement process did not remain alive."
  }

  $started += [pscustomobject]@{
    name = $service.name
    pid = $process.Id
    workingDir = $service.workingDir
    healthUrl = $service.healthUrl
    startedAt = (Get-Date).ToString("o")
  }

  Write-Host "$($service.name) is ready."
}

$started | ConvertTo-Json -Depth 4 | Set-Content -Path $stateFile -Encoding UTF8

Write-Host ""
Write-Host "All services are up."
Write-Host "State file: $stateFile"

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$stateFile = Join-Path $repoRoot ".artifacts\dev-services.json"

function Assert-Condition {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Read-Json {
  param([string]$Path)
  Get-Content -Raw -Path $Path | ConvertFrom-Json
}

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null
  )

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri
  }

  return Invoke-RestMethod -Method $Method -Uri $Uri -ContentType "application/json" -Body ($Body | ConvertTo-Json -Compress)
}

function Stop-ServiceByName {
  param([string]$Name)

  $services = Read-Json -Path $stateFile
  $service = $services | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if ($null -eq $service) {
    throw "Unable to find service '$Name' in $stateFile"
  }

  Stop-Process -Id $service.pid -Force
}

try {
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "dev-down.ps1") | Out-Null
} catch {
}

try {
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "dev-up.ps1")

  $warmingScreen = Invoke-Json -Method GET -Uri "http://127.0.0.1:4104/screen/current"
  Assert-Condition (@("warming_up", "ready") -contains $warmingScreen.screen.readiness) "Expected initial screen readiness to be 'warming_up' or 'ready'."

  $browser = Invoke-Json -Method POST -Uri "http://127.0.0.1:4103/browser/open" -Body @{ url = "https://example.com/state-check" }
  Assert-Condition (-not [string]::IsNullOrWhiteSpace($browser.browser.sessionId)) "Expected browser.open to return a non-empty sessionId."

  $readyScreen = Invoke-Json -Method GET -Uri "http://127.0.0.1:4104/screen/current"
  Assert-Condition ($readyScreen.screen.readiness -eq "ready") "Expected screen readiness to become 'ready' after browser.open."
  Assert-Condition (-not [string]::IsNullOrWhiteSpace($readyScreen.screen.sessionId)) "Expected ready screen state to include sessionId."

  $readyAction = Invoke-Json -Method POST -Uri "http://127.0.0.1:4105/act/mouse/click" -Body @{ x = 320; y = 240; button = "left" }
  Assert-Condition ($readyAction.action.degraded -eq $false) "Expected action in ready state to have degraded=false."

  Stop-ServiceByName -Name "openclaw-session-manager"
  Start-Sleep -Milliseconds 300

  $degradedScreen = Invoke-Json -Method GET -Uri "http://127.0.0.1:4104/screen/current"
  Assert-Condition ($degradedScreen.screen.readiness -eq "degraded") "Expected screen readiness to become 'degraded' when session-manager is unavailable."

  $degradedAction = Invoke-Json -Method POST -Uri "http://127.0.0.1:4105/act/mouse/click" -Body @{ x = 10; y = 10; button = "left" }
  Assert-Condition ($degradedAction.action.degraded -eq $true) "Expected action during degraded screen state to have degraded=true."

  [pscustomobject]@{
    warming_up = $warmingScreen.screen.readiness
    ready = @{
      readiness = $readyScreen.screen.readiness
      sessionId = $readyScreen.screen.sessionId
      actionDegraded = $readyAction.action.degraded
    }
    degraded = @{
      readiness = $degradedScreen.screen.readiness
      actionDegraded = $degradedAction.action.degraded
    }
  } | ConvertTo-Json -Depth 6
} finally {
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "dev-down.ps1") | Out-Null
}

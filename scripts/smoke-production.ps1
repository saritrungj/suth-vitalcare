param(
  [string]$RepositoryRoot
)

$ErrorActionPreference = "Stop"

$repositoryRoot = if ($RepositoryRoot) {
  (Resolve-Path -LiteralPath $RepositoryRoot).Path
} else {
  (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}
$port = if ($env:VITALCARE_SMOKE_PORT) { [int]$env:VITALCARE_SMOKE_PORT } else { 5091 }
$baseUrl = "http://127.0.0.1:$port"
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("vitalcare-smoke-" + [guid]::NewGuid().ToString("N"))
$stdoutPath = Join-Path $temporaryRoot "server.out.log"
$stderrPath = Join-Path $temporaryRoot "server.err.log"
$serverProcess = $null

New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null

try {
  if (-not (Test-Path (Join-Path $repositoryRoot "dist/index.html"))) {
    throw "dist/index.html is missing. Run pnpm build before the smoke test."
  }

  $env:NODE_ENV = "production"
  $env:VITALCARE_LOCAL_RUNTIME = "true"
  $env:PORT = [string]$port
  # Use the healthy MySQL 8.4 service configured in .env.local. This exercises
  # the same database-backed startup path used in production.
  if (-not $env:SESSION_SECRET -or $env:SESSION_SECRET.Length -lt 32) {
    $env:SESSION_SECRET = "local-smoke-session-secret-32-characters"
  }
  if (-not $env:AES_SECRET_KEY -or $env:AES_SECRET_KEY.Length -ne 64) {
    $env:AES_SECRET_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  }
  if (-not $env:LINE_CHANNEL_SECRET) {
    $env:LINE_CHANNEL_SECRET = "local-smoke-line-channel-secret"
  }
  if (-not $env:LINE_CHANNEL_ACCESS_TOKEN) {
    $env:LINE_CHANNEL_ACCESS_TOKEN = "local-smoke-line-access-token"
  }
  $env:FRONTEND_URL = $baseUrl
  $env:ALLOWED_ORIGINS = $baseUrl

  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $serverProcess = Start-Process `
    -FilePath $nodePath `
    -ArgumentList @("--import", "tsx", "server/index.ts") `
    -WorkingDirectory $repositoryRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

  $deadline = (Get-Date).AddSeconds(30)
  $health = $null
  while ((Get-Date) -lt $deadline) {
    if ($serverProcess.HasExited) {
      throw "Production server exited before becoming healthy."
    }
    try {
      $health = Invoke-RestMethod "$baseUrl/health" -TimeoutSec 2
      if ($health.status -eq "ok") { break }
    }
    catch {
      Start-Sleep -Milliseconds 300
    }
  }

  if (-not $health -or $health.status -ne "ok") {
    throw "Production server did not become healthy within 30 seconds."
  }
  if ($health.environment -ne "production") {
    throw "Health endpoint did not report the production environment."
  }

  $rootResponse = Invoke-WebRequest "$baseUrl/" -UseBasicParsing -TimeoutSec 5
  if ($rootResponse.StatusCode -ne 200 -or $rootResponse.Content -notmatch '<div id="root">') {
    throw "Production server did not serve the built SPA."
  }

  # API failures must remain JSON. This catches IIS/SPA HTML responses that
  # would otherwise surface in the browser as `Unexpected token '<'`.
  try {
    Invoke-WebRequest `
      "$baseUrl/api/users/login" `
      -Method Post `
      -ContentType "application/json" `
      -Body '{}' `
      -UseBasicParsing `
      -TimeoutSec 5 | Out-Null
    throw "Login without an access token unexpectedly succeeded."
  }
  catch {
    if (-not $_.Exception.Response) { throw }
    $loginResponse = $_.Exception.Response
    if ([int]$loginResponse.StatusCode -ne 400) {
      throw "Login validation returned $([int]$loginResponse.StatusCode), expected 400."
    }
    if ([string]$loginResponse.Headers["Content-Type"] -notmatch "application/json") {
      throw "Login validation did not return JSON."
    }
  }

  # Diagnostics are fire-and-forget from the browser and should stay fast.
  $clientLogWatch = [System.Diagnostics.Stopwatch]::StartNew()
  $clientLogResponse = Invoke-WebRequest `
    "$baseUrl/api/client-logs" `
    -Method Post `
    -ContentType "application/json" `
    -Body '{"event":"backend_login_failed","detail":{"source":"smoke"}}' `
    -UseBasicParsing `
    -TimeoutSec 5
  $clientLogWatch.Stop()
  if ($clientLogResponse.StatusCode -ne 204) {
    throw "Client diagnostics returned $($clientLogResponse.StatusCode), expected 204."
  }
  if ($clientLogWatch.ElapsedMilliseconds -gt 2000) {
    throw "Client diagnostics blocked for $($clientLogWatch.ElapsedMilliseconds)ms."
  }

  $socketResponse = Invoke-WebRequest "$baseUrl/socket.io/?EIO=4&transport=polling" -UseBasicParsing -TimeoutSec 5
  if ($socketResponse.StatusCode -ne 200 -or $socketResponse.Content -notmatch '^0\{') {
    throw "Socket.IO polling handshake failed."
  }

  Write-Host "Production smoke test passed: health, built SPA and Socket.IO are available on $baseUrl"
}
catch {
  if (Test-Path $stdoutPath) {
    Write-Host "--- server stdout ---"
    Get-Content -LiteralPath $stdoutPath
  }
  if (Test-Path $stderrPath) {
    Write-Host "--- server stderr ---"
    Get-Content -LiteralPath $stderrPath
  }
  throw
}
finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
    $serverProcess.WaitForExit()
  }
  if (Test-Path $temporaryRoot) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
}

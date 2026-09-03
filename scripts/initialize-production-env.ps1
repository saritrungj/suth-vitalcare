param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sourcePath = Join-Path $repositoryRoot ".env.production.example"
$targetPath = Join-Path $repositoryRoot ".env.production"
$buildSourcePath = Join-Path $repositoryRoot ".env.build.production.example"
$buildTargetPath = Join-Path $repositoryRoot ".env.build.production"

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Missing .env.production.example. Restore the production template before initializing."
}
if ((Test-Path -LiteralPath $targetPath) -and -not $Force) {
  Write-Host ".env.production already exists; preserving its current values."
} else {
  Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force:$Force
  Write-Host "Created .env.production from .env.production.example."
}

$contents = Get-Content -LiteralPath $targetPath -Raw
if ($contents -notmatch '(?m)^SESSION_SECRET=.{32,}$') {
  $bytes = New-Object byte[] 48
  $randomNumberGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $randomNumberGenerator.GetBytes($bytes)
  }
  finally {
    $randomNumberGenerator.Dispose()
  }
  $sessionSecret = [Convert]::ToBase64String($bytes)
  if ($contents -match '(?m)^SESSION_SECRET=.*$') {
    $contents = [regex]::Replace(
      $contents,
      '(?m)^SESSION_SECRET=.*$',
      "SESSION_SECRET=$sessionSecret"
    )
    Set-Content -LiteralPath $targetPath -Value $contents -NoNewline
  }
  else {
    Add-Content -LiteralPath $targetPath -Value "`r`n# Generated for production session signing. Keep this value stable after deployment.`r`nSESSION_SECRET=$sessionSecret"
  }
  Write-Host "Added a generated SESSION_SECRET to .env.production."
}

Write-Host "Review and rotate values as needed."

if (-not (Test-Path -LiteralPath $buildSourcePath)) {
  throw "Missing .env.build.production.example. Restore the build template before initializing."
}
if ((Test-Path -LiteralPath $buildTargetPath) -and -not $Force) {
  Write-Host ".env.build.production already exists; preserving its current values."
}
else {
  Copy-Item -LiteralPath $buildSourcePath -Destination $buildTargetPath -Force:$Force
  Write-Host "Created .env.build.production from .env.build.production.example."
}

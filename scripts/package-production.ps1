param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputRoot = Join-Path $repositoryRoot ".deploy"
$packageName = "vitalcare-production"
$packageRoot = Join-Path $outputRoot $packageName
$archivePath = Join-Path $outputRoot "$packageName.zip"

if (-not $packageRoot.StartsWith("$repositoryRoot\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to prepare a package outside the repository."
}

Push-Location $repositoryRoot
try {
  pnpm env:production:check
  if ($LASTEXITCODE -ne 0) {
    throw "Production environment validation failed."
  }

  if (-not $SkipBuild) {
    pnpm build:production
    if ($LASTEXITCODE -ne 0) {
      throw "Production build failed."
    }
  }

  if (-not (Test-Path "dist/web.config")) {
    throw "Production build is missing dist/web.config."
  }
  if (-not (Test-Path "dist/version.json")) {
    throw "Production build is missing dist/version.json."
  }
  if (Test-Path "dist/uploads") {
    throw "Production build contains runtime uploads. Refusing to package user data."
  }
  if (Select-String -LiteralPath "dist/web.config" -SimpleMatch '<webSocket enabled="true" />' -Quiet) {
    throw "dist/web.config contains the locked IIS webSocket section. Configure WebSocket at server level instead."
  }

  if (Test-Path $packageRoot) {
    Remove-Item -LiteralPath $packageRoot -Recurse -Force
  }
  if (Test-Path $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }

  New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null

  $rootFiles = @(
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "ecosystem.config.cjs",
    ".env.production.example"
  )
  foreach ($file in $rootFiles) {
    if (-not (Test-Path $file)) {
      throw "Required production file is missing: $file"
    }
    Copy-Item -LiteralPath $file -Destination $packageRoot
  }

  Copy-Item -LiteralPath "server" -Destination (Join-Path $packageRoot "server") -Recurse
  Copy-Item -LiteralPath "dist" -Destination (Join-Path $packageRoot "dist") -Recurse

  # Some backend features read source assets from public at runtime. Copy those
  # assets, but never package user-generated uploads from the local machine.
  Copy-Item -LiteralPath "public" -Destination (Join-Path $packageRoot "public") -Recurse
  $packagedUploads = Join-Path $packageRoot "public\uploads"
  if (Test-Path $packagedUploads) {
    Remove-Item -LiteralPath $packagedUploads -Recurse -Force
  }

  Compress-Archive -LiteralPath $packageRoot -DestinationPath $archivePath -CompressionLevel Optimal

  Write-Host "Production package created:"
  Write-Host $archivePath
  Write-Host "Runtime secrets and .env.build.production are NOT included. Provision .env.production on the server and preserve public/uploads."
}
finally {
  Pop-Location
}

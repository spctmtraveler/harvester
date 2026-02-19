param(
  [string]$HostName = "happydo.xyz",
  [string]$Username = "dh_dn8qrj",
  [string]$RemoteRoot = "/home/dh_dn8qrj/happydo.xyz/harvester",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$appsRoot = Join-Path $workspaceRoot "Reference Docs\apps"

if (-not (Test-Path $appsRoot)) {
  throw "Apps folder not found: $appsRoot"
}

if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
  throw "OpenSSH scp was not found on this machine."
}
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "OpenSSH ssh was not found on this machine."
}

$appDirs = Get-ChildItem -Path $appsRoot -Directory |
  Where-Object { $_.Name -match '^[0-9]{2}-' } |
  Sort-Object Name

if (-not $appDirs) {
  Write-Host "No app directories found under $appsRoot"
  exit 0
}

$uploaded = 0

$appsIndex = Join-Path $appsRoot "index.html"
if (Test-Path $appsIndex) {
  $remoteIndex = "$RemoteRoot/index.html"
  $remoteIndexTarget = "${Username}@${HostName}:$remoteIndex"

  Write-Host "Syncing apps/index.html"

  if ($DryRun) {
    Write-Host "  [dry-run] scp $appsIndex $remoteIndexTarget"
  } else {
    & scp "$appsIndex" "$remoteIndexTarget"
    if ($LASTEXITCODE -ne 0) {
      throw "Failed upload: $remoteIndexTarget"
    }

    $uploaded++
  }
}

foreach ($dir in $appDirs) {
  $localIndex = Join-Path $dir.FullName "index.html"
  if (-not (Test-Path $localIndex)) {
    continue
  }

  $remoteDir = "$RemoteRoot/$($dir.Name)"
  $remoteFile = "$remoteDir/index.html"
  $remoteTarget = "${Username}@${HostName}:$remoteFile"

  Write-Host "Syncing $($dir.Name)/index.html"

  if ($DryRun) {
    Write-Host "  [dry-run] ssh $Username@$HostName mkdir -p $remoteDir"
    Write-Host "  [dry-run] scp $localIndex $remoteTarget"
    continue
  }

  & ssh "$Username@$HostName" "mkdir -p '$remoteDir'"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create remote directory: $remoteDir"
  }

  & scp "$localIndex" "$remoteTarget"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed upload: $remoteTarget"
  }

  $uploaded++
}

if ($DryRun) {
  Write-Host "Dry run complete."
} else {
  Write-Host "Done. Uploaded $uploaded file(s)."
}

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

  # Files to sync for each app (index.html is required; styles.css and app.js are optional)
  $appFiles = @("index.html", "styles.css", "app.js") |
    Where-Object { Test-Path (Join-Path $dir.FullName $_) }

  Write-Host "Syncing $($dir.Name)/ ($($appFiles.Count) file(s))"

  if ($DryRun) {
    Write-Host "  [dry-run] ssh $Username@$HostName mkdir -p $remoteDir"
    foreach ($fname in $appFiles) {
      $localFile = Join-Path $dir.FullName $fname
      Write-Host "  [dry-run] scp $localFile ${Username}@${HostName}:$remoteDir/$fname"
    }
    continue
  }

  & ssh "$Username@$HostName" "mkdir -p '$remoteDir'"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create remote directory: $remoteDir"
  }

  foreach ($fname in $appFiles) {
    $localFile = Join-Path $dir.FullName $fname
    $remoteTarget = "${Username}@${HostName}:$remoteDir/$fname"
    & scp "$localFile" "$remoteTarget"
    if ($LASTEXITCODE -ne 0) {
      throw "Failed upload: $remoteDir/$fname"
    }
    $uploaded++
  }
}

if ($DryRun) {
  Write-Host "Dry run complete (apps)."
} else {
  Write-Host "Done. Uploaded $uploaded app file(s)."
}

# ── Sync harvester API files (PHP endpoints) ──
$apiRoot = Join-Path $appsRoot "harvester"
if (Test-Path $apiRoot) {
  $phpFiles = Get-ChildItem -Path $apiRoot -Filter "*.php" -File
  if ($phpFiles.Count -gt 0) {
    $remoteApi = "$RemoteRoot/api"
    $remoteUploads = "$RemoteRoot/uploads/images"
    Write-Host ""
    Write-Host "Syncing $($phpFiles.Count) API file(s) to $remoteApi"

    if ($DryRun) {
      Write-Host "  [dry-run] ssh $Username@$HostName mkdir -p $remoteApi $remoteUploads"
      foreach ($f in $phpFiles) {
        Write-Host "  [dry-run] scp $($f.FullName) ${Username}@${HostName}:$remoteApi/$($f.Name)"
      }
    } else {
      & ssh "$Username@$HostName" "mkdir -p '$remoteApi' '$remoteUploads'"
      if ($LASTEXITCODE -ne 0) {
        throw "Failed to create remote directories: $remoteApi, $remoteUploads"
      }
      foreach ($f in $phpFiles) {
        $target = "${Username}@${HostName}:$remoteApi/$($f.Name)"
        Write-Host "  $($f.Name)"
        & scp "$($f.FullName)" "$target"
        if ($LASTEXITCODE -ne 0) {
          Write-Host "  WARNING: Failed to upload $($f.Name)" -ForegroundColor Yellow
        } else {
          $uploaded++
        }
      }
      Write-Host "API files synced."
    }
  }
} else {
  Write-Host "No harvester/ api folder found — skipping API sync."
}

# ── Sync transcripts ──
$transcriptsRoot = Join-Path $workspaceRoot "transcripts"
if (Test-Path $transcriptsRoot) {
  $mdFiles = Get-ChildItem -Path $transcriptsRoot -Filter "*.md" -File
  if ($mdFiles.Count -gt 0) {
    $remoteTranscripts = "$RemoteRoot/transcripts"
    Write-Host ""
    Write-Host "Syncing $($mdFiles.Count) transcript(s) to $remoteTranscripts"

    if ($DryRun) {
      Write-Host "  [dry-run] ssh $Username@$HostName mkdir -p $remoteTranscripts"
      foreach ($f in $mdFiles) {
        Write-Host "  [dry-run] scp $($f.FullName) ${Username}@${HostName}:$remoteTranscripts/$($f.Name)"
      }
    } else {
      & ssh "$Username@$HostName" "mkdir -p '$remoteTranscripts'"
      if ($LASTEXITCODE -ne 0) {
        throw "Failed to create remote directory: $remoteTranscripts"
      }
      foreach ($f in $mdFiles) {
        $target = "${Username}@${HostName}:$remoteTranscripts/$($f.Name)"
        Write-Host "  $($f.Name)"
        & scp "$($f.FullName)" "$target"
        if ($LASTEXITCODE -ne 0) {
          Write-Host "  WARNING: Failed to upload $($f.Name)" -ForegroundColor Yellow
        } else {
          $uploaded++
        }
      }
      Write-Host "Transcripts synced."
    }
  }
} else {
  Write-Host "No transcripts/ folder found — skipping transcript sync."
}

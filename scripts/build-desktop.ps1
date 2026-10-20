# Build and sign Rivo Desktop for Windows
Write-Host "Building Rivo Desktop with Auto-Updater..." -ForegroundColor Cyan

$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
$keyFile = Join-Path $PSScriptRoot "..\src-tauri\rivo.key"

if (-not (Test-Path $keyFile)) {
    Write-Error "Signing key not found at $keyFile"
    exit 1
}

$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content $keyFile -Raw).Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "rivo-update-key-2026"

Set-Location (Join-Path $PSScriptRoot "..")
npx.cmd @tauri-apps/cli build

if ($LASTEXITCODE -eq 0) {
    $outDir = "release-desktop"
    $publicDownloads = "public\downloads"
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    New-Item -ItemType Directory -Path $publicDownloads -Force | Out-Null

    $latestExe = Get-ChildItem "src-tauri\target\release\bundle\nsis\*setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $latestSig = Get-ChildItem "src-tauri\target\release\bundle\nsis\*setup.exe.sig" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $builtBin = if (Test-Path "src-tauri\target\release\Rivo.exe") { "src-tauri\target\release\Rivo.exe" } else { "src-tauri\target\release\app.exe" }

    Copy-Item $builtBin -Destination "$outDir\Rivo.exe" -Force
    if ($latestExe) { 
        Copy-Item $latestExe.FullName -Destination "$outDir\Rivo_Setup.exe" -Force 
        Copy-Item $latestExe.FullName -Destination "$publicDownloads\Rivo_Setup.exe" -Force
        Copy-Item $latestExe.FullName -Destination "$publicDownloads\Rivo-v1.9.4.exe" -Force
    }
    if ($latestSig) { 
        Copy-Item $latestSig.FullName -Destination "$outDir\Rivo_Setup.exe.sig" -Force 
        Copy-Item $latestSig.FullName -Destination "$publicDownloads\Rivo_Setup.exe.sig" -Force
    }

    # Generate windows-update.json
    if ($latestSig) {
        $sigContent = (Get-Content $latestSig.FullName -Raw).Trim()
        $nowIso = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        $updateJson = @"
{
  "version": "1.9.4",
  "notes": "Added dedicated offline songs storage in app folder with verified embedded lyrics and tags.",
  "pub_date": "$nowIso",
  "platforms": {
    "windows-x86_64": {
      "signature": "$sigContent",
      "url": "https://github.com/WhooAre-you/Rivo/releases/download/v1.9.4/Rivo_Setup.exe"
    }
  }
}
"@
        $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText("$outDir\windows-update.json", $updateJson, $utf8NoBom)
        [System.IO.File]::WriteAllText("$publicDownloads\windows-update.json", $updateJson, $utf8NoBom)
        Write-Host "Generated windows-update.json successfully (UTF-8 without BOM)!" -ForegroundColor Green
    }

    Write-Host "Build complete! Files are ready in $outDir\ and $publicDownloads\" -ForegroundColor Green
} else {
    Write-Host "Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
}

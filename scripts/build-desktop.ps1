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
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    $latestExe = Get-ChildItem "src-tauri\target\release\bundle\nsis\*setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $latestSig = Get-ChildItem "src-tauri\target\release\bundle\nsis\*setup.exe.sig" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Copy-Item "src-tauri\target\release\app.exe" -Destination "$outDir\Rivo.exe" -Force
    if ($latestExe) { Copy-Item $latestExe.FullName -Destination "$outDir\Rivo_Setup.exe" -Force }
    if ($latestSig) { Copy-Item $latestSig.FullName -Destination "$outDir\Rivo_Setup.exe.sig" -Force }
    Write-Host "Build complete! Files are ready in $outDir\" -ForegroundColor Green
} else {
    Write-Host "Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
}

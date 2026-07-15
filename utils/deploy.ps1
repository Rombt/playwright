$source = "F:\testing\playwright\dist"
# $dest = "F:\testing\playwright_prod"
$dest = "F:\testing\playwright_prod_v-2"

# 👉 ДОПОЛНИТЕЛЬНЫЕ ПУТИ (редактируешь здесь)
$extraPaths = @(
    "F:\testing\playwright\browserOptions.json",
    "F:\testing\playwright\contextOptions.json",
    "F:\testing\playwright\fingerprint.config.json",
    "F:\testing\playwright\playwright.config.ts"
)

Write-Host "=============================="
Write-Host "       DEPLOY STARTED"
Write-Host "=============================="

# Проверка source
if (!(Test-Path $source)) {
    Write-Host "ERROR: Source folder not found!" -ForegroundColor Red
    exit 1
}

# Создание dest если нет
if (!(Test-Path $dest)) {
    Write-Host "Creating destination folder..."
    New-Item -ItemType Directory -Path $dest | Out-Null
}

# --- 1. Синхронизация dist ---
Write-Host "Syncing DIST..."

robocopy $source $dest /MIR /R:2 /W:2 `
    /XD "tasks" "results" "node_modules" `
    /XF "config.js" "package.json"

$robocopyExitCode = $LASTEXITCODE

# --- 2. Копирование дополнительных путей ---
Write-Host "Copying EXTRA paths..."

foreach ($path in $extraPaths) {

    if (!(Test-Path $path)) {
        Write-Host "Skipping (not found): $path" -ForegroundColor Yellow
        continue
    }

    $name = Split-Path $path -Leaf
    $target = Join-Path $dest $name

    if (Test-Path $path -PathType Container) {
        Write-Host "Copying folder: $name"
        robocopy $path $target /E /R:2 /W:2
    }
    else {
        Write-Host "Copying file: $name"
        Copy-Item $path $target -Force
    }
}

# --- 3. Синхронизация package.json ---
Write-Host "Syncing package.json dependencies..."

$devPackage = "F:\testing\playwright\package.json"
$prodPackage = Join-Path $dest "package.json"

if ((Test-Path $devPackage) -and (Test-Path $prodPackage)) {

    $dev = Get-Content $devPackage -Raw | ConvertFrom-Json
    $prod = Get-Content $prodPackage -Raw | ConvertFrom-Json

    # Обновляем только зависимости
    $prod.dependencies = $dev.dependencies
    $prod.devDependencies = $dev.devDependencies

    # Если используются
    if ($dev.PSObject.Properties.Name -contains "optionalDependencies") {
        $prod.optionalDependencies = $dev.optionalDependencies
    }

    if ($dev.PSObject.Properties.Name -contains "peerDependencies") {
        $prod.peerDependencies = $dev.peerDependencies
    }

    $prod | ConvertTo-Json -Depth 100 | Set-Content $prodPackage -Encoding UTF8

    Write-Host "package.json synchronized." -ForegroundColor Green
}
else {
    Write-Host "package.json not found. Skipping." -ForegroundColor Yellow
}

# Проверка результата
if ($robocopyExitCode -le 3) {
    Write-Host "=============================="
    Write-Host "       DEPLOY SUCCESS"
    Write-Host "==============================" -ForegroundColor Green
}
else {
    Write-Host "=============================="
    Write-Host "       DEPLOY FAILED"
    Write-Host "==============================" -ForegroundColor Red
    exit 1
}

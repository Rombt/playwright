$source = "F:\testing\playwright\dist"
$dest   = "F:\testing\playwright_prod"

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
    /XD "tasks" "results" `
    /XF "config.js" "package.json"

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
        # 👉 это папка
        Write-Host "Copying folder: $name"
        robocopy $path $target /E /R:2 /W:2
    } else {
        # 👉 это файл
        Write-Host "Copying file: $name"
        Copy-Item $path $target -Force
    }
}

# Проверка результата
if ($LASTEXITCODE -le 3) {
    Write-Host "=============================="
    Write-Host "       DEPLOY SUCCESS"
    Write-Host "==============================" -ForegroundColor Green
} else {
    Write-Host "=============================="
    Write-Host "       DEPLOY FAILED"
    Write-Host "==============================" -ForegroundColor Red
    exit 1
}

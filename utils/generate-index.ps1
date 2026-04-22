<#
generate-index.ps1
------------------

1. Краткая характеристика
Скрипт PowerShell для автоматической генерации barrel-файла (`index.ts`)
путём рекурсивного обхода файловой структуры проекта.

2. Историческая справка
Подход с barrel-файлами (`export * from ...`) широко используется в экосистеме
TypeScript/JavaScript для упрощения импортов. Со временем, в крупных проектах,
появилась необходимость автоматизировать их генерацию, что привело к созданию
подобных скриптов и инструментов (barrel generators).

3. Назначение
- Упрощает импорт модулей:
  вместо:
    import { X } from '../../types/X';
  используется:
    import { X } from '@/types';

- Централизует экспорт модулей
- Ускоряет разработку и рефакторинг структуры проекта

4. Пример использования 

Запуск:
    .\generate-index.ps1 -TargetDir "./src/common"

Результат (index.ts):
    export * from './types/IActions';
    export * from './helpers/util';

5. Параметры

-TargetDir (string)
    Целевая директория для сканирования (по умолчанию: текущая)

-OutputFile (string)
    Имя генерируемого файла (по умолчанию: index.ts)

6. Логика работы

- Рекурсивно обходит все файлы в TargetDir
- Фильтрует файлы по расширениям (.ts, .js)
- Исключает:
    - index.ts (во избежание самореференции)
    - служебные директории (node_modules, dist, build и др.)
- Преобразует пути в относительные (от TargetDir)
- Удаляет расширения файлов
- Нормализует пути (использует `/`)
- Сортирует:
    1. по уровню вложенности
    2. по алфавиту
- Генерирует строки:
    export * from './path/to/file';
- Перезаписывает OutputFile

7. Важные замечания

- Может создавать циклические зависимости при неосторожном использовании
- Может ухудшать tree-shaking в frontend-сборщиках
- Рекомендуется:
    - использовать для backend / утилит / модульной архитектуры
    - избегать чрезмерной агрегации в frontend

- При необходимости можно:
    - расширить список игнорируемых директорий
    - изменить список допустимых расширений

8. Ограничения

- Не анализирует содержимое файлов (export default / named exports)
- Работает на уровне файловой структуры
- Не учитывает алиасы (tsconfig paths)

#>

param (
    [string]$TargetDir = ".",
    [string]$OutputFile = "index.ts",
    [string[]]$Exclude = @()
)

# -----------------------------
# ⚙️ Настройки
# -----------------------------

$allowedExtensions = @(".ts", ".js")

$ignoredDirs = @(
    "node_modules",
    "dist",
    "build",
    ".git",
    ".next",
    "out"
)

# -----------------------------
# 📂 Подготовка
# -----------------------------

$basePath = (Resolve-Path $TargetDir).Path

# Нормализуем exclude (ОДИН раз)
$normalizedExcludes = $Exclude | ForEach-Object {
    try {
        (Resolve-Path $_).Path.TrimEnd('\')
    }
    catch {
        $_.TrimEnd('\')
    }
}

# -----------------------------
# 🔍 Получение файлов
# -----------------------------

$files = Get-ChildItem -Path $basePath -Recurse -File | Where-Object {

    # Расширение
    if ($_.Extension -notin $allowedExtensions) { return $false }

    # Сам index
    if ($_.Name -eq $OutputFile) { return $false }

    # Игнор стандартных папок
    foreach ($dir in $ignoredDirs) {
        if ($_.FullName -match "\\$dir\\") { return $false }
    }

    # Пользовательские exclude
    foreach ($ex in $normalizedExcludes) {

        # Абсолютный путь → строгое сравнение начала пути
        if ([System.IO.Path]::IsPathRooted($ex)) {
            $exPath = $ex + "\"
            if ($_.FullName.StartsWith($exPath, [System.StringComparison]::OrdinalIgnoreCase)) {
                return $false
            }
        }
        else {
            # Относительный путь или имя
            if ($_.FullName -like "*$ex*") {
                return $false
            }
        }
    }

    return $true
}

# -----------------------------
# 🧠 Преобразование путей
# -----------------------------

$exports = $files | ForEach-Object {

    # Относительный путь
    $relativePath = $_.FullName.Substring($basePath.Length)

    # Нормализация слэшей
    $relativePath = $relativePath -replace "\\", "/"
    $relativePath = $relativePath.TrimStart("/")

    # Удаление расширения (БЕЗ бага с точкой)
    $dir = Split-Path $relativePath
    $name = [System.IO.Path]::GetFileNameWithoutExtension($relativePath)

    if ($dir) {
        $relativePath = "$dir/$name"
    }
    else {
        $relativePath = $name
    }

    [PSCustomObject]@{
        Path  = $relativePath
        Depth = ($relativePath.Split("/").Count)
    }
}

# -----------------------------
# 🔤 Сортировка
# -----------------------------

$sorted = $exports | Sort-Object `
@{Expression = "Depth"; Ascending = $true }, `
@{Expression = "Path"; Ascending = $true }

# -----------------------------
# 🧾 Генерация контента
# -----------------------------

$content = $sorted | ForEach-Object {
    "export * from './$($_.Path)';"
}

# -----------------------------
# 💾 Запись файла
# -----------------------------

$outputPath = Join-Path $basePath $OutputFile

$content -join "`n" | Set-Content -Path $outputPath -Encoding UTF8

Write-Host "✅ index.ts сгенерирован: $outputPath"
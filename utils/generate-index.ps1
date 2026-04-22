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
    [string]$OutputFile = "index.ts"
)

# -----------------------------
# ⚙️ Настройки
# -----------------------------

# Какие файлы включаем
$allowedExtensions = @(".ts", ".js")

# Какие папки игнорируем по умолчанию
$ignoredDirs = @(
    "node_modules",
    "dist",
    "build",
    ".git",
    ".next",
    "out"
)

# Какие папки игнорируем по указанию 
[string[]]$Exclude = @()

# -----------------------------
# 📂 Подготовка
# -----------------------------

$basePath = (Resolve-Path $TargetDir).Path

# -----------------------------
# 🔍 Получение файлов
# -----------------------------

$files = Get-ChildItem -Path $basePath -Recurse -File | Where-Object {

    # Проверка расширения
    if ($_.Extension -notin $allowedExtensions) { return $false }

    # Исключаем index.ts
    if ($_.Name -eq $OutputFile) { return $false }

    # Проверка игнорируемых папок
    foreach ($dir in $ignoredDirs) {
        if ($_.FullName -match "\\$dir\\") { return $false }
    }

    # Проверка пользовательских исключений
    foreach ($ex in $Exclude) {
        if ($_.FullName -like "*$ex*") { return $false }
    }

    return $true
}

# -----------------------------
# 🧠 Преобразование путей
# -----------------------------

$exports = $files | ForEach-Object {

    $relativePath = $_.FullName.Substring($basePath.Length)

    $dir = Split-Path $relativePath
    $name = [System.IO.Path]::GetFileNameWithoutExtension($relativePath)

    if ($dir) {
        $relativePath = "$dir/$name"
    }
    else {
        $relativePath = $name
    }

    $relativePath = $relativePath -replace "\\", "/"

    $relativePath = $relativePath.TrimStart("/")

    [PSCustomObject]@{
        Path  = $relativePath
        Depth = ($relativePath.Split("/").Count)
    }
}

# -----------------------------
# 🔤 Сортировка
# -----------------------------
# 1. Сначала по глубине (папки сверху)
# 2. Потом по алфавиту

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
# 💾 Запись в файл
# -----------------------------

$outputPath = Join-Path $basePath $OutputFile

$content -join "`n" | Set-Content -Path $outputPath -Encoding UTF8

Write-Host "✅ index.ts сгенерирован: $outputPath"
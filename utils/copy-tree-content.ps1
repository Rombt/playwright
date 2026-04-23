<#
.SYNOPSIS
Рекурсивно собирает содержимое файлов из указанной папки в формат, удобный для копирования.

.DESCRIPTION
Проходит по всем файлам в BasePath (включая вложенные папки), исключая заданные расширения и директории.
Для каждого файла выводит:
- относительный путь (от RelativeTo)
- содержимое файла

Результат форматируется в виде:
--- FILE: relative/path ---
<content>

И копируется в буфер обмена, а также выводится в консоль.

.PARAMETER BasePath
Папка, содержимое которой будет обрабатываться (рекурсивно).

.PARAMETER RelativeTo
Папка, относительно которой строятся пути.
Если не указана — используется BasePath.

.PARAMETER ExcludeExtensions
Список расширений файлов, которые нужно исключить.

.PARAMETER ExcludeDirs
Список директорий, которые нужно исключить.

.EXAMPLE
.\copy-tree-content.ps1 -BasePath .

.EXAMPLE
.\copy-tree-content.ps1 -BasePath "C:\project\src" -RelativeTo "F:\testing\playwright"

.EXAMPLE
C:\scripts\copy-tree-content.ps1 -BasePath C:\projects\tokvex

.NOTES
Полезно для передачи кода в ChatGPT, документацию или для быстрого обзора проекта.

Разделение параметров:
    BasePath   — какие файлы читать
    RelativeTo — откуда считать относительные пути

Пример:
    BasePath   = C:\project\src
    RelativeTo = C:\project

    файл: C:\project\src\index.ts
    результат: src\index.ts
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$BasePath,

    [string]$RelativeTo,

    [string[]]$ExcludeExtensions = @("*.png", "*.jpg", "*.jpeg", "*.gif", "*.exe", "*.lock"),

    [string[]]$ExcludeDirs = @("node_modules", ".git", "dist", "build")
)

# Нормализуем пути
$BasePath = (Resolve-Path $BasePath).Path

if (-not $RelativeTo) {
    $RelativeTo = $BasePath
}
else {
    $RelativeTo = (Resolve-Path $RelativeTo).Path
}

$files = Get-ChildItem -Path $BasePath -Recurse -File -Exclude $ExcludeExtensions |
Where-Object {
    $full = $_.FullName
    foreach ($dir in $ExcludeDirs) {
        if ($full -match "\\$dir\\") { return $false }
    }
    return $true
} |
Sort-Object FullName

$output = foreach ($file in $files) {
    $from = New-Object System.Uri($RelativeTo + '\')
    $to = New-Object System.Uri($file.FullName)

    $relative = [System.Uri]::UnescapeDataString(
        $from.MakeRelativeUri($to).ToString()
    ).Replace('/', '\')

    @"
--- FILE: $relative ---
$(Get-Content $file.FullName -Raw)

"@
}

# В буфер обмена
$output | Set-Clipboard

# И в консоль
# $output
import * as XLSX from 'xlsx';

/**
 * Читает XLS-файл и возвращает уникальные артикулы
 * в формате:
 *
 * 4FWAW26TDJAM0935-43S
 * 4FWAW26TDJAM0935-20S
 * 4FWAW26TDJAM0938-20S
 */
export function read4fFulSku(filePath: string): string[] {
  const workbook = XLSX.readFile(filePath);

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const articles = new Set<string>();

  for (const row of rows) {
    const article = String(row['Артикул'] ?? '').trim();
    const product = String(row['Товари (роботи, послуги)'] ?? '').trim();

    console.log('article =', article);
    console.log('product =', product);

    if (!article || !product) {
      continue;
    }

    // Берём содержимое внутри последних скобок.
    // Например:
    // "4F Куртка DJAM0935 (S, KHAKI, 43S)"
    //                         -> "43S"
    const match = product.match(/\(([^()]*)\)\s*$/);

    if (!match) {
      continue;
    }

    const parts = match[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    const code = parts.at(-1);

    if (!code) {
      continue;
    }

    articles.add(`${article}-${code}`);
  }

  return [...articles];
}

import * as XLSX from 'xlsx';

export function readJackWolfskinFulSku(filePath: string): string[] {
  const workbook = XLSX.readFile(filePath);

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('Excel file does not contain worksheets');
  }

  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  // Ищем строку с заголовком "Артикул"
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => String(cell).trim() === 'Артикул'),
  );

  if (headerIndex === -1) {
    throw new Error('Column "Артикул" not found');
  }

  const columnIndex = rows[headerIndex].findIndex((cell) => String(cell).trim() === 'Артикул');

  // Собираем уникальные артикулы
  const articles = new Set<string>();

  for (const row of rows.slice(headerIndex + 1)) {
    const article = String(row[columnIndex] ?? '').trim();

    if (article) {
      articles.add(article);
    }
  }

  return [...articles];
}

/**
 * Извлекает имя бренда из имени файла вида:
 * brand_name_unprocessed-products.json
 */
export function extractBrandFromFileName(fileName: string): string {
  const suffix = '_unprocessed-products.json';

  if (!fileName.endsWith(suffix)) {
    throw new Error(`Invalid unprocessed products file name: ${fileName}`);
  }

  return fileName.slice(0, -suffix.length);
}

export function normalizeSku(sku: string): string {
  let result = sku;

  // 1. обрезаем по '*'
  const starIndex = result.indexOf('*');
  if (starIndex !== -1) {
    result = result.slice(0, starIndex);
  }

  // 2. удаляем SSxx / AWxx вместе с возможным разделителем перед ними
  result = result.replace(/(?:[\s\-*])?(SS|AW)\d{2}\s*$/i, '');

  // 3. чистка
  result = result.replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '').replace(/[\/\\]/g, '-');

  return result;
}

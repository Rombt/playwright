export function normalizeSku(sku: string): string {
  const rawSku = sku;
  const starIndex = rawSku.indexOf('*');
  const skuNormal =
    (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)
      ?.replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '')
      .replace(/[\/\\]/g, '-') ?? '';

  return skuNormal;
}

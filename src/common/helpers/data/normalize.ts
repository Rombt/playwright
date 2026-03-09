import { IDataImag, IDataImagItem } from '../../../data/entities/IDataImag';

export function normalizeAllData(source: IDataImag): IDataImag {
  const map = new Map<string, { urls: Set<string>; idProduct: number }>();

  for (const [sku, images] of Object.entries(source) as [string, IDataImagItem][]) {
    if (!map.has(sku)) {
      map.set(sku, {
        urls: new Set(),
        idProduct: images.idProduct,
      });
    }

    const entry = map.get(sku)!;

    // Проверка на совпадение idProduct
    if (entry.idProduct !== images.idProduct) {
      throw new Error(`SKU ${sku} has different idProduct values`);
    }

    for (const url of images) {
      entry.urls.add(url);
    }
  }

  const result: IDataImag = {};

  for (const [sku, { urls, idProduct }] of map.entries()) {
    const arr = [...urls] as unknown as IDataImagItem;
    arr.idProduct = idProduct;

    result[sku] = arr;
  }

  return result;
}

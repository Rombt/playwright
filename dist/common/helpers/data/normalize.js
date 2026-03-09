"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAllData = normalizeAllData;
function normalizeAllData(source) {
    const map = new Map();
    for (const [sku, images] of Object.entries(source)) {
        if (!map.has(sku)) {
            map.set(sku, {
                urls: new Set(),
                idProduct: images.idProduct,
            });
        }
        const entry = map.get(sku);
        // Проверка на совпадение idProduct
        if (entry.idProduct !== images.idProduct) {
            throw new Error(`SKU ${sku} has different idProduct values`);
        }
        for (const url of images) {
            entry.urls.add(url);
        }
    }
    const result = {};
    for (const [sku, { urls, idProduct }] of map.entries()) {
        const arr = [...urls];
        arr.idProduct = idProduct;
        result[sku] = arr;
    }
    return result;
}

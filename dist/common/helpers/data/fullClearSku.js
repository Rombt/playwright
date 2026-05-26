"use strict";
/**
 *
 *   обрезка по первому встреченному разделителю из набора:
 *      -
 *      _
 *      /
 *      (пробел)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fullClearSku = fullClearSku;
function fullClearSku(sku) {
    const rawSku = sku;
    const match = rawSku.match(/[-_\/\s]/);
    const cutIndex = match ? match.index : -1;
    const skuNormal = (cutIndex !== -1 ? rawSku.slice(0, cutIndex) : rawSku)
        .replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '')
        .replace(/[\/\\]/g, '-');
    return skuNormal;
}

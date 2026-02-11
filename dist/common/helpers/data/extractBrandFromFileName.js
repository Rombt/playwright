"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractBrandFromFileName = extractBrandFromFileName;
/**
 * Извлекает имя бренда из имени файла вида:
 * brand_name_unprocessed-products.json
 */
function extractBrandFromFileName(fileName) {
    const suffix = '_unprocessed-products.json';
    if (!fileName.endsWith(suffix)) {
        throw new Error(`Invalid unprocessed products file name: ${fileName}`);
    }
    return fileName.slice(0, -suffix.length);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnprocessedFilePath = getUnprocessedFilePath;
const path = require("path");
const appConfig_1 = require("../../../data/config/appConfig");
/**
 * Возвращает путь к файлу необработанных продуктов для конкретного бренда.
 * @param brand — название бренда
 * @returns string — путь к JSON файлу с необработанными продуктами
 */
function getUnprocessedFilePath(brand) {
    const cfg = appConfig_1.AppConfig.getInstance();
    console.log('cfg.resultsFolder = ', cfg.resultsFolder);
    return path.join(cfg.resultsFolder, brand, `${brand}_unprocessed-products.json`);
}

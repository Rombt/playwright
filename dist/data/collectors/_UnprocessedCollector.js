"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnprocessedCollector = void 0;
const fs = require("fs");
const appConfig_1 = require("../../config/appConfig");
const helpers_1 = require("../../common/helpers");
class UnprocessedCollector {
    constructor() { }
    /**
     * Возвращает массив необработанных продуктов.
     * @param brand Опционально — бренд или массив брендов. Если не указан, возвращаются продукты всех брендов.
     */
    getProducts(brand) {
        const brands = this.resolveBrands(brand);
        let products = [];
        for (const b of brands) {
            const filePath = (0, helpers_1.getUnprocessedFilePath)(b);
            const brandProducts = (0, helpers_1.readProducts)(filePath);
            products = products.concat(brandProducts);
        }
        return products;
    }
    /**
     * Возвращает список брендов, для которых есть необработанные продукты.
     *
     * Метод сканирует папку результатов, определённую в appConfig,
     * и ищет для каждого бренда файл:
     *   <brand>/<brand>_unprocessed-products.json
     *
     * Бренд попадает в результат только если файл существует
     * и содержит хотя бы один продукт.
     *
     * @returns string[] — массив названий брендов
     */
    getBrands() {
        const resultsFolder = appConfig_1.appConfig.data.resultsFolder;
        if (!fs.existsSync(resultsFolder)) {
            return [];
        }
        const brands = [];
        const entries = fs.readdirSync(resultsFolder, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const brand = entry.name;
            const filePath = (0, helpers_1.getUnprocessedFilePath)(brand);
            if (!fs.existsSync(filePath))
                continue;
            const products = (0, helpers_1.readProducts)(filePath);
            if (products.length > 0) {
                brands.push(brand);
            }
        }
        return brands;
    }
    /**
     * Возвращает количество необработанных продуктов.
     * @param brand Опционально — бренд или массив брендов. Если не указан, возвращается количество для всех брендов.
     */
    count(brand) {
        return this.getProducts(brand).length;
    }
    /**
     * Выводит краткий отчёт по брендам и количеству необработанных продуктов.
     */
    logSummary() {
        const brands = this.getBrands();
        console.log('--- Unprocessed Products Summary ---');
        for (const brand of brands) {
            const cnt = this.getProducts(brand).length;
            console.log(`${brand}: ${cnt} products`);
        }
        console.log('-----------------------------------');
    }
    // ---------- Вспомогательные методы ----------
    resolveBrands(brand) {
        if (!brand)
            return this.getBrands();
        return Array.isArray(brand) ? brand : [brand];
    }
    groupByBrand(files) {
        const result = {};
        for (const fileName in files) {
            const brand = (0, helpers_1.extractBrandFromFileName)(fileName);
            if (!result[brand]) {
                result[brand] = [];
            }
            result[brand].push(...files[fileName]);
        }
        return result;
    }
}
exports.UnprocessedCollector = UnprocessedCollector;
// ---------- Вспомогательная функция для чтения брендов ----------
function readBrandsFromFolder(folder) {
    const fs = require('fs');
    return fs
        .readdirSync(folder, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
}

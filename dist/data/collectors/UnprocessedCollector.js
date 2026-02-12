"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnprocessedCollector = void 0;
const fs = require("fs");
const path = require("path");
const appConfig_1 = require("../../data/config/appConfig");
class UnprocessedCollector {
    constructor() {
        this.config = appConfig_1.AppConfig.getInstance();
        this.resultsFolder = this.config.resultsFolder;
    }
    getProducts(brand) {
        const brands = this.normalizeBrands(brand);
        const files = this.getBrandFiles(brands);
        const products = [];
        for (const file of files) {
            const items = this.readFile(file);
            for (const item of items) {
                if (item?.error?.product) {
                    products.push(item.error.product);
                }
            }
        }
        return products;
    }
    getBrands() {
        return this.getAllBrandNames();
    }
    getPhotoCollectionTasks() {
        const brandedProducts = this.getProductsWithBrand();
        const grouped = new Map();
        for (const { brand, product } of brandedProducts) {
            if (!grouped.has(brand)) {
                grouped.set(brand, []);
            }
            grouped.get(brand).push(product);
        }
        const tasks = [];
        for (const [brand_name, products] of grouped.entries()) {
            tasks.push({
                type: 'recollect-product-photos',
                brand_id: null,
                brand_name,
                metadata: {
                    target_website: null,
                },
                products,
            });
        }
        return tasks;
    }
    getProductsWithBrand() {
        const files = this.getBrandFiles(null);
        const result = [];
        for (const file of files) {
            const brand = this.extractBrandFromFilename(file);
            if (!brand)
                continue;
            const items = this.readFile(file);
            for (const item of items) {
                if (item?.error?.product) {
                    result.push({
                        brand,
                        product: item.error.product,
                    });
                }
            }
        }
        return result;
    }
    countTotal() {
        return this.getProducts().length;
    }
    countByBrand() {
        const result = {};
        for (const brand of this.getAllBrandNames()) {
            result[brand] = this.count(brand);
        }
        return result;
    }
    count(brand) {
        return this.getProducts(brand).length;
    }
    getSummary() {
        return this.countByBrand();
    }
    logSummary() {
        const summary = this.getSummary();
        for (const [brand, count] of Object.entries(summary)) {
            console.log(`${brand}: ${count}`);
        }
    }
    // ============  helpers  ====================================
    /**
     * Normalize brand input to lowercase array.
     * undefined → null (means all brands)
     */
    normalizeBrands(brand) {
        if (!brand)
            return null;
        const brands = Array.isArray(brand) ? brand : [brand];
        const normalized = brands.map(b => b.trim().toLowerCase()).filter(Boolean);
        return normalized.length ? normalized : null;
    }
    /**
     * Returns absolute paths to brand files.
     */
    getBrandFiles(brands) {
        const allFiles = this.getAllBrandFiles();
        if (!brands) {
            return allFiles;
        }
        return allFiles.filter(file => {
            const brand = this.extractBrandFromFilename(file);
            return brand !== null && brands.includes(brand);
        });
    }
    /**
     * Returns all valid brand filenames.
     */
    getAllBrandFiles() {
        if (!fs.existsSync(this.resultsFolder)) {
            return [];
        }
        const result = [];
        const walk = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                }
                if (entry.isFile() && entry.name.endsWith('_unprocessed-products.json')) {
                    result.push(fullPath);
                }
            }
        };
        walk(this.resultsFolder);
        return result;
    }
    /**
     * Extract brand name from filename.
     */
    extractBrandFromFilename(filePath) {
        const filename = path.basename(filePath);
        const match = filename.match(/^(.+?)_unprocessed-products\.json$/);
        return match ? match[1].toLowerCase() : null;
    }
    /**
     * Returns all available brand names.
     */
    getAllBrandNames() {
        return this.getAllBrandFiles()
            .map(file => this.extractBrandFromFilename(file))
            .filter((b) => Boolean(b));
    }
    /**
     * Read and parse JSON file.
     * Returns empty array on any error.
     */
    readFile(filePath) {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(raw);
            return Array.isArray(data) ? data : [];
        }
        catch {
            return [];
        }
    }
}
exports.UnprocessedCollector = UnprocessedCollector;

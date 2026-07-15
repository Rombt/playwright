"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnprocessedCollector = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const appConfig_1 = require("../../data/config/appConfig");
class UnprocessedCollector {
    config;
    resultsFolder;
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
                const product = this.extractProduct(item);
                if (product)
                    products.push(product);
            }
        }
        return products;
    }
    getBrands() {
        return this.getAllBrandNames();
    }
    //todo добавить target URL для каждого продукта
    getPhotoCollectionTasks(mode) {
        const brandedProducts = this.getBrandedProductsForTasks();
        const grouped = new Map();
        for (const { brand, product, target_website } of brandedProducts) {
            if (!grouped.has(brand))
                grouped.set(brand, []);
            grouped.get(brand).push({ product, target_website });
        }
        const tasks = [];
        for (const [brand_name, items] of grouped.entries()) {
            const firstUrl = items[0]?.target_website ?? null;
            const task = {
                brand_id: null,
                brand_name,
                metadata: {
                    target_website: firstUrl,
                },
                products: items.map((i) => i.product),
            };
            if (mode === 'retry') {
                task.type = 'recollect-product-photos';
            }
            tasks.push(task);
        }
        return tasks;
    }
    // private getProductsWithBrand(): IBrandedProduct[] {
    //   const files = this.getBrandFiles(null);
    //   const result: IBrandedProduct[] = [];
    //   for (const file of files) {
    //     const brand = this.extractBrandFromFilename(file);
    //     if (!brand) continue;
    //     const items = this.readFile(file);
    //     for (const item of items) {
    //       const product = this.extractProduct(item);
    //       if (product) {
    //         result.push({
    //           brand,
    //           product,
    //         });
    //       }
    //     }
    //   }
    //   return result;
    // }
    getBrandedProductsForTasks() {
        const files = this.getBrandFiles(null);
        const result = [];
        for (const file of files) {
            const brand = this.extractBrandFromFilename(file);
            if (!brand)
                continue;
            const items = this.readFile(file);
            for (const item of items) {
                const product = this.extractProduct(item);
                if (product) {
                    const target_website = this.extractTargetUrl(item);
                    result.push({ brand, product, target_website });
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
    extractTargetUrl(item) {
        return item?.targetUrl ?? null;
    }
    extractProduct(item) {
        // сначала проверяем item.error.product, потом item.error.meta.product
        return item?.error?.product ?? item?.error?.meta?.product ?? null;
    }
    /**
     * Normalize brand input to lowercase array.
     * undefined → null (means all brands)
     */
    normalizeBrands(brand) {
        if (!brand)
            return null;
        const brands = Array.isArray(brand) ? brand : [brand];
        const normalized = brands.map((b) => b.trim().toLowerCase()).filter(Boolean);
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
        return allFiles.filter((file) => {
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
            .map((file) => this.extractBrandFromFilename(file))
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

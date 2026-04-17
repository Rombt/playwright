"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasePageSource = void 0;
class BasePageSource {
    imageExtractor;
    descriptionExtractor;
    // =================================================
    // =============== CORE EXECUTION ===================
    // =================================================
    async execute(targetUrl, page, options, debugMeta, sku) {
        const errors = [];
        try {
            // 1. Навигация
            await this.resolver.resolve(page, targetUrl, debugMeta);
            // 2. Extract phase
            const extraction = await this.extract(page, debugMeta);
            // 3. Сборка результата
            return this.buildResult(extraction, errors);
        }
        catch (error) {
            errors.push({
                error,
                targetUrl,
            });
            return this.buildResult({}, errors);
        }
    }
    // =================================================
    // =============== EXTRACTION =======================
    // =================================================
    async extract(page, debugMeta) {
        const result = {};
        if (this.imageExtractor) {
            try {
                result.images = await this.imageExtractor.extract(page, debugMeta);
            }
            catch (e) {
                // не валим пайплайн
            }
        }
        if (this.descriptionExtractor) {
            try {
                result.description = await this.descriptionExtractor.extract(page, debugMeta);
            }
            catch (e) {
                // не валим пайплайн
            }
        }
        return result;
    }
    // =================================================
    // =============== RESULT BUILDER ===================
    // =================================================
    buildResult(extraction, errors, sku) {
        return {
            data: {
                images: extraction.images && sku ? this.mapImages(extraction.images, sku) : undefined,
                html: extraction.description || undefined,
            },
            errors,
        };
    }
    mapImages(images, sku) {
        const items = images.map((url, index) => ({
            sku,
            url,
            index,
            idProduct: 0,
        }));
        // 👇 приводим к legacy-формату
        return {
            [sku]: items,
        };
    }
    // =================================================
    // =============== LEGACY (НЕ ТРОГАЕМ) ==============
    // =================================================
    async executeHttpRequest(request, options, debugMeta) {
        throw new Error('Not implemented');
    }
    async workerHttpRequest(request, headers, targetUrl, limiter, sku, debugMeta, loggerScope) {
        throw new Error('Not implemented');
    }
    async worker(targetUrl, page, limiter, getNext, loggerScope, sku, debugMeta) {
        if (!page) {
            throw new Error('Page is required for BasePageSource');
        }
        const result = await this.execute(targetUrl, page, {}, debugMeta);
        return [result];
    }
}
exports.BasePageSource = BasePageSource;

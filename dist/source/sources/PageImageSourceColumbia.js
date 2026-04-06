"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RateLimiter_1 = require("../../browser/limiter/RateLimiter");
const Logger_1 = require("../../data/logger/Logger");
const appConfig_1 = require("../../data/config/appConfig");
class PageImageSourceColumbia {
    constructor() {
        this.config = appConfig_1.AppConfig.getInstance();
        this.logger = Logger_1.Logger.getInstance();
    }
    workerHttpRequest(request, headers, targetUrl, limiter, sku) {
        throw new Error('Method not implemented.');
    }
    executeHttpRequest(request, options) {
        throw new Error('Method not implemented.');
    }
    supports(task) {
        return (task.metadata.target_website ===
            'https://www.columbia.com/search?q={{sku_prod}}&searchMethod=manualSearch');
    }
    async worker(targetUrl, page, limiter, getNext, loggerScope, sku, debugMeta) {
        const results = [];
        let product;
        if (typeof getNext === 'function') {
            product = getNext();
        }
        else if (getNext) {
            product = getNext;
        }
        if (!product) {
            throw new Error('Product is undefined');
        }
        loggerScope?.debug('Worker initialized with valid product', {
            component: 'DPageImageSourceColumbia',
            method: 'worker(...)',
            data: {
                targetUrl: targetUrl,
                page: page,
                product: product,
                limiter: limiter,
                sku: sku,
                debugMeta: debugMeta,
            },
        });
        results.push(await this.execute(targetUrl, page, product));
        return results;
    }
    async execute(targetUrl, page, product) {
        const errors = [];
        const images = {};
        let html = '';
        const limiter = new RateLimiter_1.RateLimiter(this.config.asyncRetry.maxDelay);
        // нормализация SKU
        const rawSku = product.sku;
        const sku = rawSku.includes('*') ? rawSku.split('*')[0] : rawSku;
        const url = targetUrl.replace('{{sku_prod}}', sku);
        try {
            await page.goto(url, { waitUntil: 'networkidle' });
            const link = page
                .locator('[data-component-id="product-tile"] > a.chakra-link[data-masterpid="' + sku + '"]')
                .first();
            const empty = page.locator('div.sf-product-empty-list-page > p.chakra-text', {
                hasText: 'We couldn’t find anything for',
            });
            try {
                await Promise.race([
                    link.waitFor({ state: 'visible', timeout: this.config.asyncRetry.maxDelay }),
                    empty.waitFor({ state: 'visible', timeout: this.config.asyncRetry.maxDelay }),
                ]);
            }
            catch {
                throw new Error(`Search result not resolved. ${sku}`);
            }
            if ((await empty.count()) > 0) {
                throw new Error(`Goods not found on the page. ${sku}`);
            }
            if ((await link.count()) === 0) {
                throw new Error('The page does not match the product SKU. ' + sku);
            }
            const relativeHref = await link.getAttribute('href');
            if (!relativeHref)
                throw new Error('Product link not found');
            const absoluteHref = new URL(relativeHref, page.url()).toString();
            await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });
            const image = page.locator('#app-main img').first();
            await image.waitFor({
                state: 'visible',
                timeout: this.config.asyncRetry.maxDelay,
            });
            const imageUrlsSet = new Set();
            // --- первая галерея ---
            const initialImages = await this.processingGallery(page);
            for (const img of initialImages) {
                imageUrlsSet.add(img);
            }
            const swatchColors = page.locator('[data-component-id="swatch-group-color"] a.chakra-button');
            await swatchColors.first().waitFor();
            const swatchCount = await swatchColors.count();
            // --- если нет цветов ---
            if (swatchCount === 0) {
                this.logger?.debug(`swatchColors not found`, {
                    component: 'PageImageSourceColumbia',
                    method: 'execute()',
                    action: 'const swatchColors = page.locator(\'[data-component-id="swatch-group-color"] a.chakra-button\')',
                    data: {
                        url: url,
                        originalSKU: product.sku,
                        sku: sku,
                    },
                });
                const imageUrls = Array.from(imageUrlsSet);
                imageUrls.idProduct = product.id_product;
                images[sku] = imageUrls;
            }
            else {
                await swatchColors.first().waitFor({
                    state: 'visible',
                    timeout: this.config.asyncRetry.maxDelay,
                });
                for (let i = 0; i < swatchCount; i++) {
                    const swatch = swatchColors.nth(i);
                    // пропускаем уже активный цвет
                    const isActive = await swatch.getAttribute('aria-pressed');
                    if (isActive === 'true')
                        continue;
                    const prevSrc = await image.getAttribute('src');
                    await swatch.click();
                    // ждём либо смену картинки, либо таймаут fallback
                    try {
                        await page.waitForFunction((prev) => {
                            const img = document.querySelector('#app-main img');
                            return img && img.getAttribute('src') !== prev;
                        }, prevSrc, { timeout: 5000 });
                    }
                    catch {
                        // fallback если сайт не меняет src (часто бывает)
                        await page.waitForTimeout(500);
                    }
                    const newImages = await this.processingGallery(page);
                    for (const img of newImages) {
                        imageUrlsSet.add(img);
                    }
                    await limiter.sleepNormal(this.config.asyncRetry.baseDelay, this.config.asyncRetry.maxDelay);
                }
                const imageUrls = Array.from(imageUrlsSet);
                imageUrls.idProduct = product.id_product;
                images[sku] = imageUrls;
            }
        }
        catch (err) {
            throw this.buildWorkerError(err, product, url);
        }
        return {
            data: {
                images,
                html,
            },
            errors,
        };
    }
    async processingGallery(page) {
        const gallery = page.locator('[data-component-id="image-gallery"]');
        try {
            await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
        }
        catch (error) {
            throw new Error('No gallery found on page');
        }
        const count = await gallery.count();
        if (count === 0)
            throw new Error('No images found on page');
        const firstImg = gallery.locator('img').first();
        await firstImg.waitFor({ state: 'attached', timeout: 15000 });
        const imageUrls = await gallery
            .locator('img')
            .evaluateAll((imgs) => imgs
            .filter((img) => img instanceof HTMLImageElement)
            .map((img) => img.src));
        if (imageUrls.length === 0)
            throw new Error('No valid image URLs found');
        return imageUrls;
    }
    buildWorkerError(err, product, targetUrl, retryable = true) {
        return {
            error: err,
            product,
            targetUrl,
        };
    }
}
exports.default = PageImageSourceColumbia;

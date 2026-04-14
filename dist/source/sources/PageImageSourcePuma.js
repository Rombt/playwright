"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RateLimiter_1 = require("../../browser/limiter/RateLimiter");
const Logger_1 = require("../../data/logger/Logger");
const appConfig_1 = require("../../data/config/appConfig");
class PageImageSourcePuma {
    config;
    logger;
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
        return (task.metadata.target_website === 'https://ua.puma.com/uk/catalogsearch/result/?q={{sku_prod}}');
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
        const rawSku = product.sku;
        const starIndex = rawSku.indexOf('*');
        const sku = starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku;
        const url = targetUrl.replace('{{sku_prod}}', sku);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const galleries = page.locator('#gallery > div.product-gallery-w');
            const empty = page.locator('div.search-no-result > h1.search-no-result__title', {
                hasText: `За запитом "${sku}" нічого не знайдено`,
            });
            try {
                await Promise.race([
                    galleries.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay }),
                    empty.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay }),
                ]);
            }
            catch {
                throw new Error(`Search result not resolved. ${sku}`);
            }
            if ((await empty.count()) > 0) {
                throw new Error(`Goods not found on the page. ${sku}`);
            }
            // проверка соответствия полученной страницы sku товара
            const selector = 'div.product-info-main > div.size-cont-row div.product-article > span.product-article__value';
            const pageSku = page.locator(selector);
            await pageSku.first().waitFor({
                state: 'attached',
                timeout: this.config.asyncRetry.maxDelay,
            });
            const elHandle = await pageSku.first().elementHandle();
            if (!elHandle) {
                throw new Error('SKU element not found in DOM');
            }
            await page.waitForFunction((selector) => {
                const el = document.querySelector(selector);
                return el && el.textContent && el.textContent.trim().length > 0;
            }, selector, { timeout: this.config.asyncRetry.maxDelay });
            const text = (await page.locator(selector).first().innerText()).trim();
            const normalizeSku = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedPageSku = normalizeSku(text);
            const normalizedExpectedSku = normalizeSku(sku);
            if (!normalizedPageSku.includes(normalizedExpectedSku)) {
                throw new Error(`The page is not match sku  ${sku}`);
            }
            const image = page
                .locator('#gallery > div.product-gallery-w div.gallery-item > div.zoom-image-gallery img')
                .first();
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
            const swatchColors = page.locator('div.product-info-main > div.colors > ul.colors__list > li.color-item > a');
            await swatchColors.first().waitFor();
            const swatchCount = await swatchColors.count();
            // --- если нет цветов ---
            if (swatchCount === 0) {
                this.logger?.debug(`swatchColors not found`, {
                    component: 'PageImageSourceColumbia',
                    method: 'execute()',
                    action: 'const swatchColors = page.locator(...)',
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
                    const isActive = await swatch.getAttribute('._active');
                    if (isActive === 'true')
                        continue;
                    const prevSrc = await image.getAttribute('src');
                    await swatch.click();
                    // ждём либо смену картинки, либо таймаут fallback
                    try {
                        await page.waitForFunction((prev) => {
                            const img = document.querySelector('#gallery > div.product-gallery-w div.gallery-item > div.zoom-image-gallery img');
                            return img && img.getAttribute('src') !== prev;
                        }, prevSrc, { timeout: 5000 });
                    }
                    catch {
                        // fallback если сайт не меняет src
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
                try {
                    // поиск описания
                    const htmlCont = page.locator('[data-pdp-description-container] > div'); //!!!
                    await htmlCont
                        .first()
                        .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
                    html = await htmlCont.innerHTML({ timeout: this.config.asyncRetry.maxDelay });
                }
                catch (error) {
                    this.logger?.debug(`Description is absent`, {
                        component: 'PageImageSourceBRS',
                        method: 'execute()',
                        action: 'const htmlCont = page.locator(\'div.product__section > [itemprop="description"]\'',
                        data: {
                            sku: sku,
                            url: url,
                        },
                    });
                }
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
        const gallery = page.locator('#gallery > div.product-gallery-w > div.product-gallery');
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
exports.default = PageImageSourcePuma;

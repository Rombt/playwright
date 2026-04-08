"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RateLimiter_1 = require("../../browser/limiter/RateLimiter");
const Logger_1 = require("../../data/logger/Logger");
const appConfig_1 = require("../../data/config/appConfig");
class PageImageSourceAvecs {
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
        return task.metadata.target_website === 'https://avecs.com/en/search-ru?search={{sku_prod}}';
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
            component: 'DPageImageSourceAvecs',
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
        // const sku = rawSku.includes('*') ? rawSku.split('*')[0] : rawSku;
        const sku = rawSku.split(/[* -]/)[0];
        const url = targetUrl.replace('{{sku_prod}}', sku);
        try {
            await page.goto(url, { waitUntil: 'networkidle' });
            //!!
            const [id, variant] = sku.split('/');
            const normalized = `${id}-${variant}`;
            const link = page.locator(`a.product-card__img img[src*="${normalized}"]`).first();
            const countLink = await link.count();
            this.logger?.debug(`The link is found on the page`, {
                component: 'PageImageSourceAvecs',
                method: 'execute()',
                action: 'link = page.locator(...)',
                data: {
                    url: url,
                    rawSku: rawSku,
                    sku: sku,
                    normalizedSku: normalized,
                    linkCount: countLink,
                },
            });
            const empty = page.locator('div.products-search p', {
                hasText: 'There is no product that matches the search criteria',
            });
            try {
                await Promise.race([
                    link.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay }),
                    empty.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay }),
                ]);
            }
            catch {
                throw new Error(`Search result not resolved. ${sku}`);
            }
            if ((await empty.count()) > 0) {
                throw new Error(`Goods not found on the page. ${sku}`);
            }
            if ((await link.count()) === 0) {
                throw new Error('The page search does not match the product SKU. ' + sku);
            }
            link.click();
            //!!
            // проверка соответствия страницы запрашиваемому sku
            const page_sku = page.locator('div.product-info_info-holder div.model-holder', {
                hasText: `${sku}`,
            });
            await page_sku
                .first()
                .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            if ((await page_sku.count()) === 0) {
                throw new Error(`The product page is not match sku  ${sku}`);
            }
            // переключить язык страницы на украинский
            const dropdown = page.locator('#form-language').first();
            await dropdown.click();
            const uaOption = dropdown.locator('a.language-select[name="uk-ua"]').first();
            await uaOption.waitFor({ state: 'visible' });
            await Promise.all([page.locator('html[lang="uk"]').waitFor(), uaOption.click()]);
            //!!
            const selectorImage = 'div.swiper-wrapper > div.swiper-slide > img';
            const image = page.locator(selectorImage).first();
            await image.waitFor({
                state: 'visible',
                timeout: this.config.asyncRetry.maxDelay,
            });
            //!!
            const selectorGallery = `div.product-main div.product-show__slider > div.swiper-wrapper`;
            const imageUrlsSet = new Set();
            // --- первая галерея ---
            const initialImages = await this.processingGallery(page, selectorGallery);
            for (const img of initialImages) {
                imageUrlsSet.add(img);
            }
            //!!
            const swatchColors = page.locator('div.product-info__colors > div.product-info__colors-btns > div.product-info__color > label');
            await swatchColors.first().waitFor();
            // так как цвета обозначены другим sku их не собираю, но могу, если что
            // const swatchCount = await swatchColors.count();
            const swatchCount = 0;
            // --- если нет цветов ---
            if (swatchCount === 0) {
                this.logger?.debug(`swatchColors not found`, {
                    component: 'PageImageSourceAvecs',
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
                const url = new URL(page.url());
                const normalized = url.origin + url.pathname;
                for (let i = 0; i < swatchCount; i++) {
                    const swatch = swatchColors.nth(i);
                    //!!
                    // пропускаем уже активный цвет
                    const link = await swatch.getAttribute('data-link');
                    if (link === normalized)
                        continue;
                    const prevSrc = await image.getAttribute('src');
                    await swatch.click();
                    // ждём либо смену картинки, либо таймаут fallback
                    try {
                        await page.waitForFunction((prev) => {
                            const img = document.querySelector(selectorImage);
                            return img && img.getAttribute('src') !== prev;
                        }, prevSrc, { timeout: 5000 });
                    }
                    catch {
                        // fallback если сайт не меняет src (часто бывает)
                        await page.waitForTimeout(500);
                    }
                    const newImages = await this.processingGallery(page, selectorGallery);
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
    async processingGallery(page, selectorGallery) {
        const gallery = page.locator(selectorGallery);
        const countGallery = await gallery.count();
        this.logger?.debug(`The gallery is found on the page`, {
            component: 'PageImageSourceAvecs',
            method: 'processingGallery()',
            action: 'age.locator(selectorGallery)',
            data: {
                galleryCount: countGallery,
            },
        });
        await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
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
exports.default = PageImageSourceAvecs;

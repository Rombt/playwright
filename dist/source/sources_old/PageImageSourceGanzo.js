"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Logger_1 = require("../../data/logger/Logger");
const appConfig_1 = require("../../data/config/appConfig");
class PageImageSourceGanzo {
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
        return task.metadata.target_website === 'https://ganzo.ua/search?search={{sku_prod}}';
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
        const rawSku = product.sku;
        const starIndex = rawSku.indexOf('*');
        const sku = (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '') ?? '';
        const url = targetUrl.replace('{{sku_prod}}', sku);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const link = page
                .locator('#block-personal-content > div > div > div > div > div > div > div > div.product-teaser__top > div > div.product-teaser__image--wrapper > a')
                .first();
            const empty = page.locator('.view-empty > p', {
                hasText: 'нічого не знайдено',
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
            //***---------------------------------------------------------------------
            const relativeHref = await link.getAttribute('href');
            if (!relativeHref)
                throw new Error('Product link not found');
            const absoluteHref = new URL(relativeHref, page.url()).toString();
            await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });
            const page_sku = page.locator('div.product-full__code div.field-product-vendor-code__item', {
                hasText: `${sku}`,
            });
            await page_sku
                .first()
                .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            if ((await page_sku.count()) === 0) {
                throw new Error(`The page is not match sku  ${sku}`);
            }
            const gallery = page.locator('#block-personal-content > div > div > div > div.product-full__top > div.product-full__top--left.product-full__top-item > div.product-full__gallery.swiper-arrow-style-2.swiper-arrow-style-min > div > div.product-gl__images');
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
            await firstImg.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            const imageUrls = await gallery
                .locator('img')
                .evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')).filter(Boolean));
            const absoluteImageUrls = imageUrls.map((src) => new URL(src, page.url()).toString());
            if (absoluteImageUrls.length === 0)
                throw new Error('No valid image URLs found');
            try {
                // поиск описания
                const htmlCont = page.locator('div.field-product-desc__item.field__item');
                await htmlCont
                    .first()
                    .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
                // удаляю видео ролики
                html = await htmlCont.evaluate((el) => {
                    el.querySelectorAll('div').forEach((div) => div.remove());
                    return el.innerHTML;
                });
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
            images[sku] = absoluteImageUrls;
            images[sku].idProduct = product.id_product;
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
    buildWorkerError(err, product, targetUrl, retryable = true) {
        return {
            error: err,
            product,
            targetUrl,
        };
    }
}
exports.default = PageImageSourceGanzo;

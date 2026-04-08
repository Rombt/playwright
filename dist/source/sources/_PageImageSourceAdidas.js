"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const appConfig_1 = require("../../data/config/appConfig");
class PageImageSourceAdidas {
    config;
    constructor() {
        this.config = appConfig_1.AppConfig.getInstance();
    }
    workerHttpRequest(request, headers, targetUrl, limiter, sku) {
        throw new Error('Method not implemented.');
    }
    executeHttpRequest(request, options) {
        throw new Error('Method not implemented.');
    }
    supports(task) {
        return task.metadata.target_website === 'https://www.adidas.ua/search?s={{sku_prod}}';
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
        const data = {};
        const rawSku = product.sku;
        const starIndex = rawSku.indexOf('*');
        const sku = starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku;
        const url = targetUrl.replace('{{sku_prod}}', sku);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const link = page
                .locator('div.list.store__list > div > div > div.product__image > a')
                .first();
            await link.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            const relativeHref = await link.getAttribute('href');
            if (!relativeHref)
                throw new Error('Product link not found');
            const absoluteHref = new URL(relativeHref, page.url()).toString();
            console.log('===>>  absoluteHref = ', absoluteHref);
            await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });
            const gallery = page.locator('#gallery > div > div.slider__carousel.slick-slider.slick-initialized > div > div');
            try {
                await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            }
            catch (error) {
                throw new Error('No gallery found on page');
            }
            const count = await gallery.count();
            if (count === 0)
                throw new Error('No images found on page');
            const images = gallery.locator('img');
            await images.first().waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            const imageUrls = await images.evaluateAll((imgs) => imgs
                .filter((img) => img instanceof HTMLImageElement)
                .map((img) => img.getAttribute('data-src') || img.getAttribute('data-srcset'))
                .filter((src) => Boolean(src)));
            if (imageUrls.length === 0)
                throw new Error('No valid image URLs found');
            data[sku] = imageUrls;
            data[sku].idProduct = product.id_product;
        }
        catch (err) {
            throw this.buildWorkerError(err, product, url);
        }
        return { data, errors };
    }
    buildWorkerError(err, product, targetUrl, retryable = true) {
        return {
            error: err,
            product,
            targetUrl,
        };
    }
}
exports.default = PageImageSourceAdidas;
